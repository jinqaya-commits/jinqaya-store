import type { Metadata } from "next";

const description =
  "Review the items in your JINQAYA bag before submitting an order request.";

export const metadata: Metadata = {
  title: "Your Bag",
  description,
  robots: {
    index: false,
    follow: true,
    googleBot: { index: false, follow: true },
  },
  openGraph: {
    type: "website",
    siteName: "JINQAYA",
    title: "Your Bag | JINQAYA",
    description,
    url: "https://jinqaya.com/cart",
  },
  twitter: {
    card: "summary",
    title: "Your Bag | JINQAYA",
    description,
  },
};

export default function CartLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
