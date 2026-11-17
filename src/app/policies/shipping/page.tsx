import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { CartLink } from "@/components/storefront/cart-link";
import { CategoryNavigation } from "@/components/storefront/category-navigation";
import { SiteFooter } from "@/components/storefront/site-footer";
import { SiteFooter } from "@/components/storefront/site-footer";

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
        <p>Available destinations and delivery options depend on the delivery address and the items in your order. The checkout page will show the shipping charge applicable to your order before you complete payment.</p>
        <h2>Shipping costs and estimated delivery</h2>
        <p>Shipping costs are calculated based on your order and delivery destination. The applicable shipping charge and final order total are displayed at checkout before payment. If a destination or order requires a separately arranged shipping quote, we will confirm the cost and available delivery estimate before asking you to pay. Delivery estimates may vary due to the destination, carrier operations, customs processing or other circumstances outside our control.</p>
        <h2>Before placing your order</h2>
        <p>Please make sure your shipping address and contact details are complete and accurate. Review the shipping charge and final order total shown at checkout before completing payment.</p>
        <div className="jq-policy-note"><strong>Need help?</strong><p>For delivery questions, email <a href="mailto:info@jinqaya.com">info@jinqaya.com</a>. For return eligibility, read our <Link href="/policies/returns-refunds">Returns &amp; Refunds Policy</Link>.</p></div>
        <p className="jq-policy-back"><Link href="/shop">CONTINUE SHOPPING ↗</Link></p>
      </article>
      <SiteFooter />
    </main>
  );
}
