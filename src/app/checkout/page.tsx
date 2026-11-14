import type { Metadata } from "next";
import { CheckoutForm } from "./checkout-form";

const description =
  "Secure checkout for JINQAYA. Confirm your delivery details, review shipping and pay securely with PayPal.";

export const metadata: Metadata = {
  title: "Checkout",
  description,
  robots: {
    index: false,
    follow: true,
    googleBot: { index: false, follow: true },
  },
  openGraph: {
    type: "website",
    siteName: "JINQAYA",
    title: "Checkout | JINQAYA",
    description,
    url: "https://www.jinqaya.com/checkout",
  },
  twitter: {
    card: "summary",
    title: "Checkout | JINQAYA",
    description,
  },
};

export default function CheckoutPage() {
  return <CheckoutForm />;
}
