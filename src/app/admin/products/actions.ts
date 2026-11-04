"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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
