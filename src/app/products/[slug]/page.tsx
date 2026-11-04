import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getStoreProductBySlug, formatProductPrice } from "@/lib/products";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const product = await getStoreProductBySlug(slug);
  if (!product) return { title: "Product Not Found" };
  return {
    title: product.seo_title || product.name,
    description: product.seo_description || product.short_description || product.description || undefined,
  };
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const product = await getStoreProductBySlug(slug);
  if (!product) notFound();
  const price = formatProductPrice(product.variants);
  const images = product.images.filter((image) => image.url);
  const primaryImage = images.find((image) => image.is_primary) ?? images[0];

  return (
    <main className="inner-page">
      <header className="inner-page-header">
        <Link className="wordmark" href="/">JINQAYA<span>®</span></Link>
        <nav className="inner-nav" aria-label="Main navigation">
          <Link href="/shop">SHOP ALL</Link><Link href="/#philosophy">OUR PHILOSOPHY</Link><Link href="/">HOME</Link>
        </nav>
      </header>
      <div className="product-detail">
        <div className="product-detail-gallery">
          {primaryImage?.url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="product-detail-main-image" src={primaryImage.url} alt={primaryImage.alt_text || product.name} />
          ) : <div className="product-detail-placeholder">JINQAYA</div>}
          {images.length > 1 && <div className="product-thumbnail-grid">
            {images.filter((image) => image.id !== primaryImage?.id).map((image) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={image.id} src={image.url!} alt={image.alt_text || product.name} loading="lazy" />
            ))}
          </div>}
        </div>
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
          <p className="product-detail-note">Product availability and purchasing options will be shown here once the store checkout is enabled.</p>
          <Link className="back-link" href="/shop">← BACK TO SHOP</Link>
        </section>
      </div>
      <footer className="inner-footer"><Link href="/">JINQAYA</Link><span>BETTER LIVING, TOGETHER.</span></footer>
    </main>
  );
}
