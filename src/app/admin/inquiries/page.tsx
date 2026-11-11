import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function dateTime(value: string) {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(new Date(value)) + " UTC";
}

const statusLabel: Record<string, string> = {
  new: "New",
  contacted: "Contacted",
  qualified: "Qualified",
  converted: "Converted",
  closed: "Closed",
  spam: "Spam",
};

export default async function AdminInquiriesPage() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) redirect("/login");
  const { data: allowed, error: permissionError } = await supabase.rpc("can_manage_catalog");
  if (permissionError || allowed !== true) redirect("/");

  const [{ data: inquiries, error }, { count: total }, { count: newCount }] = await Promise.all([
    supabase.from("lead_inquiries")
      .select("id,inquiry_number,customer_id,product_id,full_name,email,phone,subject,message,status,source,medium,campaign,submitted_at,products(name)")
      .order("submitted_at", { ascending: false })
      .limit(200),
    supabase.from("lead_inquiries").select("id", { count: "exact", head: true }),
    supabase.from("lead_inquiries").select("id", { count: "exact", head: true }).eq("status", "new"),
  ]);

  return (
    <main className="admin-shell">
      <aside className="admin-sidebar">
        <Link href="/" className="admin-brand">JINQAYA<span>ADMIN</span></Link>
        <nav>
          <Link href="/admin">Overview</Link>
          <Link href="/admin/products">Products</Link>
          <Link href="/admin/orders">Orders</Link>
          <Link href="/admin/customers">Customers</Link>
          <Link className="active" href="/admin/inquiries">Enquiries</Link>
          <Link href="/admin/visitors">Visitors</Link>
          <Link href="/admin/follow-ups">Follow-ups</Link>
          <Link href="/admin/after-sales">After-sales</Link>
          <Link href="/admin/inventory">Inventory</Link>
          <Link href="/shop">View storefront ↗</Link>
        </nav>
        <p className="admin-sidebar-note">CUSTOMER RELATIONSHIPS</p>
      </aside>
      <section className="admin-main">
        <header className="admin-topbar">
          <div>
            <p className="admin-kicker">JINQAYA / CUSTOMER RELATIONSHIPS</p>
            <h1>Website enquiries</h1>
            <p className="admin-help">Messages submitted through the Contact page and product enquiry links.</p>
          </div>
          <Link className="admin-back-link" href="/admin">← OVERVIEW</Link>
        </header>
        <div className="admin-summary">
          <div><span>ALL ENQUIRIES</span><strong>{total ?? 0}</strong><small>All recorded submissions</small></div>
          <div><span>NEW</span><strong>{newCount ?? 0}</strong><small>Awaiting first response</small></div>
          <div><span>IN THIS VIEW</span><strong>{inquiries?.length ?? 0}</strong><small>Latest 200 submissions</small></div>
          <div><span>CONTACT EMAIL</span><strong style={{ fontSize: 17 }}>info@jinqaya.com</strong><small>Customer reply address</small></div>
        </div>
        <section className="admin-panel">
          <div className="admin-panel-heading">
            <div><p className="admin-kicker">INCOMING MESSAGES</p><h2>Enquiry inbox</h2></div>
            <span>NEWEST FIRST</span>
          </div>
          {error ? (
            <p className="admin-error">Unable to load enquiries: {error.message}</p>
          ) : !inquiries?.length ? (
            <div className="admin-empty">
              <span>✳</span>
              <h3>No enquiries yet.</h3>
              <p>Customer messages submitted through the website will appear here.</p>
            </div>
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead><tr><th>REFERENCE / DATE</th><th>CUSTOMER</th><th>SUBJECT / MESSAGE</th><th>PRODUCT</th><th>SOURCE</th><th>STATUS</th></tr></thead>
                <tbody>
                  {inquiries.map((inquiry) => {
                    const product = Array.isArray(inquiry.products) ? inquiry.products[0] : inquiry.products;
                    const name = inquiry.full_name || "Customer";
                    return (
                      <tr key={inquiry.id}>
                        <td><strong>{inquiry.inquiry_number}</strong><small>{dateTime(inquiry.submitted_at)}</small></td>
                        <td><strong>{name}</strong><small><a href={"mailto:" + inquiry.email}>{inquiry.email}</a></small>{inquiry.phone ? <small>{inquiry.phone}</small> : null}{inquiry.customer_id ? <small><Link href={"/admin/customers/" + inquiry.customer_id}>Open customer →</Link></small> : null}</td>
                        <td><strong>{inquiry.subject || "Website enquiry"}</strong><small className="admin-inquiry-message">{inquiry.message}</small></td>
                        <td>{product?.name || "General enquiry"}</td>
                        <td><strong>{inquiry.source || "Unknown"}</strong><small>{[inquiry.medium, inquiry.campaign].filter(Boolean).join(" · ")}</small></td>
                        <td><span className={"admin-status " + (inquiry.status === "new" ? "status-pending" : inquiry.status === "spam" ? "status-draft" : "status-active")}>{statusLabel[inquiry.status] || inquiry.status}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
        <p className="admin-help" style={{ marginTop: 16 }}>Submitting an enquiry creates or links a customer record. Marketing consent remains off unless the customer separately opts in.</p>
      </section>
    </main>
  );
}
