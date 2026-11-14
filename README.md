# JINQAYA Store

Premium Pet Lifestyle — Better Living, Together.

## Tech stack

- Next.js App Router, React and TypeScript
- Tailwind CSS
- Supabase Auth and PostgreSQL
- Cloudflare R2 for original product images
- Cloudflare image delivery
- Vercel deployment target

## Local development

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Environment variables

Copy `.env.example` to `.env.local` and configure the required Supabase and Cloudflare R2 values for the environment you are running. Never commit credentials or expose the Supabase service-role key or R2 secret access key in browser code.

## Implemented application areas

### Storefront and catalog
- Public home, shop, collection and product detail pages
- Supabase-backed categories, products, variants and product images
- Product administration with draft-first publishing and publish-readiness checks
- Product image workflows: multi-file selection/upload, replacement, deletion, ordering, primary-image selection and alt text
- Category administration, descriptions and category image management
- Homepage media management

### Commerce and fulfilment
- Cart and guest checkout
- Country selection and shipping-country restrictions
- Server-side price validation and stock reservation
- PayPal order creation/capture and webhook verification
- Order status lookup and customer email verification
- Admin order processing, shipment status and issue workflows
- Returns, refunds and after-sales workflows
- Inventory adjustments and movement history

### Procurement and finance
- Supplier records
- Purchase orders, purchase-order lines and goods receipts
- Transactional stock receipt and inventory movement recording
- Purchase-order payment recording
- Accounts-payable view of outstanding supplier balances

### Operations
- Customer records, follow-ups, inquiries and support inbox
- Order email outbox and controlled recovery tooling
- Automated tests for checkout, shipping restrictions, inventory, product readiness, image cleanup, order status, PayPal contracts and procurement validation

## Verification status

Passing automated tests and a successful Next.js build do not by themselves prove that every workflow has been accepted in the deployed Preview UI. Verify the exact commit deployed to Preview before treating browser-level acceptance as complete.

The current development branch is `feat/checkout-direct-paypal`. Do not treat Preview test fixtures as live catalog content. Production deployment, live payment activation and production database changes require separate authorization.

## Catalog content required before launch

Preview currently contains test products and incomplete category content. Add approved real product names, descriptions, SKUs, prices, images, inventory and category SEO content before opening the storefront to customers.

## Safety notes

- Keep Preview and Production credentials and databases separate.
- Do not create fake orders, receipts, supplier payments or customer email sends as acceptance tests.
- Keep PayPal in Sandbox until a separately authorized production launch.
