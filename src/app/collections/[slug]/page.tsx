import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getStoreProducts } from "@/lib/products";
import { resolveProductImageUrls } from "@/lib/product-images";
import { ProductCard } from "@/components/storefront/product-card";
import { CategoryNavigation } from "@/components/storefront/category-navigation";
import { BreadcrumbJsonLd } from "@/lib/seo-jsonld";

type Props = { params: Promise<{ slug: string }> };

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: category } = await supabase.from("categories")
    .select("name,description,seo_title,seo_description,image_path")
    .eq("slug", slug).eq("is_active", true).maybeSingle();
  if (!category) return { title: "Category Not Found", robots: { index: false, follow: false } };
  const title = category.seo_title?.trim() || category.name.toLowerCase().replace(/\b\w/g, (letter: string) => letter.toUpperCase());
  const description = category.seo_description?.trim() || category.description || `Explore ${category.name.toLowerCase()} for cats and dogs from JINQAYA.`;
  const products = await getStoreProducts(slug);
  const imageUrl = category.image_path ? resolveProductImageUrls(category.image_path).detailUrl : null;
  return {
    title,
    description,
    robots: products.length ? { index: true, follow: true } : { index: false, follow: true },
    alternates: { canonical: `/collections/${slug}` },
    openGraph: {
      type: "website",
      url: `https://www.jinqaya.com/collections/${slug}`,
      title,
      description,
      ...(imageUrl ? { images: [{ url: imageUrl, alt: category.name }] } : {}),
    },
  };
}

export default async function CollectionPage({ params }: Props) {
  const { slug } = await params;
  const supabase = await createClient();
  const [{ data: category }, { data: allCategories }] = await Promise.all([
    supabase.from("categories").select("id,parent_id,name,slug,description,sort_order").eq("slug",slug).eq("is_active",true).maybeSingle(),
    supabase.from("categories").select("id,parent_id,name,slug,sort_order").eq("is_active",true).order("sort_order")
  ]);
  if (!category) notFound();
  const childCategories = (allCategories ?? []).filter(item => item.parent_id === category.id);
  const products = await getStoreProducts(slug);

  return (
    <main className="inner-page">
      <BreadcrumbJsonLd items={[{ name: "Home", path: "/" }, { name: "Collections", path: "/shop" }, { name: category.name, path: `/collections/${category.slug}` }]} />
      <header className="inner-page-header">
        <Link className="jq-brand-logo-link" href="/" aria-label="JINQAYA home"><Image className="jq-brand-logo jq-inner-logo" src="/jinqaya-logo.png" alt="JINQAYA Premium Pet Lifestyle" width={900} height={287} /></Link>
        <CategoryNavigation />
      </header>
      <section className="collection-intro">
        <p className="eyebrow">JINQAYA / CATEGORY</p>
        <h1>{category.name}</h1><p>{category.description}</p>
        {childCategories.length > 0 && <div className="collection-subcategories">{childCategories.map(child => <Link key={child.id} href={`/collections/${child.slug}`}>{child.name} ↗</Link>)}</div>}
        <Link className="back-link" href="/shop">← ALL COLLECTIONS</Link>
      </section>
      {products.length ? (
        <section className="store-product-section"><div className="product-grid">
          {products.map((product) => <ProductCard key={product.id} product={product} />)}
        </div></section>
      ) : (
        <section className="collection-empty">
          <p className="eyebrow">A THOUGHTFUL EDIT IS IN THE MAKING</p>
          <h2>Good things<br /><em>are on their way.</em></h2>
          <p>We’re preparing this collection. Please check back soon to explore the pieces as they become available.</p>
          <Link className="button button-dark" href="/shop">EXPLORE OTHER COLLECTIONS <span aria-hidden="true">↗</span></Link>
        </section>
      )}
      <footer className="inner-footer"><Link className="jq-brand-logo-link" href="/" aria-label="JINQAYA home"><Image className="jq-brand-logo jq-inner-logo jq-footer-logo" src="/jinqaya-logo.png" alt="JINQAYA Premium Pet Lifestyle" width={900} height={287} /></Link><span><Link href="/faq">FAQ</Link> · BETTER LIVING, TOGETHER.</span></footer>
    </main>
  );
}
