"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProductReadiness } from "@/lib/product-readiness";

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
  categoryIds: string[];
  primaryCategoryId: string;
  petType: "cat" | "dog" | "both" | "shared";
  shortDescription: string;
  description: string;
  material: string;
  careInstructions: string;
  seoTitle: string;
  seoDescription: string;
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
  const categoryIds = [...new Set(input.categoryIds.filter(Boolean))];
  if (!categoryIds.length) return { error: "Please choose at least one category." };
  if (!input.primaryCategoryId || !categoryIds.includes(input.primaryCategoryId)) return { error: "Choose one selected category as the primary category." };
  const { data: selectedCategories, error: categoryReadError } = await supabase
    .from("categories").select("id,parent_id,is_active").in("id",categoryIds);
  if (categoryReadError) return { error: categoryReadError.message };
  if ((selectedCategories ?? []).length !== categoryIds.length ||
      (selectedCategories ?? []).some(category => !category.is_active || !category.parent_id)) {
    return { error: "All selected categories must be active subcategories." };
  }
  if (input.status === "active") return { error: "New products are created as drafts. Complete the product information, add images and a priced SKU, then publish from the product list." };

  const price = input.sku.trim() && input.price.trim() ? Number(input.price) : null;
  const compareAtPrice = input.sku.trim() && input.compareAtPrice.trim() ? Number(input.compareAtPrice) : null;
  if ((price !== null && (!Number.isFinite(price) || price < 0)) ||
      (compareAtPrice !== null && (!Number.isFinite(compareAtPrice) || compareAtPrice < 0))) {
    return { error: "Enter valid non-negative prices." };
  }

  const { data: existing, error: slugReadError } = await supabase
    .from("products").select("id").eq("slug", slug).maybeSingle();
  if (slugReadError) return { error: slugReadError.message };
  const uniqueSlug = existing ? `${slug}-${Date.now().toString(36)}` : slug;

  const { data: productId, error } = await supabase.rpc("admin_save_product_catalog", {
    p_product_id: null,
    p_product: {
      name, slug: uniqueSlug, pet_type: input.petType,
      short_description: input.shortDescription.trim() || null,
      description: input.description.trim() || null,
      material: input.material.trim() || null,
      care_instructions: input.careInstructions.trim() || null,
      seo_title: input.seoTitle.trim() || null,
      seo_description: input.seoDescription.trim() || null,
      status: "draft",
    },
    p_category_ids: categoryIds,
    p_primary_category_id: input.primaryCategoryId,
    p_variant: input.sku.trim() ? {
      sku: input.sku.trim(),
      variant_name: input.variantName.trim() || null,
      color: input.color.trim() || null,
      size: input.size.trim() || null,
      price,
      compare_at_price: compareAtPrice,
    } : null,
  });
  if (error || !productId) return { error: error?.message || "Unable to create product." };

  revalidatePath("/admin/products");
  revalidatePath("/shop");
  revalidatePath("/collections");
  return { productId };
}
async function applyProductStatus(
  supabase: Awaited<ReturnType<typeof createClient>>,
  productId: string,
  status: "draft" | "active",
): Promise<string | null> {
  if (status === "active") {
    const [{ data: product, error: productError }, { data: images, error: imagesError }, { data: variants, error: variantsError }, { data: categoryLinks, error: categoriesError }] = await Promise.all([
      supabase.from("products").select("short_description,description,material,seo_title,seo_description").eq("id", productId).maybeSingle(),
      supabase.from("product_images").select("alt_text,is_primary").eq("product_id", productId),
      supabase.from("product_variants").select("sku,price,is_active").eq("product_id", productId),
      supabase.from("product_categories").select("is_primary,categories(parent_id,is_active)").eq("product_id", productId),
    ]);
    if (productError || imagesError || variantsError || categoriesError) {
      return productError?.message || imagesError?.message || variantsError?.message || categoriesError?.message || "Unable to check product readiness.";
    }
    if (!product) return "Product not found.";
    const readiness = getProductReadiness({
      ...product,
      images: images ?? [],
      variants: variants ?? [],
      categories: (categoryLinks ?? []).map((link) => {
        const category = Array.isArray(link.categories) ? link.categories[0] : link.categories;
        return { is_primary: link.is_primary, parent_id: category?.parent_id ?? null, is_active: category?.is_active ?? false };
      }),
    });
    if (!readiness.ready) return "Complete the product checklist before publishing: " + readiness.missing.join(", ") + ".";
  }
  const { data, error } = await supabase.from("products").update({
    status,
    published_at: status === "active" ? new Date().toISOString() : null,
  }).eq("id", productId).select("id").maybeSingle();
  if (error) return error.message;
  if (!data) return "Product not found.";
  return null;
}

export async function setProductStatus(productId: string, status: "draft" | "active" | "archived") {
  const supabase = await requireCatalogManager();
  if (status === "archived") {
    const { error } = await supabase.from("products").update({ status, published_at: null }).eq("id", productId);
    if (error) return { error: error.message };
  } else {
    const error = await applyProductStatus(supabase, productId, status);
    if (error) return { error };
  }
  revalidatePath("/admin/products");
  revalidatePath("/shop");
  revalidatePath("/collections");
  revalidatePath("/products");
  return { success: true };
}

export async function bulkSetProductStatus(productIds: string[], status: "draft" | "active") {
  const supabase = await requireCatalogManager();
  if (status !== "active" && status !== "draft") return { error: "Unsupported product status." };
  const ids = [...new Set((Array.isArray(productIds) ? productIds : []).filter((id) => typeof id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)))];
  if (ids.length === 0) return { error: "Select at least one valid product." };
  if (ids.length > 300) return { error: "Select no more than 300 products per batch." };
  const results: { productId: string; success: boolean; error?: string }[] = [];
  for (const productId of ids) {
    try {
      const error = await applyProductStatus(supabase, productId, status);
      results.push(error ? { productId, success: false, error } : { productId, success: true });
    } catch (caught) {
      results.push({ productId, success: false, error: caught instanceof Error ? caught.message : "Update failed." });
    }
  }
  revalidatePath("/admin/products");
  revalidatePath("/shop");
  revalidatePath("/collections");
  revalidatePath("/products");
  return { results };
}

export async function updateProduct(productId: string, values: {
  name: string; petType: "cat"|"dog"|"both"|"shared"; shortDescription: string;
  description: string; material: string; careInstructions: string; seoTitle: string; seoDescription: string;
  status: "draft"|"active"|"archived"; categoryIds: string[]; primaryCategoryId: string;
}) {
  const supabase = await requireCatalogManager();
  const name = values.name.trim();
  const slug = slugify(name);
  if (!name || !slug) return { error: "Product name is required." };

  const categoryIds = [...new Set(values.categoryIds.filter(Boolean))];
  if (!categoryIds.length) return { error: "Select at least one product category." };
  if (!values.primaryCategoryId || !categoryIds.includes(values.primaryCategoryId)) {
    return { error: "Choose one of the selected categories as the primary category." };
  }

  const { data: selectedCategories, error: categoryReadError } = await supabase
    .from("categories")
    .select("id,parent_id,is_active")
    .in("id", categoryIds);
  if (categoryReadError) return { error: categoryReadError.message };
  if ((selectedCategories ?? []).length !== categoryIds.length ||
      (selectedCategories ?? []).some(category => !category.is_active || !category.parent_id)) {
    return { error: "All selected categories must be active subcategories." };
  }

  if (values.status === "active") {
    const [{ data: images }, { data: variants }] = await Promise.all([
      supabase.from("product_images").select("alt_text,is_primary").eq("product_id", productId),
      supabase.from("product_variants").select("sku,price,is_active").eq("product_id", productId),
    ]);
    const categoryRows = (selectedCategories ?? []).map(category => ({
      is_primary: category.id === values.primaryCategoryId,
      parent_id: category.parent_id,
      is_active: category.is_active,
    }));
    const readiness = getProductReadiness({
      shortDescription: values.shortDescription,
      description: values.description,
      material: values.material,
      seoTitle: values.seoTitle,
      seoDescription: values.seoDescription,
      images: images ?? [],
      variants: variants ?? [],
      categories: categoryRows,
    });
    if (!readiness.ready) return { error: "Complete the product checklist before publishing: " + readiness.missing.join(", ") + "." };
  }

  const { data: conflict, error: conflictError } = await supabase.from("products")
    .select("id").eq("slug", slug).neq("id", productId).maybeSingle();
  if (conflictError) return { error: conflictError.message };

  const { error: saveError } = await supabase.rpc("admin_save_product_catalog", {
    p_product_id: productId,
    p_product: {
      name,
      slug: conflict ? `${slug}-${productId.slice(0, 8)}` : slug,
      pet_type: values.petType,
      short_description: values.shortDescription.trim() || null,
      description: values.description.trim() || null,
      material: values.material.trim() || null,
      care_instructions: values.careInstructions.trim() || null,
      seo_title: values.seoTitle.trim() || null,
      seo_description: values.seoDescription.trim() || null,
      status: values.status,
    },
    p_category_ids: categoryIds,
    p_primary_category_id: values.primaryCategoryId,
    p_variant: null,
  });
  if (saveError) return { error: saveError.message };

  revalidatePath("/admin/products"); revalidatePath("/shop"); revalidatePath("/collections");
  for (const categoryId of categoryIds) {
    const category = (selectedCategories ?? []).find(item => item.id === categoryId);
    if (category) revalidatePath(`/collections/${categoryId}`);
  }
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
 const {error}=await supabase.rpc("admin_reorder_product_images",{
  p_product_id:productId,
  p_image_ids:ids,
 });
 if(error)return {error:error.message};
 revalidatePath("/admin/products");
 revalidatePath("/shop");
 revalidatePath("/products");
 return {success:true};
}

export async function removeImage(productId: string, imageId: string, _path: string) {
  const supabase = await requireCatalogManager();
  const { error } = await supabase.rpc("admin_delete_product_image", {
    p_product_id: productId,
    p_image_id: imageId,
  });
  if (error) return { error: error.message };

  // The database function queues the detached object. The worker checks that no
  // product image row still references the path before deleting the stored file.

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

  const { data: imageId, error } = await supabase.rpc("admin_add_product_image", {
    p_product_id: productId,
    p_storage_path: storagePath,
    p_alt_text: altText,
  });

  if (error || !imageId) {
    // The upload intent remains pending and the scheduled worker will remove
    // this object after its signed upload URL has expired.
    return { error: error?.message || "Unable to save product image." };
  }

  revalidatePath("/admin/products");
  revalidatePath("/shop");
  revalidatePath("/products");
  return { success: true, imageId };
}


export async function replaceProductImage(productId: string, imageId: string, storagePath: string) {
  const supabase = await requireCatalogManager();
  const isR2 = storagePath.startsWith("r2://");
  const objectKey = isR2 ? storagePath.slice("r2://".length) : storagePath;
  if (!objectKey.startsWith(`${productId}/`) || objectKey.includes("..")) {
    return { error: "Invalid image storage path." };
  }

  // Replace the row and enqueue its detached previous object in one database
  // transaction. If queue insertion fails, the image update rolls back too.
  const { error: replaceError } = await supabase.rpc("admin_replace_product_image", {
    p_product_id: productId,
    p_image_id: imageId,
    p_storage_path: storagePath,
  });
  if (replaceError) {
    // Keep the upload intent pending; the worker waits until the signed URL
    // has expired before deleting an un-attached object.
    return { error: replaceError.message };
  }

  const { data: product } = await supabase.from("products").select("slug").eq("id", productId).maybeSingle();
  revalidatePath("/admin/products");
  revalidatePath("/shop");
  revalidatePath("/products");
  if (product?.slug) revalidatePath(`/products/${product.slug}`);
  return { success: true };
}


export async function updateProductImageAlt(productId: string, imageId: string, altText: string) {
  const supabase = await requireCatalogManager();
  const cleanAlt = altText.trim();
  if (!cleanAlt) return { error: "Image alt text cannot be empty." };
  if (cleanAlt.length > 180) return { error: "Image alt text must be 180 characters or fewer." };
  const { error } = await supabase.from("product_images")
    .update({ alt_text: cleanAlt })
    .eq("id", imageId)
    .eq("product_id", productId);
  if (error) return { error: error.message };
  const { data: product } = await supabase.from("products").select("slug").eq("id", productId).maybeSingle();
  revalidatePath("/admin/products");
  if (product?.slug) revalidatePath(`/products/${product.slug}`);
  revalidatePath("/shop");
  return { success: true };
}
