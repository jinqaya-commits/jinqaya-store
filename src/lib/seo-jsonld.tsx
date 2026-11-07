import type { StoreProduct } from "@/lib/products";

const SITE_URL = "https://jinqaya.com";

function clean(value: string | null | undefined): string | undefined {
  const normalized = value?.replace(/\s+/g, " ").trim();
  return normalized || undefined;
}

function jsonLd(data: Record<string, unknown>) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;
}

export function OrganizationJsonLd() {
  return jsonLd({
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${SITE_URL}/#organization`,
    name: "JINQAYA",
    url: SITE_URL,
    email: "info@jinqaya.com",
    description: "A pet lifestyle brand offering considered everyday essentials for cats and dogs.",
  });
}

export function WebsiteJsonLd() {
  return jsonLd({
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${SITE_URL}/#website`,
    url: SITE_URL,
    name: "JINQAYA",
    publisher: { "@id": `${SITE_URL}/#organization` },
    inLanguage: "en",
  });
}

export function ProductJsonLd({ product }: { product: StoreProduct }) {
  const imageUrls = product.images.map((image) => image.detail_url).filter((url): url is string => Boolean(url));
  const pricedVariants = product.variants.filter((variant) => variant.price !== null && Number.isFinite(variant.price));
  const currencies = [...new Set(pricedVariants.map((variant) => variant.currency))];
  const prices = pricedVariants.map((variant) => variant.price as number);
  const currency = currencies.length === 1 ? currencies[0] : undefined;
  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": `${SITE_URL}/products/${product.slug}#product`,
    name: product.name,
    description: clean(product.short_description || product.description),
    image: imageUrls.length ? imageUrls : undefined,
    sku: product.variants.length === 1 ? product.variants[0].sku : undefined,
    brand: { "@type": "Brand", name: clean(product.brand_name) || "JINQAYA" },
    material: clean(product.material),
    category: product.pet_type,
  };
  if (prices.length && currency) {
    data.offers = {
      "@type": "AggregateOffer",
      priceCurrency: currency,
      lowPrice: Math.min(...prices),
      highPrice: Math.max(...prices),
      offerCount: prices.length,
      url: `${SITE_URL}/products/${product.slug}`,
      seller: { "@id": `${SITE_URL}/#organization` },
    };
  }
  return jsonLd(data);
}

export function BreadcrumbJsonLd({ items }: { items: { name: string; path: string }[] }) {
  return jsonLd({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: `${SITE_URL}${item.path}`,
    })),
  });
}
