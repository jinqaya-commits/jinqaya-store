import { createClient } from "@/lib/supabase/server";

export type StoreProductImage = {
  id: string;
  storage_path: string;
  alt_text: string | null;
  image_type: string;
  sort_order: number;
  is_primary: boolean;
  url: string | null;
};

export type StoreProductVariant = {
  id: string;
  sku: string;
  variant_name: string | null;
  color: string | null;
  size: string | null;
  material: string | null;
  option_values: Record<string, unknown>;
  price: number | null;
  compare_at_price: number | null;
  currency: string;
  weight_grams: number | null;
  is_active: boolean;
};

export type StoreProduct = {
  id: string;
  name: string;
  slug: string;
  short_description: string | null;
  description: string | null;
  pet_type: string;
  brand_name: string;
  material: string | null;
  care_instructions: string | null;
  is_featured: boolean;
  is_new_arrival: boolean;
  seo_title: string | null;
  seo_description: string | null;
  variants: StoreProductVariant[];
  images: StoreProductImage[];
};

type ProductRow = Omit<StoreProduct, "variants" | "images">;

function resolveImageUrl(path: string): string | null {
  if (/^https?:\/\//i.test(path)) return path;

  const bucket = process.env.NEXT_PUBLIC_SUPABASE_PRODUCT_IMAGES_BUCKET;
  if (!bucket) return null;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return null;

  return `${url.replace(/\/$/, "")}/storage/v1/object/public/${bucket}/${path.replace(/^\//, "")}`;
}

async function attachProductData(rows: ProductRow[]): Promise<StoreProduct[]> {
  if (rows.length === 0) return [];

  let supabase;
  try { supabase = await createClient(); } catch (error) {
    console.error("Supabase is not configured for the storefront:", error);
    return rows.map((product) => ({ ...product, variants: [], images: [] }));
  }
  const ids = rows.map((product) => product.id);

  const [variantResult, imageResult] = await Promise.all([
    supabase
      .from("product_variants")
      .select("id, product_id, sku, variant_name, color, size, material, option_values, price, compare_at_price, currency, weight_grams, is_active")
      .in("product_id", ids)
      .eq("is_active", true)
      .order("created_at", { ascending: true }),
    supabase
      .from("product_images")
      .select("id, product_id, storage_path, alt_text, image_type, sort_order, is_primary")
      .in("product_id", ids)
      .order("is_primary", { ascending: false })
      .order("sort_order", { ascending: true }),
  ]);

  if (variantResult.error) {
    console.error("Unable to load product variants:", variantResult.error.message);
  }
  if (imageResult.error) {
    console.error("Unable to load product images:", imageResult.error.message);
  }

  return rows.map((product) => ({
    ...product,
    variants: (variantResult.data ?? [])
      .filter((variant) => variant.product_id === product.id)
      .map((variant) => ({
        id: variant.id,
        sku: variant.sku,
        variant_name: variant.variant_name,
        color: variant.color,
        size: variant.size,
        material: variant.material,
        option_values: (variant.option_values ?? {}) as Record<string, unknown>,
        price: variant.price === null ? null : Number(variant.price),
        compare_at_price: variant.compare_at_price === null ? null : Number(variant.compare_at_price),
        currency: variant.currency?.trim() || "USD",
        weight_grams: variant.weight_grams,
        is_active: variant.is_active,
      })),
    images: (imageResult.data ?? [])
      .filter((image) => image.product_id === product.id)
      .map((image) => ({
        id: image.id,
        storage_path: image.storage_path,
        alt_text: image.alt_text,
        image_type: image.image_type,
        sort_order: image.sort_order,
        is_primary: image.is_primary,
        url: resolveImageUrl(image.storage_path),
      })),
  }));
}

const productColumns = "id, name, slug, short_description, description, pet_type, brand_name, material, care_instructions, is_featured, is_new_arrival, seo_title, seo_description";

export async function getStoreProducts(categorySlug?: string): Promise<StoreProduct[]> {
  let supabase;
  try { supabase = await createClient(); } catch (error) {
    console.error("Supabase is not configured for the storefront:", error);
    return [];
  }
  let productIds: string[] | null = null;

  if (categorySlug) {
    const { data: category, error: categoryError } = await supabase
      .from("categories")
      .select("id")
      .eq("slug", categorySlug)
      .eq("is_active", true)
      .maybeSingle();

    if (categoryError || !category) return [];

    const { data: assignments, error: assignmentError } = await supabase
      .from("product_categories")
      .select("product_id")
      .eq("category_id", category.id);

    if (assignmentError) {
      console.error("Unable to load category products:", assignmentError.message);
      return [];
    }
    productIds = [...new Set((assignments ?? []).map((item) => item.product_id))];
    if (productIds.length === 0) return [];
  }

  let query = supabase
    .from("products")
    .select(productColumns)
    .eq("status", "active")
    .order("published_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (productIds) query = query.in("id", productIds);

  const { data, error } = await query;
  if (error) {
    console.error("Unable to load products:", error.message);
    return [];
  }

  return attachProductData((data ?? []) as ProductRow[]);
}

export async function getStoreProductBySlug(slug: string): Promise<StoreProduct | null> {
  let supabase;
  try { supabase = await createClient(); } catch (error) {
    console.error("Supabase is not configured for the storefront:", error);
    return null;
  }
  const { data, error } = await supabase
    .from("products")
    .select(productColumns)
    .eq("slug", slug)
    .eq("status", "active")
    .maybeSingle();

  if (error || !data) return null;
  const products = await attachProductData([data as ProductRow]);
  return products[0] ?? null;
}

export function formatProductPrice(variants: StoreProductVariant[]): string | null {
  const prices = variants
    .map((variant) => variant.price)
    .filter((price): price is number => price !== null && Number.isFinite(price));

  if (prices.length === 0) return null;
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const currency = variants.find((variant) => variant.price !== null)?.currency ?? "USD";

  const format = (value: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency }).format(value);

  return min === max ? format(min) : `From ${format(min)}`;
}
