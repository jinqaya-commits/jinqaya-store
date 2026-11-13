import type { Metadata } from "next";
import { CheckoutSuccessContent } from "../success-content";

export const metadata: Metadata = {
  title: "Payment status",
  description: "Check your JINQAYA order payment confirmation.",
  robots: { index: false, follow: false },
};

export default function CheckoutSuccessPage() {
  return <CheckoutSuccessContent />;
}
