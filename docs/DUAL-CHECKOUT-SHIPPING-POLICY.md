# Dual checkout and shipping policy

## Customer checkout choices

- **Pay now with PayPal** creates an order using database-authoritative prices, calculates the shipping estimate, and attempts an atomic 48-hour stock reservation. The order becomes payable only when the reservation succeeds.
- **Request a shipping quote** records an unpaid order for staff review. No PayPal session is created and no payment is collected at submission.

## Shipping estimate

The total quantity is the sum of item quantities across all variants and line items:

- 1–2 total units: USD 50 flat shipping.
- 3 or more total units: 50% of the merchandise subtotal.

The browser estimate is informational. The database RPC recalculates the subtotal from active variant prices and stores the confirmed server-side shipping amount and total. PayPal create/capture continues to use the stored order total only.

## Staff quote adjustments

Staff can replace the suggested shipping amount with the agreed amount before confirming a quote. The quote snapshot and activity log retain the automatic baseline, final amount, adjustment, discount (when applicable), method, and staff note. The final PayPal amount is derived from the saved order total.

## Deployment gates

Apply the new migrations in order in a non-production review environment, validate both checkout paths and reservation expiry, then separately authorize production migration and deployment. Do not enable PayPal Live or create real charges as part of code review.
