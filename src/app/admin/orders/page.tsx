import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function money(amount: number | string | null, currency: string) {
  if (amount == null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: currency || "USD" }).format(Number(amount));
}

function date(value: string) {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export default async function AdminOrdersPage() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims?.sub) redirect("/login");
  const { data: canManage, error: permissionError } = await supabase.rpc("can_manage_catalog");
  if (permissionError || canManage !== true) redirect("/");

  const { data: orders, error } = await supabase
    .from("orders")
    .select("id, order_number, status, currency, customer_email, customer_phone, subtotal, shipping_amount, tax_amount, total_amount, shipping_address_snapshot, shipping_quote_snapshot, created_at, order_items(product_name, variant_name, sku, quantity, unit_price, line_total)")
    .order("created_at", { ascending: false })
    .limit(100);

  const pending = orders?.filter((order) => order.status === "on_hold" || order.status === "pending_payment").length ?? 0;
  const paid = orders?.filter((order) => order.status === "paid" || order.status === "processing").length ?? 0;

  return (
    <main className="admin-shell">
      <aside className="admin-sidebar">
        <Link href="/" className="admin-brand">JINQAYA<span>ADMIN</span></Link>
        <nav>
          <Link href="/admin/products">Products</Link>
          <Link className="active" href="/admin/orders">Orders</Link>
          <Link href="/shop">View storefront ↗</Link>
        </nav>
        <p className="admin-sidebar-note">COMMERCE MANAGEMENT</p>
      </aside>
      <section className="admin-main">
        <header className="admin-topbar"><div><p className="admin-kicker">JINQAYA / COMMERCE</p><h1>Orders</h1></div><Link className="admin-back-link" href="/admin/products">← CATALOG</Link></header>
        <div className="admin-summary">
          <div><span>ALL ORDERS</span><strong>{orders?.length ?? 0}</strong></div>
          <div><span>NEEDS REVIEW</span><strong>{pending}</strong></div>
          <div><span>PAID / PROCESSING</span><strong>{paid}</strong></div>
        </div>
        <section className="admin-panel">
          <div className="admin-panel-heading"><div><p className="admin-kicker">CUSTOMER PURCHASES</p><h2>Recent orders</h2></div><span>LAST 100</span></div>
          {error ? <p className="admin-error">Unable to load orders: {error.message}</p> : !orders?.length ? (
            <div className="admin-empty"><span>✳</span><h3>No orders yet.</h3><p>Customer order requests and purchases will appear here.</p></div>
          ) : (
            <div className="admin-table-wrap"><table className="admin-table">
              <thead><tr><th>ORDER</th><th>CUSTOMER</th><th>ITEMS</th><th>TOTAL</th><th>STATUS</th><th>DATE</th></tr></thead>
              <tbody>{orders.map((order) => {
                const items = Array.isArray(order.order_items) ? order.order_items : [];
                const address = order.shipping_address_snapshot as { city?: string; country?: string; country_code?: string } | null;
                return <tr key={order.id}>
                  <td><strong>{order.order_number}</strong><small>{address?.city ? `${address.city}, ${address.country || address.country_code || ""}` : "Address saved"}</small></td>
                  <td><strong>{order.customer_email}</strong><small>{order.customer_phone || "No phone provided"}</small></td>
                  <td>{items.reduce((sum, item) => sum + Number(item.quantity || 0), 0)} item(s)<small>{items.slice(0,2).map((item) => item.product_name).join(", ")}{items.length > 2 ? "…" : ""}</small></td>
                  <td><strong>{money(order.total_amount, order.currency)}</strong><small>Items {money(order.subtotal, order.currency)} · Shipping {money(order.shipping_amount, order.currency)}</small></td>
                  <td><span className={`admin-status ${order.status === "paid" || order.status === "processing" ? "status-active" : "status-draft"}`}>{String(order.status).replaceAll("_", " ")}</span></td>
                  <td>{date(order.created_at)}</td>
                </tr>;
              })}</tbody>
            </table></div>
          )}
        </section>
        <p className="admin-help" style={{marginTop:16}}>Orders created through the current checkout are requests on hold until stock, shipping charges and payment are confirmed. Do not mark them paid until a verified payment notification is received.</p>
      </section>
    </main>
  );
}
