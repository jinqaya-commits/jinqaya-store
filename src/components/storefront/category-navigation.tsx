import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

type CategoryRow = { id:string; parent_id:string|null; name:string; slug:string; sort_order:number; is_active:boolean };

export async function CategoryNavigation() {
  const supabase = await createClient();
  const { data } = await supabase.from("categories")
    .select("id,parent_id,name,slug,sort_order,is_active")
    .eq("is_active", true).order("sort_order", { ascending:true });
  const rows = (data ?? []) as CategoryRow[];
  const roots = rows.filter(row => row.parent_id === null);
  return <nav className="jq-nav jq-category-nav" aria-label="Shop categories">
    <Link href="/shop">SHOP ALL</Link>
    {roots.map(root => {
      const children = rows.filter(row => row.parent_id === root.id);
      return <details className="jq-nav-category" key={root.id}>
        <summary>{root.name}</summary>
        <div className="jq-nav-dropdown">
          <Link className="jq-nav-all" href={`/collections/${root.slug}`}>Shop all {root.name.toLowerCase()} ↗</Link>
          {children.map(child => <div className="jq-nav-group" key={child.id}>
            <Link href={`/collections/${child.slug}`}>{child.name}</Link>
            <div>{rows.filter(row => row.parent_id === child.id).map(leaf =>
              <Link key={leaf.id} href={`/collections/${leaf.slug}`}>{leaf.name}</Link>
            )}</div>
          </div>)}
        </div>
      </details>;
    })}
    <Link href="/#point-of-view">OUR STORY</Link>
  </nav>;
}
