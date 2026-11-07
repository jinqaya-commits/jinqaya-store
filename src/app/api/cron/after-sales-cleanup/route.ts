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

  const keys=(rows||[])
   .map((row:{object_key:string})=>row.object_key)
   .filter((key:string)=>typeof key==="string"&&key.startsWith("after-sales/"));
  if(!keys.length)return NextResponse.json({ok:true,deleted:0,failed:0});

  const result=await s3.send(new DeleteObjectsCommand({
   Bucket:bucket,
   Delete:{Objects:keys.map(Key=>({Key})),Quiet:false}
  }));
  const deletedSet=new Set((result.Deleted||[]).map(item=>item.Key).filter((key):key is string=>!!key));
  const failedSet=new Set((result.Errors||[]).map(item=>item.Key).filter((key):key is string=>!!key));
  const deletedKeys=keys.filter(key=>deletedSet.has(key)&&!failedSet.has(key));

  if(deletedKeys.length){
   const {error:cleanupError}=await supabase.rpc("delete_after_sales_orphan_ticket_rows",{p_object_keys:deletedKeys});
   if(cleanupError)throw cleanupError;
  }

  return NextResponse.json({ok:true,deleted:deletedKeys.length,failed:keys.length-deletedKeys.length});
 }catch(error){
  console.error("[after-sales-cleanup] failed",error);
  return NextResponse.json({error:"Cleanup failed. Check server logs."},{status:500});
 }
}
