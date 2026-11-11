import type { Metadata } from "next";
import { CheckoutForm } from "./checkout-form";

const description =
  "Enter your delivery details for your JINQAYA order request. Stock, shipping and the final total are confirmed before payment.";

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
    url: "https://jinqaya.com/checkout",
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
