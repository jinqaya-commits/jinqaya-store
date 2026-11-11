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
    title: { absolute: product.seo_title || product.name },
    description: product.seo_description || product.short_description || product.description || undefined,
    alternates: { canonical: `/products/${product.slug}` },
    openGraph: {
      type: "website",
      title: product.seo_title || product.name,
      description: product.seo_description || product.short_description || product.description || undefined,
      url: `https://jinqaya.com/products/${product.slug}`,
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

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const product = await getStoreProductBySlug(slug);
  if (!product) notFound();
  const price = formatProductPrice(product.variants);
  const breadcrumbs = [{ name: "Home", path: "/" }, { name: "Shop", path: "/shop" }, ...(product.primary_category ? [{ name: product.primary_category.name, path: `/collections/${product.primary_category.slug}` }] : []), { name: product.name, path: `/products/${product.slug}` }];
  const images = product.images.filter((image) => image.url);

  return (
    <main className="inner-page">
      <ProductJsonLd product={product} />
      <BreadcrumbJsonLd items={breadcrumbs} />
      <header className="inner-page-header">
        <Link className="wordmark" href="/">JINQAYA<span>®</span></Link>
        <CategoryNavigation /><CartLink />
      </header>
      <nav className="product-breadcrumbs" aria-label="Breadcrumb"><Link href="/">Home</Link><span>/</span><Link href="/shop">Shop</Link>{product.primary_category && <><span>/</span><Link href={`/collections/${product.primary_category.slug}`}>{product.primary_category.name}</Link></>}<span>/</span><span aria-current="page">{product.name}</span></nav>
      <div className="product-detail">
        <ProductGallery images={images} productName={product.name} />
        <section className="product-detail-info">
          <p className="eyebrow">{product.brand_name}</p><h1>{product.name}</h1>
          {price && <p className="product-detail-price">{price}</p>}
          {product.short_description && <p className="product-detail-short">{product.short_description}</p>}
          {product.description && <div className="product-description">{product.description}</div>}
          <div className="product-specifications">
            <p className="eyebrow">PRODUCT DETAILS</p>
            <dl className="product-specification-grid">
              {product.material && <div><dt>Material</dt><dd>{product.material}</dd></div>}
              <div><dt>Made for</dt><dd>{product.pet_type === "both" ? "Cats & dogs" : product.pet_type === "shared" ? "Shared / general" : product.pet_type === "cat" ? "Cats" : "Dogs"}</dd></div>
              {product.primary_category && <div><dt>Collection</dt><dd>{product.primary_category.name}</dd></div>}
              {product.variants.length > 0 && [...new Set(product.variants.map((variant) => variant.color).filter((value): value is string => Boolean(value)))].length > 0 && <div><dt>Color</dt><dd>{[...new Set(product.variants.map((variant) => variant.color).filter((value): value is string => Boolean(value)))].join(", ")}</dd></div>}
              {product.variants.length > 0 && [...new Set(product.variants.map((variant) => variant.size).filter((value): value is string => Boolean(value)))].length > 0 && <div><dt>Size</dt><dd>{[...new Set(product.variants.map((variant) => variant.size).filter((value): value is string => Boolean(value)))].join(", ")}</dd></div>}
            </dl>
          </div>
          {product.variants.length > 0 && product.variants.some((variant) => variant.color || variant.size || variant.variant_name) && <div className="product-variant-list">
            <p className="eyebrow">AVAILABLE OPTIONS</p>
            {product.variants.map((variant) => <div className="product-variant-row" key={variant.id}>
              <span>{[variant.color, variant.size].filter(Boolean).join(" / ") || variant.variant_name}</span>
              {variant.price !== null && <span>{new Intl.NumberFormat("en-US", { style: "currency", currency: variant.currency }).format(variant.price)}</span>}
            </div>)}
          </div>}
          {product.care_instructions && <div className="product-care-block"><p className="eyebrow">CARE</p><p>{product.care_instructions}</p></div>}
          <div className="product-detail-note" role="note" aria-label="Order and availability information">
            <p><strong>Order request</strong></p>
            <p>Stock availability, shipping options, and the final order total are confirmed after you submit your request. No payment is collected at this stage.</p>
          </div>
          <AddToCart product={product} />
          {product.primary_category && <Link className="back-link" href={`/collections/${product.primary_category.slug}`}>← BACK TO {product.primary_category.name.toUpperCase()}</Link>}
          <Link className="back-link" href="/shop">← BACK TO SHOP</Link>
        </section>
      </div>
      <footer className="inner-footer"><Link href="/">JINQAYA</Link><span>BETTER LIVING, TOGETHER.</span></footer>
    </main>
  );
}
