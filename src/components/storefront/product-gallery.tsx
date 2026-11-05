"use client";

import { useState } from "react";
import type { StoreProductImage } from "@/lib/products";

export function ProductGallery({ images, productName }: { images: StoreProductImage[]; productName: string }) {
  const available = images.filter((image) => image.url);
  const [activeId, setActiveId] = useState<string | null>(
    available.find((image) => image.is_primary)?.id ?? available[0]?.id ?? null
  );
  const active = available.find((image) => image.id === activeId) ?? available[0];

  return (
    <div className="product-detail-gallery">
      {active?.url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="product-detail-main-image" src={active.url} alt={active.alt_text || productName} />
      ) : <div className="product-detail-placeholder">JINQAYA</div>}
      {available.length > 1 && (
        <div className="product-thumbnail-grid" aria-label="Product image gallery">
          {available.map((image, index) => (
            <button
              key={image.id}
              type="button"
              className={"product-thumbnail-button" + (image.id === active?.id ? " is-active" : "")}
              onClick={() => setActiveId(image.id)}
              aria-label={"Show product image " + (index + 1)}
              aria-pressed={image.id === active?.id}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={image.url!} alt={image.alt_text || productName + " image " + (index + 1)} loading="lazy" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
