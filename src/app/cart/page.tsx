"use client";

import Link from "next/link";
import Image from "next/image";
import { useMemo, useSyncExternalStore } from "react";
import { formatCartMoney, getCartSnapshot, parseCartSnapshot, subscribeCart, writeCart } from "@/lib/cart";
import { CartLink } from "@/components/storefront/cart-link";
import { calculateCheckoutShippingEstimate } from "@/lib/checkout-shipping-estimate";

export default function CartPage() {
  const snapshot = useSyncExternalStore(subscribeCart, getCartSnapshot, () => "[]");
  const items = useMemo(() => parseCartSnapshot(snapshot), [snapshot]);

  function updateQuantity(key: string, quantity: number) {
    const next = items.map((item) => item.key === key ? { ...item, quantity: Math.max(1, Math.min(99, quantity)) } : item);
    writeCart(next);
  }

  function removeItem(key: string) {
    writeCart(items.filter((item) => item.key !== key));
  }

  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const currency = items[0]?.currency || "USD";
  const mixedCurrencies = items.some((item) => item.currency !== currency);
  const { totalUnits, shippingCents } = calculateCheckoutShippingEstimate(items.map((item) => ({ price: item.price, quantity: item.quantity })));
  const shipping = shippingCents / 100;

  return <main className="inner-page">
    <header className="inner-page-header">
      <Link className="jq-brand-logo-link" href="/" aria-label="JINQAYA home"><Image className="jq-brand-logo jq-inner-logo" src="/jinqaya-logo.png" alt="JINQAYA Premium Pet Lifestyle" width={900} height={287} /></Link>
      <nav className="inner-nav" aria-label="Main navigation">
        <Link href="/shop">SHOP ALL</Link><Link href="/#philosophy">OUR PHILOSOPHY</Link><CartLink />
      </nav>
    </header>
    <section className="cart-page">
      <p className="eyebrow">YOUR SELECTION</p>
      <h1>Your bag</h1>
      {items.length === 0 ? <div className="cart-empty">
        <p>Your bag is currently empty.</p>
        <Link className="button button-dark" href="/shop">EXPLORE THE COLLECTION <span aria-hidden="true">↗</span></Link>
      </div> : <div className="cart-layout">
        <div className="cart-items">
          {items.map((item) => <article className="cart-item" key={item.key}>
            {item.imageUrl ? <img src={item.imageUrl} alt={item.productName} /> : <div className="cart-item-placeholder">JINQAYA</div>}
            <div className="cart-item-info">
              <Link href={`/products/${item.productSlug}`}><h2>{item.productName}</h2></Link>
              <p>{item.variantName}</p><p>{formatCartMoney(item.price, item.currency)}</p>
              <div className="cart-item-actions">
                <label>Qty <input aria-label={`Quantity for ${item.productName}`} type="number" min="1" max="99" value={item.quantity} onChange={(event) => updateQuantity(item.key, Number(event.target.value) || 1)} /></label>
                <button type="button" onClick={() => removeItem(item.key)}>Remove</button>
              </div>
            </div>
            <strong>{formatCartMoney(item.price * item.quantity, item.currency)}</strong>
          </article>)}
        </div>
        <aside className="cart-summary">
          <h2>Order summary</h2>
          <div><span>Subtotal</span><strong>{mixedCurrencies ? "Multiple currencies" : formatCartMoney(subtotal, currency)}</strong></div>
          <div><span>Shipping {totalUnits <= 2 ? "(1–2 items)" : "(3+ items)"}</span><strong>{mixedCurrencies ? "—" : formatCartMoney(shipping, currency)}</strong></div>
          <div><span>Estimated total</span><strong>{mixedCurrencies ? "Multiple currencies" : formatCartMoney(subtotal + shipping, currency)}</strong></div>
          <p>Estimated shipping is $50 for 1–2 total items, or 50% of the merchandise subtotal for 3 or more items. Applicable taxes, if any, are not included. The final amount is confirmed at checkout.</p>
          <Link href="/checkout" className="button button-dark">CONTINUE TO CHECKOUT <span aria-hidden="true">↗</span></Link>
          <p className="cart-policy-note">For non-quality returns, return shipping is paid by the customer and the original delivery charge is non-refundable. <Link href="/policies/returns-refunds">Read our Returns &amp; Refunds Policy</Link>.</p>
          <Link href="/shop" className="back-link">CONTINUE SHOPPING</Link>
        </aside>
      </div>}
    </section>
    <footer className="inner-footer"><Link className="jq-brand-logo-link" href="/" aria-label="JINQAYA home"><Image className="jq-brand-logo jq-inner-logo jq-footer-logo" src="/jinqaya-logo.png" alt="JINQAYA Premium Pet Lifestyle" width={900} height={287} /></Link><span>BETTER LIVING, TOGETHER.</span></footer>
  </main>;
}
