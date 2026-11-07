import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
export const dynamic="force-dynamic";
export default async function AccountsPayablePage(){
 const supabase=await createClient();
 const {data:claims}=await supabase.auth.getClaims();
 if(!claims?.claims?.sub)redirect("/login");
 const {data:allowed,error:permissionError}=await supabase.rpc("can_manage_catalog");
 if(permissionError||allowed!==true)redirect("/");
 const {data:orders,error}=await supabase.from("purchase_orders")
  .select("id,po_number,status,currency,order_date,expected_date,total_amount,supplier_name_snapshot,suppliers(company_name),purchase_order_payments(amount)")
  .not("status","in",'("draft","cancelled")')
  .order("expected_date",{ascending:true,nullsFirst:false}).limit(1000);
 const rows=(orders||[]).map(o=>{
  const payments=Array.isArray(o.purchase_order_payments)?o.purchase_order_payments:[];
  const paid=payments.reduce((sum,p)=>sum+Number(p.amount),0);
  const balance=Math.max(0,Number(o.total_amount)-paid);
  const supplier=Array.isArray(o.suppliers)?o.suppliers[0]:o.suppliers;
  return {...o,paid,balance,supplierName:o.supplier_name_snapshot||supplier?.company_name||"—"};
 }).filter(o=>o.balance>0.009);
 const fmt=(n:number,c:string)=>new Intl.NumberFormat("en-US",{style:"currency",currency:c.trim()||"USD"}).format(n);
 const currencies=[...new Set(rows.map(r=>r.currency.trim()||"USD"))];
 const totals=currencies.map(currency=>({currency,amount:rows.filter(r=>r.currency.trim()===currency||(!r.currency.trim()&&currency==="USD")).reduce((s,r)=>s+r.balance,0)}));
 return <main className="admin-shell"><aside className="admin-sidebar"><Link href="/" className="admin-brand">JINQAYA<span>ADMIN</span></Link><nav><Link href="/admin">Dashboard</Link><Link href="/admin/products">Products</Link><Link href="/admin/orders">Orders</Link><Link className="active" href="/admin/purchase-orders">Purchase orders</Link><Link href="/admin/suppliers">Suppliers</Link><Link href="/admin/payables">Accounts payable</Link><Link href="/admin/inventory">Inventory</Link></nav><p className="admin-sidebar-note">COMMERCE MANAGEMENT</p></aside><section className="admin-main">
 <header className="admin-topbar"><div><p className="admin-kicker">JINQAYA / FINANCE</p><h1>Accounts payable</h1><p className="admin-help">Outstanding supplier balances based only on payments actually recorded.</p></div><Link className="admin-back-link" href="/admin/purchase-orders">← PURCHASE ORDERS</Link></header>
 {error?<section className="admin-panel"><p className="admin-error">{error.message}</p></section>:<>
 <div className="admin-summary"><div><span>OPEN PURCHASE ORDERS</span><strong>{rows.length}</strong></div><div><span>SUPPLIERS WITH BALANCES</span><strong>{new Set(rows.map(r=>r.supplierName)).size}</strong></div><div><span>UNPAID AMOUNTS</span><strong>{totals.length?totals.map(t=>fmt(t.amount,t.currency)).join(" · "):fmt(0,"USD")}</strong></div></div>
 <section className="admin-panel"><div className="admin-panel-heading"><div><p className="admin-kicker">SUPPLIER BALANCES</p><h2>Unpaid purchase orders</h2></div><span>{rows.length} OPEN</span></div>
 {!rows.length?<p className="admin-help">No outstanding supplier balances. Payments and purchase orders will appear here once recorded.</p>:<div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>PO NUMBER</th><th>SUPPLIER</th><th>STATUS</th><th>EXPECTED DATE</th><th>ORDER TOTAL</th><th>PAID</th><th>OUTSTANDING</th><th></th></tr></thead><tbody>{rows.map(o=><tr key={o.id}><td><strong>{o.po_number}</strong></td><td>{o.supplierName}</td><td>{o.status.replaceAll("_"," ")}</td><td>{o.expected_date||"—"}</td><td>{fmt(Number(o.total_amount),o.currency)}</td><td>{fmt(o.paid,o.currency)}</td><td><strong>{fmt(o.balance,o.currency)}</strong></td><td><Link className="admin-table-action" href={"/admin/purchase-orders/"+o.id}>Record / view →</Link></td></tr>)}</tbody></table></div>}
 <p className="admin-help" style={{marginTop:16}}>Balances are grouped by the purchase order currency. No exchange-rate conversion is applied. This page does not initiate bank transfers.</p>
 </section></>}
 </section></main>;
}
