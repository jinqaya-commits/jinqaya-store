import Link from "next/link";
import Image from "next/image";

const socialLinks = [
  { label: "Instagram", href: "https://www.instagram.com/jinqaya/", icon: "instagram" },
  { label: "TikTok", href: "https://www.tiktok.com/@jinqaya", icon: "tiktok" },
  { label: "YouTube", href: "https://www.youtube.com/@jinqaya", icon: "youtube" },
  { label: "Facebook", href: "https://www.facebook.com/jinqaya/", icon: "facebook" },
] as const;

function SocialIcon({ name }: { name: (typeof socialLinks)[number]["icon"] }) {
  if (name === "instagram") return <svg viewBox="0 0 24 24" aria-hidden="true"><defs><linearGradient id="jq-instagram-gradient" x1="0%" y1="100%" x2="100%" y2="0%"><stop offset="0%" stopColor="#FEDA75" /><stop offset="48%" stopColor="#D62976" /><stop offset="100%" stopColor="#4F5BD5" /></linearGradient></defs><rect x="3" y="3" width="18" height="18" rx="5.2" fill="none" stroke="url(#jq-instagram-gradient)" strokeWidth="2.2" /><circle cx="12" cy="12" r="4.1" fill="none" stroke="#D62976" strokeWidth="2" /><circle cx="17.7" cy="6.5" r="1.25" fill="#F77737" /></svg>;
  if (name === "tiktok") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.1 3.1v11.2a4.1 4.1 0 1 1-3.2-4V7.1a7.3 7.3 0 1 0 7.1 7.3V9.8a8.2 8.2 0 0 0 3.1.6V7.2a5.1 5.1 0 0 1-4.3-4.1h-2.7Z" fill="#25F4EE" transform="translate(-1 0)" /><path d="M14.1 3.1v11.2a4.1 4.1 0 1 1-3.2-4V7.1a7.3 7.3 0 1 0 7.1 7.3V9.8a8.2 8.2 0 0 0 3.1.6V7.2a5.1 5.1 0 0 1-4.3-4.1h-2.7Z" fill="#FE2C55" transform="translate(1 0)" /><path d="M14.1 3.1v11.2a4.1 4.1 0 1 1-3.2-4V7.1a7.3 7.3 0 1 0 7.1 7.3V9.8a8.2 8.2 0 0 0 3.1.6V7.2a5.1 5.1 0 0 1-4.3-4.1h-2.7Z" fill="#111111" /></svg>;
  if (name === "youtube") return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="5" width="20" height="14" rx="4" fill="#FF0033" /><path d="m10 8.5 5.5 3.5-5.5 3.5v-7Z" fill="#FFFFFF" /></svg>;
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#1877F2" d="M24 12a12 12 0 1 0-13.9 11.9v-8.4H7.1V12h3V9.3c0-3 1.8-4.7 4.6-4.7 1.3 0 2.6.2 2.6.2v2.9h-1.5c-1.5 0-2 .9-2 1.9V12h3.4l-.5 3.5h-2.9v8.4A12 12 0 0 0 24 12Z" /></svg>;
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
