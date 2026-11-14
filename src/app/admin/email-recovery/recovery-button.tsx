"use client";

import { useState } from "react";

export default function OrderEmailRecoveryButton() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function runRecovery() {
    setBusy(true);
    setResult(null);
    try {
      const response = await fetch("/api/admin/order-email-recovery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: "9f15c369-d5f6-4997-88b8-6eb164ced653" }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Request failed");
      setResult(`Processed: ${data.processed}; sent: ${data.sent}; retrying: ${data.retried}; failed: ${data.dead}`);
    } catch (error) {
      setResult(error instanceof Error ? error.message : "Unable to process emails");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="admin-panel">
      <div className="admin-panel-heading">
        <div><p className="admin-kicker">PREVIEW ONLY</p><h2>Sandbox order email recovery</h2></div>
      </div>
      <p className="admin-help">This one-time action processes only the three queued emails for test order JQ-20261113-4B662A25. It does not create or charge an order.</p>
      <button type="button" onClick={runRecovery} disabled={busy} className="admin-primary-button">
        {busy ? "Processing…" : "Send the three queued emails"}
      </button>
      {result && <p role="status" className="admin-help" aria-live="polite">{result}</p>}
    </section>
  );
}
