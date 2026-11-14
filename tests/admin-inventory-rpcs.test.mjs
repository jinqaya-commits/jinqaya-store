import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL("../supabase/migrations/20261113180000_admin_inventory_management_rpcs.sql", import.meta.url),
  "utf8",
);

test("inventory adjustment RPC is admin-guarded, locked, and audited", () => {
  assert.match(migration, /function public\.admin_adjust_inventory\(/i);
  assert.match(migration, /auth\.uid\(\) is null or not public\.can_manage_catalog\(\)/i);
  assert.match(migration, /for update/i);
  assert.match(migration, /reserved \+ v_inventory\.damaged/i);
  assert.match(migration, /'adjustment'::public\.inventory_movement_type/i);
  assert.match(migration, /revoke all on function public\.admin_adjust_inventory[\s\S]*from public, anon/i);
  assert.match(migration, /grant execute on function public\.admin_adjust_inventory[\s\S]*to authenticated/i);
});

test("inventory movement RPC validates types and protects reserved stock", () => {
  assert.match(migration, /function public\.admin_record_inventory_movement\(/i);
  assert.match(migration, /'purchase_receipt', 'customer_return', 'supplier_return', 'damage'/i);
  assert.match(migration, /Cannot return stock that is reserved or damaged/i);
  assert.match(migration, /Cannot mark reserved or already damaged stock as damaged/i);
  assert.match(migration, /p_movement_type::public\.inventory_movement_type/i);
  assert.match(migration, /grant execute on function public\.admin_record_inventory_movement[\s\S]*to authenticated/i);
});
