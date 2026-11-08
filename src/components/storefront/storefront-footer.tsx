import Link from "next/link";

export function StorefrontFooter() {
  return (
    <footer className="jq-footer">
      <div className="jq-footer-main">
        <div>
          <Link className="jq-wordmark" href="/">JINQAYA<span>®</span></Link>
          <p>Life is better in good company.</p>
        </div>
        <nav className="jq-footer-links" aria-label="Footer navigation">
          <Link href="/shop">THE SHOP</Link>
          <Link href="/policies/shipping">SHIPPING POLICY</Link>
          <Link href="/policies/returns-refunds">RETURNS &amp; REFUNDS</Link>
          <Link href="/policies/privacy">PRIVACY POLICY</Link>
          <Link href="/policies/terms">TERMS OF SERVICE</Link>
          <Link href="/contact">CONTACT</Link>
          <a href="mailto:info@jinqaya.com">INFO@JINQAYA.COM</a>
        </nav>
        <span className="jq-footer-note">FOR CATS, DOGS<br />AND THE LIFE BETWEEN.</span>
      </div>
      <div className="jq-footer-bottom">
        <span>© {new Date().getFullYear()} JINQAYA. ALL RIGHTS RESERVED.</span>
        <span>DESIGNED FOR LIFE, SHARED.</span>
      </div>
    </footer>
  );
}
