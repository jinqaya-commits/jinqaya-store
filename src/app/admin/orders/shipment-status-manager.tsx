"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateShipmentStatusAction } from "./actions";

type EventRow={id:string;old_status:string|null;new_status:string;note:string|null;created_at:string;changed_by:string|null};
type Props={shipmentId:string;status:string;events:EventRow[]};
const labels:Record<string,string>={pending:"Pending",label_created:"Label created",shipped:"Shipped",in_transit:"In transit",exception:"Delivery exception",returned:"Returned",delivered:"Delivered",cancelled:"Cancelled"};
const next:Record<string,string[]>={pending:["label_created","shipped","cancelled"],label_created:["shipped","in_transit","exception","cancelled"],shipped:["in_transit","exception","returned"],in_transit:["exception","returned"],exception:["in_transit","returned"]};
function date(v:string){return new Intl.DateTimeFormat("en-US",{dateStyle:"medium",timeStyle:"short"}).format(new Date(v));}
export function ShipmentStatusManager({shipmentId,status,events}:Props){
 const router=useRouter();const [selected,setSelected]=useState("");const [note,setNote]=useState("");const [error,setError]=useState("");const [success,setSuccess]=useState("");const [busy,start]=useTransition();
 const choices=next[status]||[];
 function save(){if(!selected)return;setError("");setSuccess("");start(async()=>{const result=await updateShipmentStatusAction(shipmentId,selected,note);if(result.error){setError(result.error);return;}setSuccess("Shipment status updated.");setNote("");setSelected("");router.refresh();});}
 return <div className="admin-shipment-status-manager">
  <div className="admin-panel-heading"><div><p className="admin-kicker">MANUAL TRACKING UPDATE</p><h3>Update delivery status</h3></div><span>{labels[status]||status}</span></div>
  {choices.length>0?<><label>New logistics status<select value={selected} onChange={e=>setSelected(e.target.value)}><option value="">Choose a status</option>{choices.map(v=><option key={v} value={v}>{labels[v]}</option>)}</select></label><label>Update note <span className="optional">OPTIONAL</span><textarea rows={2} maxLength={500} value={note} onChange={e=>setNote(e.target.value)} placeholder="e.g. Parcel handed to local carrier, customs inspection delay…" /></label><button type="button" className="admin-secondary-button" disabled={busy||!selected} onClick={save}>{busy?"Saving…":"Save logistics status"}</button></>:<p className="admin-help">{status==="delivered"?"Delivery has been recorded through the order workflow.":status==="returned"?"Returned shipments are closed.":"No further manual status changes are available."}</p>}
  {error&&<p className="admin-error" role="alert">{error}</p>}{success&&<p className="admin-success" role="status">{success}</p>}
  <div className="admin-timeline">{events.map(ev=><div className="admin-timeline-item" key={ev.id}><strong>{labels[ev.new_status]||ev.new_status}</strong><span>{date(ev.created_at)}</span>{ev.old_status&&<p>{labels[ev.old_status]||ev.old_status} → {labels[ev.new_status]||ev.new_status}</p>}{ev.note&&<p>{ev.note}</p>}{ev.changed_by&&<small>Operator ID: {ev.changed_by}</small>}</div>)}</div>
 </div>;
}
