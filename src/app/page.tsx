import Link from "next/link";
import { CartLink } from "@/components/storefront/cart-link";
import { CategoryNavigation } from "@/components/storefront/category-navigation";
import { ProductCard } from "@/components/storefront/product-card";
import { categories } from "@/lib/catalog";
import { getStoreProducts } from "@/lib/products";
import { createClient } from "@/lib/supabase/server";
import { resolveProductImageUrls } from "@/lib/product-images";

export const dynamic = "force-dynamic";

const categoryVisuals = [
  { image: "https://images.unsplash.com/photo-1552053831-71594a27632d?auto=format&fit=crop&w=1400&q=88", alt: "A dog enjoying an outdoor moment" },
  { image: "https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?auto=format&fit=crop&w=1100&q=88", alt: "A cat resting in a quiet home" },
  { image: "https://images.unsplash.com/photo-1548199973-03cce0bbc87b?auto=format&fit=crop&w=1400&q=88", alt: "Two dogs exploring together" },
  { image: "https://images.unsplash.com/photo-1583337130417-3346a1be7dee?auto=format&fit=crop&w=1100&q=88", alt: "A close portrait of a dog" },
  { image: "https://images.unsplash.com/photo-1573865526739-10659fec78a5?auto=format&fit=crop&w=1100&q=88", alt: "A cat in a relaxed moment" },
  { image: "https://images.unsplash.com/photo-1545249390-6b10b4c3fcfd?auto=format&fit=crop&w=1400&q=88", alt: "A cat at home" },
];

export default async function HomePage() {
  const [allProducts, categoryImageRows] = await Promise.all([
    getStoreProducts(),
    (async () => {
      try {
        const supabase = await createClient();
        const { data, error } = await supabase.from("categories").select("slug,image_path").eq("is_active", true);
        if (error) { console.error("Unable to load collection cover images:", error.message); return []; }
        return data ?? [];
      } catch (error) {
        console.error("Unable to load collection cover images:", error);
        return [];
      }
    })(),
  ]);
  type HomepageMediaRow = { media_key: "hero" | "lifestyle"; image_path: string | null };
  const homepageMediaRows: HomepageMediaRow[] = await (async () => {
    try {
      const supabase = await createClient();
      const { data, error } = await (supabase as any).from("homepage_media").select("media_key,image_path");
      if (error) { console.error("Unable to load homepage media:", error.message); return []; }
      return (data ?? []) as HomepageMediaRow[];
    } catch (error) {
      console.error("Unable to load homepage media:", error);
      return [];
    }
  })();
  const homepageMediaMap = new Map<string, string | null>(
    homepageMediaRows.map((item): [string, string | null] => [
      item.media_key,
      item.image_path ? resolveProductImageUrls(item.image_path).detailUrl : null,
    ]),
  );
  const heroImage = homepageMediaMap.get("hero") || "https://images.unsplash.com/photo-1552053831-71594a27632d?auto=format&fit=crop&w=2400&q=90";
  const lifestyleImage = homepageMediaMap.get("lifestyle") || "https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?auto=format&fit=crop&w=1800&q=88";
  const categoryImageMap = new Map(categoryImageRows.map((item) => [
    item.slug,
    item.image_path ? resolveProductImageUrls(item.image_path).detailUrl : null,
  ]));
  const featuredProducts = [...allProducts]
    .sort((a, b) => Number(b.is_featured) - Number(a.is_featured) || Number(b.is_new_arrival) - Number(a.is_new_arrival))
    .slice(0, 4);

  return (
    <main className="jq-home">
      <div className="jq-topline"><span>JINQAYA / A PET LIFESTYLE HOUSE</span><span>MADE FOR LIFE, SHARED</span></div>

      <header className="jq-header">
        <Link className="jq-wordmark" href="/" aria-label="JINQAYA home">JINQAYA<span>®</span></Link>
        <CategoryNavigation />
        <div className="jq-header-actions"><Link href="/shop" className="jq-shop-link">DISCOVER <span>↗</span></Link><CartLink /></div>
      </header>

      <section className="jq-hero">
        <div className="jq-hero-image">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={heroImage} alt="A golden retriever in a sunlit outdoor setting" fetchPriority="high" />
        </div>
        <div className="jq-hero-shade" />
        <div className="jq-hero-top"><span>ISSUE Nº 01</span><span>THE ART OF LIVING TOGETHER</span></div>
        <div className="jq-hero-copy">
          <p className="jq-kicker">A LIFE WITH PETS, CONSIDERED</p>
          <h1>Life is better<br /><em>in good company.</em></h1>
          <div className="jq-hero-bottom">
            <p>Thoughtful essentials for the rituals, rooms and little adventures we share with cats and dogs.</p>
            <Link href="/shop" className="jq-round-link" aria-label="Explore the shop"><span>EXPLORE<br />THE SHOP</span><b>↗</b></Link>
          </div>
        </div>
        <div className="jq-hero-index"><span>01</span><i /> A WORLD SHARED</div>
      </section>

      <section className="jq-collections" id="collections">
        <div className="jq-section-rail"><span>01 / THE COLLECTIONS</span><span>MADE TO MOVE WITH EVERYDAY LIFE</span></div>
        <div className="jq-collections-heading">
          <h2>Find your<br /><em>everyday.</em></h2>
          <p>Different days call for different things. Explore the considered corners of the JINQAYA world.</p>
        </div>
        <div className="jq-collection-mosaic">
          {categories.map((category, index) => (
            <Link className={`jq-collection-tile jq-tile-${index + 1}`} href={`/collections/${category.slug}`} key={category.slug}>
              <div className="jq-tile-image">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={categoryImageMap.get(category.slug) || categoryVisuals[index % categoryVisuals.length].image} alt={`${category.name} collection`} loading="lazy" decoding="async" />
              </div>
              <div className="jq-tile-meta"><span>{category.number ?? String(index + 1).padStart(2, "0")}</span><span>↗</span></div>
              <div className="jq-tile-title"><h3>{category.name}</h3><p>{category.description}</p></div>
            </Link>
          ))}
        </div>
        <div className="jq-collections-foot"><span>THE EVERYDAY, WITH A LITTLE MORE THOUGHT.</span><Link href="/shop">VIEW ALL COLLECTIONS ↗</Link></div>
      </section>

      <section className="jq-edit" id="the-edit">
        <div className="jq-section-rail"><span>02 / THE EDIT</span><span>A FEW GOOD THINGS, CHOSEN WITH CARE</span></div>
        <div className="jq-edit-heading">
          <div><p className="jq-kicker">THE JINQAYA SELECTION</p><h2>Chosen for<br /><em>everyday.</em></h2></div>
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

      <section className="jq-manifesto" id="point-of-view">
        <div className="jq-manifesto-index"><span>THE JINQAYA<br />POINT OF VIEW</span><span>03 — 05</span></div>
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

      <section className="jq-closing" id="life-with-pets">
        <div className="jq-closing-image">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lifestyleImage} alt="A cat enjoying a peaceful moment at home" loading="lazy" />
          <span>THE QUIET JOY OF BEING TOGETHER</span>
        </div>
        <div className="jq-closing-copy">
          <p className="jq-kicker">A LIFE SHARED</p>
          <h2>Make room<br />for <em>more life.</em></h2>
          <p>For the muddy paws, slow mornings, familiar comforts and unexpected detours. The moments that make a shared life your own.</p>
          <Link href="/shop" className="jq-closing-cta">STEP INTO OUR WORLD <span>↗</span></Link>
          <span className="jq-closing-seal">J<br />®</span>
        </div>
      </section>

      <section className="jq-shopping-confidence" aria-labelledby="jq-shopping-title">
        <div className="jq-shopping-heading">
          <p className="jq-kicker">THE DETAILS MATTER</p>
          <h2 id="jq-shopping-title">A more considered<br /><em>way to shop.</em></h2>
          <p>Take a moment to review the details that matter before placing your order.</p>
        </div>
        <div className="jq-shopping-points">
          <article>
            <span>01</span>
            <h3>DELIVERY DETAILS</h3>
            <p>Review available delivery methods, destinations and estimated timing during checkout.</p>
          </article>
          <article>
            <span>02</span>
            <h3>RETURNS &amp; QUESTIONS</h3>
            <p>Please review the store’s return information and product details before making a purchase.</p>
          </article>
          <article>
            <span>03</span>
            <h3>HERE TO HELP</h3>
            <p>Need more information about an item? Check its product page for details before ordering.</p>
          </article>
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
