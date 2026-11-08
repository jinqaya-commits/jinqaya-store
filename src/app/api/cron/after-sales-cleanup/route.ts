import {NextRequest,NextResponse} from "next/server";
import {createClient as createSupabaseClient} from "@supabase/supabase-js";
import {DeleteObjectsCommand,S3Client} from "@aws-sdk/client-s3";

export const dynamic="force-dynamic";
export const runtime="nodejs";

export async function GET(request:NextRequest){
 const secret=process.env.CRON_SECRET;
 const authorization=request.headers.get("authorization");
 if(!secret||authorization!==`Bearer ${secret}`)return NextResponse.json({error:"Unauthorized"},{status:401});

 const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
 const serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
 const account=process.env.R2_ACCOUNT_ID;
 const accessKey=process.env.R2_ACCESS_KEY_ID;
 const accessSecret=process.env.R2_SECRET_ACCESS_KEY;
 const bucket=process.env.R2_AFTER_SALES_BUCKET;
 if(!url||!serviceKey||!account||!accessKey||!accessSecret||!bucket){
  return NextResponse.json({error:"Cleanup is not configured."},{status:500});
 }

 try{
  const supabase=createSupabaseClient(url,serviceKey,{auth:{autoRefreshToken:false,persistSession:false}});
  const s3=new S3Client({
   region:"auto",
   endpoint:`https://${account}.r2.cloudflarestorage.com`,
   credentials:{accessKeyId:accessKey,secretAccessKey:accessSecret}
  });

  const {data:rows,error}=await supabase.rpc("list_expired_after_sales_orphan_keys",{p_limit:100});
  if(error)throw error;

  const keys: string[] = ((rows ?? []) as Array<{ object_key: string }>)
   .map((row: { object_key: string }) => row.object_key)
   .filter((key: string) => typeof key === "string" &&
    (key.startsWith("after-sales/") || key.startsWith("after-sales-staging/")));
  let afterSalesDeleted=0,afterSalesFailed=0;
  if(keys.length){
   const result=await s3.send(new DeleteObjectsCommand({
    Bucket:bucket,
    Delete:{Objects:keys.map((Key: string)=>({Key})),Quiet:false}
   }));
   const deletedSet=new Set((result.Deleted||[]).map(item=>item.Key).filter((key):key is string=>!!key));
   const failedSet=new Set((result.Errors||[]).map(item=>item.Key).filter((key):key is string=>!!key));
   const deletedKeys=keys.filter(key=>deletedSet.has(key)&&!failedSet.has(key));
   afterSalesDeleted=deletedKeys.length;afterSalesFailed=keys.length-deletedKeys.length;
   if(deletedKeys.length){
    const {error:cleanupError}=await supabase.rpc("delete_after_sales_orphan_ticket_rows",{p_object_keys:deletedKeys});
    if(cleanupError)throw cleanupError;
   }
  }

  const {data:refundRows,error:refundListError}=await supabase.rpc("list_expired_refund_proof_upload_keys",{p_limit:100});
  if(refundListError)throw refundListError;
  const refundKeys:string[]=((refundRows??[]) as Array<{object_key:string}>)
   .map(row=>row.object_key)
   .filter(key=>typeof key==="string"&&key.startsWith("refund-proofs/")&&key.length<=500);
  let refundDeleted=0,refundFailed=0;
  if(refundKeys.length){
   const refundResult=await s3.send(new DeleteObjectsCommand({
    Bucket:bucket,Delete:{Objects:refundKeys.map(Key=>({Key})),Quiet:false}
   }));
   const refundDeletedSet=new Set((refundResult.Deleted||[]).map(item=>item.Key).filter((key):key is string=>!!key));
   const refundFailedSet=new Set((refundResult.Errors||[]).map(item=>item.Key).filter((key):key is string=>!!key));
   const successfullyDeleted=refundKeys.filter(key=>refundDeletedSet.has(key)&&!refundFailedSet.has(key));
   refundDeleted=successfullyDeleted.length;refundFailed=refundKeys.length-refundDeleted;
   if(successfullyDeleted.length){
    const {error:ticketDeleteError}=await supabase.rpc("delete_expired_refund_proof_upload_tickets",{p_object_keys:successfullyDeleted});
    if(ticketDeleteError)throw ticketDeleteError;
   }
  }

  const {data:pendingDeletionRows,error:pendingDeletionError}=await supabase.rpc("list_pending_refund_proof_deletions",{p_limit:100});
  if(pendingDeletionError)throw pendingDeletionError;
  let refundProofDeletionsCompleted=0,refundProofDeletionsFailed=0;
  for(const row of (pendingDeletionRows??[]) as Array<{attachment_id:string;object_key:string}>) {
   if(!row.object_key.startsWith("refund-proofs/")||row.object_key.length>500) {refundProofDeletionsFailed++;continue;}
   try {
    await s3.send(new DeleteObjectCommand({Bucket:bucket,Key:row.object_key}),{abortSignal:AbortSignal.timeout(8000)});
    const {error:completeError}=await supabase.rpc("complete_order_refund_attachment_deletion",{
     p_attachment_id:row.attachment_id,p_object_key:row.object_key,p_actor_user_id:null
    });
    if(completeError)throw completeError;
    refundProofDeletionsCompleted++;
   } catch(error) {
    refundProofDeletionsFailed++;
    console.error("[after-sales-cleanup] refund proof deletion retry failed",row.attachment_id,error);
   }
  }

  return NextResponse.json({ok:true,afterSales:{deleted:afterSalesDeleted,failed:afterSalesFailed},refundProofs:{orphansDeleted:refundDeleted,orphansFailed:refundFailed,deletionsCompleted:refundProofDeletionsCompleted,deletionsFailed:refundProofDeletionsFailed}});
 }catch(error){
  console.error("[after-sales-cleanup] failed",error);
  return NextResponse.json({error:"Cleanup failed. Check server logs."},{status:500});
 }
}
