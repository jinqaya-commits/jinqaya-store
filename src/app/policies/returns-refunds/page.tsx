import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { CartLink } from "@/components/storefront/cart-link";
import { CategoryNavigation } from "@/components/storefront/category-navigation";

export const metadata: Metadata = {
  alternates: { canonical: "/policies/returns-refunds" },

  title: "Returns & Refunds Policy",
  description: "Learn how to request a return for quality and non-quality reasons, and how refunds and return shipping are handled.",
};

export default function ReturnsRefundsPage() {
  return (
    <main className="jq-home jq-policy-page">
      <div className="jq-topline"><span>JINQAYA / A PET LIFESTYLE HOUSE</span><span>MADE FOR LIFE, SHARED</span></div>
      <header className="jq-header">
        <Link className="jq-brand-logo-link" href="/" aria-label="JINQAYA home"><Image className="jq-brand-logo" src="/jinqaya-logo.png" alt="JINQAYA Premium Pet Lifestyle" width={900} height={287} /></Link>
        <CategoryNavigation />
        <div className="jq-header-actions"><CartLink /></div>
      </header>
      <section className="jq-policy-hero">
        <p className="jq-kicker">CUSTOMER CARE / 01</p>
        <h1>Returns &amp;<br /><em>refunds.</em></h1>
        <p>Our return options for both quality-related and personal-preference returns.</p>
      </section>
      <article className="jq-policy-content">
        <p className="jq-policy-updated">RETURNS POLICY</p>
        <h2>Quality issues</h2>
        <p>If an item arrives with a manufacturing defect or other confirmed quality issue, contact us within 7 days of receiving your order. Include your order number, a description of the issue, and clear photos or videos so we can review your request.</p>
        <h2>How to report an issue</h2>
        <p>Before sending anything back, contact our customer service team with your order number, clear photos or videos showing the issue, and a brief description. We will review the information and confirm whether the item qualifies for a return.</p>
        <h2>Return shipping</h2>
        <p>For a confirmed quality issue, JINQAYA will cover the agreed return shipping costs. Please wait for our instructions before arranging or sending a return.</p>
        <h2>Other reasons for return</h2>
        <p>You may request a return for a non-quality reason, such as a change of mind or personal preference. The item must be unused, in its original condition, and returned with its original packaging and included accessories. You are responsible for the return shipping cost. The original shipping charge paid to deliver the order is non-refundable. Please contact us for approval and return instructions before sending anything back. Any request remains subject to applicable consumer law.</p>
        <h2>Refunds</h2>
        <p>Once an approved return is received and inspected, we will notify you of the outcome and, if approved, arrange the applicable refund to the original payment method where possible. Any refund will be handled in accordance with applicable consumer law.</p>
        <h2>Important information</h2>
        <p>This policy does not limit or exclude any consumer rights that cannot legally be limited or excluded in the country or region where you purchase our products.</p>
        <div className="jq-policy-note"><strong>Before placing an order</strong><p>Please review product descriptions, dimensions, images and other details carefully. If you have a question about a product or need to report a quality issue, email <a href="mailto:info@jinqaya.com">info@jinqaya.com</a>.</p></div>
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
