import Link from "next/link";
import Image from "next/image";

const socialLinks = [
  { label: "Instagram", href: "https://www.instagram.com/jinqaya/" },
  { label: "TikTok", href: "https://www.tiktok.com/@jinqaya" },
  { label: "YouTube", href: "https://www.youtube.com/@jinqaya" },
  { label: "Facebook", href: "https://www.facebook.com/jinqaya/" },
];

export function SiteFooter() {
  return (
    <footer className="jq-footer">
      <div className="jq-footer-main">
        <div className="jq-footer-brand">
          <Link className="jq-brand-logo-link" href="/" aria-label="JINQAYA home">
            <Image className="jq-brand-logo jq-footer-logo" src="/jinqaya-logo.png" alt="JINQAYA Premium Pet Lifestyle" width={900} height={287} />
          </Link>
          <p>Thoughtful essentials for the life we share with cats and dogs.</p>
          <a className="jq-footer-email" href="mailto:info@jinqaya.com">INFO@JINQAYA.COM <span>↗</span></a>
          <a className="jq-footer-email" href="https://wa.me/8613247615836" target="_blank" rel="noopener noreferrer">WHATSAPP <span>↗</span></a>
        </div>
        <nav className="jq-footer-group" aria-label="Explore">
          <h2>EXPLORE</h2>
          <Link href="/shop">The shop</Link>
          <Link href="/collections">Collections</Link>
          <Link href="/about">About JINQAYA</Link>
          <Link href="/order-status">Track your order</Link>
          <Link href="/account">My account</Link>
        </nav>
        <nav className="jq-footer-group" aria-label="Customer care">
          <h2>CUSTOMER CARE</h2>
          <Link href="/contact">Contact us</Link>
          <Link href="/faq">Frequently asked questions</Link>
          <Link href="/policies/shipping">Shipping</Link>
          <Link href="/policies/returns-refunds">Returns &amp; refunds</Link>
        </nav>
        <nav className="jq-footer-group jq-footer-social" aria-label="Follow JINQAYA">
          <h2>FOLLOW US</h2>
          {socialLinks.map((social) => (
            <a key={social.label} href={social.href} target="_blank" rel="noopener noreferrer">{social.label} <span>↗</span></a>
          ))}
          <Link href="/policies/privacy">Privacy policy</Link>
          <Link href="/policies/terms">Terms of service</Link>
        </nav>
      </div>
      <div className="jq-footer-bottom">
        <span>© {new Date().getFullYear()} JINQAYA. ALL RIGHTS RESERVED.</span>
        <span>FOR CATS, DOGS &amp; THE LIFE BETWEEN.</span>
        <Link href="/">BACK TO TOP ↑</Link>
      </div>
    </footer>
  );
}
