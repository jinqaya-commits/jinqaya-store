import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SupportInboxRefresh from "./inbox-refresh";

export const dynamic = "force-dynamic";
const statuses = [["all","All chats"],["open","Open"],["in_progress","In progress"],["waiting_customer","Waiting for customer"],["resolved","Resolved"],["closed","Closed"]] as const;
function dateTime(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}
export default async function AdminSupportPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) redirect("/login");
  const { data: allowed, error: permissionError } = await supabase.rpc("is_staff");
  if (permissionError || allowed !== true) redirect("/");
  const params = await searchParams;
  const selected = statuses.some(([value]) => value === params.status) ? params.status || "all" : "all";
  let query = supabase.from("support_tickets").select("id,ticket_number,subject,status,priority,customer_name,customer_email,source,page_url,created_at,last_message_at,unread_by_staff").order("last_message_at", { ascending: false, nullsFirst: false }).limit(200);
  if (selected !== "all") query = query.eq("status", selected as "open" | "in_progress" | "waiting_customer" | "resolved" | "closed");
  const [{ data: tickets, error }, { count: open }, { count: waiting }, { count: unread }] = await Promise.all([
    query,
    supabase.from("support_tickets").select("id", { count: "exact", head: true }).in("status", ["open", "in_progress"]),
    supabase.from("support_tickets").select("id", { count: "exact", head: true }).eq("status", "waiting_customer"),
    supabase.from("support_tickets").select("id", { count: "exact", head: true }).gt("unread_by_staff", 0),
  ]);
  const ids = (tickets || []).map((ticket) => ticket.id);
  const { data: lastMessages } = ids.length
    ? await supabase.from("support_messages").select("ticket_id,message,sender_type,created_at,is_internal").in("ticket_id", ids).order("created_at", { ascending: false })
    : { data: [] };
  const latest = new Map<string, { message: string; sender_type: string }>();
  for (const message of lastMessages || []) if (!latest.has(message.ticket_id) && !message.is_internal) latest.set(message.ticket_id, message);
  return (
    <main className="admin-shell">
      <aside className="admin-sidebar"><Link href="/" className="admin-brand">JINQAYA<span>ADMIN</span></Link><nav>
        <Link href="/admin">Overview</Link><Link href="/admin/products">Products</Link><Link href="/admin/orders">Orders</Link>
        <Link href="/admin/customers">Customers</Link><Link href="/admin/inquiries">Enquiries</Link><Link href="/admin/visitors">Visitors</Link>
        <Link className="active" href="/admin/support">Live chat</Link><Link href="/admin/follow-ups">Follow-ups</Link><Link href="/admin/inventory">Inventory</Link><Link href="/shop">View storefront ↗</Link>
      </nav><p className="admin-sidebar-note">CUSTOMER CARE</p></aside>
      <section className="admin-main">
        <header className="admin-topbar"><div><p className="admin-kicker">JINQAYA / CUSTOMER CARE</p><h1>Live chat</h1><p className="admin-help">Website conversations and visitor context.</p><SupportInboxRefresh /></div><Link className="admin-back-link" href="/admin">← OVERVIEW</Link></header>
        <div className="admin-summary">
          <div><span>OPEN / IN PROGRESS</span><strong>{open ?? 0}</strong><small>Needs staff attention</small></div>
          <div><span>WAITING FOR CUSTOMER</span><strong>{waiting ?? 0}</strong><small>Staff has replied</small></div>
          <div><span>UNREAD</span><strong>{unread ?? 0}</strong><small>New visitor messages</small></div>
          <div><span>IN THIS VIEW</span><strong>{tickets?.length ?? 0}</strong><small>Latest 200 chats</small></div>
        </div>
        <section className="admin-panel">
          <div className="admin-panel-heading"><div><p className="admin-kicker">CONVERSATION INBOX</p><h2>Website chats</h2></div><span>NEWEST ACTIVITY FIRST</span></div>
          <div className="admin-filter-row">{statuses.map(([value,label]) => <Link key={value} className={selected === value ? "is-selected" : ""} href={value === "all" ? "/admin/support" : "/admin/support?status=" + value}>{label}</Link>)}</div>
          {error ? <p className="admin-error">Unable to load chats: {error.message}</p> : !tickets?.length ? (
            <div className="admin-empty"><span>✳</span><h3>No chat conversations yet.</h3><p>Messages sent through the website chat widget will appear here.</p></div>
          ) : (
            <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>CONVERSATION</th><th>VISITOR</th><th>LAST MESSAGE</th><th>SOURCE</th><th>STATUS</th><th></th></tr></thead><tbody>{tickets.map((ticket) => {
              const last = latest.get(ticket.id);
              return <tr key={ticket.id}>
                <td><strong>{ticket.ticket_number}</strong><small>{ticket.subject}</small><small>{dateTime(ticket.last_message_at || ticket.created_at)}</small></td>
                <td><strong>{ticket.customer_name || "Anonymous visitor"}</strong><small>{ticket.customer_email || "No email provided"}</small></td>
                <td>{last ? <strong>{last.sender_type === "staff" ? "You: " : ""}{last.message.slice(0,110)}{last.message.length > 110 ? "…" : ""}</strong> : "—"}{ticket.unread_by_staff > 0 ? <small className="admin-status status-pending">{ticket.unread_by_staff} unread</small> : null}</td>
                <td>{ticket.source || "Unknown"}<small>{ticket.page_url || "—"}</small></td>
                <td><span className={"admin-status " + (ticket.status === "open" || ticket.status === "in_progress" ? "status-pending" : ticket.status === "waiting_customer" ? "status-active" : "status-draft")}>{ticket.status.replaceAll("_"," ")}</span></td>
                <td><Link className="admin-table-action" href={"/admin/support/" + ticket.id}>Open chat →</Link></td>
              </tr>;
            })}</tbody></table></div>
          )}
        </section>
      </section>
    </main>
  );
}
