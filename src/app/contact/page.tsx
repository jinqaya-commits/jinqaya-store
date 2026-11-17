import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { CartLink } from "@/components/storefront/cart-link";
import { CategoryNavigation } from "@/components/storefront/category-navigation";
import { InquiryForm } from "@/components/storefront/inquiry-form";
import { getStoreProductBySlug } from "@/lib/products";

export const metadata: Metadata = {
  alternates: { canonical: "/contact" },
  openGraph: { type: "website", url: "https://www.jinqaya.com/contact", title: "Contact JINQAYA", description: "Contact JINQAYA for product, order and customer care questions." },
  title: "Contact JINQAYA",
  description: "Get in touch with JINQAYA for product, order and customer care questions.",
};

export default async function ContactPage({ searchParams }: { searchParams: Promise<{ product?: string }> }) {
  const params = await searchParams;
  const product = params.product ? await getStoreProductBySlug(params.product) : null;

  return (
    <main className="jq-home jq-policy-page jq-contact-page">
      <div className="jq-topline"><span>JINQAYA / A PET LIFESTYLE HOUSE</span><span>MADE FOR LIFE, SHARED</span></div>
      <header className="jq-header">
        <Link className="jq-brand-logo-link" href="/" aria-label="JINQAYA home"><Image className="jq-brand-logo jq-inner-logo" src="/jinqaya-logo.png" alt="JINQAYA Premium Pet Lifestyle" width={900} height={287} /></Link>
        <CategoryNavigation />
        <div className="jq-header-actions"><CartLink /></div>
      </header>

      <section className="jq-contact-hero">
        <p className="jq-kicker">CUSTOMER CARE / CONTACT</p>
        <h1>Let’s talk about<br /><em>the little things.</em></h1>
        <p>Whether you have a question about a product, an order or life with your pet, we’re happy to help.</p>
      </section>

      <section className="jq-contact-layout">
        <aside className="jq-contact-sidebar">
          <p className="jq-kicker">GET IN TOUCH</p>
          <h2>A real person<br />is here to help.</h2>
          <p className="jq-contact-intro">Choose the way that works best for you. For order enquiries, please include your order number so we can help faster.</p>

          <div className="jq-contact-method">
            <span className="jq-contact-method-label">EMAIL SUPPORT</span>
            <a className="jq-contact-method-link" href="mailto:info@jinqaya.com">info@jinqaya.com <span>↗</span></a>
            <p>For email support, write to us anytime. We’ll get back to you by email.</p>
          </div>

          <div className="jq-contact-method jq-contact-whatsapp">
            <span className="jq-contact-method-label">WHATSAPP / ONLINE CHAT</span>
            <a className="jq-contact-method-link" href="https://wa.me/8613247615836" target="_blank" rel="noopener noreferrer">Chat with us on WhatsApp <span>↗</span></a>
            <p>Prefer to chat? Message our team directly: <a href="https://wa.me/8613247615836" target="_blank" rel="noopener noreferrer">+86 132 4761 5836</a>.</p>
          </div>

          <div className="jq-contact-help">
            <span className="jq-contact-method-label">NEED A QUICK ANSWER?</span>
            <p>Visit our <Link href="/faq">Frequently Asked Questions</Link> for helpful information about orders, shipping and returns.</p>
          </div>
        </aside>

        <div className="jq-contact-form-panel">
          <p className="jq-kicker">SEND US A MESSAGE</p>
          <h2>How can we help?</h2>
          <p className="jq-contact-form-intro">Fill in the form below and our team will reply by email.</p>
          <InquiryForm productId={product?.id || null} productName={product?.name || null} />
        </div>
      </section>

      <div className="jq-contact-policy-links">
        <span>YOU MAY ALSO FIND THESE HELPFUL</span>
        <p><Link href="/policies/shipping">Shipping Policy</Link><Link href="/policies/returns-refunds">Returns &amp; Refunds</Link><Link href="/policies/privacy">Privacy Policy</Link><Link href="/policies/terms">Terms of Service</Link></p>
      </div>

      <footer className="jq-footer">
        <div className="jq-footer-main">
          <div><Link className="jq-wordmark" href="/">JINQAYA<span>®</span></Link><p>Life is better in good company.</p></div>
          <div className="jq-footer-links"><Link href="/shop">THE SHOP</Link><Link href="/policies/shipping">SHIPPING POLICY</Link><Link href="/policies/returns-refunds">RETURNS &amp; REFUNDS</Link><Link href="/policies/privacy">PRIVACY POLICY</Link><Link href="/policies/terms">TERMS OF SERVICE</Link><Link href="/contact">CONTACT</Link><a href="mailto:info@jinqaya.com">info@jinqaya.com</a></div>
          <span className="jq-footer-note">FOR CATS, DOGS<br />AND THE LIFE BETWEEN.</span>
        </div>
        <div className="jq-footer-bottom"><span>© {new Date().getFullYear()} JINQAYA. ALL RIGHTS RESERVED.</span><span>DESIGNED FOR LIFE, SHARED.</span></div>
      </footer>
    </main>
  );
}
