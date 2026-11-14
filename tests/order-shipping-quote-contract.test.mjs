import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const migration = await readFile(new URL("../supabase/migrations/20261114130000_checkout_modes_and_unit_shipping.sql", import.meta.url), "utf8");
const action = await readFile(new URL("../src/app/admin/orders/actions.ts", import.meta.url), "utf8");
const ui = await readFile(new URL("../src/app/admin/orders/order-actions.tsx", import.meta.url), "utf8");
const paypalCreate = await readFile(new URL("../src/app/api/paypal/create-order/route.ts", import.meta.url), "utf8");
const paypalCapture = await readFile(new URL("../src/app/api/paypal/capture-order/route.ts", import.meta.url), "utf8");

test("order review defaults shipping to 50 percent but accepts a manual quote", () => {
  assert.match(migration, /v_shipping := round\(coalesce\([\s\S]*?case when v_units <= 2 then 50\.00 else coalesce\(v_order\.subtotal,0\) \* 0\.50 end/i);
  assert.match(migration, /Custom shipping quote/i);
  assert.match(migration, /50_percent_of_subtotal_for_three_or_more_units/i);
});

test("manual shipping quote is bounded and must have at most two decimal places", () => {
  assert.match(migration, /p_shipping_amount < 0/i);
  assert.match(migration, /p_shipping_amount > 99999999\.99/i);
  assert.match(migration, /p_shipping_amount <> round\(p_shipping_amount,2\)/i);
  assert.match(action, /shippingAmountRaw/);
  assert.match(action, /Number\.isFinite\(Number\(shippingAmountRaw\)\)/);
  assert.match(action, /return raw === "" \? null : Number\(raw\)/);
});

test("confirmed shipping amount and final order total are saved together", () => {
  assert.match(migration, /shipping_amount = v_final_shipping,[\s\S]*?total_amount = round\(/i);
  assert.match(migration, /'amount', v_final_shipping/);
  assert.match(migration, /Shipping quote confirmed/i);
});

test("manual payment validation accepts the confirmed quote instead of requiring a 50 percent calculation", () => {
  assert.match(migration, /round\(v_order\.shipping_amount,2\) <> round\(coalesce\(\(v_order\.shipping_quote_snapshot->>'amount'\)::numeric,-1\),2\)/i);
  assert.doesNotMatch(migration, /shipping_amount,2\)<>round\(v_order\.subtotal\*0\.50/i);
});

test("admin UI allows staff to edit shipping and explains the 50 percent default", () => {
  assert.match(ui, /name="shipping_amount"/);
  assert.match(ui, /50% OF SUBTOTAL/);\n  assert.match(ui, /\\$50 FOR 1–2 ITEMS/);
  assert.match(ui, /replace it with the actual shipping quote/i);
  assert.match(ui, /Confirm shipping quote & reserve stock/);
});

test("PayPal create and capture continue using the stored order total, not a client-supplied amount", () => {
  assert.match(paypalCreate, /total_amount/);
  assert.match(paypalCapture, /total_amount/);
  assert.doesNotMatch(paypalCreate, /body\.amount/);
  assert.doesNotMatch(paypalCapture, /body\.amount/);
});
