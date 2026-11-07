"use client";

import { useState, useTransition, type FormEvent } from "react";
import { createPurchaseOrderAction } from "../orders/actions";
type Variant={id:string;sku:string;name:string;currency:string};
type Supplier={id:string;name:string;email:string|null;phone:string|null;currency:string};
export function PurchaseOrderCreateForm({variants,suppliers}:{variants:Variant[];suppliers:Supplier[]}){
 const [supplierId,setSupplierId]=useState("");const [supplier,setSupplier]=useState("");const [email,setEmail]=useState("");const [phone,setPhone]=useState("");const [saveSupplier,setSaveSupplier]=useState(true);const [currency,setCurrency]=useState("USD");const [reference,setReference]=useState("");const [expected,setExpected]=useState("");const [notes,setNotes]=useState("");
 const [lines,setLines]=useState([{variant_id:"",quantity:"1",unit_cost:""}]);const [error,setError]=useState("");const [busy,start]=useTransition();
 function updateLine(i:number,key:string,value:string){setLines(old=>old.map((line,index)=>index===i?{...line,[key]:value}:line));}
 function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();setError("");const selected=lines.filter(x=>x.variant_id);
  if((!supplierId&&!supplier.trim())||!selected.length){setError("Select or enter a supplier and add at least one SKU.");return;}
  if(new Set(selected.map(x=>x.variant_id)).size!==selected.length){setError("Each SKU can appear only once. Combine quantities on the same line.");return;}
  if(selected.some(x=>!x.unit_cost.trim())){setError("Enter the actual unit cost for every SKU. Do not leave unknown costs as zero.");return;}
  const fd=new FormData();fd.set("supplier_id",supplierId);fd.set("supplier_name",supplier);fd.set("supplier_email",email);fd.set("supplier_phone",phone);fd.set("save_supplier",saveSupplier?"on":"");fd.set("currency",currency);fd.set("supplier_reference",reference);fd.set("expected_date",expected);fd.set("notes",notes);
  fd.set("items",JSON.stringify(selected.map(x=>({variant_id:x.variant_id,quantity:Number(x.quantity),unit_cost:x.unit_cost}))));
  start(async()=>{const result=await createPurchaseOrderAction(fd);if(result.error){setError(result.error);return;}if(result.id)window.location.href="/admin/purchase-orders/"+result.id;});
 }
 return <form className="admin-panel purchase-order-form" onSubmit={submit}>
  <div className="admin-panel-heading"><div><p className="admin-kicker">NEW PROCUREMENT</p><h2>Create purchase order</h2></div><span>DRAFT</span></div>
  <div className="purchase-order-fields">
   <label>Choose existing supplier <span className="optional">OPTIONAL</span><select value={supplierId} onChange={e=>{const id=e.target.value;setSupplierId(id);const s=suppliers.find(x=>x.id===id);if(s){setSupplier(s.name);setEmail(s.email||"");setPhone(s.phone||"");setCurrency(s.currency||"USD");}}}><option value="">Enter a new / temporary supplier below</option>{suppliers.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
   {!supplierId&&<><label>Supplier / company name<input required maxLength={160} value={supplier} onChange={e=>setSupplier(e.target.value)} placeholder="Supplier name"/></label>
   <label>Supplier email <span className="optional">OPTIONAL</span><input type="email" maxLength={254} value={email} onChange={e=>setEmail(e.target.value)}/></label>
   <label>Supplier phone <span className="optional">OPTIONAL</span><input maxLength={60} value={phone} onChange={e=>setPhone(e.target.value)}/></label>
   <label className="purchase-save-supplier"><input type="checkbox" checked={saveSupplier} onChange={e=>setSaveSupplier(e.target.checked)}/> Save this supplier for future purchase orders</label></>}
   <label>PO currency<select value={currency} onChange={e=>setCurrency(e.target.value)}>{["USD","CNY","EUR","GBP","CAD","AUD"].map(c=><option key={c}>{c}</option>)}</select></label>
   <label>Supplier reference <span className="optional">OPTIONAL</span><input maxLength={160} value={reference} onChange={e=>setReference(e.target.value)} placeholder="Supplier quote / reference"/></label>
   <label>Expected delivery <span className="optional">OPTIONAL</span><input type="date" min={new Date().toISOString().slice(0,10)} value={expected} onChange={e=>setExpected(e.target.value)}/></label>
  </div>
  <div className="admin-panel-heading purchase-lines-heading"><div><p className="admin-kicker">ORDER LINES</p><h2>Products and quantities</h2></div><button type="button" className="admin-secondary-button" onClick={()=>setLines(old=>[...old,{variant_id:"",quantity:"1",unit_cost:""}])} disabled={lines.length>=100}>＋ Add line</button></div>
  {lines.map((line,index)=><div className="purchase-order-line" key={index}>
   <label>Product SKU<select required value={line.variant_id} onChange={e=>updateLine(index,"variant_id",e.target.value)}><option value="">Select SKU</option>{variants.map(v=><option key={v.id} value={v.id}>{v.sku} — {v.name}</option>)}</select></label>
   <label>Quantity<input required type="number" min="1" max="1000000" step="1" value={line.quantity} onChange={e=>updateLine(index,"quantity",e.target.value)}/></label>
   <label>Unit cost ({currency})<input required type="number" min="0" step="0.01" value={line.unit_cost} onChange={e=>updateLine(index,"unit_cost",e.target.value)}/></label>
   <button type="button" className="purchase-remove-line" onClick={()=>setLines(old=>old.filter((_,i)=>i!==index))} disabled={lines.length===1} aria-label={"Remove line "+(index+1)}>Remove</button>
  </div>)}
  <label>Internal notes <span className="optional">OPTIONAL</span><textarea maxLength={3000} rows={3} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Delivery arrangements or internal notes"/></label>
  {error&&<p className="admin-error">{error}</p>}
  <div className="purchase-form-actions"><button className="admin-primary-button" type="submit" disabled={busy}>{busy?"Saving…":"Save purchase order draft"}</button><p className="admin-help">Unit costs are required for accurate purchasing records. Saving a draft does not change inventory.</p></div>
 </form>;
}
