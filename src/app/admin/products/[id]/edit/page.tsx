import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProductEditForm } from "./product-edit-form";
import { resolveProductImageUrls } from "@/lib/product-images";

export const dynamic = "force-dynamic";

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: allowed, error } = await supabase.rpc("can_manage_catalog");
  if (error || allowed !== true) redirect("/");

  const [{ data: product }, { data: variants }, { data: images }, { data: categoryLinks }, { data: categories }] = await Promise.all([
    supabase.from("products").select("id,name,pet_type,short_description,description,material,care_instructions,status,seo_title,seo_description").eq("id", id).maybeSingle(),
    supabase.from("product_variants").select("id,sku,variant_name,color,size,price,compare_at_price").eq("product_id", id).order("created_at"),
    supabase.from("product_images").select("id,storage_path,alt_text,sort_order").eq("product_id", id).order("sort_order"),
    supabase.from("product_categories").select("category_id,is_primary").eq("product_id",id),
    supabase.from("categories").select("id,parent_id,name,slug,sort_order,is_active").order("sort_order"),
  ]);
  if (!product) notFound();
  const validPetTypes = ["cat", "dog", "both", "shared"] as const;
  if (!validPetTypes.includes(product.pet_type as (typeof validPetTypes)[number])) {
    throw new Error("This product has an unsupported pet type.");
  }
  const productForForm = { ...product, pet_type: product.pet_type as (typeof validPetTypes)[number] };
  return <main className="admin-shell">
    <aside className="admin-sidebar"><Link href="/" className="admin-brand">JINQAYA<span>ADMIN</span></Link><nav><Link className="active" href="/admin/products">Products</Link><Link href="/shop">View storefront ↗</Link></nav><p className="admin-sidebar-note">CATALOG MANAGEMENT</p></aside>
    <section className="admin-main">
      <header className="admin-topbar"><div><p className="admin-kicker">JINQAYA / CATALOG / EDIT</p><h1>Edit product</h1></div><Link className="admin-back-link" href="/admin/products">← Back to products</Link></header>
      <ProductEditForm product={productForForm} categoryIds={(categoryLinks ?? []).map(link=>link.category_id)} primaryCategoryId={(categoryLinks ?? []).find(link=>link.is_primary)?.category_id ?? (categoryLinks ?? [])[0]?.category_id ?? ""} categories={categories ?? []} variants={(variants ?? []).map(v=>({id:v.id,sku:v.sku,variantName:v.variant_name ?? "",color:v.color ?? "",size:v.size ?? "",price:v.price == null ? "" : String(v.price),compareAtPrice:v.compare_at_price == null ? "" : String(v.compare_at_price)}))} images={(images ?? []).map((image) => ({ ...image, previewUrl: resolveProductImageUrls(image.storage_path).thumbnailUrl ?? "" }))}/>
    </section>
  </main>;
}
