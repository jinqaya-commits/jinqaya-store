import Link from "next/link";
import { StorefrontHeader } from "@/components/storefront/storefront-header";
import { OrderStatusLookup } from "./order-status-lookup";

export const metadata = {
  title: "Track Your Order | JINQAYA",
  description: "Securely check the latest status of your JINQAYA order.",
  robots: { index: false, follow: false },
};

export default function OrderStatusPage() {
  return (
    <main className="inner-page">
      <StorefrontHeader />
      <section className="checkout-page order-status-page">
        <p className="eyebrow">CUSTOMER CARE</p>
        <h1>Track your order</h1>
        <p className="checkout-intro">Check your order progress securely with your order reference and checkout email. We’ll send a one-time verification code to confirm it’s you.</p>
        <OrderStatusLookup />
      </section>
      <footer className="inner-footer"><Link href="/">JINQAYA</Link><span>BETTER LIVING, TOGETHER.</span></footer>
    </main>
  );
}
