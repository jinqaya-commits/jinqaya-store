import type { Metadata } from "next";
import { CartContent } from "@/components/storefront/cart-content";

export const metadata: Metadata = {
  title: "Your Bag",
  description: "Review the items in your JINQAYA bag.",
  robots: {
    index: false,
    follow: false,
    googleBot: { index: false, follow: false },
  },
};

export default function CartPage() {
  return <CartContent />;
}
