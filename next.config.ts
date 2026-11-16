import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      { protocol: "https", hostname: "images.jinqaya.com" },
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "wvoctvdwcfiioqqpfbmu.supabase.co" },
    ],
  },
};

export default nextConfig;