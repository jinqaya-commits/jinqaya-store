import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { CartLink } from "@/components/storefront/cart-link";
import { CategoryNavigation } from "@/components/storefront/category-navigation";

export const metadata: Metadata = {
  title: "Frequently Asked Questions",
  description: "Answers about JINQAYA order requests, payment, shipping, product information and returns.",
  alternates: { canonical: "/faq" },
  openGraph: { type: "website", url: "https://www.jinqaya.com/faq", title: "Frequently Asked Questions | JINQAYA", description: "Find answers about JINQAYA orders, shipping, payment and customer care." },
};

const groups = [
  { title: "Orders & payment", questions: [
    { question: "Does submitting an order request charge me?", answer: "No. Submitting an order request does not collect payment. We first review stock availability, shipping options and the final total with you. Payment is arranged only after those details have been confirmed." },
    { question: "What happens after I submit my order request?", answer: "We review the items and delivery details you submitted, then contact you to confirm availability, shipping options and the final amount. Your request is not yet a paid order or a dispatch confirmation." },
    { question: "Can I change my request after submitting it?", answer: "Please contact us as soon as possible at info@jinqaya.com and include your order number. We will check whether the requested change can still be made." },
  ]},
  { title: "Shipping & delivery", questions: [
    { question: "Where do JINQAYA orders ship from?", answer: "Orders are dispatched directly from our factory in China. We do not dispatch orders from local warehouses in the destination country." },
    { question: "Which countries do you ship to, and how much does shipping cost?", answer: "Available destinations, shipping methods and costs are checked for each order request. We confirm the options and applicable charge for your delivery address before you make any payment." },
    { question: "How long will delivery take?", answer: "Any available delivery estimate is confirmed with your shipping options after we review your order and destination. Estimates can vary with the carrier, customs processing and other circumstances outside our control." },
  ]},
  { title: "Products & care", questions: [
    { question: "Where can I find product materials, sizes and care information?", answer: "Please check the individual product page. Product details are shown when that information is available for the specific item. If you need clarification, contact us and include the product name or link." },
    { question: "Are all product options always available?", answer: "Availability can change. We confirm the selected item and option when reviewing your order request, before asking you to make payment." },
  ]},
  { title: "Returns & support", questions: [
    { question: "What if my item arrives with a quality issue?", answer: "Contact us within 7 days of receiving your order with your order number, a short description and clear photos or videos of the issue. We will review the information and confirm the next steps. Please do not send an item back before receiving our instructions." },
    { question: "Can I return an item if I change my mind?", answer: "Our policy does not offer returns or exchanges for non-quality-related reasons, such as a change of mind or personal preference, except where a remedy is required by applicable consumer law. Please read the Returns & Refunds Policy for full details." },
    { question: "How can I contact JINQAYA?", answer: "Email info@jinqaya.com or use our contact form. For an existing order, include your order number so we can identify your request." },
  ]},
] as const;

export default function FAQPage() {
  return (
    <main className="jq-home jq-policy-page">
      <div className="jq-topline"><span>JINQAYA / A PET LIFESTYLE HOUSE</span><span>MADE FOR LIFE, SHARED</span></div>
      <header className="jq-header">
        <Link className="jq-brand-logo-link" href="/" aria-label="JINQAYA home"><Image className="jq-brand-logo" src="/jinqaya-logo.png" alt="JINQAYA Premium Pet Lifestyle" width={900} height={287} /></Link>
        <CategoryNavigation />
        <div className="jq-header-actions"><CartLink /></div>
      </header>
      <section className="jq-policy-hero">
        <p className="jq-kicker">CUSTOMER CARE / 04</p>
        <h1>Good to<br /><em>know.</em></h1>
        <p>A few helpful answers about shopping with JINQAYA.</p>
      </section>
      <article className="jq-policy-content">
        <p className="jq-policy-updated">FREQUENTLY ASKED QUESTIONS</p>
        {groups.map((group) => (
          <section className="jq-faq-group" key={group.title} aria-label={group.title}>
            <h2>{group.title}</h2>
            {group.questions.map((item) => (
              <details className="jq-faq-item" key={item.question}>
                <summary>{item.question}</summary>
                <p>{item.answer}</p>
              </details>
            ))}
          </section>
        ))}
        <div className="jq-policy-note">
          <strong>Still have a question?</strong>
          <p>We’re happy to help. Email <a href="mailto:info@jinqaya.com">info@jinqaya.com</a> or <Link href="/contact">send us an enquiry</Link>.</p>
        </div>
        <p className="jq-policy-back"><Link href="/shop">CONTINUE SHOPPING ↗</Link></p>
      </article>
      <footer className="jq-footer">
        <div className="jq-footer-main">
          <div><Link className="jq-brand-logo-link" href="/" aria-label="JINQAYA home"><Image className="jq-brand-logo jq-footer-logo" src="/jinqaya-logo.png" alt="JINQAYA Premium Pet Lifestyle" width={900} height={287} /></Link><p>Life is better in good company.</p></div>
          <div className="jq-footer-links">
            <Link href="/shop">THE SHOP</Link><Link href="/faq">FAQ</Link>
            <Link href="/policies/shipping">SHIPPING POLICY</Link><Link href="/policies/returns-refunds">RETURNS &amp; REFUNDS</Link>
            <Link href="/policies/privacy">PRIVACY POLICY</Link><Link href="/policies/terms">TERMS OF SERVICE</Link>
            <Link href="/contact">CONTACT</Link><a href="mailto:info@jinqaya.com">info@jinqaya.com</a>
          </div>
          <span className="jq-footer-note">FOR CATS, DOGS<br />AND THE LIFE BETWEEN.</span>
        </div>
        <div className="jq-footer-bottom"><span>© {new Date().getFullYear()} JINQAYA. ALL RIGHTS RESERVED.</span><span>DESIGNED FOR LIFE, SHARED.</span></div>
      </footer>
    </main>
  );
}
