import type { Metadata } from "next";
import Link from "next/link";
import { CartLink } from "@/components/storefront/cart-link";
import { CategoryNavigation } from "@/components/storefront/category-navigation";

export const metadata: Metadata = {
  title: "Shipping Policy",
  description: "Learn how JINQAYA orders are dispatched directly from our factory in China.",
};

export default function ShippingPolicyPage() {
  return (
    <main className="jq-home jq-policy-page">
      <div className="jq-topline"><span>JINQAYA / A PET LIFESTYLE HOUSE</span><span>MADE FOR LIFE, SHARED</span></div>
      <header className="jq-header">
        <Link className="jq-wordmark" href="/" aria-label="JINQAYA home">JINQAYA<span>®</span></Link>
        <CategoryNavigation />
        <div className="jq-header-actions"><CartLink /></div>
      </header>
      <section className="jq-policy-hero">
        <p className="jq-kicker">CUSTOMER CARE / 02</p>
        <h1>Shipping<br /><em>information.</em></h1>
        <p>Every JINQAYA order is dispatched directly from our factory in China.</p>
      </section>
      <article className="jq-policy-content">
        <p className="jq-policy-updated">SHIPPING POLICY</p>
        <h2>Where orders ship from</h2>
        <p>JINQAYA orders are shipped directly from our factory in China to the delivery address provided at checkout. We do not dispatch orders from local warehouses in the destination country.</p>
        <h2>Available destinations and delivery methods</h2>
        <p>Available delivery destinations and shipping methods are shown during checkout based on the items and delivery address in your order.</p>
        <h2>Shipping costs and estimated delivery</h2>
        <p>Applicable shipping charges and any available estimated delivery information will be displayed during checkout before you complete your purchase. Delivery estimates are provided for guidance and may vary due to the destination, carrier operations, customs processing or other circumstances outside our control.</p>
        <h2>Before placing your order</h2>
        <p>Please make sure your shipping address and contact details are complete and accurate. If you need clarification about delivery to your location, review the checkout information before placing your order.</p>
        <div className="jq-policy-note"><strong>Need help?</strong><p>For delivery questions, email <a href="mailto:info@jinqaya.com">info@jinqaya.com</a>. For return eligibility, read our <Link href="/policies/returns-refunds">Returns &amp; Refunds Policy</Link>.</p></div>
        <p className="jq-policy-back"><Link href="/shop">CONTINUE SHOPPING ↗</Link></p>
      </article>
      <footer className="jq-footer">
        <div className="jq-footer-main">
          <div><Link className="jq-wordmark" href="/">JINQAYA<span>®</span></Link><p>Life is better in good company.</p></div>
          <div className="jq-footer-links"><Link href="/shop">THE SHOP</Link><Link href="/policies/shipping">SHIPPING POLICY</Link><Link href="/policies/returns-refunds">RETURNS &amp; REFUNDS</Link></div>
          <span className="jq-footer-note">FOR CATS, DOGS<br />AND THE LIFE BETWEEN.</span>
        </div>
        <div className="jq-footer-bottom"><span>© {new Date().getFullYear()} JINQAYA. ALL RIGHTS RESERVED.</span><span>DESIGNED FOR LIFE, SHARED.</span></div>
      </footer>
    </main>
  );
}
