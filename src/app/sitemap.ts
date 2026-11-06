import type { MetadataRoute } from "next";
import { createClient } from "@/lib/supabase/server";
import { getStoreProducts } from "@/lib/products";

const siteUrl = "https://jinqaya.com";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = await createClient();
  const { data: categories } = await supabase.from("categories")
    .select("slug").eq("is_active", true);
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: siteUrl, changeFrequency: "weekly", priority: 1 },
    { url: `${siteUrl}/shop`, changeFrequency: "daily", priority: 0.9 },
    ...(categories ?? []).map((category) => ({
      url: `${siteUrl}/collections/${category.slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
  ];

  const products = await getStoreProducts();
  const productRoutes: MetadataRoute.Sitemap = products.map((product) => ({
    url: `${siteUrl}/products/${product.slug}`,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  return [...staticRoutes, ...productRoutes];
}
