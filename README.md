# JINQAYA Store

Premium Pet Lifestyle — Better Living, Together.

## Tech stack

- Next.js App Router
- React and TypeScript
- Tailwind CSS
- Supabase Auth and PostgreSQL catalog
- Cloudflare R2 for original product images
- Cloudflare Image Resizing for image delivery
- Vercel deployment target

## Local development

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Environment variables

Copy `.env.example` to `.env.local`, then fill in the Supabase publishable key and Cloudflare R2 credentials. Never commit real credentials or expose the R2 secret access key or Supabase service-role key in browser code.

## Current implementation

- Public storefront, shop, collection and product detail pages
- Supabase-backed product, category, variant and image records
- Admin sign-in and catalog permission checks
- Product creation and editing
- Signed browser-to-R2 image uploads
- R2 object deletion and Cloudflare image transformation URLs

Checkout, payment processing, customer accounts, inventory management and order fulfilment are not yet implemented. Product pages currently display product information and indicate that checkout is not enabled.
