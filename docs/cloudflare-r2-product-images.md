# Cloudflare R2 product image setup

The application keeps product records in Supabase and stores original image files in R2. The database stores provider-neutral image identifiers (`r2://<object-key>`); legacy Supabase Storage paths remain readable.

## Cloudflare setup

1. Create an R2 bucket named `jinqaya-product-originals`.
2. Create an R2 API token with **Object Read & Write** permission, scoped only to this bucket.
3. Add the bucket's public custom domain, recommended: `images.jinqaya.com`. Public access is for image delivery only; uploads still require short-lived signed PUT URLs from the authenticated application.
4. Enable Cloudflare Image Resizing for the zone that serves `images.jinqaya.com`.
5. Configure the bucket's CORS policy:
   - Allowed origins: `http://localhost:3000` and the exact production storefront origin (for example `https://jinqaya.com`).
   - Allowed methods: `PUT`.
   - Allowed headers: `Content-Type`.
   - Expose headers: none required.
   - Max age: `3600`.

Do not enable public write access. Do not put R2 secrets in any `NEXT_PUBLIC_*` variable or commit them to Git.

## Server environment variables

Set these in the local `.env.local` and in the production hosting environment:

```dotenv
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=jinqaya-product-originals
PRODUCT_IMAGE_PUBLIC_BASE_URL=https://images.jinqaya.com
```

The account ID, access key ID, and secret access key are obtained from the R2 API token details. The public base URL must be the custom domain attached to the bucket.

## Upload flow

1. An authenticated catalog manager requests a short-lived signed PUT URL from `/api/admin/product-images/upload-url`.
2. The browser uploads the original file directly to R2.
3. The application stores `r2://<object-key>` in `product_images.storage_path`.
4. The storefront builds Cloudflare Image Resizing URLs for 600px listing images and 1600px detail images.
5. Existing unprefixed paths continue to resolve through the legacy Supabase Storage bucket.

## Migration

Copy objects to another S3-compatible provider, then change the provider resolver and upload/delete adapter. Product rows continue to reference stable object keys; do not store full CDN URLs in `product_images.storage_path`.

## Current limits

The admin uploader accepts JPG, PNG, WebP, and AVIF up to 20 MB per file. Cloudflare transformations are generated on demand and cached by Cloudflare. The R2 bucket, CORS policy, custom domain, image resizing feature, and environment variables must be configured before uploads can succeed.
