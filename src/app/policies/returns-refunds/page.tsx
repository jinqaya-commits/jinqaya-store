import type { Metadata } from "next";
import Link from "next/link";
import { CartLink } from "@/components/storefront/cart-link";
import { CategoryNavigation } from "@/components/storefront/category-navigation";

export const metadata: Metadata = {
  title: "Returns & Refunds Policy",
  description: "Learn about JINQAYA's policy for items with confirmed quality issues.",
};

export default function ReturnsRefundsPage() {
  return (
    <main className="jq-home jq-policy-page">
      <div className="jq-topline"><span>JINQAYA / A PET LIFESTYLE HOUSE</span><span>MADE FOR LIFE, SHARED</span></div>
      <header className="jq-header">
        <Link className="jq-wordmark" href="/" aria-label="JINQAYA home">JINQAYA<span>®</span></Link>
        <CategoryNavigation />
        <div className="jq-header-actions"><CartLink /></div>
      </header>
      <section className="jq-policy-hero">
        <p className="jq-kicker">CUSTOMER CARE / 01</p>
        <h1>Returns &amp;<br /><em>refunds.</em></h1>
        <p>Our approach to returns when an item arrives with a confirmed quality issue.</p>
      </section>
      <article className="jq-policy-content">
        <p className="jq-policy-updated">RETURNS POLICY</p>
        <h2>Quality issues</h2>
        <p>We accept return requests for items with confirmed manufacturing defects or quality issues. Please contact us within 7 days of receiving your order.</p>
        <h2>How to report an issue</h2>
        <p>Before sending anything back, contact our customer service team with your order number, clear photos or videos showing the issue, and a brief description. We will review the information and confirm whether the item qualifies for a return.</p>
        <h2>Return shipping</h2>
        <p>For a confirmed quality issue, JINQAYA will cover the agreed return shipping costs. Please wait for our instructions before arranging or sending a return.</p>
        <h2>Other reasons for return</h2>
        <p>We do not offer returns or exchanges for non-quality-related reasons, such as a change of mind or personal preference, except where a return, cancellation, refund or other remedy is required by applicable consumer law.</p>
        <h2>Important information</h2>
        <p>This policy does not limit or exclude any consumer rights that cannot legally be limited or excluded in the country or region where you purchase our products.</p>
        <div className="jq-policy-note"><strong>Before placing an order</strong><p>Please review product descriptions, dimensions, images and other details carefully. If you have a question about a product or need to report a quality issue, email <a href="mailto:info@jinqaya.com">info@jinqaya.com</a>.</p></div>
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
