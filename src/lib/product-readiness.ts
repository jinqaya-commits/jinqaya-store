export type ProductReadinessInput = {
  shortDescription?: string | null;
  description?: string | null;
  material?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  images?: Array<{ alt_text?: string | null; is_primary?: boolean | null }>;
  variants?: Array<{ is_active?: boolean | null; sku?: string | null; price?: number | string | null }>;
  categories?: Array<{ is_primary?: boolean | null; is_active?: boolean | null; parent_id?: string | null }>;
};

export function getProductReadiness(product: ProductReadinessInput) {
  const missing: string[] = [];
  if (!product.shortDescription?.trim()) missing.push("Short description");
  if (!product.description?.trim()) missing.push("Full description");
  if (!product.material?.trim()) missing.push("Material");
  if (!product.seoTitle?.trim()) missing.push("SEO title");
  if (!product.seoDescription?.trim()) missing.push("SEO description");

  const images = product.images ?? [];
  if (images.length === 0) missing.push("Product images");
  else {
    if (!images.some((image) => image.is_primary)) missing.push("Main image");
    if (images.some((image) => !image.alt_text?.trim())) missing.push("Image alt text");
  }

  const activeVariants = (product.variants ?? []).filter((variant) => variant.is_active !== false);
  if (activeVariants.length === 0) missing.push("Active variant");
  else {
    if (activeVariants.some((variant) => !variant.sku?.trim())) missing.push("Variant SKU");
    if (activeVariants.some((variant) => variant.price == null || variant.price === "")) missing.push("Variant price");
  }

  const hasPrimaryActiveCategory = (product.categories ?? []).some(
    (category) => category.is_primary && category.is_active && Boolean(category.parent_id),
  );
  if (!hasPrimaryActiveCategory) missing.push("Active primary category");

  return { ready: missing.length === 0, missing };
}
