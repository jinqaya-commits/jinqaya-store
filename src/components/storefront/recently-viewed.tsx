"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import styles from "./recently-viewed.module.css";

type ViewedProduct = {
  slug: string;
  name: string;
  imageUrl: string | null;
  priceLabel: string | null;
};

const STORAGE_KEY = "jinqaya-recently-viewed";

export function RecentlyViewed({ product }: { product: ViewedProduct }) {
  const [items, setItems] = useState<ViewedProduct[]>([]);

  useEffect(() => {
    let previous: ViewedProduct[] = [];
    try {
      const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "[]");
      if (Array.isArray(stored)) previous = stored.filter((item): item is ViewedProduct =>
        item && typeof item.slug === "string" && typeof item.name === "string"
      );
    } catch {
      previous = [];
    }
    const unique = previous.filter((item) => item.slug !== product.slug);
    setItems(unique.slice(0, 4));
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([product, ...unique].slice(0, 8)));
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
