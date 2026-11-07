"use client";

import { useState, useTransition, type FormEvent } from "react";
import { recordInventoryMovementAction } from "../orders/actions";

export function InventoryMovementForm({ variantId, sku }: { variantId: string; sku: string }) {
  const [type, setType] = useState("purchase_receipt");
  const [quantity, setQuantity] = useState("1");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const [busy, start] = useTransition();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setDone("");
    const data = new FormData();
    data.set("variant_id", variantId);
    data.set("movement_type", type);
    data.set("quantity", quantity);
    data.set("notes", notes);
    start(async () => {
      const result = await recordInventoryMovementAction(data);
      if (result.error) { setError(result.error); return; }
      setDone("Movement recorded");
      setNotes("");
    });
  }

  return <details className="inventory-movement-details">
    <summary>Record movement</summary>
    <form className="inventory-movement-form" onSubmit={submit}>
      <label>Movement type
        <select value={type} onChange={(event) => setType(event.target.value)}>
          <option value="purchase_receipt">Stock received (+)</option>
          <option value="customer_return">Customer return (+)</option>
          <option value="supplier_return">Return to supplier (−)</option>
          <option value="damage">Mark as damaged</option>
        </select>
      </label>
      <label>Quantity<input aria-label={sku + " movement quantity"} type="number" min="1" max="1000000" step="1" value={quantity} onChange={(event) => setQuantity(event.target.value)} /></label>
      <label>Reason<input aria-label={sku + " movement reason"} value={notes} onChange={(event) => setNotes(event.target.value)} minLength={3} maxLength={500} required placeholder="e.g. Supplier delivery reference" /></label>
      <button className="admin-secondary-button" disabled={busy} type="submit">{busy ? "Saving…" : "Save movement"}</button>
      {error && <span className="inventory-inline-error">{error}</span>}
      {done && <span className="inventory-inline-success">{done}</span>}
    </form>
  </details>;
}
