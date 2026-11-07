import type { Metadata } from "next";
import { OrganizationJsonLd, WebsiteJsonLd } from "@/lib/seo-jsonld";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://jinqaya.com"),
  title: {
    default: "JINQAYA | Premium Pet Lifestyle for Cats & Dogs",
    template: "%s | JINQAYA",
  },
  description:
    "Discover JINQAYA, a considered pet lifestyle collection for cats and dogs. Explore everyday essentials designed to belong in the life you share.",
  applicationName: "JINQAYA",
  alternates: { canonical: "/" },
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
    <html lang="en">
      <body>
        <OrganizationJsonLd />
        <WebsiteJsonLd />
        {children}
      </body>
    </html>
  );
}
