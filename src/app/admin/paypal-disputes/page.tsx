import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const disputeLabels: Record<string, string> = {
  OPEN: "Open", WAITING_FOR_SELLER_RESPONSE: "Waiting for seller",
  UNDER_REVIEW: "Under review", RESOLVED: "Resolved", CLOSED: "Closed",
  WON: "Won", LOST: "Lost", UNKNOWN: "Unknown",
};
function money(value: number | string | null, currency: string | null) {
  if (value == null) return "—";
  try { return new Intl.NumberFormat("en-US", { style: "currency", currency: currency?.trim() || "USD" }).format(Number(value)); }
  catch { return `${currency || "USD"} ${value}`; }
}
function date(value: string | null) {
  return value ? new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "—";
}
function statusLabel(value: string) {
  return disputeLabels[value.toUpperCase()] || value.replaceAll("_", " ").toLowerCase();
}

export default async function PayPalDisputesPage() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) redirect("/login");
  const { data: allowed, error: permissionError } = await supabase.rpc("can_manage_catalog");
  if (permissionError || allowed !== true) redirect("/");

  // These operational PayPal tables are created by the production migration but are not yet in the generated Supabase TypeScript schema.
  const db = supabase as any;
  const [{ data: disputes, error: disputeError }, { data: events, error: eventError }] = await Promise.all([
    db.from("paypal_disputes")
      .select("dispute_id,order_id,payment_id,capture_id,status,reason,amount,currency,created_at,updated_at,orders(id,order_number,customer_email,status),payments(status,payment_review_required)")
      .order("updated_at", { ascending: false }).limit(200),
    db.from("paypal_webhook_events")
      .select("paypal_event_id,event_type,resource_id,order_id,processing_status,error_message,created_at,processed_at,orders(id,order_number)")
      .order("created_at", { ascending: false }).limit(50),
  ]);

  const rows = (disputes || []) as any[];
  const openCount = rows.filter((d) => !["RESOLVED", "CLOSED", "WON", "LOST"].includes(String(d.status).toUpperCase())).length;
  const reviewCount = rows.filter((d) => {
    const payment = Array.isArray(d.payments) ? d.payments[0] : d.payments;
    return payment?.payment_review_required === true;
  }).length;
  const failedEvents = (events || []).filter((e: any) => e.processing_status === "failed" || Boolean(e.error_message)).length;

  return <main className="admin-shell">
    <aside className="admin-sidebar">
      <Link className="admin-brand" href="/">JINQAYA<span>ADMIN</span></Link>
      <nav>
        <Link href="/admin">Overview</Link><Link href="/admin/products">Products</Link>
        <Link href="/admin/orders">Orders</Link><Link href="/admin/customers">Customers</Link>
        <Link href="/admin/after-sales">After-sales</Link><Link className="active" href="/admin/paypal-disputes">PayPal disputes</Link>
        <Link href="/admin/inventory">Inventory</Link><Link href="/shop">View storefront ↗</Link>
      </nav>
      <p className="admin-sidebar-note">COMMERCE MANAGEMENT</p>
    </aside>
    <section className="admin-main">
      <header className="admin-topbar">
        <div><p className="admin-kicker">JINQAYA / PAYMENT RISK</p><h1>PayPal disputes</h1>
          <p className="admin-help">Review dispute notices, payment holds and webhook processing. This page is read-only.</p></div>
        <Link className="admin-back-link" href="/admin/orders">← ALL ORDERS</Link>
      </header>
      <div className="admin-summary">
        <div><span>DISPUTES SHOWN</span><strong>{rows.length}</strong><small>Latest 200 records</small></div>
        <div><span>NOT RESOLVED</span><strong>{openCount}</strong><small>Requires attention</small></div>
        <div><span>PAYMENT REVIEW HOLDS</span><strong>{reviewCount}</strong><small>Fulfilment remains restricted</small></div>
        <div><span>EVENT ERRORS</span><strong>{failedEvents}</strong><small>Latest 50 webhook events</small></div>
      </div>
      <section className="admin-panel">
        <div className="admin-panel-heading"><div><p className="admin-kicker">CASE REGISTER</p><h2>Dispute records</h2></div><span>{rows.length} SHOWN</span></div>
        {disputeError ? <p className="admin-error">Unable to load PayPal disputes. Check the database read policy.</p> :
          !rows.length ? <div className="admin-empty"><h3>No PayPal disputes recorded.</h3><p>Verified PayPal dispute notifications will appear here.</p></div> :
          <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>DISPUTE</th><th>ORDER / CUSTOMER</th><th>REASON</th><th>AMOUNT</th><th>STATUS</th><th>PAYMENT HOLD</th><th>UPDATED</th></tr></thead><tbody>
            {rows.map((d) => { const order = Array.isArray(d.orders) ? d.orders[0] : d.orders; const payment = Array.isArray(d.payments) ? d.payments[0] : d.payments; return <tr key={d.dispute_id}>
              <td><strong>{d.dispute_id}</strong><small>Capture {d.capture_id}</small></td>
              <td>{order?.id ? <Link href={`/admin/orders/${order.id}`}>{order.order_number} →</Link> : "Order unavailable"}<small>{order?.customer_email || "—"}</small></td>
              <td>{d.reason || "Not supplied"}</td><td><strong>{money(d.amount, d.currency)}</strong></td>
              <td><span className={`admin-status ${["RESOLVED","CLOSED","WON","LOST"].includes(String(d.status).toUpperCase()) ? "status-active" : "status-draft"}`}>{statusLabel(d.status)}</span></td>
              <td>{payment?.payment_review_required ? <strong className="admin-dashboard-alert">Review required</strong> : "No active flag"}</td>
              <td>{date(d.updated_at)}</td>
            </tr>; })}
          </tbody></table></div>}
      </section>
      <section className="admin-panel">
        <div className="admin-panel-heading"><div><p className="admin-kicker">WEBHOOK AUDIT</p><h2>Recent PayPal events</h2></div><span>{events?.length || 0} EVENTS · MAX 50</span></div>
        {eventError ? <p className="admin-error">Unable to load PayPal webhook events.</p> :
          !events?.length ? <div className="admin-empty"><p>No PayPal webhook events recorded.</p></div> :
          <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>EVENT</th><th>TYPE</th><th>ORDER</th><th>PROCESSING</th><th>DETAIL</th><th>RECEIVED</th><th>PROCESSED</th></tr></thead><tbody>
            {events.map((e: any) => { const order = Array.isArray(e.orders) ? e.orders[0] : e.orders; return <tr key={e.paypal_event_id}>
              <td><strong>{e.paypal_event_id}</strong><small>{e.resource_id || "No resource ID"}</small></td><td>{e.event_type}</td>
              <td>{order?.id ? <Link href={`/admin/orders/${order.id}`}>{order.order_number} →</Link> : "—"}</td>
              <td><span className="admin-status">{e.processing_status}</span></td><td>{e.error_message || "—"}</td><td>{date(e.created_at)}</td><td>{date(e.processed_at)}</td>
            </tr>; })}
          </tbody></table></div>}
      </section>
      <p className="admin-help">This register does not submit evidence, issue refunds, or release fulfilment holds. Resolve a dispute in PayPal first; the verified PayPal resolution notification updates the record. Any payment hold remains until the separate reconciliation process is completed.</p>
    </section>
  </main>;
}
