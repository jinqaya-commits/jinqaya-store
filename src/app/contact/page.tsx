import type { Metadata } from "next";
import Link from "next/link";
import { CartLink } from "@/components/storefront/cart-link";
import { CategoryNavigation } from "@/components/storefront/category-navigation";
import { StorefrontFooter } from "@/components/storefront/storefront-footer";

export const metadata: Metadata = {
  alternates: { canonical: "/contact" },
  openGraph: { type: "website", url: "https://jinqaya.com/contact", title: "Contact JINQAYA", description: "Contact JINQAYA for product, order and customer care questions." },

  title: "Contact JINQAYA",
  description: "Get in touch with JINQAYA for product, order and customer care questions.",
};

export default function ContactPage() {
  return (
    <main className="jq-home jq-policy-page">
      <div className="jq-topline"><span>JINQAYA / A PET LIFESTYLE HOUSE</span><span>MADE FOR LIFE, SHARED</span></div>
      <header className="jq-header">
        <Link className="jq-wordmark" href="/" aria-label="JINQAYA home">JINQAYA<span>®</span></Link>
        <CategoryNavigation />
        <div className="jq-header-actions"><CartLink /></div>
      </header>
      <section className="jq-policy-hero">
        <p className="jq-kicker">CUSTOMER CARE / 05</p>
        <h1>We’re here<br /><em>to help.</em></h1>
        <p>Questions about a product, an order request or a delivery? We’d be happy to hear from you.</p>
      </section>
      <article className="jq-policy-content">
        <p className="jq-policy-updated">CONTACT JINQAYA</p>
        <h2>Customer enquiries</h2>
        <p>For product information, order enquiries, delivery questions or general support, please email our team.</p>
        <div className="jq-policy-note">
          <strong>Email us</strong>
          <p><a href="mailto:info@jinqaya.com">info@jinqaya.com</a></p>
          <p>Please include your order number if your message relates to an existing order. For a product quality issue, include clear photos or videos and contact us within 7 days of receiving your order.</p>
        </div>
        <h2>Before contacting us</h2>
        <p>You may also find the information you need in our <Link href="/policies/shipping">Shipping Policy</Link>, <Link href="/policies/returns-refunds">Returns &amp; Refunds Policy</Link>, <Link href="/policies/privacy">Privacy Policy</Link> and <Link href="/policies/terms">Terms of Service</Link>.</p>
        <p className="jq-policy-back"><Link href="/shop">CONTINUE SHOPPING ↗</Link></p>
      </article>
      <StorefrontFooter />    </main>
  );
}
