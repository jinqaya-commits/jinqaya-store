import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const migrationUrl = new URL("../supabase/migrations/20261109100000_customer_order_status_lookup.sql", import.meta.url);
const sql = (await readFile(migrationUrl, "utf8")).toLowerCase();

function functionBody(name) {
  const start = sql.indexOf(`create or replace function public.${name}`);
  assert.notEqual(start, -1, `missing function: ${name}`);
  const next = sql.indexOf("\ncreate or replace function public.", start + 1);
  return sql.slice(start, next === -1 ? sql.length : next);
}

test("challenge and session tables both enable RLS", () => {
  assert.match(sql, /alter table public\.order_status_email_challenges enable row level security/);
  assert.match(sql, /alter table public\.customer_order_status_sessions enable row level security/);
});

test("challenge and session tables revoke direct access from public client roles", () => {
  for (const table of ["order_status_email_challenges", "customer_order_status_sessions"]) {
    assert.match(sql, new RegExp(`revoke all on public\\.${table} from public, anon, authenticated`));
  }
});

test("all privileged RPCs pin an empty search_path", () => {
  for (const name of ["create_order_status_email_challenge", "verify_order_status_email_code", "get_customer_order_status"]) {
    assert.match(functionBody(name), /security definer set search_path\s*=\s*''/);
  }
});

test("RPC execution is revoked from public client roles and granted only to service_role", () => {
  const signatures = [
    "create_order_status_email_challenge(text,text,text)",
    "verify_order_status_email_code(text,text,text,text)",
    "get_customer_order_status(text)",
  ];
  for (const signature of signatures) {
    assert.match(sql, new RegExp(`revoke all on function public\\.${signature.replace(/[()]/g, "\\$&")} from public, anon, authenticated`));
    assert.match(sql, new RegExp(`grant execute on function public\\.${signature.replace(/[()]/g, "\\$&")} to service_role`));
  }
});

test("challenge issuance enforces per-order, per-email, and cooldown limits", () => {
  const body = functionBody("create_order_status_email_challenge");
  assert.match(body, /order_id=v_order\.id and created_at>now\(\)-interval '1 hour'\) >= 5/);
  assert.match(body, /email=v_email and created_at>now\\(\\)-interval '1 hour'\\) >= 8/);
  assert.match(body, /created_at>now\\(\\)-interval '60 seconds'/);
});

test("verification limits attempts, locks the selected challenge, and creates a 20-minute session", () => {
  const body = functionBody("verify_order_status_email_code");
  assert.match(body, /attempts>=5/);
  assert.match(body, /limit 1 for update/);
  assert.match(body, /attempts=attempts\+1/);
  assert.match(body, /now\(\)\+interval '20 minutes'/);
});

test("email challenges expire after 10 minutes", () => {
  assert.match(functionBody("create_order_status_email_challenge"), /now\(\)\+interval '10 minutes'/);
});

test("order lookup requires a matching unexpired session token", () => {
  const body = functionBody("get_customer_order_status");
  assert.match(body, /where s\.token_hash=p_token_hash and s\.expires_at>now\(\)/);
  assert.match(body, /join public\.orders o on o\.id=s\.order_id/);
});

test("customer response is an explicit allowlist without private address or internal notes", () => {
  const body = functionBody("get_customer_order_status");
  for (const allowed of ["order_number", "status", "total_amount", "items", "shipment", "tracking_number"]) {
    assert.ok(body.includes(`'${allowed}'`), `expected customer field ${allowed}`);
  }
  for (const forbidden of ["shipping_address", "customer_phone", "internal_notes", "payment_intent"]) {
    assert.ok(!body.includes(`'${forbidden}'`), `private field must not be returned: ${forbidden}`);
  }
});
