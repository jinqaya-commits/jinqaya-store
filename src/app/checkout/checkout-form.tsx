"use client";

import Link from "next/link";
import { useMemo, useState, useSyncExternalStore, type FormEvent } from "react";
import { formatCartMoney, getCartSnapshot, parseCartSnapshot, subscribeCart, writeCart } from "@/lib/cart";
import { CartLink } from "@/components/storefront/cart-link";

type OrderResult = {
  order_id: string;
  order_number: string;
  status: string;
  subtotal: number;
  shipping_status: string;
  payment_status: string;
  currency: string;
};

function newRequestKey() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function CheckoutForm() {
  const snapshot = useSyncExternalStore(subscribeCart, getCartSnapshot, () => "[]");
  const items = useMemo(() => parseCartSnapshot(snapshot), [snapshot]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [order, setOrder] = useState<OrderResult | null>(null);
  const [requestKey, setRequestKey] = useState("");

  const currency = items[0]?.currency || "USD";
  const mixedCurrencies = items.some((item) => item.currency !== currency);
  const estimate = useMemo(() => items.reduce((sum, item) => sum + item.price * item.quantity, 0), [items]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !items.length || mixedCurrencies) return;
    setBusy(true);
    setError("");
    const data = new FormData(event.currentTarget);
    const idempotencyKey = requestKey || newRequestKey();
    setRequestKey(idempotencyKey);
    const payload = {
      idempotency_key: idempotencyKey,
      customer: {
        first_name: String(data.get("first_name") || ""),
        last_name: String(data.get("last_name") || ""),
        email: String(data.get("email") || ""),
        phone: String(data.get("phone") || ""),
      },
      shipping_address: {
        country_code: String(data.get("country_code") || ""),
        country: String(data.get("country") || ""),
        state_region: String(data.get("state_region") || ""),
        city: String(data.get("city") || ""),
        address_line1: String(data.get("address_line1") || ""),
        address_line2: String(data.get("address_line2") || ""),
        postal_code: String(data.get("postal_code") || ""),
      },
      customer_note: String(data.get("customer_note") || ""),
      website: String(data.get("website") || ""),
      items: items.map((item) => ({ variant_id: item.variantId, quantity: item.quantity })),
    };

    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "We couldn't submit your order request.");
      setOrder(result.order as OrderResult);
      writeCart([]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "We couldn't submit your order request. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="inner-page">
      <header className="inner-page-header">
        <Link className="wordmark" href="/">JINQAYA<span>®</span></Link>
        <nav className="inner-nav" aria-label="Main navigation">
          <Link href="/shop">SHOP ALL</Link><Link href="/cart">YOUR BAG</Link><CartLink />
        </nav>
      </header>

      {order ? (
        <section className="checkout-success">
          <p className="eyebrow">REQUEST RECEIVED</p>
          <h1>Thank you.</h1>
          <p>Your order request <strong>{order.order_number}</strong> has been recorded.</p>
          <div className="checkout-notice">
            <strong>What happens next</strong>
            <p>We’ll confirm stock availability, shipping options and the final delivery cost before requesting payment. Your order is not paid or ready for dispatch yet.</p>
          </div>
          <Link className="button button-dark" href="/shop">CONTINUE EXPLORING <span>↗</span></Link>
        </section>
      ) : (
        <section className="checkout-page">
          <p className="eyebrow">ORDER REQUEST</p>
          <h1>Delivery details</h1>
          <p className="checkout-intro">Send us your order details first. We’ll confirm availability, shipping and the final total with you before payment.</p>
          {items.length === 0 ? (
            <div className="cart-empty"><p>Your bag is empty.</p><Link className="button button-dark" href="/shop">EXPLORE THE COLLECTION <span>↗</span></Link></div>
          ) : (
            <div className="checkout-layout">
              <form className="checkout-form" onSubmit={submit}>
                <section className="checkout-section">
                  <div className="checkout-section-heading"><span>01</span><div><h2>Contact information</h2><p>We’ll use these details to follow up on your order.</p></div></div>
                  <div className="checkout-fields two">
                    <label>First name<input name="first_name" autoComplete="given-name" required maxLength={100} /></label>
                    <label>Last name<input name="last_name" autoComplete="family-name" required maxLength={100} /></label>
                    <label className="full">Email address<input name="email" type="email" autoComplete="email" required maxLength={254} /></label>
                    <label className="full">Phone number <span className="optional">OPTIONAL</span><input name="phone" type="tel" autoComplete="tel" maxLength={40} /></label>
                  </div>
                </section>
                <section className="checkout-section">
                  <div className="checkout-section-heading"><span>02</span><div><h2>Shipping address</h2><p>Enter the destination where you’d like your order delivered.</p></div></div>
                  <div className="checkout-fields two">
                    <label className="full">Country / Region<input name="country" autoComplete="country-name" required maxLength={100} placeholder="e.g. United States" /></label>
                    <label>Country code<input name="country_code" required minLength={2} maxLength={2} placeholder="US" /></label>
                    <label>State / Province<input name="state_region" autoComplete="address-level1" maxLength={100} /></label>
                    <label>City<input name="city" autoComplete="address-level2" required maxLength={100} /></label>
                    <label>Postal code<input name="postal_code" autoComplete="postal-code" maxLength={30} /></label>
                    <label className="full">Address<input name="address_line1" autoComplete="address-line1" required maxLength={200} /></label>
                    <label className="full">Apartment, suite, etc. <span className="optional">OPTIONAL</span><input name="address_line2" autoComplete="address-line2" maxLength={200} /></label>
                  </div>
                </section>
                <section className="checkout-section">
                  <div className="checkout-section-heading"><span>03</span><div><h2>Additional information</h2><p>Anything we should know about delivery?</p></div></div>
                  <label className="checkout-note">Order note <span className="optional">OPTIONAL</span><textarea name="customer_note" rows={3} maxLength={1000} /></label>
                </section>
                <label className="checkout-honeypot" aria-hidden="true">Website<input name="website" tabIndex={-1} autoComplete="off" /></label>
                {error && <p className="checkout-error" role="alert">{error}</p>}
                <button className="button button-dark checkout-submit" type="submit" disabled={busy || mixedCurrencies}>
                  {busy ? "SUBMITTING…" : "SUBMIT ORDER REQUEST"} <span>↗</span>
                </button>
                <p className="checkout-disclaimer">Submitting this request does not charge your payment method. We’ll confirm availability, shipping and the final total with you first. By submitting, you acknowledge our <Link href="/policies/terms">Terms of Service</Link> and <Link href="/policies/privacy">Privacy Policy</Link>.</p>
              </form>

              <aside className="checkout-summary">
                <h2>Order summary</h2>
                {items.map((item) => (
                  <div className="checkout-line" key={item.key}>
                    <div className="checkout-thumb">{item.imageUrl ? <img src={item.imageUrl} alt="" /> : <span>JQ</span>}<small>{item.quantity}</small></div>
                    <div className="checkout-line-info"><strong>{item.productName}</strong><span>{item.variantName}</span></div>
                    <strong>{formatCartMoney(item.price * item.quantity, item.currency)}</strong>
                  </div>
                ))}
                <div className="checkout-total"><span>Estimated subtotal</span><strong>{mixedCurrencies ? "Multiple currencies" : formatCartMoney(estimate, currency)}</strong></div>
                <div className="checkout-pending"><span>Shipping</span><strong>To be confirmed</strong></div>
                <p>Product prices are rechecked when you submit. Shipping and any applicable taxes are not included until confirmed.</p>
                {mixedCurrencies && <p className="checkout-error">Your bag contains different currencies. Please check out separately.</p>}
                <Link className="back-link" href="/cart">← RETURN TO BAG</Link>
              </aside>
            </div>
          )}
        </section>
      )}
      <footer className="inner-footer"><Link href="/">JINQAYA</Link><span>BETTER LIVING, TOGETHER.</span></footer>
    </main>
  );
}
