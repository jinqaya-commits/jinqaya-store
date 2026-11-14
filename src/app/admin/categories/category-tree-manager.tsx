"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { createCategory, updateCategory } from "./tree-actions";

type Category = { id:string; parent_id:string|null; name:string; slug:string; description:string|null; sort_order:number; is_active:boolean };

export function CategoryTreeManager({ categories }: { categories:Category[] }) {
  const router = useRouter();
  const [name,setName] = useState("");
  const [parentId,setParentId] = useState("");
  const [description,setDescription] = useState("");
  const [drafts,setDrafts] = useState<Record<string,{name:string;sortOrder:string;description:string}>>({});
  const [error,setError] = useState("");
  const [busy,setBusy] = useState(false);
  async function submit(e:FormEvent) {
    e.preventDefault(); setBusy(true); setError("");
    const result = await createCategory({name,parentId:parentId||null,description});
    if(result.error) setError(result.error);
    else {setName("");setDescription("");router.refresh();}
    setBusy(false);
  }
  async function save(category:Category) {
    const draft=drafts[category.id]??{name:category.name,sortOrder:String(category.sort_order),description:category.description??""};
    setBusy(true);setError("");
    const result=await updateCategory(category.id,{name:draft.name,sortOrder:Number(draft.sortOrder),description:draft.description});
    if(result.error)setError(result.error);
    else {setDrafts(current=>{const next={...current};delete next[category.id];return next;});router.refresh();}
    setBusy(false);
  }
  async function toggle(category:Category) {
    setBusy(true);setError("");
    const result=await updateCategory(category.id,{isActive:!category.is_active});
    if(result.error)setError(result.error);else router.refresh();
    setBusy(false);
  }
  const children=(parent:string|null)=>categories.filter(c=>c.parent_id===parent);
  function render(parent:string|null,depth:number):ReactNode {
    return children(parent).map(c=>{
      const draft=drafts[c.id]??{name:c.name,sortOrder:String(c.sort_order),description:c.description??""};
      return <div key={c.id} style={{marginLeft:depth*22,padding:"12px 0",borderBottom:"1px solid var(--admin-border, #e5e5e5)"}}>
        <div className="admin-form-grid" style={{alignItems:"end"}}>
          <label>Category name<input value={draft.name} onChange={e=>setDrafts(current=>({...current,[c.id]:{...draft,name:e.target.value}}))}/></label>
          <label>Sort order<input type="number" min="0" step="1" value={draft.sortOrder} onChange={e=>setDrafts(current=>({...current,[c.id]:{...draft,sortOrder:e.target.value}}))}/></label>
          <label className="full">Customer-facing description<textarea rows={2} maxLength={500} value={draft.description} onChange={e=>setDrafts(current=>({...current,[c.id]:{...draft,description:e.target.value}}))} placeholder="A short, accurate explanation of this category."/></label>
          <div className="admin-form-actions">
            <button type="button" className="admin-primary-button" disabled={busy||!draft.name.trim()} onClick={()=>void save(c)}>Save</button>
            <button type="button" className="admin-secondary-button" disabled={busy} onClick={()=>void toggle(c)}>{c.is_active?"Deactivate":"Activate"}</button>
          </div>
        </div>
        <div className="admin-help">/{c.slug} · Level {depth+1} · {c.is_active?"Active":"Inactive"}</div>
        {render(c.id,depth+1)}
      </div>;
    });
  }
  return <section className="admin-panel">
    <div className="admin-panel-heading"><div><p className="admin-kicker">PRODUCT TAXONOMY</p><h2>Category hierarchy</h2></div><span>{categories.length} CATEGORIES</span></div>
    <p className="admin-help">Three levels: main category → product type → specific product type. Only active categories are available for new product assignments.</p>
    {error&&<p className="admin-error" role="alert">{error}</p>}
    <form className="admin-form-section" onSubmit={submit}>
      <h3>Add a category</h3>
      <div className="admin-form-grid">
        <label>Category name<input required value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Cat Carriers"/></label>
        <label>Parent category<select value={parentId} onChange={e=>setParentId(e.target.value)}><option value="">Top-level category</option>{categories.filter(c=>c.parent_id===null||categories.some(p=>p.id===c.parent_id&&p.parent_id===null)).map(c=><option key={c.id} value={c.id}>{c.parent_id?"— ":""}{c.name}</option>)}</select></label>
      </div>
      <label>Description<input value={description} onChange={e=>setDescription(e.target.value)} placeholder="Short customer-facing description"/></label>
      <button className="admin-primary-button" disabled={busy||!name.trim()} type="submit">{busy?"Saving…":"Add category"}</button>
    </form>
    <div>{render(null,0)}</div>
  </section>;
}
