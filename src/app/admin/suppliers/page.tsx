import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { saveSupplierAction, setSupplierActiveAction } from "./actions";
export const dynamic = "force-dynamic";

type SearchParams = Promise<{ q?: string; status?: string }>;

export default async function AdminSuppliersPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  async function saveSupplierFormAction(formData: FormData): Promise<void> {
    "use server";
    const result = await saveSupplierAction(formData);
    if (result.error) throw new Error(result.error);
    redirect("/admin/suppliers?saved=1");
  }
  async function setSupplierActiveFormAction(formData: FormData): Promise<void> {
    "use server";
    const result = await setSupplierActiveAction(formData);
    if (result.error) throw new Error(result.error);
    redirect("/admin/suppliers?updated=1");
  }

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) redirect("/login");
  const { data: allowed, error: permissionError } = await supabase.rpc("can_manage_catalog");
  if (permissionError || allowed !== true) redirect("/");

  const status = params.status === "inactive" ? false : params.status === "all" ? null : true;
  let query = supabase.from("suppliers").select("id,supplier_code,company_name,contact_name,email,phone,website,country,city,address,postal_code,payment_terms,currency,notes,is_active,created_at,updated_at").order("company_name");
  if (status !== null) query = query.eq("is_active", status);
  const term = (params.q || "").trim();
  if (term) query = query.or(`company_name.ilike.%${term.replace(/[,%()]/g, " ")}%,email.ilike.%${term.replace(/[,%()]/g, " ")}%,contact_name.ilike.%${term.replace(/[,%()]/g, " ")}%`);
  const { data: suppliers, error } = await query.limit(300);
  const currencies = ["USD","CNY","EUR","GBP","CAD","AUD"];
  return <main className="admin-shell">
    <aside className="admin-sidebar"><Link href="/" className="admin-brand">JINQAYA<span>ADMIN</span></Link><nav>
      <Link href="/admin">Dashboard</Link><Link href="/admin/products">Products</Link><Link href="/admin/orders">Orders</Link><Link href="/admin/customers">Customers</Link><Link href="/admin/purchase-orders">Purchase orders</Link><Link className="active" href="/admin/suppliers">Suppliers</Link><Link href="/admin/inventory">Inventory</Link><Link href="/shop">View storefront ↗</Link>
    </nav><p className="admin-sidebar-note">COMMERCE MANAGEMENT</p></aside>
    <section className="admin-main">
      <header className="admin-topbar"><div><p className="admin-kicker">JINQAYA / PROCUREMENT</p><h1>Suppliers</h1><p className="admin-help">Manage supplier contacts and purchasing terms. Inactive suppliers remain on historical purchase orders.</p></div><Link className="admin-back-link" href="/admin/purchase-orders">← PURCHASE ORDERS</Link></header>
      <div className="admin-summary"><div><span>SHOWING SUPPLIERS</span><strong>{suppliers?.length ?? 0}</strong></div><div><span>VIEW</span><strong>{params.status === "inactive" ? "INACTIVE" : params.status === "all" ? "ALL" : "ACTIVE"}</strong></div></div>
      <section className="admin-panel supplier-panel"><div className="admin-panel-heading"><div><p className="admin-kicker">SUPPLIER DIRECTORY</p><h2>Add a supplier</h2></div><span>OPTIONAL DETAILS</span></div>
        <form action={saveSupplierFormAction} className="supplier-form">
          <input type="hidden" name="id" value="" />
          <label>Company / supplier name *<input name="company_name" required minLength={2} maxLength={160} /></label>
          <label>Contact person<input name="contact_name" maxLength={160} /></label>
          <label>Email<input name="email" type="email" maxLength={254} /></label>
          <label>Phone<input name="phone" maxLength={60} /></label>
          <label>Website<input name="website" type="url" placeholder="https://" maxLength={300} /></label>
          <label>Currency<select name="currency" defaultValue="USD">{currencies.map(c=><option key={c}>{c}</option>)}</select></label>
          <label>Country<input name="country" maxLength={100} /></label>
          <label>City<input name="city" maxLength={100} /></label>
          <label>Postal code<input name="postal_code" maxLength={30} /></label>
          <label className="supplier-wide">Address<input name="address" maxLength={500} /></label>
          <label>Payment terms<input name="payment_terms" maxLength={160} placeholder="e.g. 30% deposit, balance before shipment" /></label>
          <label className="supplier-wide">Internal notes<textarea name="notes" rows={3} maxLength={3000} /></label>
          <div className="supplier-form-actions"><button type="submit">Add supplier</button><span className="admin-help">Only the supplier name is required. You can also save suppliers directly from purchase order creation.</span></div>
        </form>
      </section>
      <section className="admin-panel supplier-panel"><div className="admin-panel-heading"><div><p className="admin-kicker">SUPPLIER RECORDS</p><h2>Supplier directory</h2></div><span>{suppliers?.length ?? 0} RECORDS</span></div>
        <form className="supplier-filters" method="get"><input name="q" defaultValue={term} placeholder="Search name, email or contact" /><select name="status" defaultValue={params.status || "active"}><option value="active">Active</option><option value="inactive">Inactive</option><option value="all">All suppliers</option></select><button type="submit">Search</button></form>
        {error ? <p className="admin-error">{error.message}</p> : !suppliers?.length ? <p className="admin-help">No suppliers found in this view. You can add one above or save one while creating a purchase order.</p> :
        <div className="supplier-list">{suppliers.map(s=><details className="supplier-record" key={s.id}>
          <summary><span><strong>{s.company_name}</strong><small>{[s.contact_name,s.email,s.phone].filter(Boolean).join(" · ") || "No contact details"}</small></span><span className={"admin-status "+(s.is_active?"status-active":"status-draft")}>{s.is_active?"ACTIVE":"INACTIVE"}</span></summary>
          <form action={saveSupplierAction} className="supplier-form supplier-edit-form">
            <input type="hidden" name="id" value={s.id} />
            <label>Company / supplier name *<input name="company_name" required minLength={2} maxLength={160} defaultValue={s.company_name} /></label>
            <label>Contact person<input name="contact_name" maxLength={160} defaultValue={s.contact_name||""} /></label>
            <label>Email<input name="email" type="email" maxLength={254} defaultValue={s.email||""} /></label>
            <label>Phone<input name="phone" maxLength={60} defaultValue={s.phone||""} /></label>
            <label>Website<input name="website" type="url" maxLength={300} defaultValue={s.website||""} /></label>
            <label>Currency<select name="currency" defaultValue={s.currency.trim()||"USD"}>{currencies.map(c=><option key={c}>{c}</option>)}{!currencies.includes(s.currency.trim())&&<option>{s.currency.trim()}</option>}</select></label>
            <label>Country<input name="country" maxLength={100} defaultValue={s.country||""} /></label>
            <label>City<input name="city" maxLength={100} defaultValue={s.city||""} /></label>
            <label>Postal code<input name="postal_code" maxLength={30} defaultValue={s.postal_code||""} /></label>
            <label className="supplier-wide">Address<input name="address" maxLength={500} defaultValue={s.address||""} /></label>
            <label>Payment terms<input name="payment_terms" maxLength={160} defaultValue={s.payment_terms||""} /></label>
            <label className="supplier-wide">Internal notes<textarea name="notes" rows={3} maxLength={3000} defaultValue={s.notes||""} /></label>
            <div className="supplier-form-actions"><button type="submit">Save changes</button><span className="admin-help">Updated {new Date(s.updated_at).toLocaleDateString("en-US",{dateStyle:"medium"})}</span></div>
          </form>
          <form action={setSupplierActiveFormAction} className="supplier-status-form"><input type="hidden" name="id" value={s.id}/><input type="hidden" name="active" value={s.is_active?"false":"true"}/><button type="submit" className="supplier-secondary-button">{s.is_active?"Deactivate supplier":"Reactivate supplier"}</button><small>{s.is_active?"New purchase orders can select this supplier.":"This supplier is hidden from new purchase order selection. Historical orders are unchanged."}</small></form>
        </details>)}</div>}
      </section>
    </section>
  </main>;
}
