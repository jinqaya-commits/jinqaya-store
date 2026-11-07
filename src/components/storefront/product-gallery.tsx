"use client";

import { useEffect, useState } from "react";
import type { StoreProductImage } from "@/lib/products";

export function ProductGallery({ images, productName }: { images: StoreProductImage[]; productName: string }) {
  const available = images.filter((image) => image.detail_url);
  const [activeId, setActiveId] = useState<string | null>(
    available.find((image) => image.is_primary)?.id ?? available[0]?.id ?? null
  );
  const [isZoomed, setIsZoomed] = useState(false);
  const active = available.find((image) => image.id === activeId) ?? available[0];

  useEffect(() => {
    if (!isZoomed) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsZoomed(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isZoomed]);

  return (
    <div className="product-detail-gallery">
      {active?.detail_url ? (
        <button
          className="product-detail-image-button"
          type="button"
          onClick={() => setIsZoomed(true)}
          aria-label={"Enlarge " + (active.alt_text || productName)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="product-detail-main-image" src={active.detail_url} alt={active.alt_text || productName} fetchPriority="high" />
          <span className="product-image-expand-hint">VIEW LARGER</span>
        </button>
      ) : <div className="product-detail-placeholder">JINQAYA</div>}
      {available.length > 1 && (
        <div className="product-gallery-footer">
          <span className="product-gallery-count">{String((available.findIndex((image) => image.id === active?.id) ?? 0) + 1).padStart(2, "0")} / {String(available.length).padStart(2, "0")}</span>
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
                <img src={image.thumbnail_url ?? image.detail_url!} alt={image.alt_text || productName + " image " + (index + 1)} loading="lazy" />
              </button>
            ))}
          </div>
        </div>
      )}
      {isZoomed && active?.detail_url && (
        <div className="product-image-lightbox" role="dialog" aria-modal="true" aria-label="Enlarged product image" onClick={() => setIsZoomed(false)}>
          <button className="product-image-lightbox-close" type="button" onClick={() => setIsZoomed(false)} aria-label="Close enlarged image">×</button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={active.original_url ?? active.detail_url} alt={active.alt_text || productName} onClick={(event) => event.stopPropagation()} />
        </div>
      )}
    </div>
  );
}
