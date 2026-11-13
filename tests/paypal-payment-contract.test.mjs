import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const routeRoot = new URL("../src/app/api/paypal/", import.meta.url);
const createOrder = await readFile(new URL("create-order/route.ts", routeRoot), "utf8");
const captureOrder = await readFile(new URL("capture-order/route.ts", routeRoot), "utf8");
const webhook = await readFile(new URL("webhook/route.ts", routeRoot), "utf8");
const verifyOrderStatus = await readFile(new URL("../src/app/api/order-status/verify/route.ts", import.meta.url), "utf8");
const paypal = await readFile(new URL("../src/lib/paypal.ts", import.meta.url), "utf8");
const emailOutbox = await readFile(new URL("../src/lib/order-email-outbox.ts", import.meta.url), "utf8");
const paymentSql = await readFile(new URL("../supabase/migrations/202611120003_paypal_order_payments.sql", import.meta.url), "utf8");

test("verified order session cookie is scoped to API routes used by PayPal", () => {
  assert.match(verifyOrderStatus, /path:\s*"\/api"/);
  assert.doesNotMatch(verifyOrderStatus, /path:\s*"\/api\/order-status"/);
  assert.match(createOrder, /const COOKIE = "jq_order_status_session"/);
  assert.match(captureOrder, /const COOKIE = "jq_order_status_session"/);
});

test("PayPal create-order requires same-origin and the secure checkout order session", () => {
  assert.ok(createOrder.indexOf("if (!isSameOriginRequest(request))") < createOrder.indexOf("(await cookies()).get(COOKIE)"));
  assert.match(createOrder, /if \(!sessionToken\)[\s\S]*?status: 401/);
  assert.doesNotMatch(createOrder, /Verify your order email before paying/);
  assert.match(createOrder, /action: "get-order",[\s\S]*?tokenHash: sha256\(sessionToken\)/);
});

test("PayPal create-order is limited to confirmed pending-payment orders with a live stock reservation", () => {
  assert.match(createOrder, /order\.status !== "pending_payment" \|\| order\.payment_ready !== true/);
  assert.match(createOrder, /!\/\^\[A-Z\]\{3\}\$\/\.test\(currency\)/);
  assert.match(createOrder, /!Number\.isFinite\(amount\) \|\| amount <= 0/);
});

test("PayPal create-order binds the PayPal purchase to the database order and exact confirmed total", () => {
  assert.match(createOrder, /requestId: order\.order_id/);
  assert.match(createOrder, /reference_id: order\.order_id/);
  assert.match(createOrder, /custom_id: order\.order_id/);
  assert.match(createOrder, /currency_code: currency, value: amount\.toFixed\(2\)/);
  assert.match(createOrder, /shipping_preference: "NO_SHIPPING"/);
  assert.match(createOrder, /Cache-Control": "no-store, private"/);
});

test("PayPal capture rejects oversized, malformed, and invalid order references", () => {
  assert.match(captureOrder, /rawBody\.length > 4_096/);
  assert.match(captureOrder, /body = JSON\.parse\(rawBody\)/);
  assert.match(captureOrder, /\/\^\[A-Z0-9\]\{8,40\}\$\//);
  assert.match(captureOrder, /if \(!isSameOriginRequest\(request\)\)/);
  assert.match(captureOrder, /if \(!sessionToken\)/);
});

test("PayPal capture verifies the PayPal order ID and only captures approved orders", () => {
  assert.match(captureOrder, /paypalOrder\.id !== paypalOrderId/);
  assert.match(captureOrder, /if \(paypalOrder\.status === "APPROVED"\)/);
  assert.match(captureOrder, /if \(paypalOrder\.status !== "COMPLETED"\)/);
});

test("PayPal capture validates order identity, purchase total, capture total, and currency", () => {
  assert.match(captureOrder, /unit\.custom_id !== expectedOrderId/);
  assert.match(captureOrder, /unit\.amount\?\.currency_code !== currency/);
  assert.match(captureOrder, /unit\.amount\.value\)\.toFixed\(2\) !== amount\.toFixed\(2\)/);
  assert.match(captureOrder, /item\.status === "COMPLETED"/);
  assert.match(captureOrder, /capture\.amount\.currency_code !== currency/);
  assert.match(captureOrder, /capture\.amount\.value\)\.toFixed\(2\) !== amount\.toFixed\(2\)/);
});

test("PayPal capture records only the verified capture through the server-side database RPC", () => {
  assert.match(captureOrder, /typed\.rpc\("record_paypal_order_payment"/);
  assert.match(captureOrder, /p_order_id: order\.order_id/);
  assert.match(captureOrder, /p_paypal_order_id: paypalOrderId/);
  assert.match(captureOrder, /p_capture_id: capture\.id/);
  assert.match(captureOrder, /p_amount: amount\.toFixed\(2\)/);
  assert.match(captureOrder, /p_currency: currency/);
  assert.match(captureOrder, /processOrderEmailOutbox\(\{ orderId: order\.order_id/);
});

test("PayPal webhook requires all transmission headers and validates the signature before processing", () => {
  assert.match(webhook, /if \(!transmissionId \|\| !transmissionTime \|\| !certUrl \|\| !authAlgo \|\| !transmissionSig\)/);
  assert.match(webhook, /verify-webhook-signature/);
  assert.match(webhook, /verification\.verification_status !== "SUCCESS"/);
  assert.ok(webhook.indexOf('verification.verification_status !== "SUCCESS"') < webhook.indexOf('event.event_type !== "PAYMENT.CAPTURE.COMPLETED"'));
});

test("PayPal webhook ignores unrelated event types and re-fetches the completed capture from PayPal", () => {
  assert.match(webhook, /event\.event_type !== "PAYMENT\.CAPTURE\.COMPLETED"/);
  assert.match(webhook, /related_ids\?\.order_id/);
  assert.match(webhook, /\/v2\/checkout\/orders\/.*paypalOrderId/);
  assert.match(webhook, /paypalOrder\.status !== "COMPLETED"/);
  assert.match(webhook, /item\.id === captureId && item\.status === "COMPLETED"/);
});

test("PayPal webhook compares event amount and currency to the verified capture before recording", () => {
  assert.match(webhook, /event\.resource\?\.amount\?\.value !== capture\.amount\.value/);
  assert.match(webhook, /event\.resource\?\.amount\?\.currency_code !== capture\.amount\.currency_code/);
  assert.match(webhook, /typed\.rpc\("record_paypal_order_payment"/);
  assert.match(webhook, /p_order_id: unit\.custom_id/);
  assert.match(webhook, /p_capture_id: captureId/);
});

test("PayPal credentials stay server-side and public config exposes only the client ID", () => {
  assert.match(paypal, /process\.env\.PAYPAL_CLIENT_SECRET/);
  assert.match(paypal, /Authorization: "Basic " \+ credentials/);
  assert.match(paypal, /return \{ enabled: true, clientId, sdkUrl: getPayPalSdkUrl\(\) \}/);
  assert.doesNotMatch(paypal, /NEXT_PUBLIC_PAYPAL_CLIENT_SECRET/);
});

test("the payment-recording RPC is idempotent, validates the confirmed total, and is service-role only", () => {
  assert.match(paymentSql, /create or replace function public\.record_paypal_order_payment/);
  assert.match(paymentSql, /v_existing\.provider_order_id=trim\(p_paypal_order_id\)/);
  assert.match(paymentSql, /v_existing\.provider_payment_id=trim\(p_capture_id\)/);
  assert.match(paymentSql, /round\(v_order\.total_amount,2\)<>round\(p_amount,2\)/);
  assert.match(paymentSql, /upper\(trim\(v_order\.currency\)\)<>upper\(trim\(p_currency\)\)/);
  assert.match(paymentSql, /revoke all on function public\.record_paypal_order_payment\(uuid,text,text,numeric,text\) from public,anon,authenticated/);
  assert.match(paymentSql, /grant execute on function public\.record_paypal_order_payment\(uuid,text,text,numeric,text\) to service_role/);
});

test("order email processing is blocked at the service boundary outside Production", () => {
  assert.match(emailOutbox, /if \(process\.env\.VERCEL_ENV !== "production"\)/);
  assert.ok(emailOutbox.indexOf('VERCEL_ENV !== "production"') < emailOutbox.indexOf("const supabase = createAdminClient();"));
  assert.match(emailOutbox, /return \{ processed: 0, sent: 0, retried: 0, dead: 0 \}/);
});
