"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createProduct, type CreateProductInput } from "../actions";
import { createClient } from "@/lib/supabase/client";

type Category = { id: string; name: string };

const initialValues: CreateProductInput = {
  name: "", categoryId: "", petType: "both", shortDescription: "", description: "",
  material: "", careInstructions: "", sku: "", variantName: "", color: "", size: "",
  price: "", compareAtPrice: "", status: "draft",
};

export function ProductCreateForm({ categories }: { categories: Category[] }) {
  const [values, setValues] = useState(initialValues);
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  function update<K extends keyof CreateProductInput>(key: K, value: CreateProductInput[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await createProduct(values);
      if (result.error || !result.productId) {
        setError(result.error || "Unable to save this product.");
        setBusy(false);
        return;
      }

      if (files.length) {
        const supabase = createClient();
        for (let index = 0; index < files.length; index += 1) {
          const file = files[index];
          const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
          const path = `${result.productId}/${crypto.randomUUID()}.${extension}`;
          const { error: uploadError } = await supabase.storage.from("product-images").upload(path, file, {
            upsert: false,
            contentType: file.type,
          });
          if (uploadError) throw new Error(uploadError.message);
          const { error: imageError } = await supabase.from("product_images").insert({
            product_id: result.productId,
            storage_path: path,
            alt_text: values.name,
            image_type: index === 0 ? "main" : "gallery",
            sort_order: index,
            is_primary: index === 0,
          });
          if (imageError) throw new Error(imageError.message);
        }
      }
      router.push("/admin/products");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Something went wrong.");
      setBusy(false);
    }
  }

  return <form className="admin-form" onSubmit={submit}>
    <section className="admin-form-section"><div className="admin-form-heading"><span>01</span><div><h2>Product information</h2><p>Start with the details customers will see.</p></div></div>
      <label>Product name<input required value={values.name} onChange={(e) => update("name", e.target.value)} placeholder="e.g. Everyday Travel Carrier" /></label>
      <div className="admin-form-grid"><label>Collection<select required value={values.categoryId} onChange={(e) => update("categoryId", e.target.value)}><option value="">Choose a collection</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
      <label>Made for<select value={values.petType} onChange={(e) => update("petType", e.target.value as CreateProductInput["petType"])}><option value="both">Cats & dogs</option><option value="cat">Cats</option><option value="dog">Dogs</option><option value="shared">Shared / general</option></select></label></div>
      <label>Short description<input value={values.shortDescription} onChange={(e) => update("shortDescription", e.target.value)} placeholder="A concise product introduction" /></label>
      <label>Full description<textarea rows={5} value={values.description} onChange={(e) => update("description", e.target.value)} placeholder="Describe the product, its features and intended use." /></label>
      <div className="admin-form-grid"><label>Material<input value={values.material} onChange={(e) => update("material", e.target.value)} placeholder="e.g. Cotton canvas" /></label><label>Care instructions<input value={values.careInstructions} onChange={(e) => update("careInstructions", e.target.value)} placeholder="e.g. Wipe clean with a damp cloth" /></label></div>
    </section>
    <section className="admin-form-section"><div className="admin-form-heading"><span>02</span><div><h2>Variant & pricing</h2><p>Add an initial SKU. More variants can be managed in the next catalog update.</p></div></div>
      <label>SKU<input value={values.sku} onChange={(e) => update("sku", e.target.value)} placeholder="e.g. JQ-WT-001-BE" /></label>
      <div className="admin-form-grid"><label>Variant name<input value={values.variantName} onChange={(e) => update("variantName", e.target.value)} placeholder="e.g. Beige / Small" /></label><label>Color<input value={values.color} onChange={(e) => update("color", e.target.value)} placeholder="Color" /></label><label>Size<input value={values.size} onChange={(e) => update("size", e.target.value)} placeholder="Size" /></label></div>
      <div className="admin-form-grid"><label>Price (USD)<input type="number" min="0" step="0.01" value={values.price} onChange={(e) => update("price", e.target.value)} placeholder="0.00" /></label><label>Compare-at price (USD)<input type="number" min="0" step="0.01" value={values.compareAtPrice} onChange={(e) => update("compareAtPrice", e.target.value)} placeholder="Optional" /></label></div>
      <p className="admin-help">Leave SKU blank to create the product first without a purchasable variant. Inventory and checkout are not connected yet.</p>
    </section>
    <section className="admin-form-section"><div className="admin-form-heading"><span>03</span><div><h2>Product images</h2><p>Upload JPG, PNG, WebP or AVIF images, up to 5 MB each. First image becomes the main image.</p></div></div>
      <label className="admin-upload">Choose product images<input type="file" accept="image/jpeg,image/png,image/webp,image/avif" multiple onChange={(e) => setFiles(Array.from(e.target.files ?? []))} /></label>
      {files.length > 0 && <p className="admin-help">{files.length} image(s) selected: {files.map((file) => file.name).join(", ")}</p>}
    </section>
    <section className="admin-form-section"><div className="admin-form-heading"><span>04</span><div><h2>Publishing</h2><p>Keep the product as a draft until its information is ready.</p></div></div>
      <label>Product status<select value={values.status} onChange={(e) => update("status", e.target.value as "draft" | "active")}><option value="draft">Draft — not visible in the shop</option><option value="active">Active — visible in the shop</option></select></label>
    </section>
    {error && <p className="admin-error" role="alert">{error}</p>}
    <div className="admin-form-actions"><button type="button" className="admin-secondary-button" disabled={busy} onClick={() => router.push("/admin/products")}>Cancel</button><button type="submit" className="admin-primary-button" disabled={busy || categories.length === 0}>{busy ? "Saving product…" : "Save product"}</button></div>
    {categories.length === 0 && <p className="admin-error">No active collections found. Add or activate a category before creating a product.</p>}
  </form>;
}
