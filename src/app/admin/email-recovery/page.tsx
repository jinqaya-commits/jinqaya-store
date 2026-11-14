import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import OrderEmailRecoveryButton from "./recovery-button";

export const dynamic = "force-dynamic";

export default async function AdminEmailRecoveryPage() {
  if (process.env.VERCEL_ENV !== "preview") redirect("/admin");
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) redirect("/login");
  const { data: allowed, error } = await supabase.rpc("can_manage_catalog");
  if (error || allowed !== true) redirect("/");

  return (
    <main className="admin-shell">
      <aside className="admin-sidebar">
        <Link href="/" className="admin-brand">JINQAYA<span>ADMIN</span></Link>
        <nav><Link href="/admin">Overview</Link><Link href="/admin/orders">Orders</Link><Link className="active" href="/admin/email-recovery">Email recovery</Link><Link href="/admin/products">Products</Link></nav>
        <p className="admin-sidebar-note">COMMERCE MANAGEMENT</p>
      </aside>
      <section className="admin-main">
        <header className="admin-topbar"><div><p className="admin-kicker">JINQAYA / PREVIEW</p><h1>Email recovery</h1></div><Link className="admin-back-link" href="/admin/orders">← ORDERS</Link></header>
        <OrderEmailRecoveryButton />
      </section>
    </main>
  );
}
