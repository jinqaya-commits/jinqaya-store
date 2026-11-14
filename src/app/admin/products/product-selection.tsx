"use client";

import { createContext, useContext, useMemo, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { bulkSetProductStatus } from "./actions";

type ProductOption = { id: string; name: string; status: string };
type SelectionContextValue = {
  selected: Set<string>;
  toggle: (id: string) => void;
  toggleAll: () => void;
  allSelected: boolean;
  products: ProductOption[];
};
const SelectionContext = createContext<SelectionContextValue | null>(null);

export function ProductSelectionProvider({ products, children }: { products: ProductOption[]; children: ReactNode }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const ids = useMemo(() => products.map((product) => product.id), [products]);
  const allSelected = ids.length > 0 && ids.every((id) => selected.has(id));
  const value = useMemo<SelectionContextValue>(() => ({
    selected,
    toggle: (id) => setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    }),
    toggleAll: () => setSelected((current) => allSelected ? new Set() : new Set(ids)),
    allSelected,
    products,
  }), [selected, allSelected, ids, products]);
  return <SelectionContext.Provider value={value}>{children}</SelectionContext.Provider>;
}

function useProductSelection() {
  const value = useContext(SelectionContext);
  if (!value) throw new Error("Product selection controls must be inside ProductSelectionProvider.");
  return value;
}

export function ProductSelectionCheckbox({ productId }: { productId: string }) {
  const { selected, toggle } = useProductSelection();
  return <input
    type="checkbox"
    aria-label="Select product"
    checked={selected.has(productId)}
    onChange={() => toggle(productId)}
    style={{ width: 16, height: 16, accentColor: "#365344", cursor: "pointer" }}
  />;
}

export function ProductSelectionHeader() {
  const { allSelected, toggleAll } = useProductSelection();
  return <input
    type="checkbox"
    aria-label="Select all products"
    checked={allSelected}
    onChange={toggleAll}
    style={{ width: 16, height: 16, accentColor: "#365344", cursor: "pointer" }}
  />;
}

export function ProductBulkToolbar() {
  const { selected, products, toggleAll } = useProductSelection();
  const [pending, startTransition] = useTransition();
  const [report, setReport] = useState<{ success: number; failures: { name: string; error: string }[] } | null>(null);
  const router = useRouter();

  function apply(status: "active" | "draft") {
    const ids = [...selected];
    if (!ids.length || pending) return;
    const action = status === "active" ? "publish" : "unpublish";
    const names = new Map(products.map((product) => [product.id, product.name]));
    if (!window.confirm(`You are about to ${action} ${ids.length} selected product(s). ${status === "active" ? "Products that fail the publishing checklist will remain unpublished." : "Selected products will be removed from the storefront."} Continue?`)) return;
    setReport(null);
    startTransition(async () => {
      const result = await bulkSetProductStatus(ids, status);
      if (result.error) {
        setReport({ success: 0, failures: [{ name: "Batch", error: result.error }] });
        return;
      }
      const rows = result.results ?? [];
      const failures = rows.filter((row) => !row.success).map((row) => ({
        name: names.get(row.productId) ?? row.productId,
        error: row.error ?? "Update failed.",
      }));
      setReport({ success: rows.filter((row) => row.success).length, failures });
      if (failures.length === 0) toggleAll();
      router.refresh();
    });
  }

  return <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, marginBottom: 16 }}>
    <span className="admin-help" style={{ margin: 0 }}>{selected.size} selected</span>
    <button type="button" className="admin-secondary-button" disabled={!selected.size || pending} onClick={() => apply("active")}>{pending ? "Updating…" : "Publish selected"}</button>
    <button type="button" className="admin-secondary-button" disabled={!selected.size || pending} onClick={() => apply("draft")}>{pending ? "Updating…" : "Unpublish selected"}</button>
    {report && <div role="status" style={{ flexBasis: "100%" }}>
      <p className={report.failures.length ? "admin-error" : "admin-help"}>{report.success} updated · {report.failures.length} failed</p>
      {report.failures.map((failure, index) => <p className="admin-error" key={index}>{failure.name}: {failure.error}</p>)}
    </div>}
  </div>;
}
