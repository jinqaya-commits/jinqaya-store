"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { updateProduct, updateVariant, removeVariant, reorderImages, removeImage, addProductImage } from "../../actions";

type Product = { id:string; name:string; pet_type:"cat"|"dog"|"both"|"shared"; short_description:string|null; description:string|null; material:string|null; care_instructions:string|null; status:"draft"|"active"|"archived" };
type Variant = { id?:string; sku:string; variantName:string; color:string; size:string; price:string; compareAtPrice:string };
type Image = { id:string; storage_path:string; alt_text:string|null; sort_order:number };

export function ProductEditForm({product,variants: initialVariants,images: initialImages}:{product:Product;variants:Variant[];images:Image[]}) {
 const [fields,setFields]=useState({name:product.name,petType:product.pet_type,shortDescription:product.short_description??"",description:product.description??"",material:product.material??"",careInstructions:product.care_instructions??"",status:product.status});
 const [variants,setVariants]=useState(initialVariants);
 const [images,setImages]=useState([...initialImages].sort((a,b)=>a.sort_order-b.sort_order));
 const [error,setError]=useState(""); const [busy,setBusy]=useState(false); const [uploadBusy,setUploadBusy]=useState(false); const router=useRouter();
 async function run(action:()=>Promise<{error?:string;success?:boolean}>) {setBusy(true);setError("");try{const result=await action();if(result.error){setError(result.error);setBusy(false);return false;}setBusy(false);router.refresh();return true;}catch(e){setError(e instanceof Error?e.message:"Unable to save.");setBusy(false);return false;}}
 async function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();await run(()=>updateProduct(product.id,fields));}
 async function saveVariant(v:Variant,index:number){setBusy(true);setError("");try{const result=await updateVariant(product.id,v);if(result.error){setError(result.error);setBusy(false);return;}if(result.variantId)setVariants(current=>current.map((x,i)=>i===index?{...x,id:result.variantId}:x));setBusy(false);router.refresh();}catch(e){setError(e instanceof Error?e.message:"Unable to save variant.");setBusy(false);}}
 async function dropVariant(v:Variant,index:number){if(v.id){const ok=await run(()=>removeVariant(product.id,v.id!));if(!ok)return;}setVariants(current=>current.filter((_,i)=>i!==index));setBusy(false);}
 async function moveImage(i:number,delta:-1|1){const next=[...images];const j=i+delta;if(j<0||j>=next.length)return;[next[i],next[j]]=[next[j],next[i]];setImages(next);await run(()=>reorderImages(product.id,next.map(x=>x.id)));}
 async function dropImage(img:Image){const ok=await run(()=>removeImage(product.id,img.id,img.storage_path));if(ok)setImages(current=>current.filter(x=>x.id!==img.id));}
 const blank:Variant={sku:"",variantName:"",color:"",size:"",price:"",compareAtPrice:""};
 return <div className="admin-form">
  <form onSubmit={submit} className="admin-form-section">
   <div className="admin-form-heading"><span>01</span><div><h2>Product details</h2><p>Edit the product information shown in the shop.</p></div></div>
   <label>Product name<input required value={fields.name} onChange={e=>setFields({...fields,name:e.target.value})}/></label>
   <label>Pet type<select value={fields.petType} onChange={e=>setFields({...fields,petType:e.target.value as Product["pet_type"]})}><option value="both">Cats & dogs</option><option value="cat">Cats</option><option value="dog">Dogs</option><option value="shared">Shared / general</option></select></label>
   <label>Short description<input value={fields.shortDescription} onChange={e=>setFields({...fields,shortDescription:e.target.value})}/></label>
   <label>Full description<textarea rows={5} value={fields.description} onChange={e=>setFields({...fields,description:e.target.value})}/></label>
   <div className="admin-form-grid"><label>Material<input value={fields.material} onChange={e=>setFields({...fields,material:e.target.value})}/></label><label>Care instructions<input value={fields.careInstructions} onChange={e=>setFields({...fields,careInstructions:e.target.value})}/></label></div>
   <label>Status<select value={fields.status} onChange={e=>setFields({...fields,status:e.target.value as Product["status"]})}><option value="draft">Draft</option><option value="active">Active</option><option value="archived">Archived</option></select></label>
   <button className="admin-primary-button" disabled={busy} type="submit">{busy?"Saving…":"Save product details"}</button>
  </form>
  <section className="admin-form-section"><div className="admin-form-heading"><span>02</span><div><h2>Variants & pricing</h2><p>Each color or size can have its own SKU and price.</p></div></div>
   {variants.map((v,i)=><div key={v.id??"new-"+i} className="admin-form-section"><div className="admin-form-grid">
    <label>SKU<input value={v.sku} onChange={e=>setVariants(a=>a.map((x,k)=>k===i?{...x,sku:e.target.value}:x))}/></label>
    <label>Variant name<input value={v.variantName} onChange={e=>setVariants(a=>a.map((x,k)=>k===i?{...x,variantName:e.target.value}:x))}/></label>
    <label>Color<input value={v.color} onChange={e=>setVariants(a=>a.map((x,k)=>k===i?{...x,color:e.target.value}:x))}/></label>
    <label>Size<input value={v.size} onChange={e=>setVariants(a=>a.map((x,k)=>k===i?{...x,size:e.target.value}:x))}/></label>
    <label>Price USD<input type="number" min="0" step="0.01" value={v.price} onChange={e=>setVariants(a=>a.map((x,k)=>k===i?{...x,price:e.target.value}:x))}/></label>
    <label>Compare-at USD<input type="number" min="0" step="0.01" value={v.compareAtPrice} onChange={e=>setVariants(a=>a.map((x,k)=>k===i?{...x,compareAtPrice:e.target.value}:x))}/></label>
   </div><div className="admin-form-actions"><button type="button" className="admin-primary-button" disabled={busy} onClick={()=>void saveVariant(v,i)}>Save SKU</button><button type="button" className="admin-secondary-button" disabled={busy} onClick={()=>void dropVariant(v,i)}>Remove</button></div></div>)}
   <button type="button" className="admin-secondary-button" disabled={busy} onClick={()=>setVariants(v=>[...v,blank])}>＋ Add variant</button>
  </section>

  <section className="admin-form-section"><div className="admin-form-heading"><span>03</span><div><h2>Product images</h2><p>Upload JPG, PNG, WebP or AVIF images (maximum 20 MB each). The first image becomes the main image.</p></div></div>
   <label>Upload image<input type="file" accept="image/jpeg,image/png,image/webp,image/avif" disabled={uploadBusy||busy} onChange={async e=>{const input=e.currentTarget;const file=input.files?.[0];if(!file)return;setError("");if(file.size>20*1024*1024){setError("Each image must be 20 MB or smaller.");input.value="";return;}if(!["image/jpeg","image/png","image/webp","image/avif"].includes(file.type)){setError("Please choose a JPG, PNG, WebP or AVIF image.");input.value="";return;}setUploadBusy(true);try{const prepared=await fetch("/api/admin/product-images/upload-url",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({productId:product.id,fileName:file.name,contentType:file.type,fileSize:file.size})});const uploadInfo=await prepared.json();if(!prepared.ok)throw new Error(uploadInfo.error||"Unable to prepare upload.");const uploaded=await fetch(uploadInfo.uploadUrl,{method:"PUT",headers:{"Content-Type":file.type},body:file});if(!uploaded.ok)throw new Error("Cloudflare R2 upload failed ("+uploaded.status+").");const result=await addProductImage(product.id,uploadInfo.storagePath,product.name);if(result.error)throw new Error(result.error);router.refresh();}catch(err){setError(err instanceof Error?err.message:"Image upload failed.");}finally{setUploadBusy(false);input.value="";}}}/></label>
   {uploadBusy&&<p className="admin-help">Uploading image…</p>}
   {images.length===0?<p className="admin-help">No images uploaded.</p>:images.map((img,i)=><div className="admin-form-grid" key={img.id}><div><strong>{i===0?"Main image":"Image "+(i+1)}</strong><p className="admin-help">{img.alt_text??img.storage_path}</p></div><div className="admin-form-actions"><button type="button" className="admin-secondary-button" disabled={busy||uploadBusy||i===0} onClick={()=>void moveImage(i,-1)}>Move up</button><button type="button" className="admin-secondary-button" disabled={busy||uploadBusy||i===images.length-1} onClick={()=>void moveImage(i,1)}>Move down</button><button type="button" className="admin-secondary-button" disabled={busy||uploadBusy} onClick={()=>void dropImage(img)}>Delete</button></div></div>)}
  </section>
  {error&&<p className="admin-error" role="alert">{error}</p>}
  <div className="admin-form-actions"><button type="button" className="admin-secondary-button" onClick={()=>router.push("/admin/products")}>Back to products</button></div>
 </div>;
}
