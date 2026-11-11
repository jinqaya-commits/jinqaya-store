"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getR2Client, getR2Config } from "@/lib/r2";

export async function saveCategoryImage(categoryId:string,storagePath:string):Promise<{success?:boolean;error?:string}> {
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)return {error:"Sign in required."};
  const {data:allowed,error:permissionError}=await supabase.rpc("can_manage_catalog");
  if(permissionError||allowed!==true)return {error:"Catalog permission required."};
  if(!/^[0-9a-f-]{36}$/i.test(categoryId))return {error:"Invalid category."};
  const objectKey=storagePath.startsWith("r2://")?storagePath.slice(5):"";
  if(!objectKey.startsWith(`categories/${categoryId}/`)||objectKey.includes(".."))return {error:"Invalid image storage path."};

  const {data:category,error:readError}=await supabase.from("categories").select("id,image_path").eq("id",categoryId).maybeSingle();
  if(readError||!category)return {error:readError?.message||"Category not found."};

  const {error:updateError}=await supabase.from("categories").update({image_path:storagePath}).eq("id",categoryId);
  if(updateError)return {error:updateError.message};

  const oldPath=category.image_path as string|null;
  if(oldPath?.startsWith("r2://")&&oldPath!==storagePath){
    try{
      const config=getR2Config();
      await getR2Client().send(new DeleteObjectCommand({Bucket:config.bucket,Key:oldPath.slice(5)}));
    }catch(error){console.error("Unable to remove replaced category image:",error);}
  }
  revalidatePath("/");
  revalidatePath("/admin/categories");
  revalidatePath("/collections");
  revalidatePath("/shop");
  return {success:true};
}

export async function saveCategorySeo(categoryId:string,input:{seoTitle:string;seoDescription:string}):Promise<{success?:boolean;error?:string}> {
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)return {error:"Sign in required."};
  const {data:allowed,error:permissionError}=await supabase.rpc("can_manage_catalog");
  if(permissionError||allowed!==true)return {error:"Catalog permission required."};
  if(!/^[0-9a-f-]{36}$/i.test(categoryId))return {error:"Invalid category."};

  const seoTitle=input.seoTitle.trim();
  const seoDescription=input.seoDescription.trim();
  if(seoTitle.length>70)return {error:"SEO title must be 70 characters or fewer."};
  if(seoDescription.length>160)return {error:"SEO description must be 160 characters or fewer."};

  const {data:category,error:readError}=await supabase.from("categories").select("id").eq("id",categoryId).maybeSingle();
  if(readError||!category)return {error:readError?.message||"Category not found."};

  const {error:updateError}=await supabase.from("categories").update({
    seo_title:seoTitle||null,
    seo_description:seoDescription||null,
  }).eq("id",categoryId);
  if(updateError)return {error:updateError.message};

  revalidatePath("/");
  revalidatePath("/shop");
  revalidatePath("/collections");
  revalidatePath(`/collections/${categoryId}`);
  revalidatePath("/admin/categories");
  return {success:true};
}
