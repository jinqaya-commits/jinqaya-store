export type ProductImageUrls = {
  originalUrl: string | null;
  thumbnailUrl: string | null;
  detailUrl: string | null;
};

const R2_PATH_PREFIX = "r2://";
const DEFAULT_R2_PUBLIC_BASE_URL = "https://images.jinqaya.com";

function encodeObjectKey(key: string): string {
  return key
    .replace(/^\/+/, "")
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
}

/**
 * Resolve stored image identifiers to browser-accessible URLs.
 * R2 images use the public custom domain directly. Avoid requiring
 * Cloudflare Image Resizing so uploaded originals remain displayable
 * even when the image transformation feature is not enabled.
 */
export function resolveProductImageUrls(storagePath: string): ProductImageUrls {
  if (/^https?:\/\//i.test(storagePath)) {
    return { originalUrl: storagePath, thumbnailUrl: storagePath, detailUrl: storagePath };
  }

  if (storagePath.startsWith(R2_PATH_PREFIX)) {
    const baseUrl = (process.env.PRODUCT_IMAGE_PUBLIC_BASE_URL || DEFAULT_R2_PUBLIC_BASE_URL)
      .replace(/\/+$/, "");
    const key = storagePath.slice(R2_PATH_PREFIX.length);
    if (!key || key.includes("..")) {
      return { originalUrl: null, thumbnailUrl: null, detailUrl: null };
    }

    const url = `${baseUrl}/${encodeObjectKey(key)}`;
    return { originalUrl: url, thumbnailUrl: url, detailUrl: url };
  }

  // Backward compatibility for images uploaded before the R2 migration.
  const bucket = process.env.NEXT_PUBLIC_SUPABASE_PRODUCT_IMAGES_BUCKET || "product-images";
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) return { originalUrl: null, thumbnailUrl: null, detailUrl: null };

  const path = encodeObjectKey(storagePath);
  const url = `${supabaseUrl.replace(/\/+$/, "")}/storage/v1/object/public/${bucket}/${path}`;
  return { originalUrl: url, thumbnailUrl: url, detailUrl: url };
}
