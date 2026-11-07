import { createHash, randomBytes, randomInt } from "node:crypto";
import { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export const sessionCookieName = "jq_after_sales_session";
export function sha256(value: string) { return createHash("sha256").update(value).digest("hex"); }
export function newCode() { return String(randomInt(0, 1000000)).padStart(6, "0"); }
export function newSessionToken() { return randomBytes(32).toString("hex"); }
export function getEvidenceClient() {
 const account=process.env.R2_ACCOUNT_ID, key=process.env.R2_ACCESS_KEY_ID, secret=process.env.R2_SECRET_ACCESS_KEY, bucket=process.env.R2_AFTER_SALES_BUCKET;
 if(!account||!key||!secret||!bucket) throw new Error("Evidence storage is not configured.");
 return {bucket,client:new S3Client({region:"auto",endpoint:`https://${account}.r2.cloudflarestorage.com`,credentials:{accessKeyId:key,secretAccessKey:secret}})};
}
export async function createEvidenceUploadUrl(key:string,contentType:string,size:number) {
 const {bucket,client}=getEvidenceClient();
 const url=await getSignedUrl(client,new PutObjectCommand({Bucket:bucket,Key:key,ContentType:contentType,ContentLength:size}),{expiresIn:300});
 return url;
}
export async function verifyEvidenceObject(key:string, expectedOrderId:string) {
 if(!key.startsWith(`after-sales/${expectedOrderId}/`) || key.length>500) throw new Error("Invalid evidence key.");
 const {bucket,client}=getEvidenceClient();
 const result=await client.send(new HeadObjectCommand({Bucket:bucket,Key:key}));
 const type=result.ContentType||"";
 const size=Number(result.ContentLength||0);
 const allowed=new Set(["image/jpeg","image/png","image/webp","image/avif","video/mp4","video/quicktime"]);
 if(!allowed.has(type)||!Number.isInteger(size)||size<=0||size>(type.startsWith("video/")?50:10)*1024*1024) throw new Error("Evidence file metadata is invalid.");
 return {contentType:type,size};
}
export async function createEvidenceReadUrl(key:string) {
 const {bucket,client}=getEvidenceClient();
 return getSignedUrl(client,new GetObjectCommand({Bucket:bucket,Key:key}),{expiresIn:300});
}
