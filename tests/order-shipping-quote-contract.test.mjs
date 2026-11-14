import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const migration = await readFile(new URL("../supabase/migrations/20261114161000_admin_quantity_based_shipping_quotes.sql", import.meta.url), "utf8");
const action = await readFile(new URL("../src/app/admin/orders/actions.ts", import.meta.url), "utf8");
const ui = await readFile(new URL("../src/app/admin/orders/order-actions.tsx", import.meta.url), "utf8");
const paypalCreate = await readFile(new URL("../src/app/api/paypal/create-order/route.ts", import.meta.url), "utf8");
const paypalCapture = await readFile(new URL("../src/app/api/paypal/capture-order/route.ts", import.meta.url), "utf8");

test("order review applies the quantity-based default and accepts a manual quote", () => {
  assert.match(migration, /v_auto_shipping:=case when v_units<=2 then 50\.00 else round\(coalesce\(v_order\.subtotal,0\)\*0\.50,2\) end/i);
  assert.match(migration, /coalesce\(p_shipping_amount,v_auto_shipping\)/i);
  assert.match(migration, /flat_50_for_1_or_2_units/i);
  assert.match(migration, /50_percent_of_subtotal_for_3_plus_units/i);
});

test("manual shipping quote is bounded and adjustment metadata is audited", () => {
  assert.match(migration, /p_shipping_amount<0/i);
  assert.match(migration, /p_shipping_amount>99999999\.99/i);
  assert.match(migration, /p_shipping_amount<>round\(p_shipping_amount,2\)/i);
  assert.match(migration, /automatic_amount',v_auto_shipping/i);
  assert.match(migration, /discount_amount',greatest\(v_auto_shipping-v_shipping,0\)/i);
  assert.match(migration, /reason',v_note/i);
  assert.match(action, /shippingAmountRaw/);
  assert.match(action, /Number\.isFinite\(Number\(shippingAmountRaw\)\)/);
});

test("confirmed shipping amount and final order total are saved together", () => {
  assert.match(migration, /shipping_amount=v_shipping,total_amount=round\(coalesce\(subtotal,0\)\+v_shipping/i);
  assert.match(migration, /'amount',v_shipping/);
  assert.match(migration, /confirmed shipping quote/i);
});

test("manual payment validation accepts the confirmed quote instead of requiring a fixed formula", () => {
  assert.match(migration, /round\(v_order\.shipping_amount,2\)<>round\(coalesce\(\(v_order\.shipping_quote_snapshot->>'amount'\)::numeric,-1\),2\)/i);
  assert.doesNotMatch(migration, /shipping_amount,2\)<>round\(v_order\.subtotal\*0\.50/i);
});

test("admin UI allows staff to edit the shipping amount using the quantity-based default", () => {
  assert.match(ui, /name="shipping_amount"/);
  assert.match(ui, /USD 50 FOR 1–2 ITEMS/);
  assert.match(ui, /replace it with the actual shipping quote/i);
  assert.match(ui, /Confirm shipping quote & reserve stock/);
});

test("PayPal create and capture use the stored order total, not a client-supplied amount", () => {
  assert.match(paypalCreate, /total_amount/);
  assert.match(paypalCapture, /total_amount/);
  assert.doesNotMatch(paypalCreate, /body\.amount/);
  assert.doesNotMatch(paypalCapture, /body\.amount/);
});
