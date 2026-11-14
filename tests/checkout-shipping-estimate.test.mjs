import test from "node:test";
import assert from "node:assert/strict";
import { calculateCheckoutShippingEstimate } from "../src/lib/checkout-shipping-estimate.ts";

test("one item uses the fixed USD 50 shipping estimate", () => {
  assert.deepEqual(
    calculateCheckoutShippingEstimate([{ price: 20, quantity: 1 }]),
    { totalUnits: 1, subtotalCents: 2000, shippingCents: 5000 }
  );
});

test("two items across separate lines still use the fixed USD 50 shipping estimate", () => {
  assert.deepEqual(
    calculateCheckoutShippingEstimate([
      { price: 20, quantity: 1 },
      { price: 30, quantity: 1 },
    ]),
    { totalUnits: 2, subtotalCents: 5000, shippingCents: 5000 }
  );
});

test("three or more total units use 50 percent of subtotal", () => {
  assert.deepEqual(
    calculateCheckoutShippingEstimate([
      { price: 20, quantity: 1 },
      { price: 30, quantity: 2 },
    ]),
    { totalUnits: 3, subtotalCents: 8000, shippingCents: 4000 }
  );
});

test("quantity is aggregated across variants, not distinct cart lines", () => {
  assert.deepEqual(
    calculateCheckoutShippingEstimate([
      { price: 12.99, quantity: 2 },
      { price: 8.5, quantity: 1 },
    ]),
    { totalUnits: 3, subtotalCents: 3438, shippingCents: 1719 }
  );
});
