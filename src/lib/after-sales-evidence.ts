import { createHash, randomBytes, randomInt } from "node:crypto";
import { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import sharp from "sharp";

export const sessionCookieName = "jq_after_sales_session";

export function sha256(value: string) {
 return createHash("sha256").update(value).digest("hex");
}

export function newCode() {
 return String(randomInt(0, 1000000)).padStart(6, "0");
}

export function newSessionToken() {
 return randomBytes(32).toString("hex");
}

export async function readBoundedJson<T>(request: Request, maxBytes: number): Promise<T> {
 const contentLength = request.headers.get("content-length");
 if (contentLength !== null) {
  const declaredLength = Number(contentLength);
  if (!Number.isSafeInteger(declaredLength) || declaredLength < 0 || declaredLength > maxBytes) {
   throw new Error("Request body is too large.");
  }
 }
 if (!request.body) throw new Error("Request body is required.");

 const reader = request.body.getReader();
 const chunks: Uint8Array[] = [];
 let total = 0;
 try {
  while (true) {
   const { done, value } = await reader.read();
   if (done) break;
   total += value.byteLength;
   if (total > maxBytes) {
    await reader.cancel();
    throw new Error("Request body is too large.");
   }
   chunks.push(value);
  }
 } finally {
  reader.releaseLock();
 }

 const bytes = new Uint8Array(total);
 let offset = 0;
 for (const chunk of chunks) {
  bytes.set(chunk, offset);
  offset += chunk.byteLength;
 }
 return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) as T;
}

export function getEvidenceClient() {
 const account = process.env.R2_ACCOUNT_ID;
 const key = process.env.R2_ACCESS_KEY_ID;
 const secret = process.env.R2_SECRET_ACCESS_KEY;
 const bucket = process.env.R2_AFTER_SALES_BUCKET;
 if (!account || !key || !secret || !bucket) throw new Error("Evidence storage is not configured.");
 return {
  bucket,
  client: new S3Client({
   region: "auto",
   endpoint: `https://${account}.r2.cloudflarestorage.com`,
   credentials: { accessKeyId: key, secretAccessKey: secret },
  }),
 };
}

export async function createEvidenceUploadUrl(key: string, contentType: string, size: number) {
 const { bucket, client } = getEvidenceClient();
 return getSignedUrl(
  client,
  new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType, ContentLength: size }),
  { expiresIn: 300 },
 );
}

function hasExpectedFileSignature(type: string, bytes: Uint8Array) {
 const ascii = (start: number, length: number) =>
  String.fromCharCode(...bytes.slice(start, start + length));

 if (type === "image/jpeg") return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
 if (type === "image/png") {
  return bytes.length >= 8 &&
   bytes[0] === 0x89 && ascii(1, 3) === "PNG" &&
   bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a;
 }
 if (type === "image/webp") return bytes.length >= 12 && ascii(0, 4) === "RIFF" && ascii(8, 4) === "WEBP";
 if (type === "image/avif") {
  return bytes.length >= 12 && ascii(4, 4) === "ftyp" && ["avif", "avis"].includes(ascii(8, 4));
 }
 if (type === "video/mp4" || type === "video/quicktime") {
  if (bytes.length < 12 || ascii(4, 4) !== "ftyp") return false;
  const brand = ascii(8, 4);
  return type === "video/quicktime"
   ? brand === "qt  "
   : brand !== "qt  " && brand.trim().length > 0;
 }
 return false;
}

async function readObjectRange(
 client: S3Client,
 bucket: string,
 key: string,
 start: number,
 end: number,
) {
 const result = await client.send(new GetObjectCommand({
  Bucket: bucket,
  Key: key,
  Range: `bytes=${start}-${end}`,
 }));
 if (!result.Body) throw new Error("Evidence file range is unavailable.");
 return result.Body.transformToByteArray();
}

async function validateIsoBmffContainer(
 client: S3Client,
 bucket: string,
 key: string,
 type: string,
 fileSize: number,
) {
 let offset = 0;
 let boxCount = 0;
 let hasFtyp = false;
 let hasMoov = false;
 let hasMdat = false;
 let majorBrand = "";

 while (offset < fileSize) {
  if (++boxCount > 256 || fileSize - offset < 8) return false;

  const header = await readObjectRange(client, bucket, key, offset, Math.min(offset + 15, fileSize - 1));
  if (header.byteLength < 8) return false;

  const view = new DataView(header.buffer, header.byteOffset, header.byteLength);
  let boxSize = view.getUint32(0);
  const boxType = String.fromCharCode(header[4], header[5], header[6], header[7]);
  let headerSize = 8;

  if (boxSize === 1) {
   if (header.byteLength < 16) return false;
   const largeSize = view.getBigUint64(8);
   if (largeSize > BigInt(Number.MAX_SAFE_INTEGER)) return false;
   boxSize = Number(largeSize);
   headerSize = 16;
  } else if (boxSize === 0) {
   boxSize = fileSize - offset;
  }

  if (boxSize < headerSize || boxSize > fileSize - offset) return false;

  if (boxType === "ftyp") {
   if (hasFtyp || boxSize < headerSize + 8 || (boxSize - headerSize) % 4 !== 0) return false;
   const ftyp = await readObjectRange(client, bucket, key, offset + headerSize, offset + headerSize + 3);
   if (ftyp.byteLength !== 4) return false;
   hasFtyp = true;
   majorBrand = String.fromCharCode(...ftyp);
  } else if (boxType === "moov") {
   hasMoov = boxSize > headerSize;
  } else if (boxType === "mdat") {
   hasMdat = boxSize > headerSize;
  }

  offset += boxSize;
 }
 if (offset !== fileSize || !hasFtyp || !hasMoov || !hasMdat) return false;
 return type === "video/quicktime" ? majorBrand === "qt  " : majorBrand !== "qt  ";
}

export async function verifyEvidenceObject(key: string, expectedOrderId: string) {
 if (!key.startsWith(`after-sales/${expectedOrderId}/`) || key.length > 500) {
  throw new Error("Invalid evidence key.");
 }
 const { bucket, client } = getEvidenceClient();
 const result = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
 const type = result.ContentType || "";
 const size = Number(result.ContentLength || 0);
 const allowed = new Set(["image/jpeg", "image/png", "image/webp", "image/avif", "video/mp4", "video/quicktime"]);
 if (!allowed.has(type) || !Number.isInteger(size) || size <= 0 ||
     size > (type.startsWith("video/") ? 50 : 10) * 1024 * 1024) {
  throw new Error("Evidence file metadata is invalid.");
 }

 if (type.startsWith("image/")) {
  const object = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  if (!object.Body) throw new Error("Evidence file content is unavailable.");
  const bytes = await object.Body.transformToByteArray();
  if (bytes.byteLength !== size || !hasExpectedFileSignature(type, bytes)) {
   throw new Error("Evidence file content does not match its declared type.");
  }
  try {
   const image = sharp(Buffer.from(bytes), {
    failOn: "error",
    limitInputPixels: 20_000_000,
    animated: false,
   });
   const metadata = await image.metadata();
   if (!metadata.width || !metadata.height || metadata.width * metadata.height > 20_000_000) {
    throw new Error("Image dimensions exceed the allowed limit.");
   }
   await image.stats();
  } catch {
   throw new Error("Image file is incomplete, corrupt, or cannot be decoded.");
  }
 } else {
  const prefix = await readObjectRange(client, bucket, key, 0, Math.min(31, size - 1));
  if (!hasExpectedFileSignature(type, prefix) ||
      !await validateIsoBmffContainer(client, bucket, key, type, size)) {
   throw new Error("Video container is incomplete or structurally invalid.");
  }
 }
 return { contentType: type, size };
}

export async function createEvidenceReadUrl(key: string) {
 const { bucket, client } = getEvidenceClient();
 return getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn: 300 });
}
