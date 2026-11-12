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

test("checkout displays the estimated freight and prevents the two explicitly excluded countries", () => {
  assert.match(checkoutForm, /countryCode\.toUpperCase\(\)/);
  assert.match(checkoutForm, /countryCode === "KR" \|\| countryCode === "BR"/);
  assert.match(checkoutForm, /shippingEstimate/);
  assert.match(checkoutRoute, /not currently ship to this destination/);
});
