"use client";

import type { ProductDimensions, ProductDimensionShape } from "@/lib/product-dimensions";

const shapeOptions: { value: ProductDimensionShape; label: string; hint: string }[] = [
  { value: "rectangular", label: "Rectangular / square", hint: "Length × Width × Height" },
  { value: "round", label: "Round", hint: "Diameter × Height" },
  { value: "oval", label: "Oval", hint: "Length × Width × Height" },
  { value: "irregular", label: "Irregular", hint: "Overall length × width × maximum height" },
  { value: "flat", label: "Flat", hint: "Length × Width" },
  { value: "soft", label: "Soft / flexible", hint: "Measure in its stated natural condition" },
];

export function ProductDimensionsFields({ value, onChange }: { value: ProductDimensions | null; onChange: (value: ProductDimensions | null) => void }) {
  const shape = value?.shape ?? "rectangular";
  const unit = value?.unit ?? "cm";
  const set = (patch: Partial<ProductDimensions>) => onChange({ shape, unit, ...value, ...patch } as ProductDimensions);
  const field = (key: "length" | "width" | "height" | "diameter", label: string) => (
    <label>{label}<input type="number" min="0.01" step="0.01" value={value?.[key] ?? ""} onChange={event => set({ [key]: event.target.value === "" ? undefined : Number(event.target.value) })} placeholder="Enter verified measurement" /></label>
  );
  return <section className="admin-form-section">
    <div className="admin-form-heading"><span>DIMENSIONS</span><div><h2>Product measurements</h2><p>Choose the product's actual shape. Enter confirmed measurements only; leave this section blank if dimensions have not been verified.</p></div></div>
    <div className="admin-form-grid">
      <label>Product shape<select value={shape} onChange={event => onChange({ shape: event.target.value as ProductDimensionShape, unit })}>{shapeOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
      <label>Unit<select value={unit} onChange={event => set({ unit: event.target.value as "cm" | "in" })}><option value="cm">Centimeters (cm)</option><option value="in">Inches (in)</option></select></label>
    </div>
    <p className="admin-help">Measurement format: {shapeOptions.find(option => option.value === shape)?.hint}. Measurements describe the product itself, not its shipping carton.</p>
    <div className="admin-form-grid">
      {shape === "round" ? <>{field("diameter", "Diameter")}{field("height", "Height")}</> : <>
        {field("length", shape === "irregular" ? "Overall length" : "Length")}
        {field("width", shape === "irregular" ? "Overall width" : "Width")}
        {shape !== "flat" && field("height", shape === "irregular" ? "Maximum height" : "Height")}
      </>}
    </div>
    {(shape === "irregular" || shape === "soft") && <label>Measurement note (optional)<input maxLength={180} value={value?.measurement_note ?? ""} onChange={event => set({ measurement_note: event.target.value })} placeholder="e.g. Measured in its natural, uncompressed state" /></label>}
  </section>;
}
