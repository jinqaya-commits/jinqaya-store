export type ProductImageUrls = {
  originalUrl: string | null;
  thumbnailUrl: string | null;
  detailUrl: string | null;
};

const R2_PATH_PREFIX = "r2://";

function encodeObjectKey(key: string): string {
  return key
    .replace(/^\/+/, "")
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
}

function transformedUrl(baseUrl: string, key: string, width: number): string {
  const base = baseUrl.replace(/\/+$/, "");
  const path = encodeObjectKey(key);
  return `${base}/cdn-cgi/image/width=${width},quality=85,format=auto/${path}`;
}

/**
 * Image storage paths are provider-neutral identifiers:
 * - r2://<object-key> for Cloudflare R2
 * - legacy unprefixed paths for the existing Supabase Storage bucket
 *
 * The database stores object keys, never a provider's public URL.
 */
export function resolveProductImageUrls(storagePath: string): ProductImageUrls {
  if (/^https?:\/\//i.test(storagePath)) {
    return { originalUrl: storagePath, thumbnailUrl: storagePath, detailUrl: storagePath };
  }

  if (storagePath.startsWith(R2_PATH_PREFIX)) {
    const baseUrl = process.env.PRODUCT_IMAGE_PUBLIC_BASE_URL;
    if (!baseUrl) return { originalUrl: null, thumbnailUrl: null, detailUrl: null };

    const key = storagePath.slice(R2_PATH_PREFIX.length);
    if (!key || key.includes("..")) {
      return { originalUrl: null, thumbnailUrl: null, detailUrl: null };
    }

    return {
      originalUrl: `${baseUrl.replace(/\/+$/, "")}/${encodeObjectKey(key)}`,
      thumbnailUrl: transformedUrl(baseUrl, key, 600),
      detailUrl: transformedUrl(baseUrl, key, 1600),
    };
  }

  // Backward compatibility for images uploaded before the R2 migration.
  const bucket = process.env.NEXT_PUBLIC_SUPABASE_PRODUCT_IMAGES_BUCKET || "product-images";
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) return { originalUrl: null, thumbnailUrl: null, detailUrl: null };

  const path = encodeObjectKey(storagePath);
  const url = `${supabaseUrl.replace(/\/+$/, "")}/storage/v1/object/public/${bucket}/${path}`;
  return { originalUrl: url, thumbnailUrl: url, detailUrl: url };
}
