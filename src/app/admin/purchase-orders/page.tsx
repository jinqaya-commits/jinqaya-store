import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PurchaseOrderCreateForm } from "./purchase-order-create-form";
export const dynamic="force-dynamic";
export default async function PurchaseOrdersPage(){
 const supabase=await createClient();const {data:claims}=await supabase.auth.getClaims();if(!claims?.claims?.sub)redirect("/login");
 const {data:allowed,error:permissionError}=await supabase.rpc("can_manage_catalog");if(permissionError||allowed!==true)redirect("/");
 const [{data:orders,error},{data:variants}]=await Promise.all([
  supabase.from("purchase_orders").select("id,po_number,status,currency,subtotal,total_amount,created_at,submitted_at,expected_date,suppliers(company_name),purchase_order_items(quantity_ordered,quantity_received)").order("created_at",{ascending:false}).limit(200),
  supabase.from("product_variants").select("id,sku,variant_name,color,size,currency,products(name)").eq("is_active",true).order("sku")
 ]);
 const total=orders?.length??0;const open=orders?.filter(x=>["submitted","partially_received"].includes(x.status)).length??0;const received=orders?.filter(x=>x.status==="received").length??0;
 const choices=(variants??[]).map(v=>({id:v.id,sku:v.sku,name:(v.products as {name?:string}|null)?.name||v.variant_name||[v.color,v.size].filter(Boolean).join(" ")||"Variant",currency:v.currency?.trim()||"USD"}));
 return <main className="admin-shell"><aside className="admin-sidebar"><Link href="/" className="admin-brand">JINQAYA<span>ADMIN</span></Link><nav><Link href="/admin">Dashboard</Link><Link href="/admin/products">Products</Link><Link href="/admin/orders">Orders</Link><Link href="/admin/customers">Customers</Link><Link className="active" href="/admin/purchase-orders">Purchase orders</Link><Link href="/admin/inventory">Inventory</Link><Link href="/shop">View storefront ↗</Link></nav><p className="admin-sidebar-note">COMMERCE MANAGEMENT</p></aside><section className="admin-main">
 <header className="admin-topbar"><div><p className="admin-kicker">JINQAYA / PROCUREMENT</p><h1>Purchase orders</h1><p className="admin-help">Create supplier orders and receive stock into the China Fulfillment warehouse.</p></div><Link className="admin-back-link" href="/admin/inventory">← INVENTORY</Link></header>
 <div className="admin-summary"><div><span>ALL PURCHASE ORDERS</span><strong>{total}</strong></div><div><span>AWAITING / PARTIAL</span><strong>{open}</strong></div><div><span>FULLY RECEIVED</span><strong>{received}</strong></div></div>
 <PurchaseOrderCreateForm variants={choices}/>
 <section className="admin-panel" style={{marginTop:24}}><div className="admin-panel-heading"><div><p className="admin-kicker">SUPPLIER PROCUREMENT</p><h2>Purchase order register</h2></div><span>{total} ORDERS · MAX 200</span></div>
 {error?<p className="admin-error">{error.message}</p>:!orders?.length?<p className="admin-help">No purchase orders yet. Create a draft above when you have a real supplier order.</p>:<div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>PO NUMBER</th><th>SUPPLIER</th><th>LINES / UNITS</th><th>AMOUNT</th><th>STATUS</th><th>CREATED</th><th></th></tr></thead><tbody>{orders.map(o=>{const items=Array.isArray(o.purchase_order_items)?o.purchase_order_items:[];const supplier=Array.isArray(o.suppliers)?o.suppliers[0]:o.suppliers;return <tr key={o.id}><td><strong>{o.po_number}</strong></td><td>{supplier?.company_name||"—"}</td><td>{items.length} SKU(s)<small>{items.reduce((n,x)=>n+Number(x.quantity_received),0)} / {items.reduce((n,x)=>n+Number(x.quantity_ordered),0)} received</small></td><td>{new Intl.NumberFormat("en-US",{style:"currency",currency:o.currency.trim()||"USD"}).format(Number(o.total_amount))}</td><td><span className={"admin-status "+(o.status==="received"?"status-active":o.status==="cancelled"?"status-draft":"status-pending")}>{o.status.replaceAll("_"," ")}</span></td><td>{new Date(o.created_at).toLocaleDateString("en-US",{dateStyle:"medium"})}</td><td><Link className="admin-table-action" href={"/admin/purchase-orders/"+o.id}>Open →</Link></td></tr>})}</tbody></table></div>}
 </section>
 </section></main>;
}
