"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function manager() {
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user) return {error:"Sign in required." as const};
  const {data:allowed,error}=await supabase.rpc("can_manage_catalog");
  if(error||allowed!==true)return {error:"Catalog permission required." as const};
  return {supabase};
}
function slugify(value:string) {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
}
export async function createCategory(input:{name:string;parentId:string|null;description:string}) {
  const auth=await manager(); if("error" in auth)return auth;
  const name=input.name.trim(),slug=slugify(name);
  if(!name||!slug)return {error:"Enter a valid category name."};
  let sortOrder=0;
  if(input.parentId){
    const {data:parent,error}=await auth.supabase.from("categories").select("id,parent_id").eq("id",input.parentId).maybeSingle();
    if(error||!parent)return {error:"Parent category not found."};
    if(parent.parent_id){
      const {data:grand,error:grandError}=await auth.supabase.from("categories").select("parent_id").eq("id",parent.parent_id).maybeSingle();
      if(grandError||!grand||grand.parent_id!==null)return {error:"Only three category levels are supported."};
    }
  }
  const {data:existing}=await auth.supabase.from("categories").select("id").eq("slug",slug).maybeSingle();
  if(existing)return {error:"That category URL already exists. Choose a different name."};
  const {data:siblings}=await auth.supabase.from("categories").select("sort_order").is("parent_id",input.parentId);
  sortOrder=Math.max(0,...(siblings??[]).map(row=>row.sort_order))+1;
  const {error}=await auth.supabase.from("categories").insert({name,slug,parent_id:input.parentId,description:input.description.trim()||null,sort_order,is_active:true});
  if(error)return {error:error.message};
  revalidatePath("/");revalidatePath("/shop");revalidatePath("/admin/categories");
  return {success:true};
}
export async function updateCategory(id:string,input:{isActive?:boolean;name?:string;sortOrder?:number}) {
  const auth=await manager();if("error" in auth)return auth;
  const values:{is_active?:boolean;name?:string;slug?:string;sort_order?:number;updated_at:string}={updated_at:new Date().toISOString()};\n  if(input.isActive!==undefined)values.is_active=input.isActive;\n  if(input.sortOrder!==undefined&&Number.isInteger(input.sortOrder)&&input.sortOrder>=0)values.sort_order=input.sortOrder;\n  if(input.name!==undefined){const name=input.name.trim(),slug=slugify(name);if(!name||!slug)return {error:"Enter a valid category name."};const {data:conflict}=await auth.supabase.from("categories").select("id").eq("slug",slug).neq("id",id).maybeSingle();if(conflict)return {error:"That category URL is already in use."};values.name=name;values.slug=slug;}\n  const {error}=await auth.supabase.from("categories").update(values).eq("id",id);
  if(error)return {error:error.message};
  revalidatePath("/");revalidatePath("/shop");revalidatePath("/admin/categories");
  return {success:true};
}
