import Link from "next/link";
import Image from "next/image";

const socialLinks = [
  { label: "Instagram", href: "https://www.instagram.com/jinqaya/", icon: "instagram" },
  { label: "TikTok", href: "https://www.tiktok.com/@jinqaya", icon: "tiktok" },
  { label: "YouTube", href: "https://www.youtube.com/@jinqaya", icon: "youtube" },
  { label: "Facebook", href: "https://www.facebook.com/jinqaya/", icon: "facebook" },
] as const;

function SocialIcon({ name }: { name: (typeof socialLinks)[number]["icon"] }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (name === "instagram") return <svg viewBox="0 0 24 24" aria-hidden="true" {...common}><rect x="3.2" y="3.2" width="17.6" height="17.6" rx="5" /><circle cx="12" cy="12" r="4.1" /><circle cx="17.8" cy="6.5" r="1" fill="currentColor" stroke="none" /></svg>;
  if (name === "tiktok") return <svg viewBox="0 0 24 24" aria-hidden="true" {...common}><path d="M14.2 3.2v11.2a4.1 4.1 0 1 1-3.2-4V7.1a7.3 7.3 0 1 0 7.1 7.3V9.8a8.2 8.2 0 0 0 3.1.6V7.2a5.1 5.1 0 0 1-4.3-4h-2.7Z" /></svg>;
  if (name === "youtube") return <svg viewBox="0 0 24 24" aria-hidden="true" {...common}><path d="M21 7.4a2.5 2.5 0 0 0-1.8-1.8C17.6 5.2 12 5.2 12 5.2s-5.6 0-7.2.4A2.5 2.5 0 0 0 3 7.4 26 26 0 0 0 2.6 12 26 26 0 0 0 3 16.6a2.5 2.5 0 0 0 1.8 1.8c1.6.4 7.2.4 7.2.4s5.6 0 7.2-.4a2.5 2.5 0 0 0 1.8-1.8 26 26 0 0 0 .4-4.6 26 26 0 0 0-.4-4.6Z" /><path d="m10 15.3 5-3.3-5-3.3v6.6Z" fill="currentColor" stroke="none" /></svg>;
  return <svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M13.5 21v-8h2.7l.4-3.1h-3.1v-2c0-.9.3-1.5 1.6-1.5h1.7V3.6c-.3 0-1.3-.1-2.4-.1-2.4 0-4.1 1.5-4.1 4.2v2.2H7.6V13h2.7v8h3.2Z" /></svg>;
}

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
          <div className="jq-footer-social-links">
            {socialLinks.map((social) => (
              <a key={social.label} className="jq-footer-social-link" href={social.href} target="_blank" rel="noopener noreferrer" aria-label={social.label} title={social.label}>
                <SocialIcon name={social.icon} />
              </a>
            ))}
          </div>
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
