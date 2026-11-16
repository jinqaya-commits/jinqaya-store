import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ShopMenu, type ShopNavCategory } from "./shop-menu";
import { getStoreCategoryIdsWithProducts } from "@/lib/products";
import styles from "./storefront-search.module.css";

type CategoryRow = { id:string; parent_id:string|null; name:string; slug:string; sort_order:number; is_active:boolean };

export async function CategoryNavigation() {
  let rows: CategoryRow[] = [];
  let supabase;
  try {
    supabase = await createClient();
  } catch (error) {
    if (!(error instanceof Error &&
      error.message === "Missing Supabase public environment variables.")) {
      throw error;
    }
  }

  if (supabase) {
    const { data, error } = await supabase.from("categories")
      .select("id,parent_id,name,slug,sort_order,is_active")
      .eq("is_active", true).order("sort_order", { ascending:true });
    if (error) throw error;
    rows = (data ?? []) as CategoryRow[];
  }

  const populatedCategoryIds = supabase ? await getStoreCategoryIdsWithProducts(rows) : new Set<string>();
  const buildTree = (parentId: string | null): ShopNavCategory[] =>
    rows.filter(row => row.parent_id === parentId && (parentId === null || populatedCategoryIds.has(row.id))).map(row => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      children: buildTree(row.id),
    }));
  const roots = buildTree(null);

  return (
    <nav className="jq-nav jq-category-nav" aria-label="Main navigation">
      <ShopMenu roots={roots} />
      <Link href="/#collections">DISCOVER</Link>
      <Link href="/about">OUR STORY</Link>
      <Link href="/order-status">TRACK ORDER</Link>
      <Link href="/account">MY ACCOUNT</Link>
      <form className={styles.search} action="/shop" method="get" role="search">
        <label className={styles.label} htmlFor="jq-global-search">SEARCH</label>
        <input id="jq-global-search" name="q" type="search" placeholder="Find a product" aria-label="Search products" />
        <button type="submit" aria-label="Submit product search">⌕</button>
      </form>
    </nav>
  );
}
