import { createHash, randomBytes, randomInt } from "node:crypto";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
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
export async function createEvidenceReadUrl(key:string) {
 const {bucket,client}=getEvidenceClient();
 return getSignedUrl(client,new GetObjectCommand({Bucket:bucket,Key:key}),{expiresIn:300});
}
