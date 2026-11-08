import { createHash, randomBytes, randomInt } from "node:crypto";
import { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand, CopyObjectCommand, DeleteObjectsCommand } from "@aws-sdk/client-s3";
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
  if (bytes.length < 16 || ascii(4, 4) !== "ftyp") return false;
  const boxSize = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(0);
  if (boxSize < 16) return false;
  const brands = [ascii(8, 4)];
  for (let offset = 16; offset + 4 <= Math.min(bytes.length, boxSize); offset += 4) {
   brands.push(ascii(offset, 4));
  }
  return brands.includes("avif") || brands.includes("avis");
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
 signal: AbortSignal = AbortSignal.timeout(8_000),
) {
 const result = await client.send(new GetObjectCommand({
  Bucket: bucket,
  Key: key,
  Range: `bytes=${start}-${end}`,
 }), { abortSignal: signal });
 if (!result.Body) throw new Error("Evidence file range is unavailable.");
 const bytes = await result.Body.transformToByteArray();
 if (bytes.byteLength !== end - start + 1) {
  throw new Error("Evidence storage did not return the requested byte range.");
 }
 return bytes;
}

async function validateIsoBmffContainer(
 client: S3Client,
 bucket: string,
 key: string,
 type: string,
 fileSize: number,
) {
 // Read bounded 64 KiB windows and parse many adjacent box headers from each
 // response. Large mdat/moov payloads are skipped by their declared box size.
 const WINDOW_BYTES = 64 * 1024;
 const MAX_RANGE_REQUESTS = 64;
 const MAX_TOP_LEVEL_BOXES = 4096;
 const MAX_PARSE_TIME_MS = 25_000;
 const deadline = Date.now() + MAX_PARSE_TIME_MS;
 let rangeRequests = 0;
 let windowStart = -1;
 let window: Uint8Array<ArrayBufferLike> = new Uint8Array();
 let offset = 0;
 let boxCount = 0;
 let hasFtyp = false;
 let hasMoov = false;
 let hasMdat = false;
 let majorBrand = "";

 const ensureWindow = async (position: number, minimumBytes: number) => {
  if (position < windowStart || position + minimumBytes > windowStart + window.byteLength) {
   const remainingMs = deadline - Date.now();
   if (remainingMs <= 0 || ++rangeRequests > MAX_RANGE_REQUESTS) return false;
   windowStart = position;
   const end = Math.min(position + WINDOW_BYTES - 1, fileSize - 1);
   window = await readObjectRange(
    client, bucket, key, position, end,
    AbortSignal.timeout(Math.min(8_000, remainingMs)),
   );
   if (Date.now() > deadline) return false;
  }
  return position + minimumBytes <= windowStart + window.byteLength;
 };

 const bytesAt = (position: number, length: number) => {
  const relative = position - windowStart;
  return window.slice(relative, relative + length);
 };

 while (offset < fileSize) {
  if (++boxCount > MAX_TOP_LEVEL_BOXES || fileSize - offset < 8) return false;
  if (!await ensureWindow(offset, 8)) return false;

  let header = bytesAt(offset, 8);
  let view = new DataView(header.buffer, header.byteOffset, header.byteLength);
  let boxSize = view.getUint32(0);
  const boxType = String.fromCharCode(header[4], header[5], header[6], header[7]);
  let headerSize = 8;

  if (boxSize === 1) {
   if (!await ensureWindow(offset, 16)) return false;
   header = bytesAt(offset, 16);
   view = new DataView(header.buffer, header.byteOffset, header.byteLength);
   const largeSize = view.getBigUint64(8);
   if (largeSize > BigInt(Number.MAX_SAFE_INTEGER)) return false;
   boxSize = Number(largeSize);
   headerSize = 16;
  } else if (boxSize === 0) {
   boxSize = fileSize - offset;
  }

  if (boxSize < headerSize || boxSize > fileSize - offset) return false;

  // ISO BMFF box types are four printable ASCII bytes.
  if ([...boxType].some((character) => {
   const code = character.charCodeAt(0);
   return code < 0x20 || code > 0x7e;
  })) return false;

  if (boxType === "ftyp") {
   // ISO BMFF requires ftyp to be the first top-level box.
   // ftyp contains major_brand, minor_version and zero or more compatible brands.
   // Keep it small enough to validate completely in one bounded range read.
   if (offset !== 0 || hasFtyp || boxSize < headerSize + 8 || boxSize > 4096 ||
       (boxSize - headerSize - 8) % 4 !== 0) return false;
   if (!await ensureWindow(offset + headerSize, boxSize - headerSize)) return false;
   const ftyp = bytesAt(offset + headerSize, boxSize - headerSize);
   majorBrand = String.fromCharCode(...ftyp.slice(0, 4));
   const compatibleBrands = [];
   for (let index = 8; index + 4 <= ftyp.length; index += 4) {
    compatibleBrands.push(String.fromCharCode(...ftyp.slice(index, index + 4)));
   }
   const allBrands = [majorBrand, ...compatibleBrands];
   if (allBrands.some((brand) => [...brand].some((character) => {
    const code = character.charCodeAt(0);
    return code < 0x20 || code > 0x7e;
   }))) return false;
   if (type === "video/quicktime" ? !allBrands.includes("qt  ") : allBrands.includes("qt  ")) return false;
   hasFtyp = true;
  } else if (boxType === "moov") {
   if (hasMoov || boxSize <= headerSize) return false;
   hasMoov = true;
  } else if (boxType === "mdat") {
   if (boxSize > headerSize) hasMdat = true;
  }

  offset += boxSize;
 }

 if (offset !== fileSize || !hasFtyp || !hasMoov || !hasMdat) return false;
 return type === "video/quicktime" ? majorBrand === "qt  " : majorBrand !== "qt  ";
}

export type EvidenceObjectMetadata = {
 contentType: string;
 size: number;
};

function assertEvidenceKey(key: string, expectedOrderId: string) {
 const finalPrefix = `after-sales/${expectedOrderId}/`;
 const stagingPrefix = `after-sales-staging/${expectedOrderId}/`;
 if ((!key.startsWith(finalPrefix) && !key.startsWith(stagingPrefix)) || key.length > 500) {
  throw new Error("Invalid evidence key.");
 }
}

export function createFinalEvidenceKey(stagingKey: string, expectedOrderId: string) {
 assertEvidenceKey(stagingKey, expectedOrderId);
 if (!stagingKey.startsWith(`after-sales-staging/${expectedOrderId}/`)) {
  throw new Error("Only staging evidence can be promoted.");
 }
 const extension = stagingKey.split(".").pop();
 if (!extension || !/^(jpg|png|webp|avif|mp4|mov)$/.test(extension)) {
  throw new Error("Invalid evidence file extension.");
 }
 return `after-sales/${expectedOrderId}/${randomBytes(16).toString("hex")}.${extension}`;
}

export async function promoteEvidenceObject(stagingKey: string, finalKey: string, expectedOrderId: string) {
 assertEvidenceKey(stagingKey, expectedOrderId);
 assertEvidenceKey(finalKey, expectedOrderId);
 if (!stagingKey.startsWith(`after-sales-staging/${expectedOrderId}/`) ||
     !finalKey.startsWith(`after-sales/${expectedOrderId}/`)) {
  throw new Error("Invalid evidence promotion paths.");
 }
 const { bucket, client } = getEvidenceClient();
 const copySource = `${bucket}/${stagingKey.split("/").map(encodeURIComponent).join("/")}`;
 await client.send(new CopyObjectCommand({
  Bucket: bucket,
  Key: finalKey,
  CopySource: copySource,
  MetadataDirective: "COPY",
 }), { abortSignal: AbortSignal.timeout(20_000) });
}

export async function deleteEvidenceObjects(keys: string[]) {
 if (!keys.length) return;
 const { bucket, client } = getEvidenceClient();
 const result = await client.send(new DeleteObjectsCommand({
  Bucket: bucket,
  Delete: { Objects: keys.map((Key) => ({ Key })), Quiet: false },
 }), { abortSignal: AbortSignal.timeout(8_000) });
 if (result.Errors?.length) {
  throw new Error(`Unable to delete ${result.Errors.length} evidence object(s).`);
 }
}

function parseEvidenceMetadata(contentType: string, contentLength: number) {
 const allowed = new Set(["image/jpeg", "image/png", "image/webp", "image/avif", "video/mp4", "video/quicktime"]);
 if (!allowed.has(contentType) || !Number.isSafeInteger(contentLength) || contentLength <= 0 ||
     contentLength > (contentType.startsWith("video/") ? 50 : 10) * 1024 * 1024) {
  throw new Error("Evidence file metadata is invalid.");
 }
 return { contentType, size: contentLength };
}

// Cheap metadata-only pass: lets the caller verify the upload ticket before
// spending resources on full image decoding or video container inspection.
export async function getEvidenceObjectMetadata(key: string, expectedOrderId: string): Promise<EvidenceObjectMetadata> {
 assertEvidenceKey(key, expectedOrderId);
 const { bucket, client } = getEvidenceClient();
 const result = await client.send(
  new HeadObjectCommand({ Bucket: bucket, Key: key }),
  { abortSignal: AbortSignal.timeout(8_000) },
 );
 return parseEvidenceMetadata(result.ContentType || "", Number(result.ContentLength ?? 0));
}

export async function verifyEvidenceObject(
 key: string,
 expectedOrderId: string,
 expectedMetadata?: EvidenceObjectMetadata,
) {
 assertEvidenceKey(key, expectedOrderId);
 const { bucket, client } = getEvidenceClient();
 const result = await client.send(
  new HeadObjectCommand({ Bucket: bucket, Key: key }),
  { abortSignal: AbortSignal.timeout(8_000) },
 );
 const metadata = parseEvidenceMetadata(result.ContentType || "", Number(result.ContentLength ?? 0));
 if (expectedMetadata &&
     (metadata.contentType !== expectedMetadata.contentType || metadata.size !== expectedMetadata.size)) {
  throw new Error("Evidence file metadata changed during verification.");
 }
 const { contentType: type, size } = metadata;

 if (type.startsWith("image/")) {
  const object = await client.send(
   new GetObjectCommand({ Bucket: bucket, Key: key }),
   { abortSignal: AbortSignal.timeout(12_000) },
  );
  if (!object.Body) throw new Error("Evidence file content is unavailable.");
  const bytes = await object.Body.transformToByteArray();
  if (bytes.byteLength !== size || !hasExpectedFileSignature(type, bytes)) {
   throw new Error("Evidence file content does not match its declared type.");
  }
  try {
   const image = sharp(Buffer.from(bytes), {
    failOn: "error",
    limitInputPixels: 20_000_000,
    // Read all frame metadata so animated WebP/AVIF inputs cannot hide extra frames.
    animated: true,
   });
   const metadata = await image.metadata();
   const width = metadata.width ?? 0;
   const height = metadata.height ?? 0;
   const pages = metadata.pages ?? 1;
   if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) ||
       width <= 0 || height <= 0 || width * height > 20_000_000 ||
       !Number.isSafeInteger(pages) || pages !== 1) {
    throw new Error("Image dimensions or frame count exceed the allowed limit.");
   }
   // Force a decode of the accepted single-frame image before storing the evidence reference.
   await image.stats();
  } catch {
   throw new Error("Image file is incomplete, corrupt, or cannot be decoded.");
  }
 } else {
  const prefix = await readObjectRange(
   client, bucket, key, 0, Math.min(31, size - 1),
   AbortSignal.timeout(8_000),
  );
  if (!hasExpectedFileSignature(type, prefix) ||
      !await validateIsoBmffContainer(client, bucket, key, type, size)) {
   throw new Error("Video container is incomplete or structurally invalid.");
  }
 }
 return metadata;
}

export async function createEvidenceReadUrl(key: string) {
 const { bucket, client } = getEvidenceClient();
 return getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn: 300 });
}
