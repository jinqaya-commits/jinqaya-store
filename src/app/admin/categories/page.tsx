import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolveProductImageUrls } from "@/lib/product-images";
import { CategoryImageManager } from "./category-image-manager";
import { CategoryTreeManager } from "./category-tree-manager";

export const dynamic = "force-dynamic";

export default async function AdminCategoriesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: allowed, error: permissionError } = await supabase.rpc("can_manage_catalog");
  if (permissionError || allowed !== true) redirect("/");
  const { data: categories, error } = await supabase.from("categories")
    .select("id,parent_id,name,slug,description,image_path,seo_title,seo_description,is_active,sort_order")
    .order("sort_order", { ascending: true });
  const all = categories ?? [];
  const rows = all.map(category => ({
    ...category,
    imageUrl: category.image_path ? resolveProductImageUrls(category.image_path).detailUrl : null,
  }));
  return <main className="admin-shell">
    <aside className="admin-sidebar"><Link href="/" className="admin-brand">JINQAYA<span>ADMIN</span></Link><nav>
      <Link href="/admin/products">Products</Link><Link className="active" href="/admin/categories">Categories</Link>
      <Link href="/admin/orders">Orders</Link><Link href="/admin/inventory">Inventory</Link><Link href="/shop">View storefront ↗</Link>
    </nav><p className="admin-sidebar-note">CATALOG MANAGEMENT</p></aside>
    <section className="admin-main">
      <header className="admin-topbar"><div><p className="admin-kicker">JINQAYA / CATALOG</p><h1>Categories</h1><p className="admin-help">Organize products into a clear three-level shopping structure.</p></div></header>
      {error ? <p className="admin-error">Unable to load categories: {error.message}</p> : <>
        <CategoryTreeManager categories={all} />
        <CategoryImageManager categories={rows} />
      </>}
    </section>
  </main>;
}
