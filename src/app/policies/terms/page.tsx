import type { Metadata } from "next";
import Link from "next/link";
import { CartLink } from "@/components/storefront/cart-link";
import { CategoryNavigation } from "@/components/storefront/category-navigation";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Read the terms that apply when using the JINQAYA website and submitting an order request.",
};

export default function TermsOfServicePage() {
  return (
    <main className="jq-home jq-policy-page">
      <div className="jq-topline"><span>JINQAYA / A PET LIFESTYLE HOUSE</span><span>MADE FOR LIFE, SHARED</span></div>
      <header className="jq-header">
        <Link className="jq-wordmark" href="/" aria-label="JINQAYA home">JINQAYA<span>®</span></Link>
        <CategoryNavigation />
        <div className="jq-header-actions"><CartLink /></div>
      </header>
      <section className="jq-policy-hero">
        <p className="jq-kicker">CUSTOMER CARE / 04</p>
        <h1>Terms of<br /><em>service.</em></h1>
        <p>The terms that apply when you browse JINQAYA and submit an order request.</p>
      </section>
      <article className="jq-policy-content">
        <p className="jq-policy-updated">TERMS OF SERVICE</p>
        <h2>1. Using this website</h2>
        <p>By accessing or using this website, you agree to use it lawfully and not to interfere with its operation, security or other visitors’ use of the site. If you do not agree with these terms, please do not use the website.</p>
        <h2>2. Products and product information</h2>
        <p>We aim to present product descriptions, images, dimensions, materials and prices as accurately as reasonably possible. Colors and appearance may vary depending on screen settings, lighting and other factors. Please review the product information carefully and contact us with questions before submitting an order request.</p>
        <h2>3. Order requests and confirmation</h2>
        <p>Submitting the checkout form is an order request, not acceptance of an order, a completed purchase or a payment. We will review the request and confirm product availability, final pricing, shipping options and applicable charges. A purchase is confirmed only after we communicate acceptance and the agreed payment arrangements. No payment is collected through the current order-request submission form.</p>
        <h2>4. Prices, shipping and taxes</h2>
        <p>Product prices shown on the website may not include shipping charges, customs duties, import taxes or other destination-specific charges unless expressly stated. Orders are dispatched directly from our factory in China. Shipping options, costs and any available delivery estimates will be confirmed before you proceed with payment. Any customs or import charges will be handled as required by applicable law and the shipping arrangement confirmed for your order.</p>
        <h2>5. Returns and consumer rights</h2>
        <p>Our returns approach is described in the <Link href="/policies/returns-refunds">Returns &amp; Refunds Policy</Link>. Nothing in these terms or any store policy excludes, restricts or replaces consumer rights or remedies that cannot legally be excluded or restricted under the laws applicable to your purchase.</p>
        <h2>6. Website content and intellectual property</h2>
        <p>Unless otherwise stated, website text, design elements, graphics, photographs, logos and other content are owned by or used with permission by JINQAYA and may not be copied, reproduced, distributed or commercially exploited without prior permission, except as permitted by law.</p>
        <h2>7. Website availability</h2>
        <p>We may update, suspend or discontinue parts of the website from time to time. We do not guarantee uninterrupted or error-free availability, but this does not affect rights that cannot be limited under applicable law.</p>
        <h2>8. Liability</h2>
        <p>Nothing in these terms limits liability where such limitation is prohibited by law, including liability for fraud, intentional misconduct, or death or personal injury caused by negligence where applicable. Any other limitation of liability applies only to the extent permitted by the laws governing the relevant transaction.</p>
        <h2>9. Changes to these terms</h2>
        <p>We may revise these terms from time to time. Updated terms will be posted on this page. Changes will not remove rights that have already accrued or rights that cannot legally be changed.</p>
        <h2>10. Contact</h2>
        <p>For questions about these terms or an order request, email <a href="mailto:info@jinqaya.com">info@jinqaya.com</a>.</p>
        <div className="jq-policy-note"><strong>Related information</strong><p>Read our <Link href="/policies/privacy">Privacy Policy</Link>, <Link href="/policies/shipping">Shipping Policy</Link> and <Link href="/policies/returns-refunds">Returns &amp; Refunds Policy</Link>.</p></div>
      </article>
      <footer className="jq-footer">
        <div className="jq-footer-main">
          <div><Link className="jq-wordmark" href="/">JINQAYA<span>®</span></Link><p>Life is better in good company.</p></div>
          <div className="jq-footer-links"><Link href="/shop">THE SHOP</Link><Link href="/policies/shipping">SHIPPING POLICY</Link><Link href="/policies/returns-refunds">RETURNS &amp; REFUNDS</Link><Link href="/policies/privacy">PRIVACY POLICY</Link><Link href="/policies/terms">TERMS OF SERVICE</Link><Link href="/contact">CONTACT</Link><a href="mailto:info@jinqaya.com">INFO@JINQAYA.COM</a></div>
          <span className="jq-footer-note">FOR CATS, DOGS<br />AND THE LIFE BETWEEN.</span>
        </div>
        <div className="jq-footer-bottom"><span>© {new Date().getFullYear()} JINQAYA. ALL RIGHTS RESERVED.</span><span>DESIGNED FOR LIFE, SHARED.</span></div>
      </footer>
    </main>
  );
}
