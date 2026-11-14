"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { StoreProduct, StoreProductVariant } from "@/lib/products";
import { addCartItem } from "@/lib/cart";

function formatPrice(variant: StoreProductVariant | undefined) {
  if (!variant || variant.price === null) return "";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: variant.currency || "USD" }).format(variant.price);
}

export function AddToCart({ product }: { product: StoreProduct }) {
  const router = useRouter();
  const available = product.variants.filter((variant) => variant.is_active && variant.price !== null && Number.isFinite(variant.price));
  const [variantId, setVariantId] = useState(available[0]?.id ?? "");
  const [quantity, setQuantity] = useState(1);
  const [message, setMessage] = useState("");
  const selected = available.find((variant) => variant.id === variantId);
  const colors = [...new Set(available.map((variant) => variant.color).filter((value): value is string => Boolean(value)))];
  const sizes = [...new Set(available.map((variant) => variant.size).filter((value): value is string => Boolean(value)))];

  function chooseColor(color: string) {
    const match = available.find((variant) => variant.color === color && (!selected?.size || variant.size === selected.size))
      ?? available.find((variant) => variant.color === color);
    if (match) setVariantId(match.id);
    setMessage("");
  }

  function chooseSize(size: string) {
    const match = available.find((variant) => variant.size === size && (!selected?.color || variant.color === selected.color))
      ?? available.find((variant) => variant.size === size);
    if (match) setVariantId(match.id);
    setMessage("");
  }

  function add(redirectToCheckout = false) {
    if (!selected || selected.price === null) return;
    addCartItem({
      productId: product.id,
      productSlug: product.slug,
      productName: product.name,
      variantId: selected.id,
      variantName: selected.variant_name || [selected.color, selected.size].filter(Boolean).join(" / ") || selected.sku,
      sku: selected.sku,
      price: selected.price,
      currency: selected.currency || "USD",
      imageUrl: product.images.find((image) => image.is_primary)?.detail_url ?? product.images[0]?.detail_url ?? null,
    }, quantity);
    if (redirectToCheckout) {
      router.push("/checkout");
      return;
    }
    setMessage("Added to your bag. You can continue shopping or go to checkout.");
  }

  if (available.length === 0) {
    return <div className="product-unavailable">
      <p>This piece is not available to purchase just yet.</p>
      <span>Contact us and we’ll be happy to help with availability.</span>
    </div>;
  }

  const optionLabel = (variant: StoreProductVariant) =>
    variant.variant_name || [variant.color, variant.size].filter(Boolean).join(" / ") || variant.sku;

  return (
    <div className="add-to-cart">
      <p className="cart-selected-price">{formatPrice(selected)}</p>

      {colors.length > 0 && (
        <fieldset className="cart-option-group">
          <legend>COLOR</legend>
          <div className="cart-option-buttons">
            {colors.map((color) => (
              <button key={color} type="button" className="cart-option-button" aria-pressed={selected?.color === color} onClick={() => chooseColor(color)}>
                {color}
              </button>
            ))}
          </div>
        </fieldset>
      )}

      {sizes.length > 0 && (
        <fieldset className="cart-option-group">
          <legend>SIZE</legend>
          <div className="cart-option-buttons">
            {sizes.map((size) => {
              const enabled = available.some((variant) => variant.size === size && (!selected?.color || !variant.color || variant.color === selected.color));
              return (
                <button key={size} type="button" className="cart-option-button" aria-pressed={selected?.size === size} disabled={!enabled} onClick={() => chooseSize(size)}>
                  {size}
                </button>
              );
            })}
          </div>
        </fieldset>
      )}

      {available.length > 1 && colors.length === 0 && sizes.length === 0 && (
        <label className="cart-field">
          <span>SELECT YOUR OPTION</span>
          <select value={variantId} onChange={(event) => { setVariantId(event.target.value); setMessage(""); }}>
            {available.map((variant) => (
              <option key={variant.id} value={variant.id}>
                {optionLabel(variant)}{formatPrice(variant) ? ` — ${formatPrice(variant)}` : ""}
              </option>
            ))}
          </select>
        </label>
      )}

      <div className="cart-add-row">
        <label className="cart-field">
          <span>QUANTITY</span>
          <input aria-label="Quantity" type="number" min="1" max="99" value={quantity} onChange={(event) => setQuantity(Math.max(1, Math.min(99, Number(event.target.value) || 1)))} />
        </label>
        <div className="product-purchase-actions">
          <button type="button" className="button button-light product-add-button" onClick={() => add()}>ADD TO BAG</button>
          <button type="button" className="button button-dark product-buy-now-button" onClick={() => add(true)}>BUY NOW <span aria-hidden="true">↗</span></button>
        </div>
      </div>
      {message && <p className="cart-feedback" role="status">{message}</p>}
      <div className="product-mobile-buybar">
        <span className="product-mobile-buybar-price">{formatPrice(selected)}</span>
        <div className="product-mobile-buybar-actions">
          <button type="button" className="button button-light" onClick={() => add()}>ADD TO BAG</button>
          <button type="button" className="button button-dark" onClick={() => add(true)}>BUY NOW <span aria-hidden="true">↗</span></button>
        </div>
      </div>
    </div>
  );
}
