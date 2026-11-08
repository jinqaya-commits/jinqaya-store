import { NextRequest,NextResponse } from "next/server";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEvidenceClient } from "@/lib/after-sales-evidence";

export const dynamic="force-dynamic";
export const runtime="nodejs";
export const maxDuration=60;

async function authorize() {
 const session=await createClient();
 const {data:claims}=await session.auth.getClaims();
 if(!claims?.claims?.sub)return {error:NextResponse.json({error:"Unauthorized"},{status:401})};
 const {data:allowed,error}=await session.rpc("can_manage_catalog");
 if(error||allowed!==true)return {error:NextResponse.json({error:"Forbidden"},{status:403})};
 return {userId:String(claims.claims.sub)};
}

const uuidPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const safeFilename=(value:string)=>value.replace(/[\r\n"]/g,"_").slice(0,180)||"refund-proof";

export async function GET(_request:NextRequest,{params}:{params:Promise<{id:string;refundId:string;attachmentId:string}>}) {
 const auth=await authorize();
 if("error" in auth)return auth.error;
 const {id,refundId,attachmentId}=await params;
 if(!uuidPattern.test(id)||!uuidPattern.test(refundId)||!uuidPattern.test(attachmentId))
  return NextResponse.json({error:"Invalid ID"},{status:400,headers:{"Cache-Control":"private, no-store"}});
 const db=createAdminClient();
 const {data:file,error}=await db.from("order_refund_attachments")
  .select("id,order_id,refund_id,object_key,file_name,content_type,file_size,deletion_requested_at,deleted_at")
  .eq("id",attachmentId).eq("order_id",id).eq("refund_id",refundId)
  .is("deletion_requested_at",null).is("deleted_at",null).maybeSingle();
 if(error)return NextResponse.json({error:"Unable to verify refund proof access."},{status:500,headers:{"Cache-Control":"private, no-store"}});
 if(!file||!file.object_key.startsWith("refund-proofs/"+id+"/"+refundId+"/"))
  return NextResponse.json({error:"Refund proof not found."},{status:404,headers:{"Cache-Control":"private, no-store"}});
 const {bucket,client}=getEvidenceClient();
 try {
  const result=await client.send(new GetObjectCommand({Bucket:bucket,Key:file.object_key}),{abortSignal:AbortSignal.timeout(15000)});
  if(!result.Body)return NextResponse.json({error:"Refund proof file is unavailable."},{status:404,headers:{"Cache-Control":"private, no-store"}});
  const stream=result.Body.transformToWebStream();
  const filename=safeFilename(file.file_name);
  const disposition="attachment; filename=\""+filename.replace(/[^\x20-\x7E]/g,"_")+"\"; filename*=UTF-8''"+encodeURIComponent(filename);
  return new Response(stream as ReadableStream,{
   status:200,
   headers:{
    "Content-Type":file.content_type,
    "Content-Length":String(file.file_size),
    "Content-Disposition":disposition,
    "Cache-Control":"private, no-store, max-age=0",
    "Pragma":"no-cache",
    "X-Content-Type-Options":"nosniff",
    "Content-Security-Policy":"default-src 'none'; sandbox"
   }
  });
 } catch(error) {
  console.error("[refund-proof-download] failed",error);
  return NextResponse.json({error:"Unable to download refund proof."},{status:404,headers:{"Cache-Control":"private, no-store"}});
 }
}
