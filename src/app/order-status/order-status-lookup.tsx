"use client";

import Link from "next/link";
import { useState } from "react";

type OrderItem = { product_name: string; variant_name: string | null; quantity: number };
type Shipment = {
  status: string; carrier: string | null; tracking_number: string | null;
  tracking_url: string | null; shipped_at: string | null; delivered_at: string | null;
};
type CustomerOrder = {
  order_number: string; status: string; created_at: string; currency: string;
  subtotal: number | string; shipping_amount: number | string | null;
  total_amount: number | string | null; shipping_method: string | null;
  items: OrderItem[]; shipment: Shipment | null;
};

const labels: Record<string, string> = {
  on_hold: "Under review", pending_payment: "Awaiting payment", paid: "Payment confirmed",
  processing: "Being prepared", partially_shipped: "Partially shipped", shipped: "Shipped",
  delivered: "Delivered", cancelled: "Cancelled", partially_refunded: "Partially refunded",
  refunded: "Refunded",
};
const steps = [
  { key: "on_hold", title: "Order received", detail: "We are reviewing availability and delivery options." },
  { key: "pending_payment", title: "Shipping confirmed", detail: "Your final total and payment arrangements are ready." },
  { key: "paid", title: "Payment confirmed", detail: "Payment has been verified." },
  { key: "processing", title: "Preparing your order", detail: "Your order is being prepared." },
  { key: "shipped", title: "Shipped", detail: "Your parcel is on its way." },
  { key: "delivered", title: "Delivered", detail: "Your order has been marked as delivered." },
];

function money(value: number | string | null, currency: string) {
  if (value === null || value === "") return "To be confirmed";
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "To be confirmed";
  try { return new Intl.NumberFormat("en-US", { style: "currency", currency: currency || "USD" }).format(amount); }
  catch { return amount.toFixed(2) + " " + currency; }
}

export function OrderStatusLookup() {
  const [orderNumber, setOrderNumber] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [stage, setStage] = useState<"details" | "code" | "result">("details");
  const [order, setOrder] = useState<CustomerOrder | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function post(path: string, body: unknown) {
    const response = await fetch(path, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body), cache: "no-store",
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Something went wrong.");
    return result;
  }

  async function requestCode() {
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await post("/api/order-status/request-code", { orderNumber, email });
      setNotice(result.message || "If the details match, a verification code will be sent.");
      setStage("code");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to request a code.");
    } finally { setBusy(false); }
  }

  async function verify() {
    setBusy(true); setError("");
    try {
      await post("/api/order-status/verify", { orderNumber, email, code });
      const response = await fetch("/api/order-status", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to retrieve your order.");
      setOrder(result.order as CustomerOrder);
      setStage("result");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to verify your email.");
    } finally { setBusy(false); }
  }

  async function refresh() {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/order-status", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Your verification has expired.");
      setOrder(result.order as CustomerOrder);
    } catch (caught) {
      setOrder(null); setStage("details");
      setError(caught instanceof Error ? caught.message : "Unable to refresh your order.");
    } finally { setBusy(false); }
  }

  async function endSession() {
    await fetch("/api/order-status", { method: "DELETE" });
    setOrder(null); setCode(""); setStage("details"); setNotice(""); setError("");
  }

  const status = order?.status || "";
  const currentIndex = status === "partially_shipped" ? 4 : steps.findIndex((step) => step.key === status);
  const terminal = status === "cancelled" || status === "refunded";

  return (
    <div className="order-status-lookup">
      {stage === "details" && (
        <section className="order-lookup-panel">
          <h2>Find your order</h2>
          <p>Enter the order reference from your confirmation and the email address used at checkout.</p>
          <label>Order number<input value={orderNumber} onChange={(event) => setOrderNumber(event.target.value)} maxLength={80} autoComplete="off" placeholder="e.g. JQ-…" /></label>
          <label>Email address<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} maxLength={254} autoComplete="email" /></label>
          <button className="button button-dark" type="button" disabled={busy || !orderNumber.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)} onClick={requestCode}>{busy ? "SENDING…" : "SEND VERIFICATION CODE"} <span>↗</span></button>
        </section>
      )}
      {stage === "code" && (
        <section className="order-lookup-panel">
          <h2>Verify your email</h2>
          <p>{notice}</p>
          <label>Six-digit verification code<input inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} maxLength={6} /></label>
          <button className="button button-dark" type="button" disabled={busy || code.length !== 6} onClick={verify}>{busy ? "VERIFYING…" : "VIEW ORDER STATUS"} <span>↗</span></button>
          <button className="order-lookup-text-button" type="button" disabled={busy} onClick={() => { setStage("details"); setCode(""); }}>Use different details</button>
        </section>
      )}
      {stage === "result" && order && (
        <section className="order-status-result">
          <div className="order-status-heading">
            <div><p className="eyebrow">ORDER {order.order_number}</p><h2>{labels[status] || status.replaceAll("_", " ")}</h2></div>
            <button className="order-lookup-text-button" type="button" onClick={refresh} disabled={busy}>{busy ? "REFRESHING…" : "REFRESH STATUS ↻"}</button>
          </div>
          <p className="order-status-created">Placed {new Date(order.created_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</p>
          {!terminal && (
            <ol className="order-status-timeline">
              {steps.map((step, index) => {
                const done = currentIndex >= index;
                const active = currentIndex === index;
                return <li key={step.key} className={done ? "is-complete" : ""} aria-current={active ? "step" : undefined}>
                  <span className="order-status-dot" />
                  <div><strong>{step.title}</strong><p>{step.detail}</p></div>
                </li>;
              })}
            </ol>
          )}
          {terminal && <p className="order-status-terminal">This order is {labels[status]?.toLowerCase() || status}. Please contact us if you need help.</p>}
          <div className="order-status-card">
            <h3>Order summary</h3>
            {order.items.map((item, index) => <div className="order-status-item" key={item.product_name + index}><span>{item.product_name}{item.variant_name ? " · " + item.variant_name : ""} × {item.quantity}</span></div>)}
            <div className="order-status-total"><span>Item subtotal</span><strong>{money(order.subtotal, order.currency)}</strong></div>
            <div className="order-status-total"><span>Shipping</span><strong>{money(order.shipping_amount, order.currency)}</strong></div>
            <div className="order-status-total"><span>Order total</span><strong>{money(order.total_amount, order.currency)}</strong></div>
          </div>
          {order.shipment && (
            <div className="order-status-card">
              <h3>Shipment details</h3>
              <p>{order.shipment.carrier || order.shipping_method || "Carrier details pending"} · {order.shipment.status.replaceAll("_", " ")}</p>
              {order.shipment.tracking_number && <p>Tracking number: <strong>{order.shipment.tracking_number}</strong></p>}
              {order.shipment.tracking_url && <a href={order.shipment.tracking_url} target="_blank" rel="noreferrer">Track your parcel ↗</a>}
            </div>
          )}
          <p className="order-status-private-note">For your privacy, this page does not display your delivery address or payment details. This secure session expires after 20 minutes.</p>
          <div className="order-status-actions"><button className="order-lookup-text-button" type="button" onClick={endSession}>END SECURE SESSION</button><Link href="/contact">CONTACT JINQAYA</Link></div>
        </section>
      )}
      {error && <p className="checkout-error" role="alert">{error}</p>}
    </div>
  );
}
