"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { saveCategoryImage, saveCategorySeo } from "./actions";

type Category = {
  id:string;
  name:string;
  slug:string;
  description:string|null;
  image_path:string|null;
  seo_title:string|null;
  seo_description:string|null;
  is_active:boolean;
  sort_order:number;
  imageUrl:string|null;
};

type Draft = { seoTitle:string; seoDescription:string };

export function CategoryImageManager({categories}:{categories:Category[]}) {
  const [busyId,setBusyId]=useState<string|null>(null);
  const [error,setError]=useState("");
  const [savedId,setSavedId]=useState<string|null>(null);
  const [filter,setFilter]=useState("");
  const [drafts,setDrafts]=useState<Record<string,Draft>>({});
  const router=useRouter();

  function draftFor(category:Category):Draft {
    return drafts[category.id]??{seoTitle:category.seo_title??"",seoDescription:category.seo_description??""};
  }

  async function upload(category:Category,file:File) {
    if(!["image/jpeg","image/png","image/webp","image/avif"].includes(file.type)){
      setError("Choose a JPG, PNG, WebP or AVIF image."); return;
    }
    if(file.size<=0||file.size>20*1024*1024){setError("Images must be larger than 0 bytes and 20 MB or smaller.");return;}
    setBusyId(category.id);setError("");setSavedId(null);
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

  async function saveSeo(event:FormEvent<HTMLFormElement>,category:Category) {
    event.preventDefault();
    const draft=draftFor(category);
    setBusyId(category.id);setError("");setSavedId(null);
    try {
      const result=await saveCategorySeo(category.id,draft);
      if(result.error)throw new Error(result.error);
      setDrafts(current=>{const next={...current};delete next[category.id];return next;});
      setSavedId(category.id);
      router.refresh();
    } catch(e) {
      setError(e instanceof Error?e.message:"Unable to save category SEO.");
    } finally {setBusyId(null);}
  }

  const filteredCategories=categories.filter(category=>
    `${category.name} ${category.slug}`.toLowerCase().includes(filter.trim().toLowerCase())
  );

  return <section className="admin-panel jq-category-admin">
    <div className="admin-panel-heading"><div><p className="admin-kicker">CATEGORY CONTENT & SEO</p><h2>Category images and search previews</h2></div><span>{categories.length} CATEGORIES</span></div>
    <p className="admin-help">Each category has its own image, SEO title and search description. Keep titles concise and write a genuinely relevant description for that category. Images: JPG, PNG, WebP or AVIF, up to 20 MB.</p>
    {error&&<p className="admin-error" role="alert">{error}</p>}
    <label>Find a category
      <input type="search" value={filter} onChange={event=>setFilter(event.target.value)} placeholder="Search by category name or URL slug" />
    </label>
    <p className="admin-help">Showing {filteredCategories.length} of {categories.length} categories.</p>
    <div className="jq-category-admin-grid">
      {filteredCategories.map(category=>{
        const draft=draftFor(category);
        return <article className="jq-category-admin-card" key={category.id}>
          <div className="jq-category-admin-preview">
            {category.imageUrl?<img src={category.imageUrl} alt={category.name+" category image"} />:<div className="jq-category-admin-placeholder"><span>JINQAYA</span><small>IMAGE NOT SET</small></div>}
          </div>
          <div className="jq-category-admin-copy">
            <div><p className="admin-kicker">{category.slug} · {category.is_active?"ACTIVE":"INACTIVE"}</p><h3>{category.name}</h3></div>
            <label className="admin-primary-button jq-category-upload">{busyId===category.id?"Uploading…":category.imageUrl?"Replace image":"Upload category image"}
              <input type="file" accept="image/jpeg,image/png,image/webp,image/avif" disabled={busyId!==null} onChange={e=>{const file=e.currentTarget.files?.[0];e.currentTarget.value="";if(file)void upload(category,file);}} />
            </label>
            <span className="admin-help">{category.imageUrl?"Category image is set":"No category image yet"}</span>
            <form className="admin-form-section" onSubmit={event=>void saveSeo(event,category)}>
              <label>SEO title
                <input value={draft.seoTitle} maxLength={70} placeholder={category.name+" | JINQAYA"} disabled={busyId!==null} onChange={e=>setDrafts(current=>({...current,[category.id]:{...draft,seoTitle:e.target.value}}))}/>
              </label>
              <span className="admin-help">{draft.seoTitle.length}/70 characters</span>
              <label>SEO description
                <textarea value={draft.seoDescription} maxLength={160} rows={3} placeholder="Write a unique description for this category." disabled={busyId!==null} onChange={e=>setDrafts(current=>({...current,[category.id]:{...draft,seoDescription:e.target.value}}))}/>
              </label>
              <span className="admin-help">{draft.seoDescription.length}/160 characters</span>
              <button type="submit" className="admin-primary-button" disabled={busyId!==null}>{busyId===category.id?"Saving…":"Save SEO details"}</button>
              {savedId===category.id&&<span className="admin-help" role="status">SEO details saved.</span>}
            </form>
          </div>
        </article>;
      })}
    </div>
  </section>;
}
