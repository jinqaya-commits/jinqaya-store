import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type FollowUpRow = {
  id: string;
  customer_id: string;
  title: string;
  notes: string | null;
  due_at: string;
  status: "pending" | "completed" | "cancelled";
  completed_at: string | null;
  customers: { id: string; email: string; first_name: string | null; last_name: string | null; phone: string | null } | null;
};

function dateTime(value: string) {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}
function customerName(customer: FollowUpRow["customers"]) {
  return customer ? [customer.first_name, customer.last_name].filter(Boolean).join(" ") || "Customer" : "Customer";
}
function FollowUpGroup({ title, items, empty }: { title: string; items: FollowUpRow[]; empty: string }) {
  return <section className="admin-panel admin-followup-dashboard-group">
    <div className="admin-panel-heading"><div><p className="admin-kicker">CUSTOMER RELATIONSHIP</p><h2>{title}</h2></div><span>{items.length} TASKS</span></div>
    {!items.length ? <div className="admin-empty"><p>{empty}</p></div> : <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>FOLLOW-UP</th><th>CUSTOMER</th><th>CONTACT</th><th>DUE</th><th></th></tr></thead><tbody>
      {items.map(item => <tr key={item.id}>
        <td><strong>{item.title}</strong>{item.notes && <small className="admin-followup-dashboard-note">{item.notes}</small>}</td>
        <td><strong>{customerName(item.customers)}</strong></td>
        <td><a href={item.customers?.email ? `mailto:${item.customers.email}` : undefined}>{item.customers?.email || "—"}</a>{item.customers?.phone && <small>{item.customers.phone}</small>}</td>
        <td>{dateTime(item.due_at)}</td>
        <td><Link className="admin-table-action" href={`/admin/customers/${item.customer_id}`}>Open customer →</Link></td>
      </tr>)}
    </tbody></table></div>}
  </section>;
}

export default async function AdminFollowUpsPage() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) redirect("/login");
  const { data: allowed, error: permissionError } = await supabase.rpc("can_manage_catalog");
  if (permissionError || allowed !== true) redirect("/");

  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startTomorrow = new Date(startToday.getTime() + 24 * 60 * 60 * 1000);
  const nextWeek = new Date(startToday.getTime() + 7 * 24 * 60 * 60 * 1000);
  const [{ data: pending, error: pendingError }, { data: completed, error: completedError }] = await Promise.all([
    supabase.from("customer_follow_ups")
      .select("id,customer_id,title,notes,due_at,status,completed_at,customers(id,email,first_name,last_name,phone)")
      .eq("status", "pending").order("due_at", { ascending: true }).limit(500),
    supabase.from("customer_follow_ups")
      .select("id,customer_id,title,notes,due_at,status,completed_at,customers(id,email,first_name,last_name,phone)")
      .eq("status", "completed").order("completed_at", { ascending: false }).limit(50),
  ]);
  if (pendingError || completedError) throw new Error("Unable to load customer follow-ups.");

  const pendingItems = (pending || []) as unknown as FollowUpRow[];
  const completedItems = (completed || []) as unknown as FollowUpRow[];
  const overdue = pendingItems.filter(item => new Date(item.due_at) < startToday);
  const dueToday = pendingItems.filter(item => new Date(item.due_at) >= startToday && new Date(item.due_at) < startTomorrow);
  const upcoming = pendingItems.filter(item => new Date(item.due_at) >= startTomorrow && new Date(item.due_at) < nextWeek);
  const unscheduledLater = pendingItems.filter(item => new Date(item.due_at) >= nextWeek);

  return <main className="admin-shell">
    <aside className="admin-sidebar"><Link href="/" className="admin-brand">JINQAYA<span>ADMIN</span></Link><nav><Link href="/admin/products">Products</Link><Link href="/admin/orders">Orders</Link><Link className="active" href="/admin/customers">Customers</Link><Link className="active" href="/admin/follow-ups">Follow-ups</Link><Link href="/admin/inventory">Inventory</Link><Link href="/shop">View storefront ↗</Link></nav><p className="admin-sidebar-note">COMMERCE MANAGEMENT</p></aside>
    <section className="admin-main">
      <header className="admin-topbar"><div><p className="admin-kicker">JINQAYA / RELATIONSHIPS</p><h1>Customer follow-ups</h1></div><Link className="admin-back-link" href="/admin/customers">← CUSTOMERS</Link></header>
      <div className="admin-summary">
        <div><span>OVERDUE</span><strong>{overdue.length}</strong></div>
        <div><span>DUE TODAY</span><strong>{dueToday.length}</strong></div>
        <div><span>NEXT 7 DAYS</span><strong>{upcoming.length}</strong></div>
        <div><span>OPEN TASKS</span><strong>{pendingItems.length}</strong></div>
      </div>
      <FollowUpGroup title="Overdue" items={overdue} empty="No overdue follow-ups. Nice work." />
      <FollowUpGroup title="Due today" items={dueToday} empty="No follow-ups due today." />
      <FollowUpGroup title="Coming up · Next 7 days" items={upcoming} empty="No upcoming follow-ups in the next seven days." />
      {unscheduledLater.length > 0 && <FollowUpGroup title="Later" items={unscheduledLater} empty="" />}
      <FollowUpGroup title="Recently completed" items={completedItems} empty="Completed follow-ups will appear here." />
      <p className="admin-help" style={{marginTop:16}}>Dates are grouped using the server&apos;s local calendar day. Up to 500 open and 50 recently completed follow-ups are shown.</p>
    </section>
  </main>;
}
