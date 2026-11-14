# JINQAYA Store — Preview Acceptance Checklist

Branch: `feat/checkout-direct-paypal`

This checklist separates code/CI evidence from real Preview acceptance and business data setup. A passing build is not proof that a browser workflow or a real payment has been accepted.

## Current verified state

- [x] Product image management: user-confirmed working (multi-select, batch upload, edit/replace, delete, reorder, main image, alt text). Do not reopen unless a new defect is reported.
- [x] Checkout and PayPal-related code changes through commit `e5f3535`: GitHub quality workflow passed (automated tests, checkout lint, TypeScript, Next.js build).
- [x] Product-image database integration workflow passed for commits `d7fcd0c` and `e55462d`.
- [x] Preview database: anonymous write privileges revoked from operational/application tables.
- [x] Preview database: anonymous SELECT privileges revoked from customer, profile, supplier, purchase-order, payment, goods-receipt, and order-history tables.
- [x] Preview database privilege verification: public catalog tables retain anonymous SELECT; private operational tables no longer have anonymous SELECT or write privileges.
- [ ] Latest security commits `d7fcd0c` and `e55462d` have not yet been confirmed on a READY Vercel Preview deployment.
- [ ] Browser-level acceptance of admin workflows is outstanding.

## Preview browser acceptance

Perform only with the user's own admin login session. The user must receive and enter any OTP themselves.

- [ ] Admin sign-in and session persistence.
- [ ] Orders list/detail: inspect an existing legitimate record only; do not fabricate an order.
- [ ] Order status update and status-history display, without sending email.
- [ ] Paid-order stock review controls, without changing actual stock.
- [ ] Supplier and purchase-order screens load correctly.
- [ ] Procurement forms show the configured warehouse and correctly block the isolated test warehouse.
- [ ] After-sales customer verification and case lookup screens render correctly; do not submit a fabricated customer case.

## Checkout and payment

- [x] Automated tests, TypeScript, lint, and production build passed on `e5f3535`.
- [ ] Inspect storefront product → cart → checkout in Preview using published, legitimate catalog data.
- [ ] Run a PayPal Sandbox end-to-end flow only after explicit approval to create a Sandbox test order/payment.
- [ ] Confirm order state, payment state, stock reservation/release, and webhook/capture idempotency using that approved Sandbox flow.
- [ ] Do not use Live credentials or real payment methods during Preview acceptance.

## Email safety

- [x] Preview email sending is guarded in application code.
- [ ] Inspect email-template rendering without sending.
- [ ] Do not process or retry existing pending/dead outbox records without explicit approval.
- [ ] Production email delivery requires separate production readiness review and authorization.

## Business data required (not code defects)

- [ ] Import real product records: names, descriptions, SKUs, prices, currencies, variants, and actual images.
- [ ] Complete category descriptions, SEO titles/descriptions, and category images from approved business content.
- [ ] Configure a real fulfillment warehouse in Preview using the user's actual warehouse details.
- [ ] Add real suppliers and purchasing terms if procurement is to be used.
- [ ] Enter real inventory only from verified counts.

No product details, prices, inventory quantities, supplier identities, addresses, or SEO claims should be invented to fill these gaps.

## Production launch — blocked pending explicit authorization

- [ ] Review production environment variable *names and target environments only*; never expose secret values.
- [ ] Confirm production database migrations and security separately.
- [ ] Configure PayPal Live only after explicit authorization.
- [ ] Confirm domain, shipping, tax, returns/refunds, privacy, terms, customer support, and fulfillment policies.
- [ ] Verify production catalog and inventory from real business records.
- [ ] Obtain explicit approval before any production deployment, production database change, Live payment activation, or production email send.

## Safety constraints

- Preview-only database changes unless separately authorized.
- Do not disable Vercel deployment protection.
- Do not create fake customer orders, receipts, supplier payments, stock movements, or after-sales cases.
- Do not send email or retry existing outbox messages during acceptance.
- Do not change production resources or enable PayPal Live without explicit approval.
