"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { updateProduct, updateVariant, removeVariant, reorderImages, removeImage, addProductImage, updateProductImageAlt, replaceProductImage } from "../../actions";

type Category = {id:string;parent_id:string|null;name:string;slug:string;sort_order:number};
type Product = { id:string; name:string; pet_type:"cat"|"dog"|"both"|"shared"; short_description:string|null; description:string|null; material:string|null; care_instructions:string|null; seo_title:string|null; seo_description:string|null; status:"draft"|"active"|"archived" };
type Variant = { id?:string; sku:string; variantName:string; color:string; size:string; price:string; compareAtPrice:string };
type Image = { id:string; storage_path:string; alt_text:string|null; sort_order:number; previewUrl:string };

export function ProductEditForm({product,categoryId,categories,variants: initialVariants,images: initialImages}:{product:Product;categoryId:string;categories:Category[];variants:Variant[];images:Image[]}) {
 const [fields,setFields]=useState({name:product.name,categoryId,petType:product.pet_type,shortDescription:product.short_description??"",description:product.description??"",material:product.material??"",careInstructions:product.care_instructions??"",seoTitle:product.seo_title??"",seoDescription:product.seo_description??"",status:product.status});
 const [variants,setVariants]=useState(initialVariants);
 const [images,setImages]=useState([...initialImages].sort((a,b)=>a.sort_order-b.sort_order));
 const [draggedImageId,setDraggedImageId]=useState<string|null>(null);
 const [selectedImageId,setSelectedImageId]=useState<string|null>(initialImages[0]?.id??null);
 const [error,setError]=useState(""); const [busy,setBusy]=useState(false); const [uploadBusy,setUploadBusy]=useState(false); const [draggingFiles,setDraggingFiles]=useState(false); const router=useRouter();
 async function run(action:()=>Promise<{error?:string;success?:boolean}>) {setBusy(true);setError("");try{const result=await action();if(result.error){setError(result.error);setBusy(false);return false;}setBusy(false);router.refresh();return true;}catch(e){setError(e instanceof Error?e.message:"Unable to save.");setBusy(false);return false;}}
 async function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();await run(()=>updateProduct(product.id,fields));}
 async function saveVariant(v:Variant,index:number){setBusy(true);setError("");try{const result=await updateVariant(product.id,v);if(result.error){setError(result.error);setBusy(false);return;}if(result.variantId)setVariants(current=>current.map((x,i)=>i===index?{...x,id:result.variantId}:x));setBusy(false);router.refresh();}catch(e){setError(e instanceof Error?e.message:"Unable to save variant.");setBusy(false);}}
 async function dropVariant(v:Variant,index:number){if(v.id){const ok=await run(()=>removeVariant(product.id,v.id!));if(!ok)return;}setVariants(current=>current.filter((_,i)=>i!==index));setBusy(false);}
 async function persistImageOrder(next:Image[]){const ok=await run(()=>reorderImages(product.id,next.map(x=>x.id)));if(ok)setImages(next);return ok;}
 async function moveImage(i:number,delta:-1|1){const next=[...images];const j=i+delta;if(j<0||j>=next.length)return;[next[i],next[j]]=[next[j],next[i]];await persistImageOrder(next);}
 async function moveImageToMain(imageId:string){const index=images.findIndex(image=>image.id===imageId);if(index<=0)return;const next=[...images];const [selected]=next.splice(index,1);next.unshift(selected);await persistImageOrder(next);}
 async function dropImageOn(targetId:string){if(!draggedImageId||draggedImageId===targetId)return;const next=[...images];const from=next.findIndex(image=>image.id===draggedImageId);const to=next.findIndex(image=>image.id===targetId);if(from<0||to<0)return;const [moved]=next.splice(from,1);next.splice(to,0,moved);setDraggedImageId(null);await persistImageOrder(next);}
 async function dropImage(img:Image){const ok=await run(()=>removeImage(product.id,img.id,img.storage_path));if(ok){const next=images.filter(x=>x.id!==img.id);setImages(next);if(selectedImageId===img.id)setSelectedImageId(next[0]?.id??null);}}
 async function saveImageAlt(img:Image){const ok=await run(()=>updateProductImageAlt(product.id,img.id,img.alt_text??""));if(ok)router.refresh();}
 function previewUrlFor(storagePath:string){const key=storagePath.startsWith("r2://")?storagePath.slice(5):storagePath;return "https://images.jinqaya.com/"+key.split("/").map(encodeURIComponent).join("/");}
 async function replaceImage(img:Image,file?:File){
  if(!file)return;
  if(file.size<=0||file.size>20*1024*1024){setError(file.name+": image must be larger than 0 bytes and 20 MB or smaller.");return;}
  if(!["image/jpeg","image/png","image/webp","image/avif"].includes(file.type)){setError(file.name+": choose a JPG, PNG, WebP or AVIF image.");return;}
  setUploadBusy(true);setError("");
  try{
   const prepared=await fetch("/api/admin/product-images/upload-url",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({productId:product.id,fileName:file.name,contentType:file.type,fileSize:file.size})});
   const uploadInfo=await prepared.json();
   if(!prepared.ok)throw new Error(uploadInfo.error||"Unable to prepare replacement upload.");
   const uploaded=await fetch(uploadInfo.uploadUrl,{method:"PUT",headers:{"Content-Type":file.type},body:file});
   if(!uploaded.ok)throw new Error("Cloudflare R2 upload failed ("+uploaded.status+").");
   const result=await replaceProductImage(product.id,img.id,uploadInfo.storagePath);
   if(result.error)throw new Error(result.error);
   setImages(current=>current.map(item=>item.id===img.id?{...item,storage_path:uploadInfo.storagePath,previewUrl:previewUrlFor(uploadInfo.storagePath)}:item));
   router.refresh();
  }catch(err){setError(err instanceof Error?err.message:"Image replacement failed.");}
  finally{setUploadBusy(false);}
 }
 async function uploadImages(selected:File[]){
  if(!selected.length)return;
  for(const file of selected){
   if(file.size<=0||file.size>20*1024*1024){setError(file.name+": image must be larger than 0 bytes and 20 MB or smaller.");return;}
   if(!["image/jpeg","image/png","image/webp","image/avif"].includes(file.type)){setError(file.name+": choose a JPG, PNG, WebP or AVIF image.");return;}
  }
  setUploadBusy(true);setError("");
  try{
   for(const file of selected){
    const prepared=await fetch("/api/admin/product-images/upload-url",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({productId:product.id,fileName:file.name,contentType:file.type,fileSize:file.size})});
    const uploadInfo=await prepared.json();
    if(!prepared.ok)throw new Error(uploadInfo.error||"Unable to prepare upload.");
    const uploaded=await fetch(uploadInfo.uploadUrl,{method:"PUT",headers:{"Content-Type":file.type},body:file});
    if(!uploaded.ok)throw new Error("Cloudflare R2 upload failed ("+uploaded.status+").");
    const result=await addProductImage(product.id,uploadInfo.storagePath,"");
    if(result.error)throw new Error(result.error);
    const imageId=result.imageId;
    if(imageId){const added={id:imageId,storage_path:uploadInfo.storagePath,alt_text:"",sort_order:images.length,previewUrl:previewUrlFor(uploadInfo.storagePath)};setImages(current=>[...current,added]);setSelectedImageId(imageId);}
   }
   router.refresh();
  }catch(err){setError(err instanceof Error?err.message:"Image upload failed.");}
  finally{setUploadBusy(false);}
 }
 const blank:Variant={sku:"",variantName:"",color:"",size:"",price:"",compareAtPrice:""};
 return <div className="admin-form">
  <form onSubmit={submit} className="admin-form-section">
   <div className="admin-form-heading"><span>01</span><div><h2>Product details</h2><p>Use confirmed product facts only. Leave unknown details blank until verified; do not add assumed features or performance claims.</p></div></div>
   <label>Product name<input required value={fields.name} onChange={e=>setFields({...fields,name:e.target.value})}/></label>
   <label>Product category<select required value={fields.categoryId} onChange={e=>setFields({...fields,categoryId:e.target.value})}><option value="">Choose a product type</option>{categories.filter(category=>category.parent_id!==null).map(category=>{const parent=categories.find(item=>item.id===category.parent_id);const grand=parent?.parent_id?categories.find(item=>item.id===parent.parent_id):null;return <option key={category.id} value={category.id}>{grand?grand.name+" / ":""}{parent?.name??""} / {category.name}</option>;})}</select></label>
   <label>Pet type<select value={fields.petType} onChange={e=>setFields({...fields,petType:e.target.value as Product["pet_type"]})}><option value="both">Cats & dogs</option><option value="cat">Cats</option><option value="dog">Dogs</option><option value="shared">Shared / general</option></select></label>
   <label>Short description<input value={fields.shortDescription} onChange={e=>setFields({...fields,shortDescription:e.target.value})}/></label>
   <label>Full description<textarea rows={5} value={fields.description} onChange={e=>setFields({...fields,description:e.target.value})}/></label>
   <div className="admin-form-grid"><label>Material<input value={fields.material} onChange={e=>setFields({...fields,material:e.target.value})}/></label><label>Care instructions<input value={fields.careInstructions} onChange={e=>setFields({...fields,careInstructions:e.target.value})}/></label></div>
   <section className="admin-form-section"><div className="admin-form-heading"><span>SEO</span><div><h2>Search appearance</h2><p>Write a clear page title and summary for search results. Leave blank to use the product name and description.</p></div></div><label>SEO title<input maxLength={65} value={fields.seoTitle} onChange={e=>setFields({...fields,seoTitle:e.target.value})} placeholder="Product name | JINQAYA"/></label><p className="admin-help">{fields.seoTitle.length}/65 characters</p><label>SEO description<textarea rows={3} maxLength={160} value={fields.seoDescription} onChange={e=>setFields({...fields,seoDescription:e.target.value})} placeholder="Describe what the product is, who it is for and its useful detail."/></label><p className="admin-help">{fields.seoDescription.length}/160 characters</p></section>
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
   <label className={"admin-upload"+(draggingFiles?" is-dragging":"")}
    onDragOver={event=>{event.preventDefault();setDraggingFiles(true);}}
    onDragLeave={()=>setDraggingFiles(false)}
    onDrop={event=>{event.preventDefault();setDraggingFiles(false);void uploadImages(Array.from(event.dataTransfer.files).filter(file=>file.type.startsWith("image/")));}}>
    Upload product images
    <input type="file" accept="image/jpeg,image/png,image/webp,image/avif" multiple disabled={uploadBusy||busy} onChange={event=>{const selected=Array.from(event.currentTarget.files??[]);event.currentTarget.value="";void uploadImages(selected);}}/>
    <span className="admin-help">Select multiple images: on Windows, hold Ctrl and click each image (or Shift-click a range). You can also drag several image files from File Explorer into this area. JPG, PNG, WebP or AVIF; max 20 MB each.</span>
   </label>
   {uploadBusy&&<p className="admin-help">Uploading image…</p>}
   <div className="admin-image-summary"><strong>{images.length} {images.length===1?"image":"images"}</strong><span>Drag to reorder · Select a photo to edit</span></div>
   {images.length===0?<p className="admin-help">No images uploaded.</p>:<>
    <div className="admin-image-grid">
     {images.map((img,i)=><div className={"admin-image-tile"+(selectedImageId===img.id?" is-selected":"")+(draggedImageId===img.id?" is-dragging":"")} key={img.id} draggable={!busy&&!uploadBusy} onDragStart={event=>{setDraggedImageId(img.id);event.dataTransfer.effectAllowed="move";event.dataTransfer.setData("text/plain",img.id);}} onDragOver={event=>{event.preventDefault();event.dataTransfer.dropEffect="move";}} onDrop={event=>{event.preventDefault();void dropImageOn(img.id);}} onDragEnd={()=>setDraggedImageId(null)}>
      <button type="button" className="admin-image-select" onClick={()=>setSelectedImageId(img.id)} aria-label={"Select image "+(i+1)}>
       {img.previewUrl?<img src={img.previewUrl} alt={img.alt_text||"Product image "+(i+1)}/>:<span className="admin-image-empty">Image preview unavailable</span>}
       {i===0&&<span className="admin-image-main-badge">MAIN</span>}
       <span className="admin-image-number">{String(i+1).padStart(2,"0")}</span>
      </button>
      <div className="admin-image-tile-actions">
       {i!==0&&<button type="button" disabled={busy||uploadBusy} onClick={()=>void moveImageToMain(img.id)} title="Set as main image" aria-label="Set as main image">☆</button>}
       <button type="button" disabled={busy||uploadBusy} onClick={()=>void dropImage(img)} title="Delete image" aria-label="Delete image">×</button>
      </div>
     </div>)}
    </div>
    {images.filter(img=>img.id===selectedImageId).map(img=><div className="admin-image-editor" key={img.id}>
     <div className="admin-image-editor-heading"><strong>{images.findIndex(item=>item.id===img.id)===0?"Main image":"Image "+(images.findIndex(item=>item.id===img.id)+1)}</strong><span>Selected image settings</span></div>
     <label>Image description (Alt text)<input maxLength={180} value={img.alt_text??""} onChange={e=>setImages(current=>current.map(x=>x.id===img.id?{...x,alt_text:e.target.value}:x))} placeholder="Describe the actual subject, color, shape and view shown"/></label>
     <div className="admin-form-actions">
      <button type="button" className="admin-secondary-button" disabled={busy||uploadBusy} onClick={()=>void saveImageAlt(img)}>Save description</button>
      <label className="admin-secondary-button admin-image-replace">Replace image<input type="file" accept="image/jpeg,image/png,image/webp,image/avif" disabled={busy||uploadBusy} onChange={event=>{const file=event.currentTarget.files?.[0];event.currentTarget.value="";void replaceImage(img,file);}}/></label>
      <button type="button" className="admin-secondary-button" disabled={busy||uploadBusy||images.findIndex(item=>item.id===img.id)===0} onClick={()=>void moveImage(images.findIndex(item=>item.id===img.id),-1)}>Move left</button>
      <button type="button" className="admin-secondary-button" disabled={busy||uploadBusy||images.findIndex(item=>item.id===img.id)===images.length-1} onClick={()=>void moveImage(images.findIndex(item=>item.id===img.id),1)}>Move right</button>
     </div>
    </div>)}
   </>}
  </section>
  {error&&<p className="admin-error" role="alert">{error}</p>}
  <div className="admin-form-actions"><button type="button" className="admin-secondary-button" onClick={()=>router.push("/admin/products")}>Back to products</button></div>
 </div>;
}
