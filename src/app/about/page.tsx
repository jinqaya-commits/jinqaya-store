import type { Metadata } from "next";
import Link from "next/link";
import { CartLink } from "@/components/storefront/cart-link";
import { CategoryNavigation } from "@/components/storefront/category-navigation";

export const metadata: Metadata = {
  alternates: { canonical: "/about" },
  openGraph: { type: "website", url: "https://jinqaya.com/about", title: "About JINQAYA", description: "Discover the JINQAYA point of view on life shared with cats and dogs." },

  title: "About JINQAYA",
  description: "Discover JINQAYA, a pet lifestyle brand shaped around the everyday life people share with cats and dogs.",
};

export default function AboutPage() {
  return (
    <main className="jq-home jq-about-page">
      <div className="jq-topline"><span>JINQAYA / A PET LIFESTYLE HOUSE</span><span>MADE FOR LIFE, SHARED</span></div>
      <header className="jq-header">
        <Link className="jq-wordmark" href="/" aria-label="JINQAYA home">JINQAYA<span>®</span></Link>
        <CategoryNavigation />
        <div className="jq-header-actions"><CartLink /></div>
      </header>

      <section className="jq-about-hero">
        <div className="jq-about-hero-copy">
          <p className="jq-kicker">A PET LIFESTYLE HOUSE</p>
          <h1>Life is better<br /><em>in good company.</em></h1>
          <p>JINQAYA is shaped by a simple idea: life with cats and dogs is part of the way we live, not something separate from it.</p>
          <span className="jq-about-hero-index">OUR STORY / 01</span>
        </div>
        <div className="jq-about-hero-art" role="img" aria-label="A quiet moment shared with a pet">
          <span>THE LIFE WE MAKE TOGETHER</span>
        </div>
      </section>

      <section className="jq-about-statement">
        <p className="jq-kicker">OUR POINT OF VIEW</p>
        <h2>It’s the life<br />we make <em>together.</em></h2>
        <p>The familiar routines. The space we share. The walks that take a little longer. We believe the things that accompany life with pets should feel at home in the everyday.</p>
      </section>

      <section className="jq-about-values">
        <div className="jq-about-values-heading">
          <p className="jq-kicker">WHAT GUIDES US</p>
          <h2>Thoughtful by<br /><em>everyday nature.</em></h2>
        </div>
        <div className="jq-about-value-list">
          <article><span>01</span><div><h3>MADE FOR REAL ROUTINES</h3><p>From getting out the door to settling in at home, we focus on useful pieces for the moments that make up everyday life with cats and dogs.</p></div></article>
          <article><span>02</span><div><h3>DESIGNED TO BELONG</h3><p>Pet essentials are part of the home and the things we carry with us. We look for a considered balance of function, form and a sense of ease.</p></div></article>
          <article><span>03</span><div><h3>A WORLD FOR CATS AND DOGS</h3><p>JINQAYA brings together collections for cats, dogs and the people who share their lives with them. We do not sell pet food.</p></div></article>
        </div>
      </section>

      <section className="jq-about-origin">
        <div><p className="jq-kicker">FROM OUR WORKING BASE TO YOUR HOME</p><h2>Direct from<br /><em>China.</em></h2></div>
        <div><p>JINQAYA orders are dispatched directly from our factory in China. Delivery options, shipping costs and available estimates are confirmed for your destination before payment.</p><Link href="/policies/shipping" className="jq-about-link">READ SHIPPING DETAILS ↗</Link></div>
      </section>

      <section className="jq-about-end">
        <p className="jq-kicker">COME ON IN</p>
        <h2>Find your<br /><em>everyday.</em></h2>
        <Link href="/shop" className="jq-closing-cta">EXPLORE THE COLLECTIONS <span>↗</span></Link>
      </section>

      <footer className="jq-footer">
        <div className="jq-footer-main">
          <div><Link className="jq-wordmark" href="/">JINQAYA<span>®</span></Link><p>Life is better in good company.</p></div>
          <div className="jq-footer-links"><Link href="/shop">THE SHOP</Link><Link href="/about">ABOUT JINQAYA</Link><Link href="/policies/shipping">SHIPPING POLICY</Link><Link href="/policies/returns-refunds">RETURNS &amp; REFUNDS</Link><Link href="/policies/privacy">PRIVACY POLICY</Link><Link href="/policies/terms">TERMS OF SERVICE</Link><Link href="/contact">CONTACT</Link><a href="mailto:info@jinqaya.com">INFO@JINQAYA.COM</a></div>
          <span className="jq-footer-note">FOR CATS, DOGS<br />AND THE LIFE BETWEEN.</span>
        </div>
        <div className="jq-footer-bottom"><span>© {new Date().getFullYear()} JINQAYA. ALL RIGHTS RESERVED.</span><span>DESIGNED FOR LIFE, SHARED.</span></div>
      </footer>
    </main>
  );
}
