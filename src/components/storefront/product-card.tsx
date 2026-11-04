import Link from "next/link";
import type { StoreProduct } from "@/lib/products";
import { formatProductPrice } from "@/lib/products";

export function ProductCard({ product }: { product: StoreProduct }) {
  const image = product.images.find((item) => item.is_primary && item.url)
    ?? product.images.find((item) => item.url);
  const price = formatProductPrice(product.variants);

  return (
    <article className="product-card">
      <Link className="product-card-image" href={`/products/${product.slug}`}>
        {image?.url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image.url} alt={image.alt_text || product.name} loading="lazy" />
        ) : (
          <span className="product-image-placeholder">JINQAYA</span>
        )}
        {product.is_new_arrival && <span className="product-badge">NEW</span>}
      </Link>
      <div className="product-card-copy">
        <div>
          <h2><Link href={`/products/${product.slug}`}>{product.name}</Link></h2>
          {product.short_description && <p>{product.short_description}</p>}
        </div>
        {price && <span className="product-price">{price}</span>}
      </div>
    </article>
  );
}
