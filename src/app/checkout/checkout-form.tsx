"use client";

import Link from "next/link";
import { useMemo, useState, useSyncExternalStore, type FormEvent } from "react";
import { formatCartMoney, getCartSnapshot, parseCartSnapshot, subscribeCart, writeCart } from "@/lib/cart";
import { CartLink } from "@/components/storefront/cart-link";
import { PayPalPaymentButton } from "../order-status/paypal-payment-button";
import { isRestrictedShippingDestination } from "@/lib/shipping-country";

type OrderResult = {
  order_id: string;
  order_number: string;
  status: string;
  subtotal: number;
  shipping_amount: number;
  total_amount: number;
  shipping_status: string;
  payment_status: string;
  payment_ready?: boolean;
  payment_session_ready?: boolean;
  currency: string;
};

function newRequestKey() {
  const bytes = new Uint8Array(16);
  window.crypto.getRandomValues(bytes);
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
  const [countryCode, setCountryCode] = useState("");
  const [countryName, setCountryName] = useState("");

  const currency = items[0]?.currency || "USD";
  const mixedCurrencies = items.some((item) => item.currency !== currency);
  const estimate = useMemo(() => items.reduce((sum, item) => sum + item.price * item.quantity, 0), [items]);
  const subtotalCents = Math.round((estimate + Number.EPSILON) * 100);
  const shippingCents = Math.round(subtotalCents / 2);
  const shippingEstimate = shippingCents / 100;
  const totalEstimate = (subtotalCents + shippingCents) / 100;
  const isBlockedCountry = isRestrictedShippingDestination(countryCode, countryName);
  const paymentReady = order ? (order.payment_ready ?? order.status === "pending_payment") : false;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !items.length || mixedCurrencies || isBlockedCountry) return;
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
        order.payment_status === "paid" || order.status === "paid" ? (
          <section className="checkout-success checkout-payment-success" aria-live="polite">
            <div className="payment-success-mark" aria-hidden="true">✓</div>
            <p className="eyebrow">PAYMENT COMPLETE</p>
            <h1>Payment successful.</h1>
            <p>Thank you for your order. Your PayPal payment has been received and confirmed.</p>
            <div className="checkout-notice">
              <strong>Order confirmation</strong>
              <p className="checkout-total"><span>Order number</span><strong>{order.order_number}</strong></p>
              <p className="checkout-total"><span>Payment status</span><strong className="payment-success-status">Paid</strong></p>
              <p className="checkout-total"><span>Payment method</span><strong>PayPal</strong></p>
              <p className="checkout-total"><span>Total paid</span><strong>{formatCartMoney(order.total_amount, order.currency)}</strong></p>
            </div>
            <p className="checkout-disclaimer">We’ll send an order confirmation to your checkout email. You can safely close this page. If you need help, contact info@jinqaya.com.</p>
            <Link className="button button-dark" href="/shop">CONTINUE SHOPPING <span>↗</span></Link>
          </section>
        ) : (
        <section className="checkout-success">
          <p className="eyebrow">ORDER RECEIVED</p>
          <h1>{order.payment_status === "paid" ? "Payment confirmed." : paymentReady ? "Your order is ready." : "Thank you."}</h1>
          <p>Order <strong>{order.order_number}</strong> has been recorded.</p>
          <div className="checkout-notice">
            <strong>{paymentReady ? "Confirmed order total" : "Stock confirmation required"}</strong>
            {paymentReady ? (
              <p>Your items are reserved for 48 hours. Complete payment securely below — there’s no need to look up your order or enter a verification code.</p>
            ) : (
              <p>Your order is recorded, but we couldn&apos;t reserve every item from available stock. Payment is not available yet; our team will contact you to confirm availability.</p>
            )}
            <p className="checkout-total"><span>Merchandise</span><strong>{formatCartMoney(order.subtotal, order.currency)}</strong></p>
            <p className="checkout-pending"><span>Shipping (50%)</span><strong>{formatCartMoney(order.shipping_amount, order.currency)}</strong></p>
            <p className="checkout-total"><span>Order total</span><strong>{formatCartMoney(order.total_amount, order.currency)}</strong></p>
          </div>
          {paymentReady && order.payment_session_ready === true && (
            <PayPalPaymentButton
              currency={order.currency}
              onPaid={() => {
                setOrder((current) => current
                  ? { ...current, status: "paid", payment_status: "paid" }
                  : current);
              }}
            />
          )}
          {paymentReady && order.payment_session_ready !== true && (
            <div className="checkout-notice">
              <strong>Continue to secure payment</strong>
              <p>Your order is reserved. To continue, open Track Order and verify the checkout email. You won&apos;t need to place the order again.</p>
              <Link className="button button-dark" href="/order-status">TRACK ORDER & PAY <span>↗</span></Link>
            </div>
          )}
          <p className="checkout-disclaimer">You will receive an email confirmation. If you leave this page, you can still find your order using your order number and checkout email.</p>
          <Link className="back-link" href="/shop">CONTINUE EXPLORING ↗</Link>
        </section>
        )
      ) : (
        <section className="checkout-page">
          <p className="eyebrow">CHECKOUT</p>
          <h1>Delivery details</h1>
          <p className="checkout-intro">Enter your delivery details and review the total, including shipping at 50% of the merchandise subtotal. Product prices, destination eligibility and stock are checked when you submit. If your items can be reserved, you can pay immediately with PayPal on the next screen.</p>
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
                    <label className="full">Country / Region<input name="country" autoComplete="country-name" value={countryName} onChange={(event) => setCountryName(event.target.value)} required maxLength={100} placeholder="e.g. United States" /></label>
                    <label>Country code<input name="country_code" value={countryCode} onChange={(event) => setCountryCode(event.target.value.toUpperCase().slice(0, 2))} required minLength={2} maxLength={2} placeholder="US" /></label>
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
                {isBlockedCountry && <p className="checkout-error" role="alert">We do not currently ship to this destination.</p>}
                {error && <p className="checkout-error" role="alert">{error}</p>}
                <button className="button button-dark checkout-submit" type="submit" disabled={busy || mixedCurrencies || isBlockedCountry}>
                  {busy ? "SUBMITTING…" : "CONTINUE TO PAYMENT"} <span>↗</span>
                </button>
                <p className="checkout-disclaimer">You won’t be charged when you submit. If all items can be reserved, your order total — including shipping at 50% of the merchandise subtotal — will be ready for secure PayPal payment. Payment is collected only after you approve it in PayPal. By submitting, you acknowledge our <Link href="/policies/terms">Terms of Service</Link> and <Link href="/policies/privacy">Privacy Policy</Link>.</p>
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
                <div className="checkout-total"><span>Subtotal</span><strong>{mixedCurrencies ? "Multiple currencies" : formatCartMoney(estimate, currency)}</strong></div>
                <div className="checkout-pending"><span>Shipping (50%)</span><strong>{mixedCurrencies ? "—" : formatCartMoney(shippingEstimate, currency)}</strong></div>
                <div className="checkout-total"><span>Total</span><strong>{mixedCurrencies ? "Multiple currencies" : formatCartMoney(totalEstimate, currency)}</strong></div>
                <p>Shipping is 50% of the merchandise subtotal. Product prices and stock are rechecked when you submit. Taxes, if applicable, are not included.</p>
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
