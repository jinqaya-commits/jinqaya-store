import type { Metadata } from "next";
import Link from "next/link";
import { CartLink } from "@/components/storefront/cart-link";
import { CategoryNavigation } from "@/components/storefront/category-navigation";

export const metadata: Metadata = {
  alternates: { canonical: "/policies/privacy" },

  title: "Privacy Policy",
  description: "Learn how JINQAYA handles personal information submitted through our website.",
};

export default function PrivacyPolicyPage() {
  return (
    <main className="jq-home jq-policy-page">
      <div className="jq-topline"><span>JINQAYA / A PET LIFESTYLE HOUSE</span><span>MADE FOR LIFE, SHARED</span></div>
      <header className="jq-header">
        <Link className="jq-wordmark" href="/" aria-label="JINQAYA home">JINQAYA<span>®</span></Link>
        <CategoryNavigation />
        <div className="jq-header-actions"><CartLink /></div>
      </header>
      <section className="jq-policy-hero">
        <p className="jq-kicker">CUSTOMER CARE / 03</p>
        <h1>Your privacy<br /><em>matters.</em></h1>
        <p>A clear explanation of the information used when you browse or contact JINQAYA through this website.</p>
      </section>
      <article className="jq-policy-content">
        <p className="jq-policy-updated">PRIVACY POLICY</p>
        <h2>1. Information we collect</h2>
        <p>When you submit an order request, we collect the information you provide, which may include your name, email address, phone number, shipping address, order details and any note you choose to send. We may also receive information you provide when contacting us about a product or an order.</p>
        <h2>2. How we use information</h2>
        <p>We use submitted information to process and review order requests, check product availability, confirm shipping options and costs, communicate with you, provide customer support, and operate and improve our website.</p>
        <h2>3. Sharing with service providers</h2>
        <p>We may share information with service providers that help us host and operate the website, store and process order requests, maintain website functionality, or arrange delivery. We do not authorize these providers to use the information for their own unrelated purposes. We may also disclose information when required by law or to protect our legal rights.</p>
        <h2>4. International processing</h2>
        <p>JINQAYA orders are dispatched from China. Depending on where you live and which services support the website, information may be processed or accessed in countries other than your own. Where required, we take steps intended to provide appropriate safeguards for such transfers.</p>
        <h2>5. Cookies and similar technologies</h2>
        <p>Our website may use cookies or similar technologies that are necessary for core website functions, such as maintaining a session or supporting site security. Your browser may also store locally the items you add to your shopping bag. You can manage cookies through your browser settings, although disabling some technologies may affect website functionality.</p>
        <h2>6. Data retention and security</h2>
        <p>We retain personal information for as long as reasonably necessary for the purposes described in this policy, including order administration, customer support, record keeping and legal obligations. We use reasonable measures designed to protect information, but no method of transmission or storage can be guaranteed to be completely secure.</p>
        <h2>7. Your privacy rights</h2>
        <p>Depending on your location, you may have rights to request access to, correction of, deletion of, or a copy of your personal information, or to object to or restrict certain processing. You may also have the right to withdraw consent where processing is based on consent. These rights are subject to applicable law and its exceptions.</p>
        <h2>8. Children’s privacy</h2>
        <p>This website is intended for a general audience and is not directed to children. We do not knowingly seek to collect personal information directly from children in circumstances where parental consent is required.</p>
        <h2>9. Changes to this policy</h2>
        <p>We may update this policy from time to time. The revised version will be posted on this page with its updated effective date where applicable.</p>
        <h2>10. Contact</h2>
        <p>If you have a question or privacy request, email <a href="mailto:info@jinqaya.com">info@jinqaya.com</a>.</p>
        <div className="jq-policy-note"><strong>Related information</strong><p>Read our <Link href="/policies/terms">Terms of Service</Link>, <Link href="/policies/shipping">Shipping Policy</Link> and <Link href="/policies/returns-refunds">Returns &amp; Refunds Policy</Link>.</p></div>
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
