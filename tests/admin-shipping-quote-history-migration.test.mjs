import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const migration = await readFile(
  new URL("../supabase/migrations/20261115120000_restore_admin_shipping_quote_adjustment.sql", import.meta.url),
  "utf8",
);
const action = await readFile(new URL("../src/app/admin/orders/actions.ts", import.meta.url), "utf8");

test("restored migration recreates the quote history table with its production constraints", () => {
  assert.match(migration, /create table if not exists public\.order_shipping_quote_history/i);
  assert.match(migration, /references public\.orders\(id\) on delete cascade/i);
  assert.match(migration, /adjustment_reason text not null check/i);
  assert.match(migration, /unit_count integer not null check \(unit_count >= 1\)/i);
  assert.match(migration, /order_shipping_quote_history_order_created_idx/i);
});

test("restored migration secures quote history reads and preserves server-side writes", () => {
  assert.match(migration, /enable row level security/i);
  assert.match(migration, /using \(public\.can_manage_catalog\(\)\)/i);
  assert.match(migration, /grant select on table public\.order_shipping_quote_history to authenticated/i);
  assert.match(migration, /grant all on table public\.order_shipping_quote_history to service_role/i);
});

test("restored nine-argument RPC preserves the production shipping policy and audit trail", () => {
  assert.match(migration, /admin_process_order\(p_order_id uuid, p_action text, p_shipping_amount numeric, p_shipping_method text, p_carrier_name text, p_tracking_number text, p_tracking_url text, p_note text, p_shipping_adjustment_reason text\)/i);
  assert.match(migration, /if p_action is distinct from 'confirm_quote' then/i);
  assert.match(migration, /if v_units <= 2 then\s+v_original_shipping := 50\.00/i);
  assert.match(migration, /v_original_shipping := round\(coalesce\(v_order\.subtotal,0\) \* 0\.50,2\)/i);
  assert.match(migration, /insert into public\.order_shipping_quote_history/i);
  assert.match(migration, /p_shipping_adjustment_reason/);
  assert.match(action, /p_shipping_adjustment_reason: shippingAdjustmentReason/);
});
