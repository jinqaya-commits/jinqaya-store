import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const migration = await readFile(new URL("../supabase/migrations/20261114153000_fix_request_quote_stock_reservations.sql", import.meta.url), "utf8");

test("shipping quote requests release legacy reservations and remain on hold", () => {
  assert.match(migration, /set status = 'released'/i);
  assert.match(migration, /'reservation_release'/i);
  assert.match(migration, /set status = 'on_hold'/i);
  assert.match(migration, /shipping_amount = 0/i);
  assert.match(migration, /status', 'quote_required'/i);
});

test("shipping quote requests suppress intermediate payment-confirmation emails", () => {
  assert.match(migration, /set_config\('app\.checkout_mode', p_checkout_mode, true\)/i);
  assert.match(migration, /enqueue_order_status_email\(\)'::regprocedure/i);
  assert.match(migration, /regexp_replace\([\s\S]*?'i'\s*\)/i);
  assert.match(migration, /current_setting\(''app\.checkout_mode'', true\) in \(''request_quote'', ''pay_now''\)/i);
});

test("stock reservation release is guarded against inventory underflow", () => {
  assert.match(migration, /reserved >= v_reservation\.quantity/i);
  assert.match(migration, /Could not safely release a checkout stock reservation/i);
});
