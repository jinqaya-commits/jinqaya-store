import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const route = await readFile(new URL("../src/app/api/checkout/route.ts", import.meta.url), "utf8");
const form = await readFile(new URL("../src/app/checkout/checkout-form.tsx", import.meta.url), "utf8");
const migration = await readFile(new URL("../supabase/migrations/20261114160000_dual_checkout_shipping_policy.sql", import.meta.url), "utf8");
const email = await readFile(new URL("../src/lib/order-email.ts", import.meta.url), "utf8");
const outbox = await readFile(new URL("../src/lib/order-email-outbox.ts", import.meta.url), "utf8");

test("checkout offers both immediate PayPal and manual shipping quote paths", () => {
  assert.match(form, /pay_now/);
  assert.match(form, /request_quote/);
  assert.match(form, /Pay now with PayPal/);
  assert.match(form, /Request a shipping quote/);
  assert.match(route, /submit_guest_order_with_mode/);
  assert.match(route, /p_checkout_mode: body\.checkout_mode/);
});

test("shipping policy counts total units across line items", () => {
  assert.match(form, /items\.reduce\(\(sum, item\) => sum \+ item\.quantity, 0\)/);
  assert.match(form, /totalQuantity <= 2 \? 5000 : Math\.round\(subtotalCents \/ 2\)/);
  assert.match(migration, /sum\(quantity\),0\)::integer/);
  assert.match(migration, /v_units <= 2 THEN 50\.00 ELSE round\(coalesce\(v_order\.subtotal,0\) \* 0\.50,2\) END/i);
});

test("immediate checkout reserves inventory before setting a confirmed payable total", () => {
  assert.match(migration, /INSERT INTO public\.stock_reservations/i);
  assert.match(migration, /UPDATE public\.orders[\s\S]*status = 'pending_payment'/i);
  assert.match(migration, /'status','confirmed'/i);
  assert.match(migration, /'checkout_mode','pay_now'/i);
  assert.match(migration, /EXCEPTION WHEN OTHERS THEN\s+v_stock_ok := false/i);
});

test("manual quote requests do not enable PayPal payment at submission", () => {
  assert.match(migration, /'payment_ready',false/);
  assert.match(migration, /'checkout_mode','request_quote'/);
  assert.match(form, /No payment has been taken/);
});

test("manual quote requests enqueue staff and customer emails with quote-specific wording", () => {
  assert.match(migration, /'order_received','customer'/);
  assert.match(migration, /'order_received','staff'/);
  assert.match(migration, /'checkoutMode','request_quote'/);
  assert.match(outbox, /checkoutMode: row\.checkoutMode/);
  assert.match(email, /Our team will review the delivery cost and contact you with a shipping quote and final order total before payment/);
  assert.match(email, /No payment has been taken/);
});

test("pay-now handles stock reservations already created by the base guest checkout RPC", () => {
  assert.match(migration, /First-time pay-now submissions can already be pending_payment/i);
  assert.match(migration, /v_order\.status = 'pending_payment'[\s\S]*?v_order\.shipping_quote_snapshot->>'checkout_mode' IS NULL/i);
  assert.match(migration, /shipping_amount = v_shipping[\s\S]*?'checkout_mode','pay_now'/i);
  assert.match(migration, /'payment_ready',v_reservations_valid/);
});

test("manual quote requests release any stock reservations created by the base guest checkout RPC", () => {
  assert.match(migration, /Customer requested a manual shipping quote; stock reservations released and payment disabled/i);
  assert.match(migration, /UPDATE public\.inventory[\s\S]*?reserved = reserved - v_item\.quantity/i);
  assert.match(migration, /UPDATE public\.stock_reservations[\s\S]*?status = 'released'/i);
  assert.match(migration, /status = 'on_hold'[\s\S]*?'checkout_mode','request_quote'/i);
  assert.match(migration, /'payment_ready',false/);
});
