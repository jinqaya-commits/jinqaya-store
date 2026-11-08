"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { StoreProductImage } from "@/lib/products";

export function ProductGallery({ images, productName }: { images: StoreProductImage[]; productName: string }) {
  const available = useMemo(() => images.filter((image) => image.detail_url), [images]);
  const [activeId, setActiveId] = useState<string | null>(available.find((image) => image.is_primary)?.id ?? available[0]?.id ?? null);
  const [isZoomed, setIsZoomed] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const activeIndex = Math.max(0, available.findIndex((image) => image.id === activeId));
  const active = available[activeIndex] ?? available[0];

  const showImage = useCallback((index: number) => {
    if (!available.length) return;
    const next = (index + available.length) % available.length;
    setActiveId(available[next].id);
  }, [available]);

  const showNext = useCallback(() => showImage(activeIndex + 1), [activeIndex, showImage]);
  const showPrevious = useCallback(() => showImage(activeIndex - 1), [activeIndex, showImage]);

  useEffect(() => {
    if (!isZoomed) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsZoomed(false);
      if (event.key === "ArrowRight") showNext();
      if (event.key === "ArrowLeft") showPrevious();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isZoomed, showNext, showPrevious]);

  function handleTouchStart(event: React.TouchEvent<HTMLDivElement>) {
    touchStartX.current = event.touches[0]?.clientX ?? null;
  }
  function handleTouchEnd(event: React.TouchEvent<HTMLDivElement>) {
    if (touchStartX.current === null) return;
    const delta = event.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(delta) > 45) {\n      if (delta < 0) showNext();\n      else showPrevious();\n    }
    touchStartX.current = null;
  }

  return (
    <div className="product-detail-gallery">
      {active?.detail_url ? (
        <div className="product-gallery-stage" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
          <button className="product-detail-image-button" type="button" onClick={() => setIsZoomed(true)} aria-label={"Enlarge " + (active.alt_text || productName)}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="product-detail-main-image" src={active.detail_url} alt={active.alt_text || productName} fetchPriority="high" />
            <span className="product-image-expand-hint">VIEW LARGER</span>
          </button>
          {available.length > 1 && <>
            <button type="button" className="product-gallery-arrow product-gallery-arrow-prev" onClick={showPrevious} aria-label="Previous product image">‹</button>
            <button type="button" className="product-gallery-arrow product-gallery-arrow-next" onClick={showNext} aria-label="Next product image">›</button>
          </>}
        </div>
      ) : <div className="product-detail-placeholder" role="img" aria-label={productName + " image coming soon"}><span>JINQAYA</span><small>IMAGE COMING SOON</small></div>}
      {available.length > 1 && (
        <div className="product-gallery-footer">
          <span className="product-gallery-count">{String(activeIndex + 1).padStart(2, "0")} / {String(available.length).padStart(2, "0")}</span>
          <div className="product-thumbnail-grid" aria-label="Product image gallery">
            {available.map((image, index) => (
              <button key={image.id} type="button" className={"product-thumbnail-button" + (image.id === active?.id ? " is-active" : "")} onClick={() => setActiveId(image.id)} aria-label={"Show product image " + (index + 1)} aria-pressed={image.id === active?.id}>
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
          {available.length > 1 && <>
            <button className="product-lightbox-arrow product-lightbox-arrow-prev" type="button" onClick={(event) => { event.stopPropagation(); showPrevious(); }} aria-label="Previous image">‹</button>
            <button className="product-lightbox-arrow product-lightbox-arrow-next" type="button" onClick={(event) => { event.stopPropagation(); showNext(); }} aria-label="Next image">›</button>
          </>}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={active.original_url ?? active.detail_url} alt={active.alt_text || productName} onClick={(event) => event.stopPropagation()} />
          <span className="product-lightbox-count">{String(activeIndex + 1).padStart(2, "0")} / {String(available.length).padStart(2, "0")}</span>
        </div>
      )}
    </div>
  );
}
