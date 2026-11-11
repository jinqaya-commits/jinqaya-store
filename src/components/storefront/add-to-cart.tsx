"use client";

import { useState } from "react";
import type { StoreProduct, StoreProductVariant } from "@/lib/products";
import { addCartItem } from "@/lib/cart";

function formatPrice(variant: StoreProductVariant | undefined) {
  if (!variant || variant.price === null) return "";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: variant.currency || "USD" }).format(variant.price);
}

export function AddToCart({ product }: { product: StoreProduct }) {
  const available = product.variants.filter((variant) => variant.is_active && variant.price !== null && Number.isFinite(variant.price));
  const [variantId, setVariantId] = useState(available[0]?.id ?? "");
  const [quantity, setQuantity] = useState(1);
  const [message, setMessage] = useState("");
  const selected = available.find((variant) => variant.id === variantId);

  function add() {
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
    setMessage("Added to your bag.");
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
      {available.length > 1 && (
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
        <button type="button" className="button button-dark product-add-button" onClick={add}>
          ADD TO BAG <span aria-hidden="true">↗</span>
        </button>
      </div>
      {message && <p className="cart-feedback" role="status">{message}</p>}
      <div className="product-mobile-buybar">
        <span className="product-mobile-buybar-price">{formatPrice(selected)}</span>
        <button type="button" className="button button-dark" onClick={add}>ADD TO BAG <span aria-hidden="true">↗</span></button>
      </div>
    </div>
  );
}
