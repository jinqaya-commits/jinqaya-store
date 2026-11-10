import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../supabase/functions/order-status-api/index.ts", import.meta.url), "utf8");

test("Edge Function authenticates the public application key itself", () => {
  assert.doesNotMatch(source, /verify_jwt/i);
  assert.match(source, /req\.headers\.get\("apikey"\)/);
  assert.match(source, /SUPABASE_PUBLISHABLE_KEYS/);
  assert.match(source, /return accepted\.has\(supplied\)/);
});

test("Edge Function keeps elevated database credentials server-side", () => {
  assert.match(source, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(source, /createClient\(supabaseUrl, serviceRoleKey/);
  assert.doesNotMatch(source, /serviceRoleKey[^\n]*Response|Response[^\n]*serviceRoleKey/);
});

test("Edge Function exposes order-status actions including protected delivery failure marking", () => {
  for (const action of ["request-code", "verify-code", "get-order"]) {
    assert.ok(source.includes(`"${action}"`), `missing action ${action}`);
  }
  assert.match(source, /Unsupported action/);
  assert.match(source, /validTokenHash/);
  assert.match(source, /validCode/);
  assert.match(source, /Cache-Control/);
});

test("Edge Function supports server-side session revocation using only the hashed token", () => {
  assert.match(source, /action === "end-session"/);
  assert.match(source, /validTokenHash\(body\.tokenHash\)/);
  assert.match(source, /revoke_customer_order_status_session/);
});

test("delivery failure action requires the private internal secret before its privileged RPC", () => {
  assert.match(source, /action === "delivery-failed"/);
  assert.match(source, /Deno\.env\.get\("ORDER_STATUS_INTERNAL_SECRET"\)/);
  assert.match(source, /req\.headers\.get\("x-order-status-internal-secret"\)/);
  assert.match(source, /if \(mismatch !== 0\) return json\(\{ error: "Unauthorized\." \}, 401\)/);
  assert.ok(source.indexOf("if (mismatch !== 0)") < source.indexOf("mark_order_status_email_challenge_delivery_failed"));
});

test("Edge Function never returns database errors or logs customer inputs", () => {
  assert.match(source, /Unable to process this request/);
  assert.doesNotMatch(source, /console\.(?:log|error|warn)\([^\n]*(?:email|orderNumber|code|token)/i);
  assert.doesNotMatch(source, /return json\(\{[^}]*serviceRoleKey/);
});
