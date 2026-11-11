import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function dateTime(value: string) {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function countryName(code: string | null) {
  if (!code) return "Unknown location";
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(code) || code;
  } catch {
    return code;
  }
}

export default async function AdminVisitorsPage() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) redirect("/login");
  const { data: allowed, error: permissionError } = await supabase.rpc("can_manage_catalog");
  if (permissionError || allowed !== true) redirect("/");

  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
  const [{ data: sessions, error }, { count: totalSessions }, { count: todaySessions }, { count: pageViews }] = await Promise.all([
    supabase.from("visitor_sessions")
      .select("id,visitor_id,started_at,last_seen_at,ip_country_code,ip_region,ip_city,source,medium,campaign,landing_page,referrer_url,device_type,browser,operating_system,visitor_page_views(page_path,viewed_at)")
      .order("last_seen_at", { ascending: false })
      .limit(100),
    supabase.from("visitor_sessions").select("id", { count: "exact", head: true }),
    supabase.from("visitor_sessions").select("id", { count: "exact", head: true }).gte("started_at", today),
    supabase.from("visitor_page_views").select("id", { count: "exact", head: true }),
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
          <Link className="active" href="/admin/visitors">Visitors</Link>
          <Link href="/admin/follow-ups">Follow-ups</Link>
          <Link href="/admin/after-sales">After-sales</Link>
          <Link href="/admin/inventory">Inventory</Link>
          <Link href="/shop">View storefront ↗</Link>
        </nav>
        <p className="admin-sidebar-note">CUSTOMER INSIGHTS</p>
      </aside>
      <section className="admin-main">
        <header className="admin-topbar">
          <div>
            <p className="admin-kicker">JINQAYA / CUSTOMER INSIGHTS</p>
            <h1>Website visitors</h1>
            <p className="admin-help">Visits recorded after a visitor allows optional analytics.</p>
          </div>
          <Link className="admin-back-link" href="/admin">← OVERVIEW</Link>
        </header>
        <div className="admin-summary">
          <div><span>RECORDED VISITS</span><strong>{totalSessions ?? 0}</strong><small>Analytics-consented sessions</small></div>
          <div><span>VISITS TODAY</span><strong>{todaySessions ?? 0}</strong><small>Based on UTC day boundary</small></div>
          <div><span>PAGE VIEWS</span><strong>{pageViews ?? 0}</strong><small>Pages recorded across sessions</small></div>
          <div><span>RECENT VISITORS</span><strong>{sessions?.length ?? 0}</strong><small>Latest 100 sessions</small></div>
        </div>
        <section className="admin-panel">
          <div className="admin-panel-heading">
            <div><p className="admin-kicker">VISITOR ACTIVITY</p><h2>Recent visits</h2></div>
            <span>NEWEST FIRST</span>
          </div>
          {error ? (
            <p className="admin-error">Unable to load visitor activity: {error.message}</p>
          ) : !sessions?.length ? (
            <div className="admin-empty">
              <span>✳</span>
              <h3>No visitor activity recorded yet.</h3>
              <p>Once a visitor accepts optional analytics and browses the storefront, their visit and page views will appear here. Visitors who decline analytics are not tracked.</p>
            </div>
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead><tr><th>VISITOR / TIME</th><th>LOCATION</th><th>SOURCE</th><th>DEVICE</th><th>LANDING PAGE</th><th>RECENT PAGES</th></tr></thead>
                <tbody>
                  {sessions.map((session) => {
                    const views = [...(session.visitor_page_views || [])].sort((a, b) => a.viewed_at.localeCompare(b.viewed_at));
                    const recentPages = views.slice(-4).reverse();
                    const location = [session.ip_city, session.ip_region, countryName(session.ip_country_code)].filter(Boolean).join(", ");
                    const source = [session.source || "Unknown", session.medium].filter(Boolean).join(" / ");
                    return (
                      <tr key={session.id}>
                        <td><strong>{session.visitor_id.slice(0, 8)}</strong><small>First seen {dateTime(session.started_at)}</small><small>Last seen {dateTime(session.last_seen_at)}</small></td>
                        <td>{location || "Unknown location"}</td>
                        <td><strong>{source}</strong>{session.campaign ? <small>{session.campaign}</small> : null}</td>
                        <td>{session.device_type || "Unknown"}<small>{[session.browser, session.operating_system].filter(Boolean).join(" · ")}</small></td>
                        <td><span className="admin-table-path">{session.landing_page || "—"}</span></td>
                        <td>{recentPages.length ? recentPages.map((view, index) => <small className="admin-table-path" key={view.viewed_at + view.page_path}>{view.page_path}</small>) : "—"}<small>{views.length} page views</small></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
        <p className="admin-help" style={{ marginTop: 16 }}>Location is estimated from hosting-provider region data and may be imprecise. Raw IP addresses are not stored by this analytics endpoint. Anonymous visits are not automatically identified by name or company.</p>
      </section>
    </main>
  );
}
