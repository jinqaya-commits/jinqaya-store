"use client";
import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { processOrderAction, resolvePaidOrderStockReviewAction } from "./actions";

type Props={orderId:string;status:string;shippingMethod:string|null;subtotal:number|string|null;hasValidStockReservation:boolean;paymentProvider:string|null;stockReviewRequired:boolean};
export function OrderActions({orderId,status,shippingMethod,subtotal,hasValidStockReservation,paymentProvider,stockReviewRequired}:Props){
 const router=useRouter();
 const [busy,start]=useTransition();const [error,setError]=useState("");const [success,setSuccess]=useState("");
 const [method,setMethod]=useState(shippingMethod||"");const [carrier,setCarrier]=useState("");const [tracking,setTracking]=useState("");const [url,setUrl]=useState("");const [note,setNote]=useState("");
 function run(action:string,formData:FormData){setError("");setSuccess("");start(async()=>{const r=await processOrderAction(orderId,action,formData);if(r.error){setError(r.error);return;}setSuccess("Order updated.");router.refresh();});}
 function resolveStockReview(){if(!window.confirm("Confirm that you have checked the inventory and that every ordered item is now available in the reserved stock?"))return;setError("");setSuccess("");start(async()=>{const r=await resolvePaidOrderStockReviewAction(orderId,note);if(r.error){setError(r.error);return;}setSuccess("Stock review completed. The order can now enter processing.");router.refresh();});}
 function submit(action:string,e:FormEvent<HTMLFormElement>){e.preventDefault();if(action==="cancel"&&!window.confirm("Cancel this unpaid order and release any reserved stock?"))return;run(action,new FormData(e.currentTarget));}
 return <section className="admin-panel order-actions-panel"><div className="admin-panel-heading"><div><p className="admin-kicker">ORDER WORKFLOW</p><h2>Next action</h2></div><span>{status.replaceAll("_"," ").toUpperCase()}</span></div>
 <form className="order-action-form" onSubmit={e=>submit(status==="on_hold"?"confirm_quote":status==="pending_payment"?"confirm_payment":status==="paid"?"start_processing":status==="processing"?"ship":status==="shipped"?"delivered":"save_note",e)}>
 {status==="on_hold"&&<><div className="admin-form-grid"><div><span className="admin-field-label">Shipping (50% of subtotal)</span><strong>{new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(Number(subtotal||0)*0.5)}</strong></div><label>Shipping method <span className="optional">OPTIONAL</span><input name="shipping_method" maxLength={100} placeholder="e.g. Standard / Express / Air / Sea" value={method} onChange={e=>setMethod(e.target.value)}/></label></div><p className="admin-help">The shipping amount is fixed at 50% of the merchandise subtotal. Confirming reserves available stock for 48 hours and opens PayPal payment. No payment is collected here.</p></> }
 {status==="pending_payment"&&<p className="admin-help">Only click after checking your bank/payment provider and confirming that the full amount has arrived. This action deducts the reserved stock.</p>}
 {status==="processing"&&<div className="admin-form-grid"><label>Carrier<input name="carrier_name" required maxLength={100} value={carrier} onChange={e=>setCarrier(e.target.value)} placeholder="Carrier name"/></label><label>Tracking number<input name="tracking_number" required maxLength={150} value={tracking} onChange={e=>setTracking(e.target.value)} placeholder="Tracking number"/></label><label className="full">Tracking URL <span className="optional">OPTIONAL</span><input name="tracking_url" type="url" value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://"/></label></div>}
 <label className="order-note-label">Internal note<textarea name="note" rows={3} maxLength={2000} value={note} onChange={e=>setNote(e.target.value)} placeholder="Visible to staff only"/></label>
 <div className="order-action-buttons">
 {status==="on_hold"&&<button className="admin-primary-button" disabled={busy} type="submit">Confirm 50% shipping & reserve stock</button>}
 {status==="pending_payment"&&!hasValidStockReservation&&<><p className="admin-help">The stock hold is missing or expired. Refresh inventory availability before accepting payment.</p><button className="admin-secondary-button" disabled={busy} type="button" onClick={()=>{const fd=new FormData();run("reconfirm_stock",fd);}}>Recheck stock & reserve for 48 hours</button></>}
 {status==="pending_payment"&&paymentProvider!=="paypal"&&<button className="admin-primary-button" disabled={busy} type="submit">Confirm offline payment received</button>}
 {status==="pending_payment"&&paymentProvider==="paypal"&&<p className="admin-help">PayPal payment is recorded automatically after PayPal confirms the capture. Do not manually confirm this payment.</p>}
 {status==="paid"&&stockReviewRequired&&<><div className="admin-warning-panel" role="alert"><strong>Inventory review required</strong><p>PayPal confirmed this payment, but the stock reservation could not be safely committed. Check the ordered quantities, receive or adjust stock if necessary, and make sure active reservations exactly match every order item before continuing.</p></div><button className="admin-primary-button" disabled={busy} type="button" onClick={resolveStockReview}>Verify inventory & complete review</button></>}
 {status==="paid"&&!stockReviewRequired&&<button className="admin-primary-button" disabled={busy} type="submit">Start processing</button>}
 {status==="processing"&&<button className="admin-primary-button" disabled={busy} type="submit">Mark shipped & add tracking</button>}
 {status==="shipped"&&<button className="admin-primary-button" disabled={busy} type="submit">Mark delivered</button>}
 {["on_hold","pending_payment"].includes(status)&&<button className="admin-danger-button" disabled={busy} type="button" onClick={()=>{if(!window.confirm("Cancel this unpaid order and release any reserved stock?"))return;const fd=new FormData();fd.set("note",note);run("cancel",fd);}}>Cancel order</button>}
 <button className="admin-secondary-button" disabled={busy} type="button" onClick={()=>{const fd=new FormData();fd.set("note",note);run("save_note",fd);}}>Save internal note</button>
 </div>{busy&&<p className="admin-help">Saving order changes…</p>}{error&&<p className="admin-error" role="alert">{error}</p>}{success&&<p className="admin-success" role="status">{success} Refreshing this page will show the updated status.</p>}
 </form></section>;
}
