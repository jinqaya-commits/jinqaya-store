import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { HeadObjectCommand, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEvidenceClient } from "@/lib/after-sales-evidence";

export const dynamic = "force-dynamic";
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
 let body:any;try{body=await request.json()}catch{return NextResponse.json({error:"Invalid request"},{status:400})}
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
  const head=await client.send(new HeadObjectCommand({Bucket:bucket,Key:objectKey}));
  const contentType=String(head.ContentType||"");const size=Number(head.ContentLength||0);
  if(!allowedTypes.has(contentType)||!Number.isInteger(size)||size<1||size>maxSize)return NextResponse.json({error:"Uploaded file metadata is invalid."},{status:400});
  const {data,error}=await db.from("order_refund_attachments").insert({refund_id:refundId,order_id:id,object_key:objectKey,file_name:fileName,content_type:contentType,file_size:size,uploaded_by:auth.userId}).select("id").single();
  if(error)return NextResponse.json({error:"Unable to save refund proof metadata."},{status:400});
  return NextResponse.json({ok:true,attachmentId:data.id});
 }
 return NextResponse.json({error:"Unsupported action."},{status:400});
}
