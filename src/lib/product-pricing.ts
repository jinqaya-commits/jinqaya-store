import type { StoreProductVariant } from "@/lib/products";

export function formatProductPrice(variants: StoreProductVariant[]): string | null {
  const prices = variants
    .filter((variant) => variant.is_active)
    .map((variant) => variant.price)
    .filter((price): price is number => price !== null && Number.isFinite(price));

  if (prices.length === 0) return null;
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const currency = variants.find((variant) => variant.is_active && variant.price !== null)?.currency ?? "USD";
  const format = (value: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency }).format(value);

  return min === max ? format(min) : `From ${format(min)}`;
}
