import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CustomerCrmEditor from "../customer-crm-editor";
import CustomerFollowUps from "../customer-follow-ups";

export const dynamic = "force-dynamic";

const statusLabels: Record<string, string> = {
  on_hold: "Needs review", pending_payment: "Awaiting payment", paid: "Paid",
  processing: "Processing", partially_shipped: "Partially shipped", shipped: "Shipped",
  delivered: "Delivered", cancelled: "Cancelled", partially_refunded: "Partially refunded", refunded: "Refunded",
};
function money(amount: number | string | null, currency: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: currency.trim() || "USD" }).format(Number(amount || 0));
}
function date(value: string) {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}
export default async function AdminCustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) redirect("/login");
  const { data: allowed, error: permissionError } = await supabase.rpc("can_manage_catalog");
  if (permissionError || allowed !== true) redirect("/");

  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) notFound();

  const { data: customer, error } = await supabase.from("customers")
    .select("id,email,first_name,last_name,phone,accepts_marketing,marketing_opt_in_at,notes,tags,created_at,updated_at")
    .eq("id", id).maybeSingle();
  if (error) throw new Error("Unable to load customer.");
  if (!customer) notFound();

  const [{ data: orders, error: ordersError }, { count: orderCount }, { data: followUps, error: followUpsError }] = await Promise.all([
    supabase.from("orders")
      .select("id,order_number,status,currency,subtotal,shipping_amount,total_amount,placed_at,created_at,paid_at,shipping_method_name,order_items(product_name,variant_name,sku,quantity,unit_price,line_total)")
      .eq("customer_id", id).order("created_at", { ascending: false }).limit(100),
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("customer_id", id),
    supabase.from("customer_follow_ups").select("id,title,notes,due_at,status,completed_at,created_at").eq("customer_id", id).order("due_at", { ascending: true }).limit(100),
  ]);
  if (ordersError) throw new Error("Unable to load customer orders.");
  if (followUpsError) throw new Error("Unable to load customer follow-ups.");

  const paidOrders = (orders || []).filter(order => ["paid", "processing", "partially_shipped", "shipped", "delivered"].includes(order.status));
  const currencies = [...new Set(paidOrders.map(order => order.currency.trim() || "USD"))];
  const paidTotals = currencies.map(currency => ({
    currency,
    total: paidOrders.filter(order => (order.currency.trim() || "USD") === currency).reduce((sum, order) => sum + Number(order.total_amount || 0), 0),
  }));
  const name = [customer.first_name, customer.last_name].filter(Boolean).join(" ") || "Customer";

  return <main className="admin-shell">
    <aside className="admin-sidebar"><Link href="/" className="admin-brand">JINQAYA<span>ADMIN</span></Link><nav><Link href="/admin/products">Products</Link><Link href="/admin/orders">Orders</Link><Link className="active" href="/admin/customers">Customers</Link><Link href="/admin/inventory">Inventory</Link><Link href="/shop">View storefront ↗</Link></nav><p className="admin-sidebar-note">COMMERCE MANAGEMENT</p></aside>
    <section className="admin-main">
      <header className="admin-topbar"><div><p className="admin-kicker">JINQAYA / CUSTOMER</p><h1>{name}</h1></div><Link className="admin-back-link" href="/admin/customers">← ALL CUSTOMERS</Link></header>
      <div className="admin-summary"><div><span>ORDERS</span><strong>{orderCount ?? 0}</strong></div><div><span>PAID ORDERS</span><strong>{paidOrders.length}</strong></div>{paidTotals.map(item=><div key={item.currency}><span>PAID TOTAL · {item.currency}</span><strong>{money(item.total,item.currency)}</strong></div>)}</div>
      <section className="admin-panel">
        <div className="admin-panel-heading"><div><p className="admin-kicker">CUSTOMER PROFILE</p><h2>Contact details</h2></div><span>ADDED {date(customer.created_at)}</span></div>
        <div className="admin-detail-grid">
          <div><span className="admin-kicker">EMAIL</span><p><a href={`mailto:${customer.email}`}>{customer.email}</a></p></div>
          <div><span className="admin-kicker">PHONE</span><p>{customer.phone || "Not provided"}</p></div>
          <div><span className="admin-kicker">MARKETING CONSENT</span><p>{customer.accepts_marketing ? "Opted in" : "Not opted in"}{customer.marketing_opt_in_at ? " · " + date(customer.marketing_opt_in_at) : ""}</p></div>
          <div><span className="admin-kicker">CUSTOMER NOTES</span><p>{customer.notes || "No customer notes recorded."}</p></div>
        </div>
      </section>
      <section className="admin-panel">
        <div className="admin-panel-heading"><div><p className="admin-kicker">CUSTOMER RELATIONSHIP</p><h2>Notes & tags</h2></div><span>INTERNAL ONLY</span></div>
        <CustomerCrmEditor customerId={customer.id} initialNotes={customer.notes || ""} initialTags={customer.tags || []} />
      </section>
      <section className="admin-panel">
        <div className="admin-panel-heading"><div><p className="admin-kicker">CUSTOMER RELATIONSHIP</p><h2>Follow-ups</h2></div><span>INTERNAL ONLY</span></div>
        <CustomerFollowUps customerId={customer.id} initialFollowUps={followUps || []} />
      </section>
      <section className="admin-panel">
        <div className="admin-panel-heading"><div><p className="admin-kicker">PURCHASE HISTORY</p><h2>Orders</h2></div><span>{orderCount ?? 0} TOTAL</span></div>
        {!orders?.length ? <div className="admin-empty"><h3>No orders yet.</h3><p>This customer has not submitted an order.</p></div> : <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>ORDER</th><th>ITEMS</th><th>AMOUNT</th><th>STATUS</th><th>DATE</th><th></th></tr></thead><tbody>{orders.map(order=>{
          const items=Array.isArray(order.order_items)?order.order_items:[];
          const quantity=items.reduce((sum,item)=>sum+Number(item.quantity||0),0);
          return <tr key={order.id}><td><strong>{order.order_number}</strong><small>{order.shipping_method_name||"Shipping to be confirmed"}</small></td><td>{quantity} item(s)<small>{items.slice(0,2).map(item=>item.product_name).join(", ")}{items.length>2?"…":""}</small></td><td><strong>{money(order.total_amount,order.currency)}</strong><small>Subtotal {money(order.subtotal,order.currency)}</small></td><td><span className={`admin-status ${["paid","processing","shipped","delivered"].includes(order.status)?"status-active":"status-draft"}`}>{statusLabels[order.status]||order.status}</span></td><td>{date(order.created_at)}</td><td><Link className="admin-table-action" href={`/admin/orders/${order.id}`}>View order →</Link></td></tr>;
        })}</tbody></table></div>}
      </section>
      <p className="admin-help" style={{marginTop:16}}>Paid totals include orders recorded as paid, processing, shipped or delivered. Different currencies are kept separate. Only the latest 100 orders are displayed here.</p>
    </section>
  </main>;
}
