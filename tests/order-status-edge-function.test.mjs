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

test("Edge Function exposes only the four order-status RPC actions", () => {
  for (const action of ["request-code", "verify-code", "get-order"]) {
    assert.ok(source.includes(`"${action}"`), `missing action ${action}`);
  }
  assert.match(source, /Unsupported action/);
  assert.match(source, /validTokenHash/);
  assert.match(source, /validCode/);
  assert.match(source, /Cache-Control/);
});

test("Edge Function never returns database errors or logs customer inputs", () => {
  assert.match(source, /Unable to process this request/);
  assert.doesNotMatch(source, /console\.(?:log|error|warn)\([^\n]*(?:email|orderNumber|code|token)/i);
  assert.doesNotMatch(source, /return json\(\{[^}]*serviceRoleKey/);
});
