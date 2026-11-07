import type { MetadataRoute } from "next";
import { createClient } from "@/lib/supabase/server";
import { getStoreProducts } from "@/lib/products";

const siteUrl = "https://jinqaya.com";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = await createClient();
  const [{ data: categories }, products] = await Promise.all([
    supabase.from("categories").select("slug").eq("is_active", true),
    getStoreProducts(),
  ]);

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: siteUrl, changeFrequency: "weekly", priority: 1 },
    { url: `${siteUrl}/shop`, changeFrequency: "daily", priority: 0.9 },
    { url: `${siteUrl}/about`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${siteUrl}/contact`, changeFrequency: "yearly", priority: 0.4 },
    { url: `${siteUrl}/policies/shipping`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${siteUrl}/policies/returns-refunds`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${siteUrl}/policies/privacy`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${siteUrl}/policies/terms`, changeFrequency: "yearly", priority: 0.2 },
    ...(categories ?? []).map((category) => ({
      url: `${siteUrl}/collections/${category.slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
  ];

  const productRoutes: MetadataRoute.Sitemap = products.map((product) => ({
    url: `${siteUrl}/products/${product.slug}`,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  return [...staticRoutes, ...productRoutes];
}
