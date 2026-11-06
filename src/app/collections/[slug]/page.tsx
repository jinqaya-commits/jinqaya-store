import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { categories, getCategory } from "@/lib/catalog";
import { getStoreProducts } from "@/lib/products";
import { ProductCard } from "@/components/storefront/product-card";

type Props = { params: Promise<{ slug: string }> };

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const category = getCategory(slug);
  if (!category) return { title: "Collection Not Found" };
  return {
    title: category.name.toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase()),
    description: category.description,
  };
}

export default async function CollectionPage({ params }: Props) {
  const { slug } = await params;
  const category = getCategory(slug);
  if (!category) notFound();
  const products = await getStoreProducts(slug);

  return (
    <main className="inner-page">
      <header className="inner-page-header">
        <Link className="wordmark" href="/">JINQAYA<span>®</span></Link>
        <nav className="inner-nav" aria-label="Main navigation">
          <Link href="/shop">SHOP ALL</Link><Link href="/#point-of-view">OUR PHILOSOPHY</Link><Link href="/">HOME</Link>
        </nav>
      </header>
      <section className="collection-intro">
        <p className="eyebrow">COLLECTION {category.number}</p>
        <h1>{category.name}</h1><p>{category.description}</p>
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
      <footer className="inner-footer"><Link href="/">JINQAYA</Link><span>BETTER LIVING, TOGETHER.</span></footer>
    </main>
  );
}
