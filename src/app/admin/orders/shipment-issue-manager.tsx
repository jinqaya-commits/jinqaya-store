"use client";
import {useState,useTransition} from "react";
import {useRouter} from "next/navigation";
import {createShipmentIssueAction,updateShipmentIssueAction,createReplacementShipmentAction} from "./actions";

type EventRow={id:string;event_type:string;description:string;old_values:Record<string,unknown>|null;new_values:Record<string,unknown>|null;created_by:string|null;created_at:string};
type IssueRow={id:string;shipment_id:string;issue_type:string;reason:string;status:string;resolution_action:string|null;resolution_notes:string|null;refund_amount:number|null;refund_reference:string|null;refund_confirmed_at:string|null;replacement_shipment_id:string|null;created_at:string;shipment_issue_events:EventRow[]};
type Props={shipmentId:string;orderId:string;shipmentStatus:string;issues:IssueRow[]};
const issueLabels:Record<string,string>={exception:"Delivery exception",returned:"Returned parcel"};
const statusLabels:Record<string,string>={open:"Open",in_progress:"In progress",resolved:"Resolved"};
const actionLabels:Record<string,string>={awaiting_carrier:"Awaiting carrier",reship:"Reship",refund:"Refund",other:"Other"};
function dt(v:string){return new Intl.DateTimeFormat("en-US",{dateStyle:"medium",timeStyle:"short"}).format(new Date(v));}
export function ShipmentIssueManager({shipmentId,orderId,shipmentStatus,issues}:Props){
 const router=useRouter();const [reason,setReason]=useState("");const [busy,start]=useTransition();const [error,setError]=useState("");const [message,setMessage]=useState("");
 const [drafts,setDrafts]=useState<Record<string,{status:string;action:string;notes:string;amount:string;reference:string;carrier:string;tracking:string;url:string}>>({});
 const canCreate=["exception","returned"].includes(shipmentStatus)&&!issues.some(i=>i.status!=="resolved");
 function draft(i:IssueRow){return drafts[i.id]||{status:i.status,action:i.resolution_action||"",notes:i.resolution_notes||"",amount:"",reference:"",carrier:"",tracking:"",url:""};}
 function patch(id:string,k:string,v:string){setDrafts(old=>({...old,[id]:{...draft(issues.find(i=>i.id===id)!),...old[id], [k]:v}}));}
 function create(){setError("");setMessage("");start(async()=>{const r=await createShipmentIssueAction(orderId,shipmentId,shipmentStatus,reason);if(r.error){setError(r.error);return;}setReason("");setMessage("Shipment issue recorded.");router.refresh();});}
 function save(i:IssueRow,confirmRefund=false){const d=draft(i);setError("");setMessage("");start(async()=>{const r=await updateShipmentIssueAction(orderId,i.id,d.status,d.action||null,d.notes,d.amount,d.reference,confirmRefund);if(r.error){setError(r.error);return;}setMessage(confirmRefund?"Actual refund record saved.":"Issue handling updated.");router.refresh();});}
 function reship(i:IssueRow){const d=draft(i);setError("");setMessage("");start(async()=>{const r=await createReplacementShipmentAction(orderId,i.id,d.carrier,d.tracking,d.url);if(r.error){setError(r.error);return;}setMessage("Replacement shipment created. The original shipment history is preserved.");router.refresh();});}
 return <section className="admin-shipment-issues">
  <div className="admin-panel-heading"><div><p className="admin-kicker">DELIVERY PROBLEM HANDLING</p><h3>Exceptions & returns</h3></div><span>{issues.length} RECORDS</span></div>
  {canCreate&&<div className="admin-issue-create"><strong>Record {issueLabels[shipmentStatus]||"shipment issue"}</strong><label>Reason / carrier explanation<textarea value={reason} onChange={e=>setReason(e.target.value)} rows={3} minLength={3} maxLength={3000} placeholder="Describe what happened, carrier feedback, dates and customer communication…" /></label><button type="button" disabled={busy||reason.trim().length<3} onClick={create}>Record delivery issue</button></div>}
  {!issues.length&&<p className="admin-help">No delivery issue has been recorded for this shipment.</p>}
  {issues.map(i=>{const d=draft(i);return <article className="admin-issue-card" key={i.id}>
   <div className="admin-panel-heading"><div><strong>{issueLabels[i.issue_type]||i.issue_type}</strong><p>{dt(i.created_at)}</p></div><span className="admin-status status-draft">{statusLabels[i.status]||i.status}</span></div>
   <p className="admin-issue-reason">{i.reason}</p>
   <div className="admin-form-grid">
    <label>Handling status<select value={d.status} disabled={busy} onChange={e=>patch(i.id,"status",e.target.value)}><option value="open">Open</option><option value="in_progress">In progress</option><option value="resolved">Resolved</option></select></label>
    <label>Resolution<select value={d.action} disabled={busy} onChange={e=>patch(i.id,"action",e.target.value)}><option value="">Choose resolution</option><option value="awaiting_carrier">Awaiting carrier</option><option value="reship">Reship</option><option value="refund">Refund</option><option value="other">Other</option></select></label>
   </div>
   <label>Handling notes / outcome<textarea rows={3} maxLength={3000} value={d.notes} disabled={busy} onChange={e=>patch(i.id,"notes",e.target.value)} placeholder="Record contact with carrier, customer agreement, inspection and final decision…" /></label>
   <button type="button" className="admin-secondary-button" disabled={busy||(!d.action&&!d.notes&&d.status===i.status)} onClick={()=>save(i)}>Save handling update</button>
   {d.action==="reship"&&<div className="admin-issue-reship"><strong>Replacement parcel</strong>{i.replacement_shipment_id?<p>Replacement shipment created: {i.replacement_shipment_id}</p>:<><label>Carrier<input value={d.carrier} onChange={e=>patch(i.id,"carrier",e.target.value)} maxLength={100}/></label><label>New tracking number<input value={d.tracking} onChange={e=>patch(i.id,"tracking",e.target.value)} maxLength={150}/></label><label>Tracking URL <span className="optional">OPTIONAL</span><input type="url" value={d.url} onChange={e=>patch(i.id,"url",e.target.value)}/></label><button type="button" disabled={busy||d.carrier.trim().length<2||d.tracking.trim().length<3} onClick={()=>reship(i)}>Create replacement shipment</button><small>Creates a new shipment linked to the original order and copies the original shipment's item quantities. It does not deduct stock again.</small></>}</div>}
   {d.action==="refund"&&<div className="admin-issue-refund"><strong>Refund record</strong>{i.refund_confirmed_at?<p>Refund recorded: {i.refund_amount} · Reference: {i.refund_reference||"Not provided"} · {dt(i.refund_confirmed_at)}</p>:<><label>Actual refunded amount<input type="number" min="0.01" step="0.01" value={d.amount} onChange={e=>patch(i.id,"amount",e.target.value)} placeholder="Only after the refund is actually sent"/></label><label>Refund transaction reference <span className="optional">OPTIONAL</span><input value={d.reference} maxLength={200} onChange={e=>patch(i.id,"reference",e.target.value)}/></label><button type="button" disabled={busy||!(Number(d.amount)>0)} onClick={()=>save(i,true)}>Confirm refund actually completed</button><small>This records a completed refund; it does not transfer money or change payment-provider records.</small></>}</div>}
   {i.replacement_shipment_id&&<p className="admin-help">Replacement shipment ID: {i.replacement_shipment_id}</p>}
   {!!i.shipment_issue_events?.length&&<div className="admin-timeline">{i.shipment_issue_events.map(ev=><div className="admin-timeline-item" key={ev.id}><strong>{ev.description}</strong><span>{dt(ev.created_at)}</span>{ev.created_by&&<small>Operator ID: {ev.created_by}</small>}</div>)}</div>}
  </article>})}
  {error&&<p className="admin-error" role="alert">{error}</p>}{message&&<p className="admin-success" role="status">{message}</p>}
 </section>;
}
