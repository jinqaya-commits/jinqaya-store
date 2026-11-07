import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getStoreProductBySlug, formatProductPrice } from "@/lib/products";
import { ProductGallery } from "@/components/storefront/product-gallery";
import { AddToCart } from "@/components/storefront/add-to-cart";
import { CartLink } from "@/components/storefront/cart-link";
import { CategoryNavigation } from "@/components/storefront/category-navigation";
import { BreadcrumbJsonLd, ProductJsonLd } from "@/lib/seo-jsonld";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const product = await getStoreProductBySlug(slug);
  if (!product) return { title: "Product Not Found" };
  return {
    title: product.seo_title || product.name,
    description: product.seo_description || product.short_description || product.description || undefined,
    alternates: { canonical: `/products/${product.slug}` },
    openGraph: {
      type: "website",
      title: product.seo_title || product.name,
      description: product.seo_description || product.short_description || product.description || undefined,
      url: `https://jinqaya.com/products/${product.slug}`,
      images: product.images.filter((image) => image.detail_url).slice(0, 4).map((image) => ({ url: image.detail_url as string, alt: image.alt_text || product.name })),
    },
  };
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const product = await getStoreProductBySlug(slug);
  if (!product) notFound();
  const price = formatProductPrice(product.variants);
  const images = product.images.filter((image) => image.url);

  return (
    <main className="inner-page">
      <ProductJsonLd product={product} />
      <BreadcrumbJsonLd items={[{ name: "Home", path: "/" }, { name: "Shop", path: "/shop" }, { name: product.name, path: `/products/${product.slug}` }]} />
      <header className="inner-page-header">
        <Link className="wordmark" href="/">JINQAYA<span>®</span></Link>
        <CategoryNavigation /><CartLink />
      </header>
      <div className="product-detail">
        <ProductGallery images={images} productName={product.name} />
        <section className="product-detail-info">
          <p className="eyebrow">{product.brand_name}</p><h1>{product.name}</h1>
          {price && <p className="product-detail-price">{price}</p>}
          {product.short_description && <p className="product-detail-short">{product.short_description}</p>}
          {product.description && <div className="product-description">{product.description}</div>}
          {product.variants.length > 0 && <div className="product-variant-list">
            <p className="eyebrow">AVAILABLE OPTIONS</p>
            {product.variants.map((variant) => <div className="product-variant-row" key={variant.id}>
              <span>{variant.variant_name || [variant.color, variant.size, variant.material].filter(Boolean).join(" / ") || variant.sku}</span>
              {variant.price !== null && <span>{new Intl.NumberFormat("en-US", { style: "currency", currency: variant.currency }).format(variant.price)}</span>}
            </div>)}
          </div>}
          {product.material && <p className="product-detail-meta"><strong>Material</strong> {product.material}</p>}
          {product.care_instructions && <p className="product-detail-meta"><strong>Care</strong> {product.care_instructions}</p>}
          <AddToCart product={product} />
          <Link className="back-link" href="/shop">← BACK TO SHOP</Link>
        </section>
      </div>
      <footer className="inner-footer"><Link href="/">JINQAYA</Link><span>BETTER LIVING, TOGETHER.</span></footer>
    </main>
  );
}
