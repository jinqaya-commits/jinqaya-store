import { validateProductDimensions } from "@/lib/product-dimensions";

export type CatalogCompletenessInput = {
  dimensions?: unknown;
  images?: Array<{ alt_text?: string | null }>;
  variants?: Array<{ is_active?: boolean | null; sku?: string | null }>;
  categories?: Array<{ is_primary?: boolean | null; is_active?: boolean | null; parent_id?: string | null }>;
};

export function getCatalogCompleteness(product: CatalogCompletenessInput) {
  const missing: string[] = [];
  const variants = (product.variants ?? []).filter((variant) => variant.is_active !== false);
  if (variants.length === 0 || variants.some((variant) => !variant.sku?.trim())) {
    missing.push("SKU");
  }

  if (!validateProductDimensions(product.dimensions)) {
    missing.push("Dimensions");
  }

  const images = product.images ?? [];
  if (images.some((image) => !image.alt_text?.trim())) {
    missing.push("Image Alt Text");
  } else if (images.length === 0) {
    missing.push("Product Images");
  }

  const hasActivePrimaryCategory = (product.categories ?? []).some(
    (category) => category.is_primary && category.is_active && Boolean(category.parent_id),
  );
  if (!hasActivePrimaryCategory) missing.push("Category");

  return { complete: missing.length === 0, missing };
}
