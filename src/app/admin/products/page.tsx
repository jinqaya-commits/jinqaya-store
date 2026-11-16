import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { setProductStatus } from "./actions";
import { getProductReadiness } from "@/lib/product-readiness";
import { resolveProductImageUrls } from "@/lib/product-images";
import { getCatalogCompleteness } from "@/lib/catalog-completeness";
import { ProductBulkToolbar, ProductSelectionCheckbox, ProductSelectionHeader, ProductSelectionProvider } from "./product-selection";

export const dynamic = "force-dynamic";

export default async function AdminProductsPage({ searchParams }: { searchParams?: Promise<{ completeness?: string }> }) {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims?.sub) redirect("/login");
  const { data: canManage, error: permissionError } = await supabase.rpc("can_manage_catalog");
  if (permissionError || canManage !== true) redirect("/");

  const { data: products, error } = await supabase
    .from("products")
    .select("id, name, slug, status, pet_type, created_at, short_description, description, material, seo_title, seo_description, dimensions, product_variants(price, currency, sku, is_active), product_images(storage_path, alt_text, is_primary), product_categories(is_primary, categories(name, parent_id, is_active))")
    .order("created_at", { ascending: false });

  const params = searchParams ? await searchParams : {};
  const incompleteOnly = params.completeness === "incomplete";
  const catalogRows = (products ?? []).map((product) => {
    const imageRows = Array.isArray(product.product_images) ? product.product_images : [];
    const categoryRows = Array.isArray(product.product_categories) ? product.product_categories : [];
    const categoryInputs = categoryRows.map((row: { is_primary: boolean; categories: { parent_id: string | null; is_active: boolean } | { parent_id: string | null; is_active: boolean }[] | null }) => {
      const category = Array.isArray(row.categories) ? row.categories[0] : row.categories;
      return { is_primary: row.is_primary, parent_id: category?.parent_id ?? null, is_active: category?.is_active ?? false };
    });
    const checks = getCatalogCompleteness({
      dimensions: product.dimensions,
      images: imageRows,
      variants: Array.isArray(product.product_variants) ? product.product_variants : [],
      categories: categoryInputs,
    });
    return { product, checks };
  });
  const catalogIncompleteCount = catalogRows.filter((row) => !row.checks.complete).length;
  const missingSkuCount = catalogRows.filter((row) => row.checks.missing.includes("SKU")).length;
  const missingDimensionsCount = catalogRows.filter((row) => row.checks.missing.includes("Dimensions")).length;
  const missingAltCount = catalogRows.filter((row) => row.checks.missing.includes("Image Alt Text")).length;
  const missingCategoryCount = catalogRows.filter((row) => row.checks.missing.includes("Category")).length;
  const visibleProducts = catalogRows.filter((row) => !incompleteOnly || !row.checks.complete).map((row) => row.product);

  const needsContentCount = (products ?? []).filter((product) => {
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
    return !readiness.ready;
  }).length;

  return (
    <main className="admin-shell">
      <aside className="admin-sidebar">
        <Link href="/" className="admin-brand">JINQAYA<span>ADMIN</span></Link>
        <nav><Link className="active" href="/admin/products">Products</Link><Link href="/admin/categories">Collections</Link><Link href="/admin/homepage-media">Homepage images</Link><Link href="/admin/orders">Orders</Link><Link href="/admin/inventory">Inventory</Link><Link href="/shop">View storefront ↗</Link></nav>
        <p className="admin-sidebar-note">CATALOG MANAGEMENT</p>
      </aside>
      <section className="admin-main">
        <header className="admin-topbar"><div><p className="admin-kicker">JINQAYA / CATALOG</p><h1>Products</h1></div><div className="admin-topbar-actions"><Link className="admin-secondary-button" href="/admin/products/import">Import CSV</Link><Link className="admin-primary-button" href="/admin/products/new">＋ Add product</Link></div></header>
        <div className="admin-summary"><div><span>ALL PRODUCTS</span><strong>{products?.length ?? 0}</strong></div><div><span>ACTIVE</span><strong>{products?.filter((p) => p.status === "active").length ?? 0}</strong></div><div><span>DRAFTS</span><strong>{products?.filter((p) => p.status === "draft").length ?? 0}</strong></div><div><span>NEEDS CONTENT</span><strong>{needsContentCount}</strong></div></div>
        <div className="admin-panel" style={{ marginBottom: 24 }}>
          <div className="admin-panel-heading"><div><p className="admin-kicker">CATALOG DATA QUALITY</p><h2>Product completeness check</h2></div><span>{catalogIncompleteCount} NEED ATTENTION</span></div>
          <p className="admin-help">Checks four essential fields: SKU, valid product dimensions, image Alt Text, and an active primary category. This check only reports missing data and never changes product records.</p>
          <div className="admin-summary">
            <div><span>MISSING SKU</span><strong>{missingSkuCount}</strong></div>
            <div><span>MISSING DIMENSIONS</span><strong>{missingDimensionsCount}</strong></div>
            <div><span>MISSING ALT TEXT</span><strong>{missingAltCount}</strong></div>
            <div><span>MISSING CATEGORY</span><strong>{missingCategoryCount}</strong></div>
          </div>
          <p className="admin-help"><Link className="admin-secondary-button" href="/admin/products">All products</Link> <Link className="admin-secondary-button" href="/admin/products?completeness=incomplete">Show incomplete products ({catalogIncompleteCount})</Link></p>
        </div>
        <ProductSelectionProvider products={(products ?? []).map((product) => ({ id: product.id, name: product.name, status: product.status }))}>
        <section className="admin-panel">
          <div className="admin-panel-heading"><div><p className="admin-kicker">YOUR CATALOG</p><h2>{incompleteOnly ? "Incomplete products" : "All products"}</h2></div><span>{visibleProducts.length} ITEMS</span></div>
          <ProductBulkToolbar />
          {error ? <p className="admin-error">Unable to load products: {error.message}</p> : !products?.length ? (
            <div className="admin-empty"><span>✳</span><h3>Your product catalog starts here.</h3><p>Add your first product to begin building the JINQAYA collection.</p><Link className="admin-primary-button" href="/admin/products/new">Add your first product</Link></div>
          ) : visibleProducts.length === 0 ? (
            <div className="admin-empty"><h3>No incomplete products found.</h3><p>All products currently have an SKU, valid dimensions, image descriptions and an active primary category.</p><Link className="admin-secondary-button" href="/admin/products">View all products</Link></div>
          ) : (
            <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th><ProductSelectionHeader /></th><th>PRODUCT</th><th>SKU</th><th>PET</th><th>PRICE</th><th>DATA CHECK</th><th>READINESS</th><th>STATUS</th><th>ACTION</th></tr></thead><tbody>
              {visibleProducts.map((product) => {
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
                const dataChecks = getCatalogCompleteness({
                  dimensions: product.dimensions,
                  images: imageRows,
                  variants: Array.isArray(product.product_variants) ? product.product_variants : [],
                  categories: categoryRows.map((row: { is_primary: boolean; categories: { parent_id: string | null; is_active: boolean } | { parent_id: string | null; is_active: boolean }[] | null }) => {
                    const category = Array.isArray(row.categories) ? row.categories[0] : row.categories;
                    return { is_primary: row.is_primary, parent_id: category?.parent_id ?? null, is_active: category?.is_active ?? false };
                  }),
                });
                return <tr key={product.id}><td><ProductSelectionCheckbox productId={product.id} /></td><td><div className="admin-product-cell">{(() => { const mainImage = imageRows.find((image) => image.is_primary) ?? imageRows[0]; const imageUrl = mainImage?.storage_path ? resolveProductImageUrls(mainImage.storage_path).thumbnailUrl : null; return imageUrl ? <img className="admin-product-thumb" src={imageUrl} alt="" /> : <span className="admin-product-thumb admin-product-thumb-empty">JQ</span>; })()}<div><strong>{product.name}</strong><small>/{product.slug}</small><small><Link href={`/admin/products/${product.id}/edit`}>Edit product →</Link></small></div></div></td><td>{variant?.sku ?? "—"}</td><td>{product.pet_type}</td><td>{price}</td><td><span className={`admin-status ${dataChecks.complete ? "status-active" : "status-draft"}`}>{dataChecks.complete ? "Complete" : `${dataChecks.missing.length} missing`}</span>{!dataChecks.complete && <small>{dataChecks.missing.join(" · ")}</small>}<small><Link href={`/admin/products/${product.id}/edit`}>Fix data →</Link></small></td><td><span className={`admin-status ${seoReady ? "status-active" : "status-draft"}`}>{seoReady ? "Complete" : `${readiness.missing.length} missing`}</span>{!seoReady && <small>{readiness.missing.join(" · ")}</small>}</td><td><span className={`admin-status status-${product.status}`}>{product.status}</span></td><td><form action={async () => { "use server"; await setProductStatus(product.id, product.status === "active" ? "draft" : "active"); }}><button className="admin-table-action" type="submit" disabled={product.status !== "active" && !seoReady}>{product.status === "active" ? "Unpublish" : "Publish"}</button></form></td></tr>;
              })}
            </tbody></table></div>
          )}
        </section>
        </ProductSelectionProvider>
      </section>
    </main>
  );
}
