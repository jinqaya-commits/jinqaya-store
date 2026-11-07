"use client";
import {useCallback,useEffect,useRef,useState} from "react";

type Attachment={id:string;file_name:string;content_type:string;file_size:number;uploaded_by:string|null;created_at:string;url:string};
type Event={id:string;event_type:string;description:string;actor_user_id:string|null;created_at:string};
export function RefundProofManager({orderId,refundId}:{orderId:string;refundId:string}){
 const [attachments,setAttachments]=useState<Attachment[]>([]);
 const [events,setEvents]=useState<Event[]>([]);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const [message,setMessage]=useState("");
 const input=useRef<HTMLInputElement>(null);
 const endpoint="/api/admin/orders/"+orderId+"/refunds/"+refundId+"/attachments";
 const refresh=useCallback(async()=>{
  const response=await fetch(endpoint,{cache:"no-store"});
  const result=await response.json();
  if(!response.ok)throw new Error(result.error||"Unable to load refund documents.");
  setAttachments(result.attachments||[]);setEvents(result.events||[]);
 },[endpoint]);
 useEffect(()=>{let alive=true;fetch(endpoint,{cache:"no-store"}).then(async r=>{const j=await r.json();if(!r.ok)throw new Error(j.error||"Unable to load refund documents.");if(alive){setAttachments(j.attachments||[]);setEvents(j.events||[]);}}).catch(e=>{if(alive)setError(e instanceof Error?e.message:"Unable to load refund documents.");});return()=>{alive=false};},[endpoint]);
 async function upload(file:File){
  if(file.size>10*1024*1024)throw new Error("Each refund proof must be 10 MB or smaller.");
  setBusy(true);setError("");setMessage("");
  try{
   const start=await fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"create_upload",fileName:file.name,contentType:file.type,size:file.size})});
   const info=await start.json();if(!start.ok)throw new Error(info.error||"Unable to prepare upload.");
   const put=await fetch(info.uploadUrl,{method:"PUT",headers:{"Content-Type":file.type},body:file});
   if(!put.ok)throw new Error("File upload failed. Please try again.");
   const complete=await fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"complete",objectKey:info.objectKey,fileName:info.fileName})});
   const saved=await complete.json();if(!complete.ok)throw new Error(saved.error||"Unable to save refund proof.");
   setMessage("Refund proof uploaded.");await refresh();
  }catch(e){setError(e instanceof Error?e.message:"Unable to upload refund proof.");}
  finally{setBusy(false);if(input.current)input.current.value="";}
 }
 function dt(value:string){return new Intl.DateTimeFormat("en-US",{dateStyle:"medium",timeStyle:"short"}).format(new Date(value));}
 return <div className="admin-refund-proof">
  <div className="admin-panel-heading"><div><strong>Refund proof & audit trail</strong><p>Private documents · PDF or images · 10 MB maximum per file</p></div><span>{attachments.length} FILES</span></div>
  <input ref={input} type="file" accept="application/pdf,image/jpeg,image/png,image/webp,image/avif" disabled={busy} onChange={e=>{const f=e.target.files?.[0];if(f)void upload(f);}}/>
  {busy&&<small>Uploading securely…</small>}{error&&<p className="admin-error" role="alert">{error}</p>}{message&&<p className="admin-success" role="status">{message}</p>}
  {attachments.length===0?<p className="admin-help">No refund proof uploaded yet.</p>:<ul>{attachments.map(file=><li key={file.id}><a href={file.url} target="_blank" rel="noreferrer">{file.file_name}</a><small>{(file.file_size/1024/1024).toFixed(2)} MB · {dt(file.created_at)} · {file.uploaded_by||"Operator not available"}</small></li>)}</ul>}
  {events.length>0&&<details><summary>Refund operation history ({events.length})</summary><ol>{events.map(event=><li key={event.id}><strong>{event.description}</strong><small>{dt(event.created_at)} · {event.actor_user_id||"System"}</small></li>)}</ol></details>}
 </div>;
}
