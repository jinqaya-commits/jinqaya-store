import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const migration = await readFile(new URL("../supabase/migrations/20261114180000_dual_checkout_shipping_policy.sql", import.meta.url), "utf8");
const checkoutRoute = await readFile(new URL("../src/app/api/checkout/route.ts", import.meta.url), "utf8");
const checkoutForm = await readFile(new URL("../src/app/checkout/checkout-form.tsx", import.meta.url), "utf8");

test("direct payment uses a flat USD 50 shipping amount for one or two total units", () => {
  assert.match(migration, /v_total_units<=2 THEN 50\.00 ELSE round\(v_subtotal\*0\.50,2\)/);
  assert.match(migration, /v_total_units integer := 0/);
  assert.match(migration, /v_total_units := v_total_units \+ v_quantity/);
});

test("direct payment uses 50 percent of the server-verified subtotal for three or more total units", () => {
  assert.match(migration, /50_percent_of_subtotal_for_3_plus_items/);
  assert.match(migration, /round\(v_subtotal\*0\.50,2\)/);
  assert.match(migration, /'amount',CASE WHEN v_total_units<=2 THEN 50\.00 ELSE round\(v_subtotal\*0\.50,2\) END/);
});

test("manual quote checkout skips stock reservation and leaves payment disabled", () => {
  assert.match(migration, /IF p_checkout_mode = 'direct_payment' THEN[\s\S]*?ELSE\s+v_stock_ready := false;/);
  assert.match(migration, /'status','quote_required'[\s\S]*?'checkout_mode','manual_quote'/);
  assert.match(migration, /'payment_ready',\(p_checkout_mode='direct_payment' AND v_stock_ready\)/);
  assert.match(migration, /'shipping_status',CASE WHEN p_checkout_mode='direct_payment' THEN 'confirmed' ELSE 'quote_required' END/);
});

test("checkout API validates and passes the selected mode to the service-role RPC", () => {
  assert.match(checkoutRoute, /checkoutMode !== "direct_payment" && checkoutMode !== "manual_quote"/);
  assert.match(checkoutRoute, /p_checkout_mode: checkoutMode/);
  assert.match(checkoutRoute, /if \(data\.payment_ready === true\)/);
});

test("checkout defaults to PayPal and presents a separate no-payment shipping quote option", () => {
  assert.match(checkoutForm, /useState<"direct_payment" \| "manual_quote">\("direct_payment"\)/);
  assert.match(checkoutForm, /value="direct_payment"/);
  assert.match(checkoutForm, /value="manual_quote"/);
  assert.match(checkoutForm, /Request a shipping quote/);
  assert.match(checkoutForm, /REQUEST SHIPPING QUOTE/);
  assert.match(checkoutForm, /No payment has been taken/);
});

test("pre-checkout estimate uses total unit quantity, not the number of distinct product lines", () => {
  assert.match(checkoutForm, /items\.reduce\(\(sum, item\) => sum \+ item\.quantity, 0\)/);
  assert.match(checkoutForm, /totalQuantity <= 2 \? 5000 : Math\.round\(subtotalCents \/ 2\)/);
});
