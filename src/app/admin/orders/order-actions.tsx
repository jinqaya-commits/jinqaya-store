"use client";
import { useState, useTransition, type FormEvent } from "react";
import { processOrderAction } from "./actions";

type Props={orderId:string;status:string;shippingAmount:number|string|null;shippingMethod:string|null};
export function OrderActions({orderId,status,shippingAmount,shippingMethod}:Props){
 const [busy,start]=useTransition();const [error,setError]=useState("");const [success,setSuccess]=useState("");
 const [amount,setAmount]=useState(shippingAmount==null?"":String(shippingAmount));const [method,setMethod]=useState(shippingMethod||"");const [carrier,setCarrier]=useState("");const [tracking,setTracking]=useState("");const [url,setUrl]=useState("");const [note,setNote]=useState("");
 function run(action:string,formData:FormData){setError("");setSuccess("");start(async()=>{const r=await processOrderAction(orderId,action,formData);if(r.error){setError(r.error);return;}setSuccess("Order updated.");});}
 function submit(action:string,e:FormEvent<HTMLFormElement>){e.preventDefault();if(action==="cancel"&&!window.confirm("Cancel this unpaid order and release any reserved stock?"))return;run(action,new FormData(e.currentTarget));}
 return <section className="admin-panel order-actions-panel"><div className="admin-panel-heading"><div><p className="admin-kicker">ORDER WORKFLOW</p><h2>Next action</h2></div><span>{status.replaceAll("_"," ").toUpperCase()}</span></div>
 <form className="order-action-form" onSubmit={e=>submit(status==="on_hold"?"confirm_quote":status==="pending_payment"?"confirm_payment":status==="paid"?"start_processing":status==="processing"?"ship":status==="shipped"?"delivered":"save_note",e)}>
 {status==="on_hold"&&<><div className="admin-form-grid"><label>Shipping amount (USD)<input name="shipping_amount" type="number" min="0" step="0.01" required value={amount} onChange={e=>setAmount(e.target.value)}/></label><label>Shipping method<input name="shipping_method" required maxLength={100} placeholder="e.g. Express / Air / Sea" value={method} onChange={e=>setMethod(e.target.value)}/></label></div><p className="admin-help">Confirming the quote reserves available stock for 48 hours and moves the order to Awaiting payment. No payment is collected here.</p></>}
 {status==="pending_payment"&&<p className="admin-help">Only click after checking your bank/payment provider and confirming that the full amount has arrived. This action deducts the reserved stock.</p>}
 {status==="processing"&&<div className="admin-form-grid"><label>Carrier<input name="carrier_name" required maxLength={100} value={carrier} onChange={e=>setCarrier(e.target.value)} placeholder="Carrier name"/></label><label>Tracking number<input name="tracking_number" required maxLength={150} value={tracking} onChange={e=>setTracking(e.target.value)} placeholder="Tracking number"/></label><label className="full">Tracking URL <span className="optional">OPTIONAL</span><input name="tracking_url" type="url" value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://"/></label></div>}
 <label className="order-note-label">Internal note<textarea name="note" rows={3} maxLength={2000} value={note} onChange={e=>setNote(e.target.value)} placeholder="Visible to staff only"/></label>
 <div className="order-action-buttons">
 {status==="on_hold"&&<button className="admin-primary-button" disabled={busy} type="submit">Confirm shipping quote & reserve stock</button>}
 {status==="pending_payment"&&<button className="admin-primary-button" disabled={busy} type="submit">Confirm payment received</button>}
 {status==="paid"&&<button className="admin-primary-button" disabled={busy} type="submit">Start processing</button>}
 {status==="processing"&&<button className="admin-primary-button" disabled={busy} type="submit">Mark shipped & add tracking</button>}
 {status==="shipped"&&<button className="admin-primary-button" disabled={busy} type="submit">Mark delivered</button>}
 {["on_hold","pending_payment"].includes(status)&&<button className="admin-danger-button" disabled={busy} type="button" onClick={()=>{if(!window.confirm("Cancel this unpaid order and release any reserved stock?"))return;const fd=new FormData();fd.set("note",note);run("cancel",fd);}}>Cancel order</button>}
 <button className="admin-secondary-button" disabled={busy} type="button" onClick={()=>{const fd=new FormData();fd.set("note",note);run("save_note",fd);}}>Save internal note</button>
 </div>{busy&&<p className="admin-help">Saving order changes…</p>}{error&&<p className="admin-error" role="alert">{error}</p>}{success&&<p className="admin-success" role="status">{success} Refreshing this page will show the updated status.</p>}
 </form></section>;
}
