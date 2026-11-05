import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin/", "/login", "/api/"],
    },
    sitemap: "https://jinqaya.com/sitemap.xml",
    host: "https://jinqaya.com",
  };
}
