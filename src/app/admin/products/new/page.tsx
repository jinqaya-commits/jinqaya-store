import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProductCreateForm } from "./product-create-form";

export const dynamic = "force-dynamic";

export default async function NewProductPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: canManage, error } = await supabase.rpc("can_manage_catalog");
  if (error || canManage !== true) redirect("/");

  const { data: categories } = await supabase
    .from("categories").select("id, name").eq("is_active", true).order("sort_order");

  return <main className="admin-shell">
    <aside className="admin-sidebar"><Link href="/" className="admin-brand">JINQAYA<span>ADMIN</span></Link><nav><Link className="active" href="/admin/products">Products</Link><Link href="/shop">View storefront ↗</Link></nav><p className="admin-sidebar-note">CATALOG MANAGEMENT</p></aside>
    <section className="admin-main">
      <header className="admin-topbar"><div><p className="admin-kicker">JINQAYA / CATALOG / NEW</p><h1>Add a product</h1></div><Link className="admin-back-link" href="/admin/products">← Back to products</Link></header>
      <ProductCreateForm categories={categories ?? []} />
    </section>
  </main>;
}
