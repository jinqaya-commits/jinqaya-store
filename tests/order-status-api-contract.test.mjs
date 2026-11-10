import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../src/app/api/order-status/", import.meta.url);
const requestCode = await readFile(new URL("request-code/route.ts", root), "utf8");
const verify = await readFile(new URL("verify/route.ts", root), "utf8");
const status = await readFile(new URL("route.ts", root), "utf8");

test("request-code uses the same generic response whether an order matches or not", () => {
  assert.match(requestCode, /if \(allowed === true\)\s*\{[\s\S]*?sendOrderStatusVerificationCode/);
  assert.match(requestCode, /If the order number and email match, a verification code will be sent\./);
  assert.doesNotMatch(requestCode, /json\(\{[^}]*orderNumber[^}]*\}\)/);
  assert.match(requestCode, /Cache-Control": "no-store, private"/);
});

test("request-code never returns or logs the raw verification code", () => {
  assert.doesNotMatch(requestCode, /console\.(?:log|error|warn)\([^\n]*\bcode\b/i);
  assert.doesNotMatch(requestCode, /NextResponse\.json\([^\n]*\bcode\b/);
});

test("request-code validates bounded input before asking the Edge Function for a challenge", () => {
  assert.match(requestCode, /readBoundedJson<unknown>\(request, 8 \* 1024\)/);
  assert.ok(requestCode.indexOf("parseOrderStatusRequestInput(body)") < requestCode.indexOf('action: "request-code"'));
});

test("verification refuses invalid Edge Function results and does not set a session cookie", () => {
  assert.match(verify, /if \(verified !== true\)/);
  assert.ok(verify.indexOf("if (verified !== true)") < verify.indexOf("response.cookies.set"));
  assert.match(verify, /The code is invalid or expired/);
});

test("verification stores only a hash in the database and protects the session cookie", () => {
  assert.match(verify, /tokenHash: sha256\(token\)/);
  assert.match(verify, /httpOnly: true/);
  assert.match(verify, /sameSite: "strict"/);
  assert.match(verify, /path: "\/api\/order-status"/);
  assert.match(verify, /maxAge: 1200/);
  assert.doesNotMatch(verify, /NextResponse\.json\(\{[^}]*token/);
});

test("order lookup rejects a missing cookie before contacting the Edge Function", () => {
  assert.match(status, /if \(!token\)/);
  assert.match(status, /status: 401/);
  assert.ok(status.indexOf("if (!token)") < status.indexOf("callOrderStatusApi"));
});

test("order lookup hashes the cookie token and clears expired sessions", () => {
  assert.match(status, /tokenHash: sha256\(token\)/);
  assert.match(status, /Your verification has expired/);
  assert.match(status, /maxAge: 0/);
});

test("logout clears the scoped session cookie and API responses are not cacheable", () => {
  assert.match(status, /export async function DELETE\(\)/);
  assert.match(status, /response\.cookies\.set\(COOKIE, ""/);
  assert.match(status, /Cache-Control": "no-store, private"/);
  assert.match(verify, /Cache-Control": "no-store, private"/);
});

test("failed verification email delivery does not expose the privileged failure RPC", () => {
  assert.match(requestCode, /normal 60-second resend cooldown/);
  assert.doesNotMatch(requestCode, /delivery-failed|mark_order_status_email_challenge_delivery_failed/);
});
