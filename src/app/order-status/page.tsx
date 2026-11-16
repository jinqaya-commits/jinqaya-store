import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { CartLink } from "@/components/storefront/cart-link";
import { CategoryNavigation } from "@/components/storefront/category-navigation";
import { OrderStatusLookup } from "./order-status-lookup";
import "./order-status.css";
export const metadata: Metadata = { title: "Track Your Order | JINQAYA", description: "Securely check the latest status of your JINQAYA order.", robots: { index: false, follow: false } };
export default function OrderStatusPage() {
 return <main className="jq-home jq-policy-page order-status-shell">
  <div className="jq-topline"><span>JINQAYA / A PET LIFESTYLE HOUSE</span><span>MADE FOR LIFE, SHARED</span></div>
  <header className="jq-header"><Link className="jq-brand-logo-link" href="/" aria-label="JINQAYA home"><Image className="jq-brand-logo" src="/jinqaya-logo.png" alt="JINQAYA Premium Pet Lifestyle" width={900} height={287} /></Link><CategoryNavigation/><div className="jq-header-actions"><CartLink/></div></header>
  <section className="jq-policy-hero order-status-hero"><p className="jq-kicker">CUSTOMER CARE</p><h1>Track your<br/><em>order.</em></h1><p>Check your order progress securely with your order reference and checkout email. We’ll send a one-time verification code to confirm it’s you.</p></section>
  <article className="jq-policy-content order-status-content"><OrderStatusLookup/></article>
  <footer className="jq-footer"><div className="jq-footer-main"><div><Link className="jq-brand-logo-link" href="/" aria-label="JINQAYA home"><Image className="jq-brand-logo jq-footer-logo" src="/jinqaya-logo.png" alt="JINQAYA Premium Pet Lifestyle" width={900} height={287} /></Link><p>Life is better in good company.</p></div><div className="jq-footer-links"><Link href="/shop">THE SHOP</Link><Link href="/contact">CONTACT</Link><a href="mailto:info@jinqaya.com">info@jinqaya.com</a></div><span className="jq-footer-note">FOR CATS, DOGS<br/>AND THE LIFE BETWEEN.</span></div></footer>
 </main>;
}