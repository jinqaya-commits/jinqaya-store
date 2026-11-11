import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function cleanSearch(value: string) {
  return value.replace(/[^\w@+.\-\s]/g, "").trim().slice(0, 100);
}
function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date(value));
}
export default async function AdminCustomersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) redirect("/login");
  const { data: allowed, error: permissionError } = await supabase.rpc("can_manage_catalog");
  if (permissionError || allowed !== true) redirect("/");

  const params = await searchParams;
  const search = cleanSearch(params.q || "");
  let query = supabase.from("customers")
    .select("id,email,first_name,last_name,phone,accepts_marketing,tags,created_at,orders(count)")
    .order("created_at", { ascending: false }).limit(200);
  if (search) query = query.or(`email.ilike.%${search}%,first_name.ilike.%${search}%,last_name.ilike.%${search}%,phone.ilike.%${search}%`);
  const [{ data: customers, error }, { count: total }, { count: optedIn }] = await Promise.all([
    query,
    supabase.from("customers").select("id", { count: "exact", head: true }),
    supabase.from("customers").select("id", { count: "exact", head: true }).eq("accepts_marketing", true),
  ]);

  return <main className="admin-shell">
    <aside className="admin-sidebar"><Link href="/" className="admin-brand">JINQAYA<span>ADMIN</span></Link><nav><Link href="/admin/products">Products</Link><Link href="/admin/orders">Orders</Link><Link className="active" href="/admin/customers">Customers</Link><Link href="/admin/inquiries">Enquiries</Link><Link href="/admin/visitors">Visitors</Link><Link href="/admin/follow-ups">Follow-ups</Link><Link href="/admin/inventory">Inventory</Link><Link href="/shop">View storefront ↗</Link></nav><p className="admin-sidebar-note">COMMERCE MANAGEMENT</p></aside>
    <section className="admin-main">
      <header className="admin-topbar"><div><p className="admin-kicker">JINQAYA / RELATIONSHIPS</p><h1>Customers</h1></div><Link className="admin-back-link" href="/admin/orders">← ORDERS</Link></header>
      <div className="admin-summary"><div><span>ALL CUSTOMERS</span><strong>{total ?? 0}</strong></div><div><span>MARKETING OPT-IN</span><strong>{optedIn ?? 0}</strong></div><div><span>IN THIS VIEW</span><strong>{customers?.length ?? 0}</strong></div></div>
      <section className="admin-panel">
        <div className="admin-panel-heading"><div><p className="admin-kicker">CUSTOMER DIRECTORY</p><h2>Customer register</h2></div><span>MAX 200 SHOWN</span></div>
        <form className="admin-order-search" action="/admin/customers" method="get">
          <label>Search customers<input type="search" name="q" defaultValue={search} placeholder="Name, email or phone" /></label>
          <button type="submit">Search</button><Link href="/admin/customers">Clear</Link>
        </form>
        {error ? <p className="admin-error">Unable to load customers: {error.message}</p> : !customers?.length ? <div className="admin-empty"><span>✳</span><h3>No customers found.</h3><p>Customers are added when an order request is submitted.</p></div> : <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>CUSTOMER</th><th>CONTACT</th><th>ORDERS</th><th>TAGS</th><th>MARKETING</th><th>ADDED</th><th></th></tr></thead><tbody>{customers.map(customer => {
          const name = [customer.first_name, customer.last_name].filter(Boolean).join(" ") || "Customer";
          const orderCount = Array.isArray(customer.orders) ? Number(customer.orders[0]?.count || 0) : 0;
          return <tr key={customer.id}><td><strong>{name}</strong><small>{customer.email}</small></td><td>{customer.phone || "—"}</td><td><strong>{orderCount}</strong></td><td>{customer.tags?.length ? customer.tags.map((tag: string) => <span className="admin-crm-tag" key={tag}>{tag}</span>) : "—"}</td><td><span className={`admin-status ${customer.accepts_marketing ? "status-active" : "status-draft"}`}>{customer.accepts_marketing ? "Opted in" : "Not opted in"}</span></td><td>{formatDate(customer.created_at)}</td><td><Link className="admin-table-action" href={`/admin/customers/${customer.id}`}>View customer →</Link></td></tr>;
        })}</tbody></table></div>}
      </section>
      <p className="admin-help" style={{ marginTop: 16 }}>Marketing consent is shown as recorded. Customers are not automatically subscribed to marketing emails.</p>
    </section>
  </main>;
}
