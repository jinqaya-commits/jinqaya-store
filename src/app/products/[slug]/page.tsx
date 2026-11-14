import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getStoreProductBySlug, getStoreProducts, formatProductPrice } from "@/lib/products";
import { ProductGallery } from "@/components/storefront/product-gallery";
import { AddToCart } from "@/components/storefront/add-to-cart";
import { ProductCard } from "@/components/storefront/product-card";
import { CartLink } from "@/components/storefront/cart-link";
import { CategoryNavigation } from "@/components/storefront/category-navigation";
import { BreadcrumbJsonLd, ProductJsonLd } from "@/lib/seo-jsonld";
import { RecentlyViewed } from "@/components/storefront/recently-viewed";
import styles from "./product-experience.module.css";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const product = await getStoreProductBySlug(slug);
  if (!product) return { title: "Product Not Found" };
  return {
    title: { absolute: product.seo_title || product.name },
    description: product.seo_description || product.short_description || product.description || undefined,
    alternates: { canonical: `/products/${product.slug}` },
    openGraph: {
      type: "website",
      title: product.seo_title || product.name,
      description: product.seo_description || product.short_description || product.description || undefined,
      url: `https://www.jinqaya.com/products/${product.slug}`,
      siteName: "JINQAYA",
      images: product.images.filter((image) => image.detail_url).slice(0, 4).map((image) => ({ url: image.detail_url as string, alt: image.alt_text || product.name })),
    },
    twitter: {
      card: "summary_large_image",
      title: product.seo_title || product.name,
      description: product.seo_description || product.short_description || product.description || undefined,
      images: product.images.filter((image) => image.detail_url).slice(0, 1).map((image) => ({ url: image.detail_url as string, alt: image.alt_text || product.name })),
    },
  };
}

function petTypeLabel(value: string) {
  if (value === "both") return "Cats & dogs";
  if (value === "shared") return "Shared / general";
  if (value === "cat") return "Cats";
  if (value === "dog") return "Dogs";
  return null;
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const product = await getStoreProductBySlug(slug);
  if (!product) notFound();

  const relatedProducts = await getStoreProducts(product.primary_category?.slug);
  const recommendations = relatedProducts.filter((item) => item.id !== product.id).slice(0, 4);
  const price = formatProductPrice(product.variants);
  const breadcrumbs = [
    { name: "Home", path: "/" },
    { name: "Shop", path: "/shop" },
    ...(product.primary_category ? [{ name: product.primary_category.name, path: `/collections/${product.primary_category.slug}` }] : []),
    { name: product.name, path: `/products/${product.slug}` },
  ];
  const images = product.images.filter((image) => image.url);
  const colors = [...new Set(product.variants.map((variant) => variant.color).filter((value): value is string => Boolean(value)))];
  const sizes = [...new Set(product.variants.map((variant) => variant.size).filter((value): value is string => Boolean(value)))];
  const suitableFor = petTypeLabel(product.pet_type);

  return (
    <main className="inner-page product-page">
      <ProductJsonLd product={product} />
      <BreadcrumbJsonLd items={breadcrumbs} />
      <header className="inner-page-header">
        <Link className="jq-brand-logo-link" href="/" aria-label="JINQAYA home"><Image className="jq-brand-logo jq-inner-logo" src="/jinqaya-logo.png" alt="JINQAYA Premium Pet Lifestyle" width={900} height={287} /></Link>
        <CategoryNavigation /><CartLink />
      </header>

      <nav className="product-breadcrumbs" aria-label="Breadcrumb">
        <Link href="/">Home</Link><span>/</span><Link href="/shop">Shop</Link>
        {product.primary_category && <><span>/</span><Link href={`/collections/${product.primary_category.slug}`}>{product.primary_category.name}</Link></>}
        <span>/</span><span aria-current="page">{product.name}</span>
      </nav>

      <div className="product-detail">
        <ProductGallery images={images} productName={product.name} />

        <section className="product-detail-info" aria-labelledby="product-title">
          <p className="eyebrow product-brand">{product.brand_name}</p>
          <h1 id="product-title">{product.name}</h1>
          {price && <p className="product-detail-price">{price}</p>}
          {product.short_description && <p className="product-detail-short">{product.short_description}</p>}

          <AddToCart product={product} />

          <div className="product-order-assurance" role="note">
            <span className="product-assurance-mark" aria-hidden="true">✓</span>
            <p><strong>Order request, not instant payment.</strong> We confirm stock availability, shipping options and the final total after you submit your request. No payment is collected at this stage.</p>
          </div>

          <div className="product-policy-links" aria-label="Shopping information">
            <Link href="/policies/shipping">Shipping information <span aria-hidden="true">↗</span></Link>
            <Link href="/policies/returns-refunds">Returns & refunds <span aria-hidden="true">↗</span></Link>
          </div>

          <details className={styles.accordion} open>
            <summary>PRODUCT DETAILS</summary>
            <div className="product-specifications">
              <dl className="product-specification-grid">
                {product.material && <div><dt>Material</dt><dd>{product.material}</dd></div>}
                {suitableFor && <div><dt>Designed for</dt><dd>{suitableFor}</dd></div>}
                {product.primary_category && <div><dt>Collection</dt><dd>{product.primary_category.name}</dd></div>}
                {colors.length > 0 && <div><dt>Color options</dt><dd>{colors.join(", ")}</dd></div>}
                {sizes.length > 0 && <div><dt>Size options</dt><dd>{sizes.join(", ")}</dd></div>}
              </dl>
            </div>
          </details>

          {product.care_instructions && (
            <details className={styles.accordion}>
              <summary>CARE & MAINTENANCE</summary>
              <p>{product.care_instructions}</p>
            </details>
          )}

          <details className={styles.accordion}>
            <summary>SHIPPING & DELIVERY</summary>
            <p>Shipping options and the estimated delivery window are confirmed with you before your order is finalized.</p>
            <Link href="/policies/shipping">Read our shipping information ↗</Link>
          </details>

          <details className={styles.accordion}>
            <summary>RETURNS & REFUNDS</summary>
            <p>Please review our returns and refunds policy before submitting an order request.</p>
            <Link href="/policies/returns-refunds">Read our returns & refunds policy ↗</Link>
          </details>

          <Link className="product-question-link" href={`/contact?product=${encodeURIComponent(product.slug)}`}>
            NEED A LITTLE MORE DETAIL? ASK US ABOUT THIS PIECE <span aria-hidden="true">↗</span>
          </Link>
        </section>
      </div>

      {product.description && (
        <section className="product-story-section" aria-labelledby="product-story-title">
          <div className="product-story-inner">
            <p className="eyebrow">A CLOSER LOOK</p>
            <h2 id="product-story-title">Made for the moments<br /><em>we share.</em></h2>
            <div className="product-story-copy">{product.description}</div>
          </div>
        </section>
      )}

      {recommendations.length > 0 && (
        <section className="product-recommendations" aria-labelledby="recommendations-title">
          <div className="product-recommendations-heading">
            <div><p className="eyebrow">CONTINUE EXPLORING</p><h2 id="recommendations-title">You may also like</h2></div>
            {product.primary_category && <Link href={`/collections/${product.primary_category.slug}`}>VIEW THE COLLECTION ↗</Link>}
          </div>
          <div className="product-grid">
            {recommendations.map((item) => <ProductCard key={item.id} product={item} />)}
          </div>
        </section>
      )}

      <RecentlyViewed product={{
        slug: product.slug,
        name: product.name,
        imageUrl: product.images.find((image) => image.is_primary)?.detail_url ?? product.images[0]?.detail_url ?? null,
        priceLabel: price,
      }} />
      <footer className="inner-footer"><Link className="jq-brand-logo-link" href="/" aria-label="JINQAYA home"><Image className="jq-brand-logo jq-inner-logo jq-footer-logo" src="/jinqaya-logo.png" alt="JINQAYA Premium Pet Lifestyle" width={900} height={287} /></Link><span>FOR CATS, DOGS & THE LIFE BETWEEN.</span></footer>
    </main>
  );
}
