"use client";

import { useState, useTransition, type FormEvent } from "react";
import { createPurchaseOrderAction } from "../orders/actions";

type Variant = { id: string; sku: string; name: string; currency: string };
export function PurchaseOrderCreateForm({ variants }: { variants: Variant[] }) {
  const [supplier,setSupplier]=useState(""); const [email,setEmail]=useState(""); const [phone,setPhone]=useState(""); const [notes,setNotes]=useState("");
  const [lines,setLines]=useState([{variant_id:"",quantity:"1",unit_cost:"",currency:"USD"}]);
  const [error,setError]=useState(""); const [busy,start]=useTransition();
  function updateLine(index:number,key:string,value:string){setLines(old=>old.map((line,i)=>i===index?{...line,[key]:value}:line));}
  function changeVariant(index:number,id:string){const v=variants.find(x=>x.id===id);setLines(old=>old.map((line,i)=>i===index?{...line,variant_id:id,currency:v?.currency||"USD"}:line));}
  function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();setError("");
    const selected=lines.filter(x=>x.variant_id);
    if(!supplier.trim()||selected.length===0){setError("Enter a supplier and add at least one SKU.");return;}
    if(new Set(selected.map(x=>x.variant_id)).size!==selected.length){setError("Each SKU can appear only once. Combine quantities on the same line.");return;}
    const fd=new FormData();fd.set("supplier_name",supplier);fd.set("supplier_email",email);fd.set("supplier_phone",phone);fd.set("notes",notes);
    fd.set("items",JSON.stringify(selected.map(x=>({variant_id:x.variant_id,quantity:Number(x.quantity),unit_cost:x.unit_cost,currency:x.currency}))));
    start(async()=>{const result=await createPurchaseOrderAction(fd);if(result.error){setError(result.error);return;}if(result.id)window.location.href="/admin/purchase-orders/"+result.id;});
  }
  return <form className="admin-panel purchase-order-form" onSubmit={submit}>
    <div className="admin-panel-heading"><div><p className="admin-kicker">NEW PROCUREMENT</p><h2>Create purchase order</h2></div><span>DRAFT</span></div>
    <div className="purchase-order-fields">
      <label>Supplier name<input required maxLength={160} value={supplier} onChange={e=>setSupplier(e.target.value)} placeholder="Supplier or factory name"/></label>
      <label>Supplier email <span className="optional">OPTIONAL</span><input type="email" maxLength={254} value={email} onChange={e=>setEmail(e.target.value)} /></label>
      <label>Supplier phone <span className="optional">OPTIONAL</span><input maxLength={60} value={phone} onChange={e=>setPhone(e.target.value)} /></label>
    </div>
    <div className="admin-panel-heading purchase-lines-heading"><div><p className="admin-kicker">ORDER LINES</p><h2>Products and quantities</h2></div><button type="button" className="admin-secondary-button" onClick={()=>setLines(old=>[...old,{variant_id:"",quantity:"1",unit_cost:"",currency:"USD"}])} disabled={lines.length>=100}>＋ Add line</button></div>
    {lines.map((line,index)=><div className="purchase-order-line" key={index}>
      <label>Product SKU<select required value={line.variant_id} onChange={e=>changeVariant(index,e.target.value)}><option value="">Select SKU</option>{variants.map(v=><option key={v.id} value={v.id}>{v.sku} — {v.name}</option>)}</select></label>
      <label>Quantity<input required type="number" min="1" max="1000000" step="1" value={line.quantity} onChange={e=>updateLine(index,"quantity",e.target.value)}/></label>
      <label>Unit cost <span className="optional">OPTIONAL</span><input type="number" min="0" step="0.01" value={line.unit_cost} onChange={e=>updateLine(index,"unit_cost",e.target.value)}/></label>
      <label>Currency<select value={line.currency} onChange={e=>updateLine(index,"currency",e.target.value)}>{["USD","CNY","EUR","GBP","CAD","AUD"].map(c=><option key={c}>{c}</option>)}</select></label>
      <button type="button" className="purchase-remove-line" onClick={()=>setLines(old=>old.filter((_,i)=>i!==index))} disabled={lines.length===1} aria-label={"Remove line "+(index+1)}>Remove</button>
    </div>)}
    <label>Internal notes <span className="optional">OPTIONAL</span><textarea maxLength={3000} rows={3} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Expected delivery, supplier reference or internal notes"/></label>
    {error&&<p className="admin-error">{error}</p>}
    <div className="purchase-form-actions"><button className="admin-primary-button" type="submit" disabled={busy}>{busy?"Saving…":"Save purchase order draft"}</button><p className="admin-help">Saving a draft does not change inventory. Issue the order and record actual receipts separately.</p></div>
  </form>;
}
