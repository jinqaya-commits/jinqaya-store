"use client";

import Link from "next/link";
import { useMemo, useSyncExternalStore } from "react";
import { formatCartMoney, getCartSnapshot, parseCartSnapshot, subscribeCart, writeCart } from "@/lib/cart";
import { StorefrontHeader } from "@/components/storefront/storefront-header";

export default function CartPage() {
  const snapshot = useSyncExternalStore(subscribeCart, getCartSnapshot, () => "[]");
  const items = useMemo(() => parseCartSnapshot(snapshot), [snapshot]);

  function updateQuantity(key: string, quantity: number) {
    const safeQuantity = Math.max(1, Math.min(99, Math.trunc(quantity) || 1));
    writeCart(items.map((item) => item.key === key ? { ...item, quantity: safeQuantity } : item));
  }
  function removeItem(key: string) { writeCart(items.filter((item) => item.key !== key)); }

  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const currency = items[0]?.currency || "USD";
  const mixedCurrencies = items.some((item) => item.currency !== currency);

  return <main className="inner-page">
    <StorefrontHeader />
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
                <label>Qty <input aria-label={`Quantity for ${item.productName}`} type="number" inputMode="numeric" min="1" max="99" step="1" value={item.quantity} onChange={(event) => updateQuantity(item.key, Number(event.target.value))} /></label>
                <button type="button" aria-label={`Remove ${item.productName} from bag`} onClick={() => removeItem(item.key)}>Remove</button>
              </div>
            </div>
            <strong>{formatCartMoney(item.price * item.quantity, item.currency)}</strong>
          </article>)}
        </div>
        <aside className="cart-summary">
          <h2>Order summary</h2>
          <div><span>Subtotal</span><strong>{mixedCurrencies ? "Multiple currencies" : formatCartMoney(subtotal, currency)}</strong></div>
          <p>Shipping and any applicable taxes will be confirmed with you after you submit an order request, before payment.</p>
          <Link href="/checkout" className="button button-dark">CONTINUE TO CHECKOUT <span aria-hidden="true">↗</span></Link>
          <Link href="/shop" className="back-link">CONTINUE SHOPPING</Link>
        </aside>
      </div>}
    </section>
    <footer className="inner-footer"><Link href="/">JINQAYA</Link><span>BETTER LIVING, TOGETHER.</span></footer>
  </main>;
}
