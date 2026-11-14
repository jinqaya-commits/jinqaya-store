import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const migration = await readFile(
  new URL("../supabase/migrations/20261113192200_purchase_test_warehouse_guard.sql", import.meta.url),
  "utf8",
);
const page = await readFile(
  new URL("../src/app/admin/purchase-orders/page.tsx", import.meta.url),
  "utf8",
);

test("database blocks purchase-order creation when the default warehouse is a test warehouse", () => {
  assert.match(migration, /v_warehouse_name\s+~\*\s+'\(\^\|\[\^a-z\]\)\(test\|testing\|sandbox\|isolated\)/i);
  assert.match(migration, /The default warehouse is a test warehouse/);
});

test("database blocks receiving stock into purchase orders linked to a test warehouse", () => {
  assert.match(migration, /v_warehouse_name\s+is\s+null\s+or\s+v_warehouse_name\s+~\*/i);
  assert.match(migration, /Receiving is blocked until a real fulfillment warehouse is configured/);
});

test("purchase-order UI hides creation form when the default warehouse is missing, inactive, or test-only", () => {
  assert.match(page, /const warehouseIsTest=!warehouse\|\|!warehouse\.is_active\|\|/);
  assert.match(page, /warehouseIsTest\?<div/);
  assert.match(page, /No purchase order can be created against a test warehouse/);
});
