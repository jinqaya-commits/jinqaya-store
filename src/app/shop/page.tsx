import type { Metadata } from "next";
import Link from "next/link";
import { getRootCategories } from "@/lib/catalog";
import { getStoreProducts } from "@/lib/products";
import { ProductCard } from "@/components/storefront/product-card";
import { CategoryNavigation } from "@/components/storefront/category-navigation";

export const metadata: Metadata = {
  title: "Shop Pet Lifestyle Essentials",
  description: "Explore thoughtful lifestyle essentials for cats and dogs from JINQAYA.",
};

export default async function ShopPage() {
  const [products, categories] = await Promise.all([getStoreProducts(), getRootCategories()]);

  return (
    <main className="inner-page">
      <header className="inner-page-header">
        <Link className="wordmark" href="/">JINQAYA<span>®</span></Link>
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
          <div className="product-grid">{products.map((product) => <ProductCard key={product.id} product={product} />)}</div>
        ) : (
          <div className="collection-empty">
            <p className="eyebrow">A THOUGHTFUL EDIT IS IN THE MAKING</p>
            <h2>Good things<br /><em>are on their way.</em></h2>
            <p>Our first pieces are being prepared. Please check back soon.</p>
          </div>
        )}
      </section>
      <footer className="inner-footer"><Link href="/">JINQAYA</Link><span>BETTER LIVING, TOGETHER.</span></footer>
    </main>
  );
}
