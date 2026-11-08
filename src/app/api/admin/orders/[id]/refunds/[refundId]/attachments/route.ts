import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { HeadObjectCommand, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import sharp from "sharp";
import { readBoundedJson } from "@/lib/after-sales-evidence";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEvidenceClient } from "@/lib/after-sales-evidence";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
const allowedTypes = new Set(["application/pdf","image/jpeg","image/png","image/webp","image/avif"]);
const maxSize = 10 * 1024 * 1024;
const cleanName = (value:string) => value.normalize("NFKC").replace(/[^a-zA-Z0-9._ -]/g,"_").replace(/\s+/g," ").trim().slice(0,180) || "refund-proof";

async function authorize() {
 const session = await createClient();
 const {data:claims} = await session.auth.getClaims();
 if(!claims?.claims?.sub) return {error:NextResponse.json({error:"Unauthorized"},{status:401})};
 const {data:allowed,error} = await session.rpc("can_manage_catalog");
 if(error || allowed!==true) return {error:NextResponse.json({error:"Forbidden"},{status:403})};
 return {userId:String(claims.claims.sub)};
}

function hasRefundProofSignature(type:string,bytes:Uint8Array) {
 const ascii=(start:number,length:number)=>String.fromCharCode(...bytes.slice(start,start+length));
 if(type==="application/pdf") {
  return bytes.length>=12 && ascii(0,5)==="%PDF-" &&
   ascii(Math.max(0,bytes.length-2048),Math.min(2048,bytes.length)).includes("%%EOF");
 }
 if(type==="image/jpeg")return bytes.length>=3&&bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff;
 if(type==="image/png")return bytes.length>=8&&bytes[0]===0x89&&ascii(1,3)==="PNG"&&bytes[4]===0x0d&&bytes[5]===0x0a&&bytes[6]===0x1a&&bytes[7]===0x0a;
 if(type==="image/webp")return bytes.length>=12&&ascii(0,4)==="RIFF"&&ascii(8,4)==="WEBP";
 if(type==="image/avif") {
  if(bytes.length<16||ascii(4,4)!=="ftyp")return false;
  const size=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength).getUint32(0);
  if(size<16||size>bytes.length||(size-16)%4!==0)return false;
  const brands=[ascii(8,4)];
  for(let i=16;i+4<=size;i+=4)brands.push(ascii(i,4));
  return brands.includes("avif")||brands.includes("avis");
 }
 return false;
}
async function verifyRefundProofObject(client:ReturnType<typeof getEvidenceClient>["client"],bucket:string,key:string,expectedType:string,expectedSize:number) {
 const head=await client.send(new HeadObjectCommand({Bucket:bucket,Key:key}),{abortSignal:AbortSignal.timeout(8000)});
 const type=String(head.ContentType||"");
 const size=Number(head.ContentLength||0);
 if(type!==expectedType||size!==expectedSize||!allowedTypes.has(type)||!Number.isSafeInteger(size)||size<1||size>maxSize) {
  throw new Error("Uploaded file metadata does not match the upload request.");
 }
 const result=await client.send(new GetObjectCommand({Bucket:bucket,Key:key}),{abortSignal:AbortSignal.timeout(15000)});
 if(!result.Body)throw new Error("Uploaded file content is unavailable.");
 const bytes=await result.Body.transformToByteArray();
 if(bytes.byteLength!==size||!hasRefundProofSignature(type,bytes))throw new Error("File content does not match its declared type or is incomplete.");
 if(type.startsWith("image/")) {
  try {
   const image=sharp(Buffer.from(bytes),{failOn:"error",limitInputPixels:20_000_000,animated:true});
   const metadata=await image.metadata();
   if(!metadata.width||!metadata.height||metadata.width*metadata.height>20_000_000||(metadata.pages??1)!==1)throw new Error("Invalid image dimensions or frame count.");
   await image.stats();
  } catch { throw new Error("Image is incomplete, corrupt, animated, or cannot be decoded."); }
 }
}

async function refundExists(db:ReturnType<typeof createAdminClient>,orderId:string,refundId:string) {
 const {data,error}=await db.from("order_refunds").select("id").eq("id",refundId).eq("order_id",orderId).maybeSingle();
 return !error && !!data;
}
export async function GET(_request:NextRequest,{params}:{params:Promise<{id:string;refundId:string}>}) {
 const auth=await authorize(); if("error" in auth)return auth.error;
 const {id,refundId}=await params;
 if(!/^[0-9a-f-]{36}$/i.test(id)||!/^[0-9a-f-]{36}$/i.test(refundId))return NextResponse.json({error:"Invalid ID"},{status:400});
 const db=createAdminClient(); if(!await refundExists(db,id,refundId))return NextResponse.json({error:"Refund not found"},{status:404});
 const {data:attachments,error}=await db.from("order_refund_attachments").select("id,file_name,content_type,file_size,uploaded_by,created_at,object_key").eq("refund_id",refundId).eq("order_id",id).order("created_at",{ascending:false});
 if(error)return NextResponse.json({error:"Unable to load refund proofs"},{status:500});
 const {data:events,error:eventError}=await db.from("order_refund_events").select("id,event_type,description,old_values,new_values,actor_user_id,created_at").eq("refund_id",refundId).eq("order_id",id).order("created_at",{ascending:false});
 if(eventError)return NextResponse.json({error:"Unable to load refund history"},{status:500});
 const {bucket,client}=getEvidenceClient();
 const files=await Promise.all((attachments||[]).map(async file=>({id:file.id,file_name:file.file_name,content_type:file.content_type,file_size:file.file_size,uploaded_by:file.uploaded_by,created_at:file.created_at,url:await getSignedUrl(client,new GetObjectCommand({Bucket:bucket,Key:file.object_key}),{expiresIn:180})})));
 return NextResponse.json({attachments:files,events:events||[]});
}
export async function POST(request:NextRequest,{params}:{params:Promise<{id:string;refundId:string}>}) {
 const auth=await authorize(); if("error" in auth)return auth.error;
 const {id,refundId}=await params;
 if(!/^[0-9a-f-]{36}$/i.test(id)||!/^[0-9a-f-]{36}$/i.test(refundId))return NextResponse.json({error:"Invalid ID"},{status:400});
 let body:any;try{body=await readBoundedJson<any>(request,8*1024)}catch(error){return NextResponse.json({error:error instanceof Error&&error.message==="Request body is too large."?"Request body is too large.":"Invalid request"},{status:error instanceof Error&&error.message==="Request body is too large."?413:400})}
 if(!body||typeof body!=="object"||Array.isArray(body))return NextResponse.json({error:"Invalid request"},{status:400})
 const db=createAdminClient(); if(!await refundExists(db,id,refundId))return NextResponse.json({error:"Refund not found"},{status:404});
 const {bucket,client}=getEvidenceClient();
 if(body.action==="create_upload") {
  const fileName=typeof body.fileName==="string"?cleanName(body.fileName):"";
  const contentType=String(body.contentType||"");
  const size=Number(body.size);
  if(!fileName||!allowedTypes.has(contentType)||!Number.isInteger(size)||size<1||size>maxSize)return NextResponse.json({error:"Upload only PDF or image files up to 10 MB."},{status:400});
  const objectKey="refund-proofs/"+id+"/"+refundId+"/"+randomUUID();
  const uploadUrl=await getSignedUrl(client,new PutObjectCommand({Bucket:bucket,Key:objectKey,ContentType:contentType,ContentLength:size}),{expiresIn:300});
  return NextResponse.json({uploadUrl,objectKey,fileName,contentType,size});
 }
 if(body.action==="complete") {
  const objectKey=String(body.objectKey||"");
  const fileName=typeof body.fileName==="string"?cleanName(body.fileName):"";
  if(!fileName||!objectKey.startsWith("refund-proofs/"+id+"/"+refundId+"/")||objectKey.length>500)return NextResponse.json({error:"Invalid refund proof upload."},{status:400});
  let contentType="",size=0;
  try {
   const head=await client.send(new HeadObjectCommand({Bucket:bucket,Key:objectKey}),{abortSignal:AbortSignal.timeout(8000)});
   contentType=String(head.ContentType||"");size=Number(head.ContentLength||0);
   if(!allowedTypes.has(contentType)||!Number.isSafeInteger(size)||size<1||size>maxSize)throw new Error("Uploaded file metadata is invalid.");
   await verifyRefundProofObject(client,bucket,objectKey,contentType,size);
  } catch(error) {
   return NextResponse.json({error:error instanceof Error?error.message:"Unable to verify uploaded file."},{status:400});
  }
  const {data,error}=await db.from("order_refund_attachments").insert({refund_id:refundId,order_id:id,object_key:objectKey,file_name:fileName,content_type:contentType,file_size:size,uploaded_by:auth.userId}).select("id").single();
  if(error)return NextResponse.json({error:"Unable to save refund proof metadata."},{status:400});
  return NextResponse.json({ok:true,attachmentId:data.id});
 }
 return NextResponse.json({error:"Unsupported action."},{status:400});
}
