"use server";
import { revalidatePath } from "next/cache";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { createClient } from "@/lib/supabase/server";
import { getR2Client, getR2Config } from "@/lib/r2";
export async function saveHomepageMedia(mediaKey:"hero"|"lifestyle",storagePath:string):Promise<{success?:boolean;error?:string}> {
 const supabase=await createClient(); const {data:{user}}=await supabase.auth.getUser(); if(!user)return {error:"Sign in required."};
 const {data:allowed,error:permissionError}=await supabase.rpc("can_manage_catalog"); if(permissionError||allowed!==true)return {error:"Catalog permission required."};
 if(mediaKey!=="hero"&&mediaKey!=="lifestyle")return {error:"Invalid homepage image slot."};
 const key=storagePath.startsWith("r2://")?storagePath.slice(5):""; if(!key.startsWith(`homepage/${mediaKey}/`)||key.includes(".."))return {error:"Invalid image storage path."};
 const {data:oldRow,error:readError}=await (supabase as any).from("homepage_media").select("image_path").eq("media_key",mediaKey).maybeSingle(); if(readError)return {error:readError.message};
 const {error:updateError}=await supabase.from("homepage_media").upsert({media_key:mediaKey,image_path:storagePath,updated_at:new Date().toISOString()},{onConflict:"media_key"}); if(updateError)return {error:updateError.message};
 const oldPath=oldRow?.image_path as string|null; if(oldPath?.startsWith("r2://")&&oldPath!==storagePath){try{const config=getR2Config();await getR2Client().send(new DeleteObjectCommand({Bucket:config.bucket,Key:oldPath.slice(5)}));}catch(error){console.error("Unable to remove replaced homepage image:",error);}}
 revalidatePath("/"); revalidatePath("/admin/homepage-media"); return {success:true};
}