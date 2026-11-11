"use client";
import { useMemo, useState } from "react";
import type { StoreProduct } from "@/lib/products";
import { ProductCard } from "@/components/storefront/product-card";
import styles from "./shop-product-browser.module.css";

type SortOption = "featured" | "newest" | "price-low" | "price-high" | "name";
function lowestPrice(product: StoreProduct) {
  const prices = product.variants.filter((variant) => variant.is_active && variant.price !== null && Number.isFinite(variant.price)).map((variant) => variant.price as number);
  return prices.length ? Math.min(...prices) : null;
}

export function ShopProductBrowser({ products }: { products: StoreProduct[] }) {
  const [search, setSearch] = useState("");
  const [pet, setPet] = useState("all");
  const [category, setCategory] = useState("all");
  const [sort, setSort] = useState<SortOption>("featured");
  const categories = useMemo(() => {
    const unique = new Map<string, string>();
    products.forEach((product) => { if (product.primary_category?.slug) unique.set(product.primary_category.slug, product.primary_category.name); });
    return [...unique.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [products]);

  const currencies = new Set(products.flatMap((product) => product.variants.filter((variant) => variant.is_active && variant.price !== null).map((variant) => variant.currency || "USD")));
  const canSortByPrice = currencies.size <= 1;

  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    const result = products.filter((product) => {
      const matchesSearch = !term || [product.name, product.short_description, product.description, product.material].some((value) => value?.toLocaleLowerCase().includes(term));
      const matchesPet = pet === "all" || product.pet_type === pet || ((pet === "cat" || pet === "dog") && product.pet_type === "both");
      const matchesCategory = category === "all" || product.primary_category?.slug === category;
      return matchesSearch && matchesPet && matchesCategory;
    });
    return result.sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name);
      if (sort === "newest") return Number(b.is_new_arrival) - Number(a.is_new_arrival);
      if (sort === "price-low" && canSortByPrice) return (lowestPrice(a) ?? Number.MAX_SAFE_INTEGER) - (lowestPrice(b) ?? Number.MAX_SAFE_INTEGER);
      if (sort === "price-high" && canSortByPrice) return (lowestPrice(b) ?? -1) - (lowestPrice(a) ?? -1);
      return Number(b.is_featured) - Number(a.is_featured) || Number(b.is_new_arrival) - Number(a.is_new_arrival);
    });
  }, [products, search, pet, category, sort]);

  const hasFilters = search.trim() !== "" || pet !== "all" || category !== "all" || sort !== "featured";
  function reset() { setSearch(""); setPet("all"); setCategory("all"); setSort("featured"); }

  return (
    <div className={styles.browser}>
      <div className={styles.controls}>
        <label className={styles.search}><span>SEARCH THE COLLECTION</span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search products…" /></label>
        <label><span>FOR</span><select value={pet} onChange={(event) => setPet(event.target.value)}><option value="all">Cats &amp; dogs</option><option value="cat">Cats</option><option value="dog">Dogs</option><option value="shared">Shared / general</option></select></label>
        <label><span>COLLECTION</span><select value={category} onChange={(event) => setCategory(event.target.value)}><option value="all">All collections</option>{categories.map(([slug, name]) => <option value={slug} key={slug}>{name}</option>)}</select></label>
        <label><span>SORT BY</span><select value={sort} onChange={(event) => setSort(event.target.value as SortOption)}><option value="featured">Featured</option><option value="newest">New arrivals</option><option value="price-low" disabled={!canSortByPrice}>Price: low to high</option><option value="price-high" disabled={!canSortByPrice}>Price: high to low</option><option value="name">Name: A to Z</option></select></label>
      </div>
      <div className={styles.resultLine} aria-live="polite"><p>{filtered.length} {filtered.length === 1 ? "piece" : "pieces"}{!canSortByPrice ? " · Price sorting is unavailable across multiple currencies." : ""}</p>{hasFilters && <button type="button" onClick={reset}>CLEAR FILTERS ×</button>}</div>
      {filtered.length ? <div className="product-grid">{filtered.map((product) => <ProductCard key={product.id} product={product} />)}</div> : (
        <div className={styles.empty}><p className="eyebrow">NO MATCHES JUST YET</p><h3>Try another search.</h3><p>Adjust your filters or clear them to explore the full collection.</p><button type="button" onClick={reset}>CLEAR FILTERS</button></div>
      )}
    </div>
  );
}
