"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveCategoryImage } from "./actions";

type Category = { id:string; name:string; slug:string; description:string|null; image_path:string|null; is_active:boolean; sort_order:number; imageUrl:string|null };

export function CategoryImageManager({categories}:{categories:Category[]}) {
  const [busyId,setBusyId]=useState<string|null>(null);
  const [error,setError]=useState("");
  const router=useRouter();

  async function upload(category:Category,file:File) {
    if(!["image/jpeg","image/png","image/webp","image/avif"].includes(file.type)){
      setError("Choose a JPG, PNG, WebP or AVIF image."); return;
    }
    if(file.size<=0||file.size>20*1024*1024){setError("Images must be larger than 0 bytes and 20 MB or smaller.");return;}
    setBusyId(category.id);setError("");
    try {
      const prepared=await fetch("/api/admin/category-images/upload-url",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({categoryId:category.id,fileName:file.name,contentType:file.type,fileSize:file.size})});
      const info=await prepared.json();
      if(!prepared.ok)throw new Error(info.error||"Unable to prepare image upload.");
      const uploaded=await fetch(info.uploadUrl,{method:"PUT",headers:{"Content-Type":file.type},body:file});
      if(!uploaded.ok)throw new Error("Cloudflare R2 upload failed ("+uploaded.status+").");
      const saved=await saveCategoryImage(category.id,info.storagePath);
      if(saved.error)throw new Error(saved.error);
      router.refresh();
    } catch(e) {
      setError(e instanceof Error?e.message:"Image upload failed.");
    } finally { setBusyId(null); }
  }

  return <section className="admin-panel jq-category-admin">
    <div className="admin-panel-heading"><div><p className="admin-kicker">STOREFRONT IMAGERY</p><h2>Collection cover images</h2></div><span>{categories.length} COLLECTIONS</span></div>
    <p className="admin-help">Upload one landscape or portrait cover image for each collection. Recommended: 4:5 or 3:2 composition, JPG/WebP, up to 20 MB. Images appear on the homepage collection tiles.</p>
    {error&&<p className="admin-error" role="alert">{error}</p>}
    <div className="jq-category-admin-grid">
      {categories.map(category=><article className="jq-category-admin-card" key={category.id}>
        <div className="jq-category-admin-preview">
          {category.imageUrl?<img src={category.imageUrl} alt={category.name+" collection cover"} />:<div className="jq-category-admin-placeholder"><span>JINQAYA</span><small>IMAGE NOT SET</small></div>}
        </div>
        <div className="jq-category-admin-copy">
          <div><p className="admin-kicker">{category.slug}</p><h3>{category.name}</h3></div>
          <label className="admin-primary-button jq-category-upload">{busyId===category.id?"Uploading…":category.imageUrl?"Replace cover image":"Upload cover image"}
            <input type="file" accept="image/jpeg,image/png,image/webp,image/avif" disabled={busyId!==null} onChange={e=>{const file=e.currentTarget.files?.[0];e.currentTarget.value="";if(file)void upload(category,file);}} />
          </label>
          <span className="admin-help">{category.imageUrl?"Cover image is set":"No cover image yet"}</span>
        </div>
      </article>)}
    </div>
  </section>;
}