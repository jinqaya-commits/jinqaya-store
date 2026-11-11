import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SupportThread from "../support-thread";
import "./support-thread.css";

export const dynamic = "force-dynamic";
export default async function AdminSupportDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) redirect("/login");
  const { data: allowed, error: permissionError } = await supabase.rpc("is_staff");
  if (permissionError || allowed !== true) redirect("/");
  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) notFound();
  const { data: ticket, error } = await supabase.from("support_tickets")
    .select("id,ticket_number,subject,status,priority,customer_id,customer_name,customer_email,visitor_id,session_id,source,page_url,created_at,updated_at,last_message_at,unread_by_staff,unread_by_customer")
    .eq("id", id).maybeSingle();
  if (error) throw new Error("Unable to load chat conversation.");
  if (!ticket) notFound();
  const [{ data: messages, error: messagesError }, { data: visitor }] = await Promise.all([
    supabase.from("support_messages").select("id,sender_type,sender_user_id,message,is_internal,created_at").eq("ticket_id", id).order("created_at", { ascending: true }).limit(300),
    ticket.session_id ? supabase.from("visitor_sessions").select("ip_country,ip_region,ip_city,source,medium,campaign,landing_page,device_type,browser,operating_system,started_at,last_seen_at").eq("id", ticket.session_id).maybeSingle() : Promise.resolve({ data: null, error: null }),
  ]);
  if (messagesError) throw new Error("Unable to load chat messages.");
  return (
    <main className="admin-shell">
      <aside className="admin-sidebar"><Link href="/" className="admin-brand">JINQAYA<span>ADMIN</span></Link><nav>
        <Link href="/admin">Overview</Link><Link href="/admin/products">Products</Link><Link href="/admin/orders">Orders</Link>
        <Link href="/admin/customers">Customers</Link><Link href="/admin/inquiries">Enquiries</Link><Link href="/admin/visitors">Visitors</Link>
        <Link className="active" href="/admin/support">Live chat</Link><Link href="/admin/follow-ups">Follow-ups</Link><Link href="/admin/inventory">Inventory</Link>
      </nav><p className="admin-sidebar-note">CUSTOMER CARE</p></aside>
      <section className="admin-main">
        <header className="admin-topbar"><div><p className="admin-kicker">JINQAYA / CUSTOMER CARE</p><h1>{ticket.ticket_number}</h1><p className="admin-help">{ticket.subject}</p></div><Link className="admin-back-link" href="/admin/support">← ALL CHATS</Link></header>
        <SupportThread initialTicket={ticket} initialMessages={messages || []} initialVisitor={visitor || null} />
      </section>
    </main>
  );
}
