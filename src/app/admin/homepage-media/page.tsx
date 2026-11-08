import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolveProductImageUrls } from "@/lib/product-images";
import { HomepageMediaManager } from "./homepage-media-manager";

export const dynamic = "force-dynamic";

type HomepageMediaRow = {
  media_key: "hero" | "lifestyle";
  image_path: string | null;
};

export default async function AdminHomepageMediaPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: allowed, error: permissionError } = await supabase.rpc("can_manage_catalog");
  if (permissionError || allowed !== true) redirect("/");

  const { data, error } = await supabase
    .from("homepage_media")
    .select("media_key,image_path");
  const rows: HomepageMediaRow[] = data ?? [];
  const imageByKey = new Map<string, string | null>(
    rows.map((row): [string, string | null] => [row.media_key, row.image_path]),
  );

  const slots = (["hero", "lifestyle"] as const).map((key) => {
    const path = imageByKey.get(key) ?? null;
    return {
      media_key: key,
      imageUrl: path ? resolveProductImageUrls(path).detailUrl : null,
      title: key === "hero" ? "Homepage hero image" : "Life with pets image",
      guidance: key === "hero"
        ? "Wide landscape crop; leave enough negative space for the headline."
        : "Warm, natural pet-at-home scene that supports the closing story.",
    };
  });

  return (
    <main className="admin-shell">
      <aside className="admin-sidebar">
        <Link href="/" className="admin-brand">JINQAYA<span>ADMIN</span></Link>
        <nav>
          <Link href="/admin/products">Products</Link>
          <Link href="/admin/categories">Collections</Link>
          <Link className="active" href="/admin/homepage-media">Homepage images</Link>
          <Link href="/admin/orders">Orders</Link>
          <Link href="/admin/inventory">Inventory</Link>
          <Link href="/shop">View storefront ↗</Link>
        </nav>
        <p className="admin-sidebar-note">STOREFRONT MANAGEMENT</p>
      </aside>
      <section className="admin-main">
        <header className="admin-topbar">
          <div>
            <p className="admin-kicker">JINQAYA / STOREFRONT</p>
            <h1>Homepage images</h1>
            <p className="admin-help">Manage the campaign and lifestyle photography shown on the homepage.</p>
          </div>
        </header>
        {error
          ? <p className="admin-error">Unable to load homepage images: {error.message}</p>
          : <HomepageMediaManager slots={slots} />}
      </section>
    </main>
  );
}
