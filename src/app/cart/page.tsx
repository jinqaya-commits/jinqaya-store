"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CART_EVENT, formatCartMoney, readCart, writeCart, type CartItem } from "@/lib/cart";
import { CartLink } from "@/components/storefront/cart-link";

export default function CartPage() {
  const [items, setItems] = useState<CartItem[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const refresh = () => setItems(readCart());
    refresh();
    setReady(true);
    window.addEventListener(CART_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(CART_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  function updateQuantity(key: string, quantity: number) {
    const next = items.map((item) => item.key === key ? { ...item, quantity: Math.max(1, Math.min(99, quantity)) } : item);
    setItems(next);
    writeCart(next);
  }

  function removeItem(key: string) {
    const next = items.filter((item) => item.key !== key);
    setItems(next);
    writeCart(next);
  }

  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const currency = items[0]?.currency || "USD";
  const mixedCurrencies = items.some((item) => item.currency !== currency);

  return <main className="inner-page">
    <header className="inner-page-header">
      <Link className="wordmark" href="/">JINQAYA<span>®</span></Link>
      <nav className="inner-nav" aria-label="Main navigation">
        <Link href="/shop">SHOP ALL</Link><Link href="/#philosophy">OUR PHILOSOPHY</Link><CartLink />
      </nav>
    </header>
    <section className="cart-page">
      <p className="eyebrow">YOUR SELECTION</p>
      <h1>Your bag</h1>
      {!ready ? <p>Loading your bag…</p> : items.length === 0 ? <div className="cart-empty">
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
          <p>Shipping and any applicable taxes are calculated at checkout.</p>
          <button type="button" className="button button-dark" disabled>CHECKOUT COMING SOON</button>
          <Link href="/shop" className="back-link">CONTINUE SHOPPING</Link>
        </aside>
      </div>}
    </section>
    <footer className="inner-footer"><Link href="/">JINQAYA</Link><span>BETTER LIVING, TOGETHER.</span></footer>
  </main>;
}
