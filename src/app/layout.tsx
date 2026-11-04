import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://jinqaya.com"),
  title: {
    default: "JINQAYA | Better Living, Together.",
    template: "%s | JINQAYA",
  },
  description:
    "Thoughtfully chosen lifestyle essentials for cats and dogs. Better Living, Together.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}