"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getR2Client, getR2Config } from "@/lib/r2";

async function requireCatalogManager() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: canManage, error } = await supabase.rpc("can_manage_catalog");
  if (error || canManage !== true) {
    throw new Error("You do not have permission to manage the catalog.");
  }
  return supabase;
}

function slugify(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export type CreateProductInput = {
  name: string;
  categoryId: string;
  petType: "cat" | "dog" | "both" | "shared";
  shortDescription: string;
  description: string;
  material: string;
  careInstructions: string;
  sku: string;
  variantName: string;
  color: string;
  size: string;
  price: string;
  compareAtPrice: string;
  status: "draft" | "active";
};

export async function createProduct(input: CreateProductInput) {
  const supabase = await requireCatalogManager();
  const name = input.name.trim();
  const slug = slugify(name);
  if (!name || !slug) return { error: "Please enter a product name." };
  if (!input.categoryId) return { error: "Please choose a category." };

  const { data: existing } = await supabase
    .from("products").select("id").eq("slug", slug).maybeSingle();
  const uniqueSlug = existing ? `${slug}-${Date.now().toString(36)}` : slug;

  const { data: product, error: productError } = await supabase
    .from("products")
    .insert({
      name,
      slug: uniqueSlug,
      pet_type: input.petType,
      short_description: input.shortDescription.trim() || null,
      description: input.description.trim() || null,
      material: input.material.trim() || null,
      care_instructions: input.careInstructions.trim() || null,
      status: input.status,
      brand_name: "JINQAYA",
      published_at: input.status === "active" ? new Date().toISOString() : null,
    })
    .select("id")
    .single();

  if (productError || !product) {
    return { error: productError?.message || "Unable to create product." };
  }

  const { error: categoryError } = await supabase.from("product_categories").insert({
    product_id: product.id,
    category_id: input.categoryId,
    is_primary: true,
  });

  if (categoryError) {
    await supabase.from("products").delete().eq("id", product.id);
    return { error: categoryError.message };
  }

  if (input.sku.trim()) {
    const price = input.price.trim() ? Number(input.price) : null;
    const compareAtPrice = input.compareAtPrice.trim() ? Number(input.compareAtPrice) : null;
    if ((price !== null && (!Number.isFinite(price) || price < 0)) ||
        (compareAtPrice !== null && (!Number.isFinite(compareAtPrice) || compareAtPrice < 0))) {
      await supabase.from("products").delete().eq("id", product.id);
      return { error: "Enter valid non-negative prices." };
    }

    const { error: variantError } = await supabase.from("product_variants").insert({
      product_id: product.id,
      sku: input.sku.trim(),
      variant_name: input.variantName.trim() || null,
      color: input.color.trim() || null,
      size: input.size.trim() || null,
      price,
      compare_at_price: compareAtPrice,
      currency: "USD",
    });

    if (variantError) {
      await supabase.from("products").delete().eq("id", product.id);
      return { error: variantError.message };
    }
  }

  revalidatePath("/admin/products");
  revalidatePath("/shop");
  revalidatePath(`/collections`);
  return { productId: product.id };
}

export async function setProductStatus(productId: string, status: "draft" | "active" | "archived") {
  const supabase = await requireCatalogManager();
  const { error } = await supabase.from("products").update({
    status,
    published_at: status === "active" ? new Date().toISOString() : null,
  }).eq("id", productId);

  if (error) throw new Error(error.message);
  revalidatePath("/admin/products");
  revalidatePath("/shop");
}

export async function updateProduct(productId: string, values: {
  name: string; petType: "cat"|"dog"|"both"|"shared"; shortDescription: string;
  description: string; material: string; careInstructions: string; status: "draft"|"active"|"archived";
}) {
  const supabase = await requireCatalogManager();
  const name = values.name.trim();
  const slug = slugify(name);
  if (!name || !slug) return { error: "Product name is required." };
  const { data: conflict } = await supabase.from("products").select("id").eq("slug",slug).neq("id",productId).maybeSingle();
  const { error } = await supabase.from("products").update({
    name, slug: conflict ? slug + "-" + productId.slice(0,8) : slug,
    pet_type: values.petType, short_description: values.shortDescription.trim() || null,
    description: values.description.trim() || null, material: values.material.trim() || null,
    care_instructions: values.careInstructions.trim() || null, status: values.status,
    published_at: values.status === "active" ? new Date().toISOString() : null,
  }).eq("id",productId);
  if (error) return { error: error.message };
  revalidatePath("/admin/products"); revalidatePath("/shop"); revalidatePath("/collections");
  return { success: true };
}

export async function updateVariant(productId: string, variant: {
  id?: string; sku: string; variantName: string; color: string; size: string; price: string; compareAtPrice: string;
}) {
  const supabase = await requireCatalogManager();
  if (!variant.sku.trim()) return { error: "SKU is required." };
  const price = variant.price.trim() ? Number(variant.price) : null;
  const compare = variant.compareAtPrice.trim() ? Number(variant.compareAtPrice) : null;
  if ((price !== null && (!Number.isFinite(price)||price<0))||(compare!==null&&(!Number.isFinite(compare)||compare<0))) return {error:"Enter valid non-negative prices."};
  const values = {product_id:productId,sku:variant.sku.trim(),variant_name:variant.variantName.trim()||null,color:variant.color.trim()||null,size:variant.size.trim()||null,price,compare_at_price:compare,currency:"USD"};
  if (variant.id) {
    const { error } = await supabase.from("product_variants").update(values).eq("id", variant.id).eq("product_id", productId);
    if (error) return { error: error.message };
    revalidatePath("/admin/products"); revalidatePath("/shop");
    return { success: true, variantId: variant.id };
  }
  const { data, error } = await supabase.from("product_variants").insert(values).select("id").single();
  if (error) return { error: error.message };
  revalidatePath("/admin/products"); revalidatePath("/shop");
  return { success: true, variantId: data.id };
}

export async function removeVariant(productId:string,variantId:string) {
 const supabase=await requireCatalogManager();
 const {error}=await supabase.from("product_variants").delete().eq("id",variantId).eq("product_id",productId);
 if(error)return {error:error.message}; revalidatePath("/admin/products"); return {success:true};
}

export async function reorderImages(productId:string, ids:string[]) {
 const supabase=await requireCatalogManager();
 const {data:owned,error:readError}=await supabase.from("product_images").select("id").eq("product_id",productId);
 if(readError)return {error:readError.message};
 const ownedIds=new Set((owned??[]).map(image=>image.id));
 if(ids.length!==ownedIds.size||ids.some(id=>!ownedIds.has(id))||new Set(ids).size!==ids.length){
  return {error:"The image list changed. Refresh the page and try again."};
 }
 const {error:clearError}=await supabase.from("product_images").update({is_primary:false,image_type:"gallery"}).eq("product_id",productId);
 if(clearError)return {error:clearError.message};
 for(let i=0;i<ids.length;i++){
  const {error}=await supabase.from("product_images").update({sort_order:i,is_primary:i===0,image_type:i===0?"main":"gallery"}).eq("id",ids[i]).eq("product_id",productId);
  if(error)return {error:error.message};
 }
 revalidatePath("/admin/products"); revalidatePath("/shop"); revalidatePath("/products"); return {success:true};
}

export async function removeImage(productId: string, imageId: string, _path: string) {
  const supabase = await requireCatalogManager();
  const { data: image, error: readError } = await supabase
    .from("product_images")
    .select("storage_path")
    .eq("id", imageId)
    .eq("product_id", productId)
    .maybeSingle();
  if (readError || !image) return { error: readError?.message || "Image not found." };

  const path = image.storage_path as string;
  try {
    if (path.startsWith("r2://")) {
      const config = getR2Config();
      await getR2Client().send(new DeleteObjectCommand({
        Bucket: config.bucket,
        Key: path.slice("r2://".length),
      }));
    } else if (path && !(path.startsWith("https://") || path.startsWith("http://"))) {
      const { error: storageError } = await supabase.storage.from("product-images").remove([path]);
      if (storageError) return { error: storageError.message };
    }
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Unable to delete image from storage." };
  }

  const { error } = await supabase.from("product_images").delete().eq("id", imageId).eq("product_id", productId);
  if (error) return { error: error.message };
  const { data: remaining, error: remainingError } = await supabase
    .from("product_images").select("id").eq("product_id", productId).order("sort_order", { ascending: true });
  if (remainingError) return { error: remainingError.message };
  const { error: clearError } = await supabase.from("product_images")
    .update({ is_primary: false, image_type: "gallery" }).eq("product_id", productId);
  if (clearError) return { error: clearError.message };
  for (let index = 0; index < (remaining ?? []).length; index++) {
    const { error: updateError } = await supabase.from("product_images")
      .update({ sort_order: index, is_primary: index === 0, image_type: index === 0 ? "main" : "gallery" })
      .eq("id", remaining![index].id).eq("product_id", productId);
    if (updateError) return { error: updateError.message };
  }
  revalidatePath("/admin/products");
  revalidatePath("/shop");
  revalidatePath("/products");
  return { success: true };
}

export async function addProductImage(productId: string, storagePath: string, altText: string): Promise<{ error?: string; success?: boolean; imageId?: string }> {
  const supabase = await requireCatalogManager();
  const isR2 = storagePath.startsWith("r2://");
  const objectKey = isR2 ? storagePath.slice("r2://".length) : storagePath;
  if (!objectKey.startsWith(`${productId}/`) || objectKey.includes("..")) {
    return { error: "Invalid image storage path." };
  }
  const { data: existing, error: readError } = await supabase
    .from("product_images")
    .select("id")
    .eq("product_id", productId);
  if (readError) return { error: readError.message };
  const isPrimary = (existing?.length ?? 0) === 0;
  const { data: insertedImage, error } = await supabase.from("product_images").insert({
    product_id: productId,
    storage_path: storagePath,
    alt_text: altText.trim() || null,
    image_type: isPrimary ? "main" : "gallery",
    sort_order: existing?.length ?? 0,
    is_primary: isPrimary,
  }).select("id").single();
  if (error) {
    try {
      if (isR2) {
        const config = getR2Config();
        await getR2Client().send(new DeleteObjectCommand({ Bucket: config.bucket, Key: objectKey }));
      } else {
        await supabase.storage.from("product-images").remove([storagePath]);
      }
    } catch (cleanupError) {
      console.error("Unable to clean up unlinked product image:", cleanupError);
    }
    return { error: error.message };
  }
  revalidatePath("/admin/products");
  revalidatePath("/shop");
  revalidatePath("/products");
  return { success: true, imageId: insertedImage.id };
}
