import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CartLink } from "@/components/storefront/cart-link";
import { StorefrontNavigation, type StorefrontCategory } from "@/components/storefront/storefront-navigation";

type CategoryRow = { id: string; parent_id: string | null; name: string; slug: string; sort_order: number; is_active: boolean };

export async function StorefrontHeader() {
  const supabase = await createClient();
  const { data } = await supabase.from("categories")
    .select("id,parent_id,name,slug,sort_order,is_active")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  const rows = (data ?? []) as CategoryRow[];
  const buildTree = (parentId: string | null): StorefrontCategory[] =>
    rows.filter((row) => row.parent_id === parentId).map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      children: buildTree(row.id),
    }));
  const roots = buildTree(null);

  return (
    <header className="jq-site-header">
      <Link className="jq-site-wordmark" href="/" aria-label="JINQAYA home">JINQAYA<span>®</span></Link>
      <StorefrontNavigation roots={roots} />
      <div className="jq-site-header-actions"><CartLink /></div>
    </header>
  );
}
