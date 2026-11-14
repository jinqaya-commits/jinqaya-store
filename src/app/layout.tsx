import type { Metadata } from "next";
import { OrganizationJsonLd, WebsiteJsonLd } from "@/lib/seo-jsonld";
import { VisitorAnalytics } from "@/components/storefront/visitor-analytics";
import { LiveChatWidget } from "@/components/storefront/live-chat-widget";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.jinqaya.com"),
  title: {
    default: "JINQAYA | Premium Pet Lifestyle for Cats & Dogs",
    template: "%s | JINQAYA",
  },
  description:
    "Discover JINQAYA, a considered pet lifestyle collection for cats and dogs. Explore everyday essentials designed to belong in the life you share.",
  applicationName: "JINQAYA",
  icons: {
    icon: [{ url: "/jinqaya-favicon.png", type: "image/png" }],
    shortcut: ["/jinqaya-favicon.png"],
    apple: [{ url: "/jinqaya-favicon.png", type: "image/png" }],
  },
  openGraph: {
    type: "website",
    siteName: "JINQAYA",
    title: "JINQAYA | Premium Pet Lifestyle for Cats & Dogs",
    description: "Considered everyday essentials for the life you share with cats and dogs.",
    url: "https://www.jinqaya.com/",
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
        <VisitorAnalytics />
        <LiveChatWidget />
        {process.env.VERCEL_ENV === "preview" ? (
          <div
            role="status"
            aria-label="Preview test environment"
            style={{
              background: "#fff4d6",
              borderBottom: "1px solid #e7c66b",
              color: "#654b12",
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: "0.04em",
              padding: "9px 16px",
              textAlign: "center",
            }}
          >
            PREVIEW · TEST ENVIRONMENT — Orders, customers, products, payments and inventory here are test data, not live business records.
          </div>
        ) : null}
        {children}
      </body>
    </html>
  );
}
