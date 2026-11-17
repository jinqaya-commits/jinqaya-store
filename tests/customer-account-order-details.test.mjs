import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const accountPage = await readFile(new URL("../src/app/account/page.tsx", import.meta.url), "utf8");
const accountMigration = await readFile(new URL("../supabase/migrations/202611170001_customer_account_order_history.sql", import.meta.url), "utf8");

test("customer order details stay inside the authenticated account session", () => {
  assert.match(accountPage, /supabase\.auth\.getUser\(\)/);
  assert.match(accountPage, /rpc\("get_my_customer_account_orders"\)/);
  assert.match(accountPage, /account\?\.orders\.find\(\(order\) => order\.order_number === selectedOrderNumber\)/);
  assert.match(accountPage, /href=\{"\/account\?order="/);
  assert.doesNotMatch(accountPage, /href=\{"\/order-status\?order="/);
});

test("customer order history RPC enforces verified user and customer ownership", () => {
  assert.match(accountMigration, /auth\.uid\(\)/);
  assert.match(accountMigration, /u\.email_confirmed_at is not null/);
  assert.match(accountMigration, /lower\(trim\(c\.email\)\)=v_email/);
  assert.match(accountMigration, /c\.auth_user_id is null or c\.auth_user_id=v_user_id/);
  assert.match(accountMigration, /grant execute on function public\.get_my_customer_account_orders\(\) to authenticated/);
});
