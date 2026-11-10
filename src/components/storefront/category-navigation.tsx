import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ShopMenu, type ShopNavCategory } from "./shop-menu";

type CategoryRow = { id:string; parent_id:string|null; name:string; slug:string; sort_order:number; is_active:boolean };

export async function CategoryNavigation() {
  let rows: CategoryRow[] = [];
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.from("categories")
      .select("id,parent_id,name,slug,sort_order,is_active")
      .eq("is_active", true).order("sort_order", { ascending:true });
    if (error) {
      console.error("Unable to load category navigation:", error.message);
    } else {
      rows = (data ?? []) as CategoryRow[];
    }
  } catch (error) {
    console.error("Unable to load category navigation:", error);
  }

  const buildTree = (parentId: string | null): ShopNavCategory[] =>
    rows.filter(row => row.parent_id === parentId).map(row => ({
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
    </nav>
  );
}
