import type { Metadata } from "next";
import Link from "next/link";
import { categories } from "@/lib/catalog";

export const metadata: Metadata = {
  title: "Shop Pet Lifestyle Essentials",
  description: "Explore JINQAYA collections for cats and dogs, from walk and travel essentials to home comfort and everyday care.",
};

export default function ShopPage() {
  return (
    <main className="inner-page">
      <header className="inner-page-header">
        <Link className="wordmark" href="/">JINQAYA<span>®</span></Link>
        <nav className="inner-nav" aria-label="Main navigation">
          <Link href="/shop" aria-current="page">SHOP ALL</Link>
          <Link href="/#philosophy">OUR PHILOSOPHY</Link>
          <Link href="/">HOME</Link>
        </nav>
      </header>

      <section className="page-intro">
        <p className="eyebrow">THE JINQAYA COLLECTIONS</p>
        <h1>Thoughtful living<br /><em>starts here.</em></h1>
        <p>Explore considered lifestyle essentials for the everyday moments we share with cats and dogs.</p>
      </section>

      <section className="shop-categories" aria-label="Shop by category">
        {categories.map((category) => (
          <Link className="shop-category" href={`/collections/${category.slug}`} key={category.slug}>
            <div className="shop-category-art">
              <span>{category.number}</span><span aria-hidden="true">↗</span>
            </div>
            <div className="shop-category-copy">
              <h2>{category.name}</h2>
              <p>{category.description}</p>
            </div>
          </Link>
        ))}
      </section>

      <footer className="inner-footer">
        <Link href="/">JINQAYA</Link>
        <span>BETTER LIVING, TOGETHER.</span>
      </footer>
    </main>
  );
}
