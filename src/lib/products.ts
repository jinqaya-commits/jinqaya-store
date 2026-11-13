import { resolveProductImageUrls } from "@/lib/product-images";
import { createClient } from "@/lib/supabase/server";

export type StoreProductImage = {
  id: string;
  storage_path: string;
  alt_text: string | null;
  image_type: string;
  sort_order: number;
  is_primary: boolean;
  url: string | null;
  original_url: string | null;
  thumbnail_url: string | null;
  detail_url: string | null;
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
  primary_category?: { name: string; slug: string } | null;
};

type ProductRow = Omit<StoreProduct, "variants" | "images">;

function isNextDynamicServerUsageError(error: unknown): error is Error & { digest: string } {
  return typeof error === "object" && error !== null &&
    "digest" in error && error.digest === "DYNAMIC_SERVER_USAGE";
}


async function attachProductData(rows: ProductRow[]): Promise<StoreProduct[]> {
  if (rows.length === 0) return [];

  let supabase;
  try { supabase = await createClient(); } catch (error) {
    if (isNextDynamicServerUsageError(error)) throw error;
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
        ...(() => {
          const urls = resolveProductImageUrls(image.storage_path);
          return {
            url: urls.detailUrl,
            original_url: urls.originalUrl,
            thumbnail_url: urls.thumbnailUrl,
            detail_url: urls.detailUrl,
          };
        })(),
      })),
  }));
}

const productColumns = "id, name, slug, short_description, description, pet_type, brand_name, material, care_instructions, is_featured, is_new_arrival, seo_title, seo_description";

export async function getStoreProducts(categorySlug?: string): Promise<StoreProduct[]> {
  let supabase;
  try { supabase = await createClient(); } catch (error) {
    if (isNextDynamicServerUsageError(error)) throw error;
    console.error("Supabase is not configured for the storefront:", error);
    return [];
  }
  let productIds: string[] | null = null;

  if (categorySlug) {
    const { data: categoryRows, error: categoryError } = await supabase
      .from("categories").select("id,parent_id,slug,is_active");
    if (categoryError) {
      console.error("Unable to load categories:", categoryError.message);
      return [];
    }
    const category = (categoryRows ?? []).find(row => row.slug === categorySlug && row.is_active);
    if (!category) return [];
    const descendants = new Set<string>([category.id]);
    let frontier = [category.id];
    while (frontier.length) {
      const next = (categoryRows ?? []).filter(row => row.is_active && row.parent_id && frontier.includes(row.parent_id)).map(row => row.id);
      next.forEach(id => descendants.add(id));
      frontier = next;
    }
    const { data: assignments, error: assignmentError } = await supabase
      .from("product_categories").select("product_id").in("category_id", [...descendants]);
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
    // Keep internal checkout fixtures out of every public storefront listing.
    .not("slug", "in", '("preview-checkout-test-item","test-harness-item")')
    .order("published_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (productIds) query = query.in("id", productIds);

  const { data, error } = await query;
  if (error) {
    console.error("Unable to load products:", error.message);
    return [];
  }

  const productRows = (data ?? []) as ProductRow[];
  const [products, categoryResult] = await Promise.all([
    attachProductData(productRows),
    supabase
      .from("product_categories")
      .select("product_id,is_primary,categories(name,slug)")
      .in("product_id", productRows.map((product) => product.id))
      .eq("is_primary", true),
  ]);

  if (categoryResult.error) {
    console.error("Unable to load primary product categories:", categoryResult.error.message);
    return products;
  }

  const primaryCategories = new Map(
    (categoryResult.data ?? []).map((item) => [
      item.product_id,
      item.categories as unknown as { name: string; slug: string } | null,
    ]),
  );

  return products.map((product) => ({
    ...product,
    primary_category: primaryCategories.get(product.id) ?? null,
  }));
}

export async function getStoreProductBySlug(slug: string): Promise<StoreProduct | null> {
  let supabase;
  try { supabase = await createClient(); } catch (error) {
    if (isNextDynamicServerUsageError(error)) throw error;
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
  const { data: categoryLink } = await supabase
    .from("product_categories")
    .select("categories(name,slug)")
    .eq("product_id", data.id)
    .eq("is_primary", true)
    .maybeSingle();
  const linked = categoryLink?.categories as unknown as { name: string; slug: string } | null;
  return products[0] ? { ...products[0], primary_category: linked ?? null } : null;
}

export { formatProductPrice } from "@/lib/product-pricing";
