import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { setProductStatus } from "./actions";
import { getProductReadiness } from "@/lib/product-readiness";

export const dynamic = "force-dynamic";

export default async function AdminProductsPage() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims?.sub) redirect("/login");
  const { data: canManage, error: permissionError } = await supabase.rpc("can_manage_catalog");
  if (permissionError || canManage !== true) redirect("/");

  const { data: products, error } = await supabase
    .from("products")
    .select("id, name, slug, status, pet_type, created_at, short_description, description, material, seo_title, seo_description, product_variants(price, currency, sku, is_active), product_images(alt_text, is_primary), product_categories(is_primary, categories(parent_id, is_active))")
    .order("created_at", { ascending: false });

  return (
    <main className="admin-shell">
      <aside className="admin-sidebar">
        <Link href="/" className="admin-brand">JINQAYA<span>ADMIN</span></Link>
        <nav><Link className="active" href="/admin/products">Products</Link><Link href="/admin/categories">Collections</Link><Link href="/admin/orders">Orders</Link><Link href="/admin/inventory">Inventory</Link><Link href="/shop">View storefront ↗</Link></nav>
        <p className="admin-sidebar-note">CATALOG MANAGEMENT</p>
      </aside>
      <section className="admin-main">
        <header className="admin-topbar"><div><p className="admin-kicker">JINQAYA / CATALOG</p><h1>Products</h1></div><Link className="admin-primary-button" href="/admin/products/new">＋ Add product</Link></header>
        <div className="admin-summary"><div><span>ALL PRODUCTS</span><strong>{products?.length ?? 0}</strong></div><div><span>ACTIVE</span><strong>{products?.filter((p) => p.status === "active").length ?? 0}</strong></div><div><span>DRAFTS</span><strong>{products?.filter((p) => p.status === "draft").length ?? 0}</strong></div></div>
        <div className="admin-panel" style={{ marginBottom: 24 }}>
          <div className="admin-panel-heading"><div><p className="admin-kicker">SEARCH READINESS</p><h2>Product SEO checks</h2></div><span>CONTENT QUALITY</span></div>
          <p className="admin-help">Checks are based on product-specific information entered by your team. Generic placeholders do not count as useful image descriptions. A complete checklist helps review the catalog; it does not guarantee search rankings.</p>
        </div>
        <section className="admin-panel">
          <div className="admin-panel-heading"><div><p className="admin-kicker">YOUR CATALOG</p><h2>All products</h2></div><span>{products?.length ?? 0} ITEMS</span></div>
          {error ? <p className="admin-error">Unable to load products: {error.message}</p> : !products?.length ? (
            <div className="admin-empty"><span>✳</span><h3>Your product catalog starts here.</h3><p>Add your first product to begin building the JINQAYA collection.</p><Link className="admin-primary-button" href="/admin/products/new">Add your first product</Link></div>
          ) : (
            <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>PRODUCT</th><th>SKU</th><th>PET</th><th>PRICE</th><th>SEO CHECK</th><th>STATUS</th><th>ACTION</th></tr></thead><tbody>
              {products.map((product) => {
                const variant = Array.isArray(product.product_variants) ? product.product_variants.find((item) => item.is_active) ?? product.product_variants[0] : null;
                const price = variant?.price == null ? "—" : new Intl.NumberFormat("en-US", { style: "currency", currency: variant.currency || "USD" }).format(Number(variant.price));
                const imageRows = Array.isArray(product.product_images) ? product.product_images : [];
                const categoryRows = Array.isArray(product.product_categories) ? product.product_categories : [];
                const readiness = getProductReadiness({
                  shortDescription: product.short_description,
                  description: product.description,
                  material: product.material,
                  seoTitle: product.seo_title,
                  seoDescription: product.seo_description,
                  images: imageRows,
                  variants: Array.isArray(product.product_variants) ? product.product_variants : [],
                  categories: categoryRows.map((row: { is_primary: boolean; categories: { parent_id: string | null; is_active: boolean } | { parent_id: string | null; is_active: boolean }[] | null }) => {
                    const category = Array.isArray(row.categories) ? row.categories[0] : row.categories;
                    return { is_primary: row.is_primary, parent_id: category?.parent_id ?? null, is_active: category?.is_active ?? false };
                  }),
                });
                const seoReady = readiness.ready;
                return <tr key={product.id}><td><strong>{product.name}</strong><small>/{product.slug}</small><small><Link href={`/admin/products/${product.id}/edit`}>Edit product →</Link></small></td><td>{variant?.sku ?? "—"}</td><td>{product.pet_type}</td><td>{price}</td><td><span className={`admin-status ${seoReady ? "status-active" : "status-draft"}`}>{seoReady ? "Complete" : `${missing.length} missing`}</span>{!seoReady && <small>{readiness.missing.join(" · ")}</small>}</td><td><span className={`admin-status status-${product.status}`}>{product.status}</span></td><td><form action={async () => { "use server"; await setProductStatus(product.id, product.status === "active" ? "draft" : "active"); }}><button className="admin-table-action" type="submit" disabled={product.status !== "active" && !seoReady}>{product.status === "active" ? "Unpublish" : "Publish"}</button></form></td></tr>;
              })}
            </tbody></table></div>
          )}
        </section>
      </section>
    </main>
  );
}
