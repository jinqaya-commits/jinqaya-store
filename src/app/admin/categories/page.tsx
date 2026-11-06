import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolveProductImageUrls } from "@/lib/product-images";
import { CategoryImageManager } from "./category-image-manager";

export const dynamic = "force-dynamic";

export default async function AdminCategoriesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: allowed, error: permissionError } = await supabase.rpc("can_manage_catalog");
  if (permissionError || allowed !== true) redirect("/");

  const { data: categories, error } = await supabase
    .from("categories")
    .select("id,name,slug,description,image_path,is_active,sort_order")
    .order("sort_order", { ascending: true });

  const rows = (categories ?? []).map((category) => ({
    ...category,
    imageUrl: category.image_path ? resolveProductImageUrls(category.image_path).detailUrl : null,
  }));

  return <main className="admin-shell">
    <aside className="admin-sidebar">
      <Link href="/" className="admin-brand">JINQAYA<span>ADMIN</span></Link>
      <nav>
        <Link href="/admin/products">Products</Link>
        <Link className="active" href="/admin/categories">Collections</Link>
        <Link href="/admin/orders">Orders</Link>
        <Link href="/admin/inventory">Inventory</Link>
        <Link href="/shop">View storefront ↗</Link>
      </nav>
      <p className="admin-sidebar-note">CATALOG MANAGEMENT</p>
    </aside>
    <section className="admin-main">
      <header className="admin-topbar"><div><p className="admin-kicker">JINQAYA / CATALOG</p><h1>Collections</h1><p className="admin-help">Manage the cover image used for each collection across the storefront.</p></div></header>
      {error ? <p className="admin-error">Unable to load collections: {error.message}</p> : <CategoryImageManager categories={rows} />}
    </section>
  </main>;
}