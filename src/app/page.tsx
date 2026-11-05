import Link from "next/link";
import { CartLink } from "@/components/storefront/cart-link";
import { ProductCard } from "@/components/storefront/product-card";
import { categories } from "@/lib/catalog";
import { getStoreProducts } from "@/lib/products";

const categoryVisuals = [
  { image: "https://images.unsplash.com/photo-1552053831-71594a27632d?auto=format&fit=crop&w=1000&q=85", alt: "Golden retriever enjoying time outdoors" },
  { image: "https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?auto=format&fit=crop&w=1000&q=85", alt: "Cat relaxing at home" },
  { image: "https://images.unsplash.com/photo-1548199973-03cce0bbc87b?auto=format&fit=crop&w=1000&q=85", alt: "Dogs exploring outdoors together" },
  { image: "https://images.unsplash.com/photo-1583337130417-3346a1be7dee?auto=format&fit=crop&w=1000&q=85", alt: "Dog portrait" },
  { image: "https://images.unsplash.com/photo-1573865526739-10659fec78a5?auto=format&fit=crop&w=1000&q=85", alt: "Cat portrait" },
  { image: "https://images.unsplash.com/photo-1545249390-6b10b4c3fcfd?auto=format&fit=crop&w=1000&q=85", alt: "Cat resting in a calm home" },
];

export default async function HomePage() {
  const allProducts = await getStoreProducts();
  const featuredProducts = [...allProducts]
    .sort((a, b) => Number(b.is_featured) - Number(a.is_featured) || Number(b.is_new_arrival) - Number(a.is_new_arrival))
    .slice(0, 4);

  return (
    <main className="home-page">
      <div className="announcement">A MORE THOUGHTFUL WAY TO LIVE TOGETHER</div>

      <header className="site-header home-header">
        <Link className="wordmark" href="/" aria-label="JINQAYA home">JINQAYA<span>®</span></Link>
        <nav className="main-nav" aria-label="Main navigation">
          <Link href="/shop">SHOP ALL</Link>
          <Link href="#collections">COLLECTIONS</Link>
          <Link href="#story">OUR PHILOSOPHY</Link>
        </nav>
        <div className="header-actions">
          <Link href="/shop">DISCOVER THE SHOP ↗</Link>
          <CartLink />
        </div>
      </header>

      <section className="home-hero">
        <div className="home-hero-copy">
          <p className="eyebrow">PREMIUM PET LIFESTYLE</p>
          <h1>Better living,<br /><em>together.</em></h1>
          <p className="home-hero-description">Thoughtfully chosen essentials for the everyday moments we share with our cats and dogs.</p>
          <div className="home-hero-actions">
            <Link className="button button-dark" href="/shop">SHOP THE COLLECTION <span aria-hidden="true">↗</span></Link>
            <Link className="home-text-link" href="#collections">EXPLORE OUR WORLD</Link>
          </div>
          <div className="home-hero-note"><span /> MADE FOR THE LIFE YOU SHARE</div>
        </div>
        <div className="home-hero-visual">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="https://images.unsplash.com/photo-1548199973-03cce0bbc87b?auto=format&fit=crop&w=1800&q=90" alt="Two dogs enjoying an outdoor moment together" fetchPriority="high" />
          <div className="home-hero-image-caption"><span>01 / THE JINQAYA WAY</span><span>Life, in good company.</span></div>
          <div className="home-hero-stamp">J<br />®</div>
        </div>
      </section>

      <section className="home-intro" id="story">
        <p className="eyebrow">THE JINQAYA POINT OF VIEW</p>
        <h2>More than the things<br />we choose. <em>It’s how we live.</em></h2>
        <p>Life with pets is made up of little rituals, familiar comforts and everyday adventures. We bring together considered essentials for the moments that make a home feel like yours.</p>
      </section>

      <section className="home-category-section" id="collections">
        <div className="home-section-heading">
          <div><p className="eyebrow">FIND YOUR EVERYDAY</p><h2>Explore our <em>collections.</em></h2></div>
          <Link className="home-text-link" href="/shop">VIEW ALL COLLECTIONS ↗</Link>
        </div>
        <div className="home-category-grid">
          {categories.map((category, index) => (
            <Link className="home-category-card" href={`/collections/${category.slug}`} key={category.slug}>
              <div className="home-category-image">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={categoryVisuals[index].image} alt={categoryVisuals[index].alt} loading="lazy" />
                <span className="home-category-number">{category.number}</span>
                <span className="home-category-arrow" aria-hidden="true">↗</span>
              </div>
              <div className="home-category-copy"><h3>{category.name}</h3><p>{category.description}</p></div>
            </Link>
          ))}
        </div>
      </section>

      <section className="home-featured-section">
        <div className="home-section-heading">
          <div><p className="eyebrow">A FEW GOOD THINGS</p><h2>The considered <em>edit.</em></h2></div>
          <Link className="home-text-link" href="/shop">SHOP ALL PRODUCTS ↗</Link>
        </div>
        {featuredProducts.length > 0 ? (
          <div className="product-grid home-featured-grid">
            {featuredProducts.map((product) => <ProductCard key={product.id} product={product} />)}
          </div>
        ) : (
          <div className="home-products-empty"><p>OUR FIRST COLLECTION IS TAKING SHAPE</p><span>Thoughtful pieces for life together are on their way.</span></div>
        )}
      </section>

      <section className="home-story-banner">
        <div className="home-story-image">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?auto=format&fit=crop&w=1400&q=85" alt="A cat enjoying a quiet moment at home" loading="lazy" />
        </div>
        <div className="home-story-copy">
          <p className="eyebrow">SMALL MOMENTS. SHARED LIFE.</p>
          <h2>For every<br /><em>little moment.</em></h2>
          <p>From slow mornings at home to the next adventure outside, make room for the moments you’ll remember.</p>
          <Link className="button button-light" href="/shop">GET TO KNOW JINQAYA <span aria-hidden="true">↗</span></Link>
        </div>
      </section>

      <section className="home-values">
        <div><span>01</span><h3>THOUGHTFUL BY NATURE</h3><p>Useful, considered essentials for everyday life.</p></div>
        <div><span>02</span><h3>MADE FOR BOTH</h3><p>Exploring life with cats and dogs in mind.</p></div>
        <div><span>03</span><h3>LIVE A LITTLE CLOSER</h3><p>Because the best parts of life are shared.</p></div>
      </section>

      <footer className="site-footer home-footer">
        <div className="footer-main">
          <div><Link className="wordmark footer-wordmark" href="/">JINQAYA<span>®</span></Link><p>Better Living, Together.</p></div>
          <div className="footer-links">
            <div><p className="eyebrow">DISCOVER</p><Link href="/shop">Shop all</Link><Link href="#collections">Collections</Link><Link href="#story">Our philosophy</Link></div>
            <div><p className="eyebrow">THE BRAND</p><span>Thoughtful living essentials for cats and dogs.</span></div>
          </div>
        </div>
        <div className="footer-bottom"><span>© {new Date().getFullYear()} JINQAYA. ALL RIGHTS RESERVED.</span><span>DESIGNED FOR LIFE TOGETHER.</span></div>
      </footer>
    </main>
  );
}
