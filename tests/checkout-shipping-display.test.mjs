import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const checkout = await readFile(new URL("../src/app/checkout/checkout-form.tsx", import.meta.url), "utf8");

test("checkout displays the server-confirmed subtotal, shipping amount, and total after submission", () => {
  assert.match(checkout, /shipping_amount: number/);
  assert.match(checkout, /total_amount: number/);
  assert.match(checkout, /formatCartMoney\(Number\(order\.subtotal\), order\.currency\)/);
  assert.match(checkout, /formatCartMoney\(Number\(order\.shipping_amount\), order\.currency\)/);
  assert.match(checkout, /formatCartMoney\(Number\(order\.total_amount\), order\.currency\)/);
});

test("checkout communicates that PayPal payment requires email verification and a live stock reservation", () => {
  assert.match(checkout, /order\.payment_ready \? "Verify your email to continue to payment" : "Stock confirmation required"/);
  assert.match(checkout, /Your items have been reserved for 48 hours/);
  assert.match(checkout, /payment is not available yet/);
});

test("checkout estimates shipping at 50 percent but explains the server rechecks the final amount", () => {
  assert.match(checkout, /estimate \* 0\.5/);
  assert.match(checkout, /estimate \* 1\.5/);
  assert.match(checkout, /The server rechecks product prices, destination restrictions and stock/);
});

test("checkout copy matches the actual reservation and PayPal verification flow", () => {
  assert.match(checkout, /Shipping is estimated at 50% of the item subtotal/);
  assert.match(checkout, /verify your email and continue to PayPal/);
  assert.match(checkout, /payment remains unavailable/);
  assert.doesNotMatch(checkout, /We’ll confirm availability, shipping and the final total with you before payment/);
});
