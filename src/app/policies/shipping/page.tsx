import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { CartLink } from "@/components/storefront/cart-link";
import { CategoryNavigation } from "@/components/storefront/category-navigation";

export const metadata: Metadata = {
  alternates: { canonical: "/policies/shipping" },

  title: "Shipping Policy",
  description: "Learn how JINQAYA orders are dispatched directly from our factory in China.",
};

export default function ShippingPolicyPage() {
  return (
    <main className="jq-home jq-policy-page">
      <div className="jq-topline"><span>JINQAYA / A PET LIFESTYLE HOUSE</span><span>MADE FOR LIFE, SHARED</span></div>
      <header className="jq-header">
        <Link className="jq-brand-logo-link" href="/" aria-label="JINQAYA home"><Image className="jq-brand-logo" src="/jinqaya-logo.png" alt="JINQAYA Premium Pet Lifestyle" width={900} height={287} /></Link>
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
        <p>After you submit an order request, we will check whether delivery is available for your destination and confirm the shipping methods that can be used for your items.</p>
        <h2>Shipping costs and estimated delivery</h2>
        <p>We will confirm the applicable shipping charge and any available estimated delivery information with you after reviewing your order request and delivery address. You can review the final total and agreed shipping arrangements before making any payment. Delivery estimates are provided for guidance and may vary due to the destination, carrier operations, customs processing or other circumstances outside our control.</p>
        <h2>Before placing your order</h2>
        <p>Please make sure your shipping address and contact details are complete and accurate. Submitting an order request does not collect payment or commit you to dispatch. Please review the confirmed shipping arrangements and final total before making payment.</p>
        <div className="jq-policy-note"><strong>Need help?</strong><p>For delivery questions, email <a href="mailto:info@jinqaya.com">info@jinqaya.com</a>. For return eligibility, read our <Link href="/policies/returns-refunds">Returns &amp; Refunds Policy</Link>.</p></div>
        <p className="jq-policy-back"><Link href="/shop">CONTINUE SHOPPING ↗</Link></p>
      </article>
      <footer className="jq-footer">
        <div className="jq-footer-main">
          <div><Link className="jq-brand-logo-link" href="/" aria-label="JINQAYA home"><Image className="jq-brand-logo jq-footer-logo" src="/jinqaya-logo.png" alt="JINQAYA Premium Pet Lifestyle" width={900} height={287} /></Link><p>Life is better in good company.</p></div>
          <div className="jq-footer-links"><Link href="/shop">THE SHOP</Link><Link href="/policies/shipping">SHIPPING POLICY</Link><Link href="/policies/returns-refunds">RETURNS &amp; REFUNDS</Link></div>
          <span className="jq-footer-note">FOR CATS, DOGS<br />AND THE LIFE BETWEEN.</span>
        </div>
        <div className="jq-footer-bottom"><span>© {new Date().getFullYear()} JINQAYA. ALL RIGHTS RESERVED.</span><span>DESIGNED FOR LIFE, SHARED.</span></div>
      </footer>
    </main>
  );
}
