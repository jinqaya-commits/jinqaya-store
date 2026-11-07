import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const labels: Record<string, string> = {
  on_hold: "Needs review", pending_payment: "Awaiting payment", paid: "Paid",
  processing: "Processing", partially_shipped: "Partially shipped", shipped: "Shipped",
  delivered: "Delivered", cancelled: "Cancelled", partially_refunded: "Partially refunded", refunded: "Refunded",
};
const filters = [
  ["all", "All orders"], ["on_hold", "Needs review"], ["pending_payment", "Awaiting payment"],
  ["paid", "Paid"], ["processing", "Processing"], ["shipped", "Shipped"],
  ["delivered", "Delivered"], ["cancelled", "Cancelled"],
] as const;
function money(a: number | string | null, c: string) {
  return a == null ? "—" : new Intl.NumberFormat("en-US", { style: "currency", currency: c.trim() || "USD" }).format(Number(a));
}
function date(v: string) {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(v));
}
function cleanSearch(value: string) {
  return value.replace(/[^\w@+.\-\s]/g, "").trim().slice(0, 100);
}
function dateBoundary(value?: string) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value ? null : parsed.toISOString();
}
export default async function AdminOrdersPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string; from?: string; to?: string }> }) {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) redirect("/login");
  const { data: allowed, error: permError } = await supabase.rpc("can_manage_catalog");
  if (permError || allowed !== true) redirect("/");

  const params = await searchParams;
  const validStatuses = new Set(filters.map(([value]) => value));
  const selected = params.status && validStatuses.has(params.status as typeof filters[number][0]) ? params.status : "all";
  const search = cleanSearch(params.q || "");
  const from = dateBoundary(params.from);
  const to = dateBoundary(params.to);
  const filterParams = new URLSearchParams();
  if (selected !== "all") filterParams.set("status", selected);
  if (search) filterParams.set("q", search);
  if (params.from && from) filterParams.set("from", params.from);
  if (params.to && to) filterParams.set("to", params.to);
  const queryString = filterParams.toString();
  const exportHref = `/admin/orders/export${queryString ? `?${queryString}` : ""}`;

  let q = supabase.from("orders").select("id,order_number,status,currency,customer_email,customer_phone,subtotal,shipping_amount,shipping_address_snapshot,created_at,order_items(quantity,product_name)").order("created_at", { ascending: false }).limit(200);
  if (selected !== "all") q = q.eq("status", selected);
  if (search) q = q.or(`order_number.ilike.%${search}%,customer_email.ilike.%${search}%,customer_phone.ilike.%${search}%`);
  if (from) q = q.gte("created_at", from);
  if (to) {
    const end = new Date(to);
    end.setUTCDate(end.getUTCDate() + 1);
    q = q.lt("created_at", end.toISOString());
  }
  const [{ data: orders, error }, { count: all }, { count: review }, { count: payment }, { count: fulfil }] = await Promise.all([
    q,
    supabase.from("orders").select("id", { count: "exact", head: true }),
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "on_hold"),
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "pending_payment"),
    supabase.from("orders").select("id", { count: "exact", head: true }).in("status", ["paid", "processing"]),
  ]);
  return <main className="admin-shell">
    <aside className="admin-sidebar"><Link href="/" className="admin-brand">JINQAYA<span>ADMIN</span></Link><nav><Link href="/admin/products">Products</Link><Link className="active" href="/admin/orders">Orders</Link><Link href="/admin/inventory">Inventory</Link><Link href="/shop">View storefront ↗</Link></nav><p className="admin-sidebar-note">COMMERCE MANAGEMENT</p></aside>
    <section className="admin-main">
      <header className="admin-topbar"><div><p className="admin-kicker">JINQAYA / COMMERCE</p><h1>Orders</h1></div><Link className="admin-back-link" href="/admin/products">← CATALOG</Link></header>
      <div className="admin-summary"><div><span>ALL ORDERS</span><strong>{all ?? 0}</strong></div><div><span>NEEDS REVIEW</span><strong>{review ?? 0}</strong></div><div><span>AWAITING PAYMENT</span><strong>{payment ?? 0}</strong></div><div><span>TO FULFIL</span><strong>{fulfil ?? 0}</strong></div></div>
      <section className="admin-panel">
        <div className="admin-panel-heading"><div><p className="admin-kicker">CUSTOMER PURCHASES</p><h2>Order register</h2></div><span>{orders?.length ?? 0} SHOWN · MAX 200</span></div>
        <div className="admin-filter-row">{filters.map(([value, label]) => {
          const next = new URLSearchParams(filterParams);
          if (value === "all") next.delete("status"); else next.set("status", value);
          return <Link key={value} className={selected === value ? "is-selected" : ""} href={`/admin/orders${next.size ? `?${next.toString()}` : ""}`}>{label}</Link>;
        })}</div>
        <form className="admin-order-search" action="/admin/orders" method="get">
          {selected !== "all" && <input type="hidden" name="status" value={selected} />}
          <label>Search orders<input type="search" name="q" defaultValue={search} placeholder="Order number, customer email or phone" /></label>
          <label>From<input type="date" name="from" defaultValue={params.from && from ? params.from : ""} /></label>
          <label>To<input type="date" name="to" defaultValue={params.to && to ? params.to : ""} /></label>
          <button type="submit">Apply filters</button>
          <Link href={selected === "all" ? "/admin/orders" : `/admin/orders?status=${selected}`}>Clear</Link>
          <a href={exportHref}>Export CSV ↓</a>
        </form>
        {error ? <p className="admin-error">Unable to load orders: {error.message}</p> : !orders?.length ? <div className="admin-empty"><span>✳</span><h3>No orders in this view.</h3><p>Try changing your search or date range.</p></div> : <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>ORDER</th><th>CUSTOMER</th><th>ITEMS</th><th>ITEM SUBTOTAL</th><th>STATUS</th><th>DATE</th><th></th></tr></thead><tbody>{orders.map(o => {
          const items = Array.isArray(o.order_items) ? o.order_items : [];
          const address = o.shipping_address_snapshot as { city?: string; country?: string; country_code?: string } | null;
          return <tr key={o.id}><td><strong>{o.order_number}</strong><small>{address?.city ? address.city + ", " + (address.country || address.country_code || "") : "Address saved"}</small></td><td><strong>{o.customer_email}</strong><small>{o.customer_phone || "No phone"}</small></td><td>{items.reduce((sum, item) => sum + Number(item.quantity || 0), 0)} item(s)<small>{items.slice(0, 2).map(item => item.product_name).join(", ")}{items.length > 2 ? "…" : ""}</small></td><td><strong>{money(o.subtotal, o.currency)}</strong><small>{Number(o.shipping_amount) > 0 ? "Shipping " + money(o.shipping_amount, o.currency) : "Shipping pending"}</small></td><td><span className={`admin-status ${["paid", "processing", "shipped", "delivered"].includes(o.status) ? "status-active" : "status-draft"}`}>{labels[o.status] || o.status}</span></td><td>{date(o.created_at)}</td><td><Link className="admin-table-action" href={`/admin/orders/${o.id}`}>View order →</Link></td></tr>;
        })}</tbody></table></div>}
      </section>
      <p className="admin-help" style={{ marginTop: 16 }}>Payment is recorded only after funds are independently verified. Stock is reserved when a shipping quote is confirmed and deducted when payment is confirmed.</p>
    </section>
  </main>;
}
