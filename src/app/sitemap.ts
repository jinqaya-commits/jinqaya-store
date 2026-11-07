import type { MetadataRoute } from "next";
import { createClient } from "@/lib/supabase/server";
import { getStoreProducts } from "@/lib/products";

const siteUrl = "https://jinqaya.com";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = await createClient();
  const [{ data: categories }, products, { data: activeProducts }] = await Promise.all([
    supabase.from("categories").select("id,parent_id,slug").eq("is_active", true),
    getStoreProducts(),
    supabase.from("products").select("id").eq("status", "active"),
  ]);

  const activeProductIds = (activeProducts ?? []).map((product) => product.id);
  let assignedCategoryIds = new Set<string>();
  if (activeProductIds.length) {
    const { data: assignments } = await supabase
      .from("product_categories")
      .select("category_id")
      .in("product_id", activeProductIds);
    assignedCategoryIds = new Set((assignments ?? []).map((row) => row.category_id));
  }

  const categoryRows = categories ?? [];
  const indexableCategories = categoryRows.filter((category) => {
    const subtree = new Set<string>([category.id]);
    let frontier = [category.id];
    while (frontier.length) {
      const children = categoryRows
        .filter((row) => row.parent_id && frontier.includes(row.parent_id))
        .map((row) => row.id);
      children.forEach((id) => subtree.add(id));
      frontier = children;
    }
    return [...subtree].some((id) => assignedCategoryIds.has(id));
  });

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: siteUrl, changeFrequency: "weekly", priority: 1 },
    { url: `${siteUrl}/shop`, changeFrequency: "daily", priority: 0.9 },
    { url: `${siteUrl}/about`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${siteUrl}/contact`, changeFrequency: "yearly", priority: 0.4 },
    { url: `${siteUrl}/policies/shipping`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${siteUrl}/policies/returns-refunds`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${siteUrl}/policies/privacy`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${siteUrl}/policies/terms`, changeFrequency: "yearly", priority: 0.2 },
    ...indexableCategories.map((category) => ({
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
