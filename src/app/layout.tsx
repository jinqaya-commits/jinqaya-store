import type { Metadata } from "next";
import { Cormorant_Garamond, Inter } from "next/font/google";
import { OrganizationJsonLd, WebsiteJsonLd } from "@/lib/seo-jsonld";
import "./globals.css";
import "./brand-overrides.css";

const displayFont = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-display",
  display: "swap",
});

const bodyFont = Inter({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://jinqaya.com"),
  title: {
    default: "JINQAYA | Premium Pet Lifestyle for Cats & Dogs",
    template: "%s | JINQAYA",
  },
  description:
    "Discover JINQAYA, a considered pet lifestyle collection for cats and dogs. Explore everyday essentials designed to belong in the life you share.",
  applicationName: "JINQAYA",
  icons: {
    icon: [{ url: "/brand/jinqaya-icon.svg", type: "image/svg+xml" }],
    shortcut: "/brand/jinqaya-icon.svg",
    apple: "/brand/jinqaya-icon.svg",
  },
  openGraph: {
    type: "website",
    siteName: "JINQAYA",
    title: "JINQAYA | Premium Pet Lifestyle for Cats & Dogs",
    description: "Considered everyday essentials for the life you share with cats and dogs.",
    url: "https://jinqaya.com/",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "JINQAYA | Premium Pet Lifestyle for Cats & Dogs",
    description: "Considered everyday essentials for the life you share with cats and dogs.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${displayFont.variable} ${bodyFont.variable}`}>
      <body>
        <OrganizationJsonLd />
        <WebsiteJsonLd />
        {children}
      </body>
    </html>
  );
}
