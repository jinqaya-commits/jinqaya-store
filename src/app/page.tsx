import Link from "next/link";

const categories = [
  {
    number: "01",
    name: "WALK & TRAVEL",
    description: "For little journeys and everyday adventures.",
    href: "/collections/walk-travel",
  },
  {
    number: "02",
    name: "HOME & COMFORT",
    description: "Thoughtful comforts for shared spaces.",
    href: "/collections/home-comfort",
  },
  {
    number: "03",
    name: "PLAY & DISCOVER",
    description: "Make room for curiosity and connection.",
    href: "/collections/play-discover",
  },
  {
    number: "04",
    name: "CARE & GROOMING",
    description: "Considered essentials for daily care.",
    href: "/collections/care-grooming",
  },
  {
    number: "05",
    name: "STYLE & ACCESSORIES",
    description: "Finishing touches for life together.",
    href: "/collections/style-accessories",
  },
  {
    number: "06",
    name: "SMART LIVING",
    description: "Useful ideas for a more thoughtful routine.",
    href: "/collections/smart-living",
  },
];

export default function HomePage() {
  return (
    <main>
      <div className="announcement">
        A MORE THOUGHTFUL WAY TO LIVE TOGETHER
      </div>

      <header className="site-header">
        <Link className="wordmark" href="/" aria-label="JINQAYA home">
          JINQAYA<span>®</span>
        </Link>
        <nav className="main-nav" aria-label="Main navigation">
          <Link href="/shop">SHOP ALL</Link>
          <Link href="#categories">COLLECTIONS</Link>
          <Link href="#philosophy">OUR PHILOSOPHY</Link>
        </nav>
        <div className="header-actions">
          <Link href="/account">ACCOUNT</Link>
          <Link href="/cart">BAG (0)</Link>
        </div>
      </header>

      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">PREMIUM PET LIFESTYLE</p>
          <h1>Better Living,<br /><em>Together.</em></h1>
          <p className="hero-description">
            Thoughtfully chosen essentials for the everyday moments
            we share with our pets.
          </p>
          <Link className="button button-dark" href="/shop">
            DISCOVER THE COLLECTION <span aria-hidden="true">↗</span>
          </Link>
        </div>
        <div className="hero-art" aria-label="Decorative warm neutral composition">
          <div className="art-sun" />
          <div className="art-arch art-arch-back" />
          <div className="art-arch art-arch-front" />
          <div className="art-caption">LIFE, IN GOOD COMPANY.</div>
        </div>
        <div className="hero-index"><span>01</span> / 03</div>
      </section>

      <section className="intro-strip" id="philosophy">
        <p className="eyebrow">THE JINQAYA POINT OF VIEW</p>
        <p className="intro-statement">
          The best moments are the <em>ones we share.</em>
        </p>
        <p className="intro-copy">
          A considered approach to everyday life with cats and dogs —
          where comfort, function and quiet design belong together.
        </p>
      </section>

      <section className="category-section" id="categories">
        <div className="section-topline">
          <div>
            <p className="eyebrow">EXPLORE OUR WORLD</p>
            <h2>Made for life <em>together.</em></h2>
          </div>
          <Link className="text-link" href="/shop">VIEW ALL CATEGORIES ↗</Link>
        </div>

        <div className="category-grid">
          {categories.map((category) => (
            <Link className="category-card" href={category.href} key={category.number}>
              <div className="category-art">
                <span>{category.number}</span>
                <span className="category-arrow" aria-hidden="true">↗</span>
              </div>
              <div className="category-card-copy">
                <h3>{category.name}</h3>
                <p>{category.description}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="closing-banner">
        <p className="eyebrow">JINQAYA</p>
        <h2>Little rituals.<br /><em>Better days.</em></h2>
        <Link className="button button-light" href="/shop">EXPLORE JINQAYA ↗</Link>
      </section>

      <footer className="site-footer">
        <div className="footer-main">
          <div>
            <Link className="wordmark footer-wordmark" href="/">JINQAYA<span>®</span></Link>
            <p>Better Living, Together.</p>
          </div>
          <div className="footer-links">
            <div><p className="eyebrow">DISCOVER</p><Link href="/shop">Shop all</Link><Link href="#categories">Collections</Link></div>
            <div><p className="eyebrow">HELP</p><Link href="/contact">Contact</Link><Link href="/shipping">Shipping</Link><Link href="/returns">Returns</Link></div>
            <div><p className="eyebrow">FOLLOW ALONG</p><Link href="#top">Instagram ↗</Link><Link href="#top">Pinterest ↗</Link></div>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} JINQAYA. ALL RIGHTS RESERVED.</span>
          <span>DESIGNED FOR LIFE TOGETHER.</span>
        </div>
      </footer>
    </main>
  );
}