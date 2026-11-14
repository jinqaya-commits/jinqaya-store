"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { createProduct, type CreateProductInput } from "../actions";

type Category = { id: string; name: string; slug: string };
type ParsedRow = { line: number; values: Record<string, string>; error?: string };

const HEADERS = ["name","category_slug","pet_type","short_description","description","material","care_instructions","seo_title","seo_description","sku","variant_name","color","size","price","compare_at_price"];
const TEMPLATE = [
  HEADERS.join(","),
  '"Everyday Travel Carrier","walk-travel","both","A practical carrier for everyday outings.","","Polyester","","","","JQ-WT-001-BE","Beige","Beige","One Size","39.99",""',
].join("\r\n");

function parseCsv(source: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = "", quoted = false;
  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (quoted) {
      if (char === '"' && source[i + 1] === '"') { cell += '"'; i++; }
      else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"' && cell.length === 0) quoted = true;
    else if (char === ",") { row.push(cell); cell = ""; }
    else if (char === "\n") { row.push(cell.replace(/\r$/, "")); rows.push(row); row = []; cell = ""; }
    else cell += char;
  }
  if (quoted) throw new Error("The CSV contains an unclosed quotation mark.");
  if (cell.length || row.length) { row.push(cell.replace(/\r$/, "")); rows.push(row); }
  return rows.filter((item) => item.some((value) => value.trim() !== ""));
}

function downloadTemplate() {
  const blob = new Blob(["\uFEFF" + TEMPLATE], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url; anchor.download = "jinqaya-product-import-template.csv"; anchor.click();
  URL.revokeObjectURL(url);
}

export function ProductCsvImport({ categories }: { categories: Category[] }) {
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [error, setError] = useState("");
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<{ line: number; name: string; error?: string }[]>([]);
  const categoryBySlug = useMemo(() => new Map(categories.map((item) => [item.slug.toLowerCase(), item])), [categories]);

  async function readFile(file?: File) {
    setError(""); setRows([]); setResults([]);
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".csv")) { setError("Please choose a CSV file exported as UTF-8."); return; }
    if (file.size > 2 * 1024 * 1024) { setError("CSV files must be 2 MB or smaller."); return; }
    try {
      const parsed = parseCsv(await file.text());
      if (parsed.length < 2) throw new Error("The CSV needs a header row and at least one product row.");
      const headers = parsed[0].map((value) => value.trim().toLowerCase());
      const missing = ["name", "category_slug"].filter((key) => !headers.includes(key));
      if (missing.length) throw new Error("Missing required columns: " + missing.join(", "));
      const mapped = parsed.slice(1).map((values, index) => {
        const record = Object.fromEntries(headers.map((header, column) => [header, (values[column] ?? "").trim()]));
        let rowError = "";
        if (!record.name) rowError = "Product name is required.";
        else if (!categoryBySlug.has((record.category_slug || "").toLowerCase())) rowError = "Unknown category_slug. Use an active category slug.";
        else if (record.pet_type && !["cat", "dog", "both", "shared"].includes(record.pet_type.toLowerCase())) rowError = "pet_type must be cat, dog, both or shared.";
        else if (record.price && (!Number.isFinite(Number(record.price)) || Number(record.price) < 0)) rowError = "Price must be a non-negative number.";
        else if (record.compare_at_price && (!Number.isFinite(Number(record.compare_at_price)) || Number(record.compare_at_price) < 0)) rowError = "Compare-at price must be a non-negative number.";
        return { line: index + 2, values: record, error: rowError || undefined };
      });
      if (mapped.length > 50) throw new Error("Import up to 50 products per CSV file. Split larger catalogs into batches.");
      setRows(mapped);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to read this CSV."); }
  }

  async function importRows() {
    setRunning(true); setResults([]); setProgress(0); setError("");
    const completed: { line: number; name: string; error?: string }[] = [];
    const ready = rows.filter((row) => !row.error);
    for (let index = 0; index < ready.length; index++) {
      const row = ready[index];
      const v = row.values;
      const category = categoryBySlug.get(v.category_slug.toLowerCase());
      if (!category) continue;
      const input: CreateProductInput = {
        name: v.name, categoryIds: [category.id], primaryCategoryId: category.id,
        petType: (v.pet_type || "both").toLowerCase() as CreateProductInput["petType"],
        shortDescription: v.short_description || "", description: v.description || "",
        material: v.material || "", careInstructions: v.care_instructions || "",
        seoTitle: v.seo_title || "", seoDescription: v.seo_description || "",
        sku: v.sku || "", variantName: v.variant_name || "", color: v.color || "", size: v.size || "",
        price: v.price || "", compareAtPrice: v.compare_at_price || "", status: "draft",
      };
      try {
        const result = await createProduct(input);
        completed.push({ line: row.line, name: v.name, error: result.error });
      } catch (caught) {
        completed.push({ line: row.line, name: v.name, error: caught instanceof Error ? caught.message : "Import failed." });
      }
      setProgress(index + 1);
      setResults([...completed]);
    }
    setRunning(false);
  }

  const validCount = rows.filter((row) => !row.error).length;
  const errorCount = rows.length - validCount;
  const successCount = results.filter((row) => !row.error).length;

  return <div className="admin-form">
    <section className="admin-form-section">
      <div className="admin-form-heading"><span>01</span><div><h2>Prepare your CSV</h2><p>Import up to 50 products per file. Each row creates a draft product and, if an SKU is supplied, its first variant. No products are published automatically.</p></div></div>
      <button type="button" className="admin-secondary-button" onClick={downloadTemplate}>Download CSV template</button>
      <p className="admin-help">Required columns: name, category_slug. Use an active category slug shown below. Optional pet_type values: cat, dog, both, shared. Prices are in USD. Product images are added separately in the product editor.</p>
      <div className="admin-category-options">{categories.map((category) => <div className="admin-category-option" key={category.id}><span>{category.name}</span><code>{category.slug}</code></div>)}</div>
      <label className="admin-upload">Choose CSV file<input type="file" accept=".csv,text/csv" disabled={running} onChange={(event) => { void readFile(event.target.files?.[0]); event.currentTarget.value = ""; }} /></label>
    </section>
    {error && <p className="admin-error" role="alert">{error}</p>}
    {rows.length > 0 && <section className="admin-form-section">
      <div className="admin-form-heading"><span>02</span><div><h2>Review import</h2><p>{rows.length} rows found · {validCount} ready · {errorCount} need correction</p></div></div>
      <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>CSV ROW</th><th>PRODUCT</th><th>CATEGORY</th><th>SKU</th><th>PRICE</th><th>CHECK</th></tr></thead><tbody>
        {rows.map((row) => <tr key={row.line}><td>{row.line}</td><td>{row.values.name || "—"}</td><td>{row.values.category_slug || "—"}</td><td>{row.values.sku || "—"}</td><td>{row.values.price || "—"}</td><td>{row.error ? <span className="admin-status status-draft">{row.error}</span> : <span className="admin-status status-active">Ready</span>}</td></tr>)}
      </tbody></table></div>
      <button type="button" className="admin-primary-button" disabled={running || validCount === 0} onClick={() => void importRows()}>{running ? `Importing ${progress}/${validCount}…` : `Import ${validCount} draft products`}</button>
    </section>}
    {results.length > 0 && <section className="admin-form-section"><div className="admin-form-heading"><span>03</span><div><h2>Import results</h2><p>{successCount} created · {results.length - successCount} failed</p></div></div><ul>{results.map((item) => <li key={item.line}>Row {item.line}: {item.name} — {item.error || "Created as draft"}</li>)}</ul><Link className="admin-primary-button" href="/admin/products">Return to products</Link></section>}
  </div>;
}
