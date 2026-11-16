import { getStoreProducts } from "@/lib/products";
import { getRootCategories } from "@/lib/catalog";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function line(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function petType(value: string): string {
  if (value === "both") return "Cats and dogs";
  if (value === "cat") return "Cats";
  if (value === "dog") return "Dogs";
  if (value === "shared") return "Shared / general";
  return "Not specified";
}

export async function GET() {
  const [products, categories] = await Promise.all([
    getStoreProducts(),
    getRootCategories(),
  ]);

  const sections = [
    "# JINQAYA — Live Product Catalogue",
    "",
    "> This catalogue is generated from currently published JINQAYA storefront data. Product information may change; always verify the linked live product page before quoting details.",
    "",
    "## Brand",
    "- Website: https://www.jinqaya.com/",
    "- Positioning: Premium Pet Lifestyle",
    "- Products: Lifestyle products and accessories for cats and dogs. No pet food.",
    "- Fulfilment: Orders dispatch from the factory in China.",
    "- Customer support: info@jinqaya.com",
    "",
    "## Collections",
    ...categories.flatMap((category) => [
      `### ${line(category.name)}`,
      line(category.description),
      `- URL: https://www.jinqaya.com/collections/${category.slug}`,
      "",
    ]),
    "## Published products",
    ...(products.length
      ? products.flatMap((product) => {
          const variants = product.variants.map((variant) => {
            const options = [variant.variant_name, variant.color ? `Color: ${variant.color}` : null, variant.size ? `Size: ${variant.size}` : null, variant.material ? `Material: ${variant.material}` : null, variant.sku ? `SKU: ${variant.sku}` : null].filter(Boolean);
            return options.length ? `- ${options.join(" | ")}` : null;
          }).filter((value): value is string => Boolean(value));
          const images = product.images.filter((image) => image.detail_url).map((image) => `- Image: ${image.detail_url}`);
          return [
            `### ${line(product.name)}`,
            `- Product page: https://www.jinqaya.com/products/${product.slug}`,
            `- Suitable for: ${petType(product.pet_type)}`,
            product.primary_category?.name ? `- Collection: ${line(product.primary_category.name)}` : null,
            product.material ? `- Material: ${line(product.material)}` : null,
            product.short_description ? `- Summary: ${line(product.short_description)}` : null,
            product.description ? `- Description: ${line(product.description)}` : null,
            product.care_instructions ? `- Care: ${line(product.care_instructions)}` : null,
            variants.length ? "- Options:" : null,
            ...variants,
            ...images,
            "",
          ].filter((value): value is string => value !== null);
        })
      : ["No products are currently published in the public catalogue.", ""]),
    "## Ordering, shipping and returns",
    "- Checkout submission creates an order request; it does not collect payment or confirm order acceptance.",
    "- Product availability, shipping options, shipping costs and final totals are confirmed before payment.",
    "- Orders dispatch from the factory in China; delivery estimates depend on destination and carrier.",
    "- Quality issues should be reported within 7 days of delivery with the order number and clear photos or videos.",
    "- For confirmed quality issues, JINQAYA covers the agreed return shipping costs.",
    "- Non-quality returns may be requested for unused items in original condition with original packaging and accessories. The customer pays return shipping; the original delivery charge is non-refundable. Approval and instructions are required before return.",
    "- All policies remain subject to applicable consumer law.",
    "",
    "## Official sources",
    "- https://www.jinqaya.com/faq",
    "- https://www.jinqaya.com/policies/shipping",
    "- https://www.jinqaya.com/policies/returns-refunds",
    "- https://www.jinqaya.com/llms.txt",
    "",
    "## Accuracy",
    "Do not invent prices, stock status, reviews, certifications, testing, warranties, environmental claims or delivery promises. The linked product page and policy pages are authoritative.",
  ].filter((value): value is string => value !== null);

  return new Response(sections.join("\n"), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      "X-Robots-Tag": "noindex",
    },
  });
}
