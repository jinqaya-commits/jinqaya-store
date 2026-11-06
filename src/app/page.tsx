import Link from "next/link";
import { CartLink } from "@/components/storefront/cart-link";
import { ProductCard } from "@/components/storefront/product-card";
import { categories } from "@/lib/catalog";
import { getStoreProducts } from "@/lib/products";

const categoryVisuals = [
  { image: "https://images.unsplash.com/photo-1552053831-71594a27632d?auto=format&fit=crop&w=1400&q=88", alt: "A dog enjoying an outdoor moment" },
  { image: "https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?auto=format&fit=crop&w=1100&q=88", alt: "A cat resting in a quiet home" },
  { image: "https://images.unsplash.com/photo-1548199973-03cce0bbc87b?auto=format&fit=crop&w=1400&q=88", alt: "Two dogs exploring together" },
  { image: "https://images.unsplash.com/photo-1583337130417-3346a1be7dee?auto=format&fit=crop&w=1100&q=88", alt: "A close portrait of a dog" },
  { image: "https://images.unsplash.com/photo-1573865526739-10659fec78a5?auto=format&fit=crop&w=1100&q=88", alt: "A cat in a relaxed moment" },
  { image: "https://images.unsplash.com/photo-1545249390-6b10b4c3fcfd?auto=format&fit=crop&w=1400&q=88", alt: "A cat at home" },
];

export default async function HomePage() {
  const allProducts = await getStoreProducts();
  const featuredProducts = [...allProducts]
    .sort((a, b) => Number(b.is_featured) - Number(a.is_featured) || Number(b.is_new_arrival) - Number(a.is_new_arrival))
    .slice(0, 4);

  return (
    <main className="jq-home">
      <div className="jq-topline"><span>JINQAYA / A PET LIFESTYLE HOUSE</span><span>MADE FOR LIFE, SHARED</span></div>

      <header className="jq-header">
        <Link className="jq-wordmark" href="/" aria-label="JINQAYA home">JINQAYA<span>®</span></Link>
        <nav className="jq-nav" aria-label="Main navigation">
          <Link href="/shop">THE SHOP</Link>
          <Link href="#collections">COLLECTIONS</Link>
          <Link href="#point-of-view">OUR POINT OF VIEW</Link>
        </nav>
        <div className="jq-header-actions"><Link href="/shop" className="jq-shop-link">DISCOVER <span>↗</span></Link><CartLink /></div>
      </header>

      <section className="jq-hero">
        <div className="jq-hero-image">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="https://images.unsplash.com/photo-1552053831-71594a27632d?auto=format&fit=crop&w=2400&q=90" alt="A golden retriever in a sunlit outdoor setting" fetchPriority="high" />
        </div>
        <div className="jq-hero-shade" />
        <div className="jq-hero-top"><span>ISSUE Nº 01</span><span>THE ART OF LIVING TOGETHER</span></div>
        <div className="jq-hero-copy">
          <p className="jq-kicker">THE JINQAYA CAMPAIGN / 001</p>
          <h1>A life,<br /><em>well shared.</em></h1>
          <div className="jq-hero-bottom">
            <p>Objects and essentials for the life we share with cats and dogs. Considered in form. Made for living.</p>
            <Link href="/shop" className="jq-round-link" aria-label="Explore the shop"><span>EXPLORE<br />THE SHOP</span><b>↗</b></Link>
          </div>
        </div>
        <div className="jq-hero-index"><span>01</span><i /> A WORLD SHARED</div>
      </section>

      <section className="jq-manifesto" id="point-of-view">
        <div className="jq-manifesto-index"><span>THE JINQAYA<br />POINT OF VIEW</span><span>01 — 03</span></div>
        <div className="jq-manifesto-main">
          <p className="jq-kicker">NOT JUST PET THINGS.</p>
          <h2>It’s the life<br />we make <em>together.</em></h2>
        </div>
        <div className="jq-manifesto-aside">
          <span className="jq-aside-mark">✳</span>
          <p>Good design belongs in the everyday. In the familiar corner by the window, the walk that takes the long way home, and the small rituals that become part of a life.</p>
          <span className="jq-aside-caption">FOR CATS. FOR DOGS. FOR THE WAY WE LIVE.</span>
        </div>
      </section>

      <section className="jq-collections" id="collections">
        <div className="jq-section-rail"><span>02 / THE COLLECTIONS</span><span>MADE TO MOVE WITH EVERYDAY LIFE</span></div>
        <div className="jq-collections-heading">
          <h2>Find your<br /><em>everyday.</em></h2>
          <p>Different days call for different things. Explore the considered corners of the JINQAYA world.</p>
        </div>
        <div className="jq-collection-mosaic">
          {categories.map((category, index) => (
            <Link className={`jq-collection-tile jq-tile-${index + 1}`} href={`/collections/${category.slug}`} key={category.slug}>
              <div className="jq-tile-image">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={categoryVisuals[index % categoryVisuals.length].image} alt={categoryVisuals[index % categoryVisuals.length].alt} loading="lazy" />
              </div>
              <div className="jq-tile-meta"><span>{category.number ?? String(index + 1).padStart(2, "0")}</span><span>↗</span></div>
              <div className="jq-tile-title"><h3>{category.name}</h3><p>{category.description}</p></div>
            </Link>
          ))}
        </div>
        <div className="jq-collections-foot"><span>THE EVERYDAY, WITH A LITTLE MORE THOUGHT.</span><Link href="/shop">VIEW ALL COLLECTIONS ↗</Link></div>
      </section>

      <section className="jq-edit">
        <div className="jq-edit-heading">
          <div><p className="jq-kicker">03 / THE EDIT</p><h2>Chosen for<br /><em>everyday.</em></h2></div>
          <p>A considered selection of pieces for the life you share. Take a closer look.</p>
          <Link href="/shop" className="jq-underlined-link">EXPLORE THE SHOP ↗</Link>
        </div>
        {featuredProducts.length > 0 ? (
          <div className="product-grid jq-product-grid">
            {featuredProducts.map((product) => <ProductCard key={product.id} product={product} />)}
          </div>
        ) : (
          <div className="jq-empty-edit"><span>THE FIRST EDIT</span><p>Our collection is taking shape.<br />A few good things, coming into view.</p><Link href="/shop">VISIT THE SHOP ↗</Link></div>
        )}
      </section>

      <section className="jq-closing">
        <div className="jq-closing-image">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?auto=format&fit=crop&w=1800&q=88" alt="A cat enjoying a peaceful moment at home" loading="lazy" />
          <span>THE QUIET JOY OF BEING TOGETHER</span>
        </div>
        <div className="jq-closing-copy">
          <p className="jq-kicker">A NOTE ON THE EVERYDAY</p>
          <h2>Make room<br />for <em>more life.</em></h2>
          <p>For the muddy paws, slow mornings, familiar comforts and unexpected detours. The moments that make a shared life your own.</p>
          <Link href="/shop" className="jq-closing-cta">STEP INTO OUR WORLD <span>↗</span></Link>
          <span className="jq-closing-seal">J<br />®</span>
        </div>
      </section>

      <footer className="jq-footer">
        <div className="jq-footer-main">
          <div><Link className="jq-wordmark" href="/">JINQAYA<span>®</span></Link><p>Life is better in good company.</p></div>
          <div className="jq-footer-links"><Link href="/shop">THE SHOP</Link><Link href="#collections">COLLECTIONS</Link><Link href="#point-of-view">OUR POINT OF VIEW</Link></div>
          <span className="jq-footer-note">FOR CATS, DOGS<br />AND THE LIFE BETWEEN.</span>
        </div>
        <div className="jq-footer-bottom"><span>© {new Date().getFullYear()} JINQAYA. ALL RIGHTS RESERVED.</span><span>DESIGNED FOR LIFE, SHARED.</span></div>
      </footer>
    </main>
  );
}
