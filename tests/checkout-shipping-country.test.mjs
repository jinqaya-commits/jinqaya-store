import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const checkoutRoute = await readFile(new URL("../src/app/api/checkout/route.ts", import.meta.url), "utf8");
const checkoutForm = await readFile(new URL("../src/app/checkout/checkout-form.tsx", import.meta.url), "utf8");
const migration = await readFile(new URL("../supabase/migrations/20261112080000_checkout_shipping_country_policy.sql", import.meta.url), "utf8");

test("checkout freight is calculated from the server-verified merchandise subtotal at 50 percent", () => {
  assert.match(migration, /shipping_amount=round\(v_subtotal\*0\.50,2\)/);
  assert.match(migration, /total_amount=v_subtotal\+round\(v_subtotal\*0\.50,2\)/);
  assert.match(migration, /'calculation','50_percent_of_subtotal'/);
  assert.match(checkoutForm, /const shippingEstimate =/);
  assert.match(checkoutForm, /shippingEstimate/);
});

test("South Korea and Brazil are seeded as restricted destinations and restrictions are checked inside the database RPC", () => {
  assert.match(migration, /\('KR','South Korea'/);
  assert.match(migration, /\('BR','Brazil'/);
  assert.match(migration, /checkout_country_restrictions r[\s\S]*?r\.is_active = true/);
  assert.match(migration, /We do not currently ship to this destination/);
  assert.match(migration, /enable row level security/);
  assert.match(migration, /grant select, insert, update, delete on public\.checkout_country_restrictions to service_role/);
});

test("checkout displays the estimated freight and blocks the two explicitly excluded countries", () => {
  assert.match(checkoutForm, /countryCode\.toUpperCase\(\)/);
  assert.match(checkoutForm, /countryCode\.toUpperCase\(\) === "KR" \|\| countryCode\.toUpperCase\(\) === "BR"/);
  assert.match(checkoutForm, /shippingEstimate/);
  assert.match(checkoutRoute, /isRestrictedShippingDestination\\(body\\.shipping_address\\.country_code, body\\.shipping_address\\.country\\)/);\n  assert.match(checkoutRoute, /not currently ship to this destination/);
});

test("idempotent checkout retries preserve the existing order's payment readiness and totals", () => {
  assert.match(migration, /'subtotal',o\.subtotal,'shipping_amount',o\.shipping_amount,'total_amount',o\.total_amount/);
  assert.match(migration, /'payment_ready',\(o\.status='pending_payment'\)/);
});

const retryMigration = await readFile(
  new URL("../supabase/migrations/20261112162608_preserve_checkout_retry_payment_readiness.sql", import.meta.url),
  "utf8",
);

test("idempotent checkout retries preserve payment readiness for reserved orders", () => {
  assert.match(retryMigration, /'payment_ready',\(o\.status='pending_payment'\)/);
  assert.match(retryMigration, /Could not locate guest checkout idempotency response block/);
  assert.match(retryMigration, /if position\(v_new in v_definition\) > 0 then/);
});

test("country policy migration can be safely reconciled when its schema changes already exist", () => {
  assert.match(migration, /elsif position\(v_new in v_definition\)=0 then/g);
  assert.match(migration, /create table if not exists public\.checkout_country_restrictions/);
});
