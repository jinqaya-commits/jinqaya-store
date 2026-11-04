import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { setProductStatus } from "./actions";

export const dynamic = "force-dynamic";

export default async function AdminProductsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: canManage, error: permissionError } = await supabase.rpc("can_manage_catalog");
  if (permissionError || canManage !== true) redirect("/");

  const { data: products, error } = await supabase
    .from("products")
    .select("id, name, slug, status, pet_type, created_at, product_variants(price, currency, sku)")
    .order("created_at", { ascending: false });

  return (
    <main className="admin-shell">
      <aside className="admin-sidebar">
        <Link href="/" className="admin-brand">JINQAYA<span>ADMIN</span></Link>
        <nav><Link className="active" href="/admin/products">Products</Link><Link href="/shop">View storefront ↗</Link></nav>
        <p className="admin-sidebar-note">CATALOG MANAGEMENT</p>
      </aside>
      <section className="admin-main">
        <header className="admin-topbar"><div><p className="admin-kicker">JINQAYA / CATALOG</p><h1>Products</h1></div><Link className="admin-primary-button" href="/admin/products/new">＋ Add product</Link></header>
        <div className="admin-summary"><div><span>ALL PRODUCTS</span><strong>{products?.length ?? 0}</strong></div><div><span>ACTIVE</span><strong>{products?.filter((p) => p.status === "active").length ?? 0}</strong></div><div><span>DRAFTS</span><strong>{products?.filter((p) => p.status === "draft").length ?? 0}</strong></div></div>
        <section className="admin-panel">
          <div className="admin-panel-heading"><div><p className="admin-kicker">YOUR CATALOG</p><h2>All products</h2></div><span>{products?.length ?? 0} ITEMS</span></div>
          {error ? <p className="admin-error">Unable to load products: {error.message}</p> : !products?.length ? (
            <div className="admin-empty"><span>✳</span><h3>Your product catalog starts here.</h3><p>Add your first product to begin building the JINQAYA collection.</p><Link className="admin-primary-button" href="/admin/products/new">Add your first product</Link></div>
          ) : (
            <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>PRODUCT</th><th>SKU</th><th>PET</th><th>PRICE</th><th>STATUS</th><th>ACTION</th></tr></thead><tbody>
              {products.map((product) => {
                const variant = Array.isArray(product.product_variants) ? product.product_variants[0] : null;
                const price = variant?.price == null ? "—" : new Intl.NumberFormat("en-US", { style: "currency", currency: variant.currency || "USD" }).format(Number(variant.price));
                return <tr key={product.id}><td><strong>{product.name}</strong><small>/{product.slug}</small></td><td>{variant?.sku ?? "—"}</td><td>{product.pet_type}</td><td>{price}</td><td><span className={`admin-status status-${product.status}`}>{product.status}</span></td><td><form action={async () => { "use server"; await setProductStatus(product.id, product.status === "active" ? "draft" : "active"); }}><button className="admin-table-action" type="submit">{product.status === "active" ? "Unpublish" : "Publish"}</button></form></td></tr>;
              })}
            </tbody></table></div>
          )}
        </section>
      </section>
    </main>
  );
}
