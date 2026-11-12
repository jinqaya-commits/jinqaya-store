import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function money(value: number | string | null, currency: string) {
  if (value == null) return "—";
  try { return new Intl.NumberFormat("en-US", { style: "currency", currency: currency.trim() || "USD" }).format(Number(value)); }
  catch { return `${currency} ${value}`; }
}
function dateTime(value: string) {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}
function dayStart() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
}

export default async function AdminDashboardPage() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) redirect("/login");
  const { data: allowed, error: permissionError } = await supabase.rpc("can_manage_catalog");
  if (permissionError || allowed !== true) redirect("/");

  const today = dayStart();
  const now = new Date().toISOString();
  const [{ count: allOrders }, { count: reviewOrders }, { count: paymentOrders }, { count: fulfilOrders }, { count: todayOrders }, { data: recentOrders, error: ordersError }, { count: openFollowUps }, { count: overdueFollowUps }, { data: dueFollowUps, error: followUpsError }, { data: warehouse }, { data: variants, error: inventoryError }, { data: incomingItems, error: incomingError }] = await Promise.all([
    supabase.from("orders").select("id", { count: "exact", head: true }),
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "on_hold"),
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "pending_payment"),
    supabase.from("orders").select("id", { count: "exact", head: true }).in("status", ["paid", "processing"]),
    supabase.from("orders").select("id", { count: "exact", head: true }).gte("created_at", today),
    supabase.from("orders").select("id,order_number,status,currency,customer_email,subtotal,created_at").order("created_at", { ascending: false }).limit(6),
    supabase.from("customer_follow_ups").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("customer_follow_ups").select("id", { count: "exact", head: true }).eq("status", "pending").lt("due_at", now),
    supabase.from("customer_follow_ups").select("id,customer_id,title,due_at,customers(first_name,last_name,email)").eq("status", "pending").order("due_at", { ascending: true }).limit(6),
    supabase.from("warehouses").select("id,code,name").eq("is_default", true).eq("is_active", true).maybeSingle(),
    supabase.from("product_variants").select("id,sku,variant_name,color,size,products(name),inventory(on_hand,reserved,damaged,reorder_point,warehouse_id)").eq("is_active", true).limit(500),
    supabase.from("purchase_order_items").select("variant_id,quantity_ordered,quantity_received,purchase_orders!inner(status,warehouse_id)").in("purchase_orders.status", ["submitted", "partially_received"]),
  ]);

  if (ordersError) throw new Error("Unable to load recent orders.");
  if (followUpsError) throw new Error("Unable to load customer follow-ups.");
  if (inventoryError) throw new Error("Unable to load inventory alerts.");
  if (incomingError) throw new Error("Unable to load incoming purchase quantities.");

  const incomingByVariant = new Map<string, number>();
  (incomingItems || []).forEach((item: any) => {
    const purchaseOrder = Array.isArray(item.purchase_orders) ? item.purchase_orders[0] : item.purchase_orders;
    if (!warehouse || purchaseOrder?.warehouse_id !== warehouse.id) return;
    const remaining = Math.max(0, Number(item.quantity_ordered) - Number(item.quantity_received));
    if (remaining > 0) incomingByVariant.set(item.variant_id, (incomingByVariant.get(item.variant_id) || 0) + remaining);
  });

  const stockRows = (variants || []).map((variant: any) => {
    const stocks = Array.isArray(variant.inventory) ? variant.inventory : [];
    const stock = stocks.find((item: any) => item.warehouse_id === warehouse?.id);
    if (!stock) return null;
    const available = Number(stock.on_hand) - Number(stock.reserved) - Number(stock.damaged);
    const reorderPoint = Number(stock.reorder_point);
    const incoming = incomingByVariant.get(variant.id) || 0;
    return { sku: variant.sku, name: variant.products?.name || "Product", available, reorderPoint, incoming, replenishmentGap: Math.max(0, reorderPoint - available - incoming) };
  }).filter((row: any) => row && row.available <= row.reorderPoint).sort((a: any, b: any) => a.available - b.available).slice(0, 6);

  const followUps = (dueFollowUps || []) as any[];
  const orderStatus: Record<string, string> = { on_hold: "Needs review", pending_payment: "Awaiting payment", paid: "Paid", processing: "Processing", partially_shipped: "Partially shipped", shipped: "Shipped", delivered: "Delivered", cancelled: "Cancelled", partially_refunded: "Partially refunded", refunded: "Refunded" };

  return <main className="admin-shell">
    <aside className="admin-sidebar"><Link href="/" className="admin-brand">JINQAYA<span>ADMIN</span></Link><nav>
      <Link className="active" href="/admin">Overview</Link><Link href="/admin/products">Products</Link><Link href="/admin/orders">Orders</Link><Link href="/admin/customers">Customers</Link><Link href="/admin/follow-ups">Follow-ups</Link><Link href="/admin/after-sales">After-sales</Link><Link href="/admin/inventory">Inventory</Link><Link href="/shop">View storefront ↗</Link>
    </nav><p className="admin-sidebar-note">COMMERCE MANAGEMENT</p></aside>
    <section className="admin-main">
      <header className="admin-topbar"><div><p className="admin-kicker">JINQAYA / OVERVIEW</p><h1>Good day.</h1><p className="admin-help">A clear view of what needs your attention.</p></div><Link className="admin-back-link" href="/admin/orders">VIEW ORDERS →</Link></header>
      <div className="admin-summary">
        <div><span>ALL ORDERS</span><strong>{allOrders ?? 0}</strong><small>{todayOrders ?? 0} received today</small></div>
        <div><span>NEEDS REVIEW</span><strong>{reviewOrders ?? 0}</strong><small>Order requests to review</small></div>
        <div><span>AWAITING PAYMENT</span><strong>{paymentOrders ?? 0}</strong><small>Payment to verify manually</small></div>
        <div><span>TO FULFIL</span><strong>{fulfilOrders ?? 0}</strong><small>Paid / processing orders</small></div>
      </div>
      <div className="admin-dashboard-grid">
        <section className="admin-panel">
          <div className="admin-panel-heading"><div><p className="admin-kicker">COMMERCE</p><h2>Recent orders</h2></div><Link href="/admin/orders">ALL ORDERS →</Link></div>
          {!recentOrders?.length ? <div className="admin-empty"><h3>No orders yet.</h3><p>New customer order requests will appear here.</p></div> : <div className="admin-dashboard-list">{recentOrders.map(order => <Link className="admin-dashboard-row" href={`/admin/orders/${order.id}`} key={order.id}><span><strong>{order.order_number}</strong><small>{order.customer_email} · {dateTime(order.created_at)}</small></span><span className="admin-dashboard-row-end"><strong>{money(order.subtotal, order.currency)}</strong><small>{orderStatus[order.status] || order.status.replaceAll("_", " ")}</small></span></Link>)}</div>}
        </section>
        <section className="admin-panel">
          <div className="admin-panel-heading"><div><p className="admin-kicker">CUSTOMER RELATIONSHIP</p><h2>Follow-up tasks</h2></div><Link href="/admin/follow-ups">OPEN TASKS →</Link></div>
          <div className="admin-dashboard-mini-stats"><div><strong>{openFollowUps ?? 0}</strong><small>Open</small></div><div><strong className={(overdueFollowUps ?? 0) > 0 ? "admin-dashboard-alert" : ""}>{overdueFollowUps ?? 0}</strong><small>Overdue</small></div></div>
          {!followUps.length ? <div className="admin-empty"><p>No pending follow-ups.</p></div> : <div className="admin-dashboard-list">{followUps.map(item => { const customer = item.customers; const name = [customer?.first_name, customer?.last_name].filter(Boolean).join(" ") || customer?.email || "Customer"; const overdue = new Date(item.due_at).getTime() < Date.now(); return <Link className="admin-dashboard-row" href={`/admin/customers/${item.customer_id}`} key={item.id}><span><strong>{item.title}</strong><small>{name}</small></span><span className={overdue ? "admin-dashboard-alert admin-dashboard-due" : "admin-dashboard-due"}>{overdue ? "Overdue" : dateTime(item.due_at)}</span></Link>; })}</div>}
        </section>
        <section className="admin-panel">
          <div className="admin-panel-heading"><div><p className="admin-kicker">STOCK CONTROL</p><h2>Inventory alerts</h2></div><Link href="/admin/inventory">INVENTORY →</Link></div>
          {!warehouse ? <div className="admin-empty"><p>No active default warehouse configured.</p></div> : !stockRows.length ? <div className="admin-empty"><p>No low-stock variants detected.</p></div> : <div className="admin-dashboard-list">{stockRows.map((row: any) => <Link className="admin-dashboard-row" href="/admin/inventory" key={row.sku}><span><strong>{row.name}</strong><small>{row.sku} · {row.incoming} incoming · reorder at {row.reorderPoint}</small></span><span className={row.available <= 0 ? "admin-dashboard-alert admin-dashboard-due" : "admin-dashboard-due"}>{row.available} available{row.replenishmentGap > 0 ? " · +" + row.replenishmentGap + " needed" : ""}</span></Link>)}</div>}
          <p className="admin-help">Available = on hand − reserved − damaged. Alerts use each SKU's reorder point.</p>
        </section>
        <section className="admin-panel admin-dashboard-shortcuts">
          <div className="admin-panel-heading"><div><p className="admin-kicker">QUICK ACCESS</p><h2>Manage your store</h2></div></div>
          <Link href="/admin/products">Products & catalog <span>→</span></Link>
          <Link href="/admin/customers">Customer directory <span>→</span></Link>
          <Link href="/admin/follow-ups">Customer follow-ups <span>→</span></Link>
          <Link href="/admin/after-sales">After-sales cases <span>→</span></Link>
          <Link href="/admin/inventory">Stock management <span>→</span></Link>
        </section>
      </div>
      <p className="admin-help" style={{marginTop:18}}>Dashboard figures are live database counts. Payments are never inferred: payment verification remains a manual admin action. Inventory alerts show up to six variants in the default warehouse.</p>
    </section>
  </main>;
}
