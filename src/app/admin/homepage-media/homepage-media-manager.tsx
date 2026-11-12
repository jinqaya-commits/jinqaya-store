"use client";
import {useState} from "react"; import {useRouter} from "next/navigation"; import {clearHomepageMedia,saveHomepageMedia} from "./actions";
type Slot={media_key:"hero"|"lifestyle";imageUrl:string|null;title:string;guidance:string};
export function HomepageMediaManager({slots}:{slots:Slot[]}) {
 const [busy,setBusy]=useState<string|null>(null);const [error,setError]=useState("");const router=useRouter();
 async function clear(slot:Slot){
  setBusy(slot.media_key);setError("");
  try{const result=await clearHomepageMedia(slot.media_key);if(result.error)throw new Error(result.error);router.refresh();}
  catch(e){setError(e instanceof Error?e.message:"Unable to restore the default image.");}
  finally{setBusy(null);}
 }
 async function upload(slot:Slot,file:File){
  if(!["image/jpeg","image/png","image/webp","image/avif"].includes(file.type)){setError("Choose a JPG, PNG, WebP or AVIF image.");return;}
  if(file.size<=0||file.size>20*1024*1024){setError("Images must be larger than 0 bytes and 20 MB or smaller.");return;}
  setBusy(slot.media_key);setError("");
  try{const response=await fetch("/api/admin/homepage-media/upload-url",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({mediaKey:slot.media_key,contentType:file.type,fileSize:file.size})});const data=await response.json();if(!response.ok)throw new Error(data.error||"Unable to prepare upload.");
   const uploaded=await fetch(data.uploadUrl,{method:"PUT",headers:{"Content-Type":file.type},body:file});if(!uploaded.ok)throw new Error("Cloudflare R2 upload failed ("+uploaded.status+").");
   const saved=await saveHomepageMedia(slot.media_key,data.storagePath);if(saved.error)throw new Error(saved.error);router.refresh();
  }catch(e){setError(e instanceof Error?e.message:"Image upload failed.");}finally{setBusy(null);}
 }
 return <section className="admin-panel jq-category-admin"><div className="admin-panel-heading"><div><p className="admin-kicker">STOREFRONT IMAGERY</p><h2>Homepage campaign images</h2></div><span>2 IMAGE SLOTS</span></div>
 <p className="admin-help">Upload original JINQAYA photography or approved campaign artwork. JPG, PNG, WebP or AVIF, up to 20 MB. Hero works best as a wide landscape image; lifestyle works best as a landscape image with a clear subject.</p>
 {error&&<p className="admin-error" role="alert">{error}</p>}<div className="jq-homepage-media-grid">{slots.map(slot=><article className="jq-homepage-media-card" key={slot.media_key}>
 <div className="jq-homepage-media-preview">{slot.imageUrl?<img src={slot.imageUrl} alt={slot.title+" preview"}/>:<div className="jq-category-admin-placeholder"><span>JINQAYA</span><small>USING CURRENT FALLBACK</small></div>}</div>
 <div className="jq-category-admin-copy"><div><p className="admin-kicker">{slot.media_key.toUpperCase()}</p><h3>{slot.title}</h3><p className="admin-help">{slot.guidance}</p></div>
 <label className="admin-primary-button jq-category-upload">{busy===slot.media_key?"Uploading…":slot.imageUrl?"Replace image":"Upload image"}<input type="file" accept="image/jpeg,image/png,image/webp,image/avif" disabled={busy!==null} onChange={e=>{const file=e.currentTarget.files?.[0];e.currentTarget.value="";if(file)void upload(slot,file);}}/></label>{slot.imageUrl&&<button type="button" className="admin-primary-button" disabled={busy!==null} onClick={()=>void clear(slot)}>{busy===slot.media_key?"Saving…":"Use default image"}</button>}<span className="admin-help">{slot.imageUrl?"Custom image is active":"Default image remains active"}</span></div></article>)}</div></section>;
}