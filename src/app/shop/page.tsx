import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { getRootCategories } from "@/lib/catalog";
import { getStoreProducts } from "@/lib/products";
import { ShopProductBrowser } from "@/components/storefront/shop-product-browser";
import { CategoryNavigation } from "@/components/storefront/category-navigation";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  alternates: { canonical: "/shop" },
  openGraph: { type: "website", url: "https://www.jinqaya.com/shop", title: "Shop Pet Lifestyle Essentials | JINQAYA", description: "Explore thoughtful lifestyle essentials for cats and dogs from JINQAYA." },

  title: "Shop Pet Lifestyle Essentials",
  description: "Explore thoughtful lifestyle essentials for cats and dogs from JINQAYA.",
};

type Props = { searchParams: Promise<{ q?: string }> };

export default async function ShopPage({ searchParams }: Props) {
  const [{ products, categories }, params] = await Promise.all([
    Promise.all([getStoreProducts(), getRootCategories()]).then(([products, categories]) => ({ products, categories })),
    searchParams,
  ]);
  const initialSearch = typeof params.q === "string" ? params.q.slice(0, 120) : "";

  return (
    <main className="inner-page">
      <header className="inner-page-header">
        <Link className="jq-brand-logo-link" href="/" aria-label="JINQAYA home"><Image className="jq-brand-logo jq-inner-logo" src="/jinqaya-logo.png" alt="JINQAYA Premium Pet Lifestyle" width={900} height={287} /></Link>
        <CategoryNavigation />
      </header>
      <section className="page-intro">
        <p className="eyebrow">THE JINQAYA COLLECTION</p>
        <h1>Thoughtful living,<br /><em>shared every day.</em></h1>
        <p>Explore considered essentials for the everyday moments we share with cats and dogs.</p>
      </section>
      <section className="shop-categories" aria-label="Shop by collection">
        {categories.map((category) => (
          <Link className="shop-category" href={`/collections/${category.slug}`} key={category.slug}>
            <div className="shop-category-art"><span>{category.number}</span><span aria-hidden="true">↗</span></div>
            <div className="shop-category-copy"><h2>{category.name}</h2><p>{category.description}</p></div>
          </Link>
        ))}
      </section>
      <section className="store-product-section">
        <div className="store-section-heading"><p className="eyebrow">THE EDIT</p><h2>Explore the collection</h2></div>
        {products.length ? (
          <ShopProductBrowser key={initialSearch} products={products} initialSearch={initialSearch} />
        ) : (
          <div className="collection-empty">
            <p className="eyebrow">A THOUGHTFUL EDIT IS IN THE MAKING</p>
            <h2>Good things<br /><em>are on their way.</em></h2>
            <p>Our first pieces are being prepared. Please check back soon.</p>
          </div>
        )}
      </section>
      <footer className="inner-footer"><Link className="jq-brand-logo-link" href="/" aria-label="JINQAYA home"><Image className="jq-brand-logo jq-inner-logo jq-footer-logo" src="/jinqaya-logo.png" alt="JINQAYA Premium Pet Lifestyle" width={900} height={287} /></Link><span><Link href="/faq">FAQ</Link> · <Link href="/order-status">TRACK ORDER</Link> · <Link href="/account">MY ACCOUNT</Link> · BETTER LIVING, TOGETHER.</span></footer>
    </main>
  );
}
