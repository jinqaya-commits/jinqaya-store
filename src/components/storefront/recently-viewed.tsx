"use client";

import { useEffect, useSyncExternalStore } from "react";
import Link from "next/link";
import styles from "./recently-viewed.module.css";

type ViewedProduct = {
  slug: string;
  name: string;
  imageUrl: string | null;
  priceLabel: string | null;
};

const STORAGE_KEY = "jinqaya-recently-viewed";

function subscribe(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  return () => window.removeEventListener("storage", onStoreChange);
}

function getSnapshot() {
  try {
    return window.localStorage.getItem(STORAGE_KEY) || "[]";
  } catch {
    return "[]";
  }
}

function getServerSnapshot() {
  return "[]";
}

function parseViewedProducts(snapshot: string): ViewedProduct[] {
  try {
    const stored: unknown = JSON.parse(snapshot);
    if (!Array.isArray(stored)) return [];
    return stored.filter((item): item is ViewedProduct =>
      item !== null &&
      typeof item === "object" &&
      "slug" in item &&
      typeof item.slug === "string" &&
      "name" in item &&
      typeof item.name === "string"
    );
  } catch {
    return [];
  }
}

export function RecentlyViewed({ product }: { product: ViewedProduct }) {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const items = parseViewedProducts(snapshot)
    .filter((item) => item.slug !== product.slug)
    .slice(0, 4);

  useEffect(() => {
    const previous = parseViewedProducts(getSnapshot());
    const unique = previous.filter((item) => item.slug !== product.slug);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify([product, ...unique].slice(0, 8)));
    } catch {
      // Recently viewed is optional; the product page remains fully usable without storage.
    }
  }, [product.slug, product.name, product.imageUrl, product.priceLabel]);

  if (items.length === 0) return null;

  return (
    <section className={styles.section} aria-labelledby="recently-viewed-title">
      <div className={styles.heading}>
        <p className="eyebrow">A LITTLE MORE TO EXPLORE</p>
        <h2 id="recently-viewed-title">Recently viewed</h2>
      </div>
      <div className={styles.grid}>
        {items.map((item) => (
          <Link className={styles.card} href={`/products/${item.slug}`} key={item.slug}>
            {item.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.imageUrl} alt={item.name} loading="lazy" />
            ) : <span className={styles.placeholder}>JINQAYA</span>}
            <span className={styles.name}>{item.name}</span>
            {item.priceLabel && <span className={styles.price}>{item.priceLabel}</span>}
          </Link>
        ))}
      </div>
    </section>
  );
}
