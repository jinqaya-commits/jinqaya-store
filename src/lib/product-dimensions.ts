export type ProductDimensionShape =
  | "rectangular"
  | "round"
  | "oval"
  | "irregular"
  | "flat"
  | "soft";

export type ProductDimensions = {
  shape: ProductDimensionShape;
  unit: "cm" | "in";
  length?: number;
  width?: number;
  height?: number;
  diameter?: number;
  measurement_note?: string;
};

const labels: Record<ProductDimensionShape, string> = {
  rectangular: "Length × Width × Height",
  round: "Diameter × Height",
  oval: "Length × Width × Height",
  irregular: "Overall Length × Overall Width × Maximum Height",
  flat: "Length × Width",
  soft: "Length × Width × Height",
};

function validNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

export function validateProductDimensions(value: unknown): value is ProductDimensions {
  if (!value || typeof value !== "object") return false;
  const dimensions = value as Record<string, unknown>;
  if (!["rectangular", "round", "oval", "irregular", "flat", "soft"].includes(String(dimensions.shape))) return false;
  if (dimensions.unit !== "cm" && dimensions.unit !== "in") return false;
  const shape = dimensions.shape as ProductDimensionShape;
  if (shape === "round") return validNumber(dimensions.diameter) && validNumber(dimensions.height);
  if (shape === "flat") return validNumber(dimensions.length) && validNumber(dimensions.width);
  return validNumber(dimensions.length) && validNumber(dimensions.width) && validNumber(dimensions.height);
}

export function formatProductDimensions(value: unknown): string | null {
  if (!validateProductDimensions(value)) return null;
  const d = value;
  const fmt = (n: number) => Number.isInteger(n) ? String(n) : String(Number(n.toFixed(2)));
  const unit = d.unit;
  if (d.shape === "round") return `Ø${fmt(d.diameter!)} × ${fmt(d.height!)} ${unit} (Diameter × H)`;
  if (d.shape === "flat") return `${fmt(d.length!)} × ${fmt(d.width!)} ${unit} (L × W)`;
  const prefix = d.shape === "irregular" ? "Overall " : "";
  const suffix = d.shape === "irregular" ? " (Overall L × W × Maximum H)" : " (L × W × H)";
  return `${prefix}${fmt(d.length!)} × ${fmt(d.width!)} × ${fmt(d.height!)} ${unit}${suffix}`;
}

export function productDimensionLabel(shape: ProductDimensionShape): string {
  return labels[shape];
}
