import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const checkoutRoute = await readFile(new URL("../src/app/api/checkout/route.ts", import.meta.url), "utf8");
const checkoutForm = await readFile(new URL("../src/app/checkout/checkout-form.tsx", import.meta.url), "utf8");
const createOrder = await readFile(new URL("../src/app/api/paypal/create-order/route.ts", import.meta.url), "utf8");
const captureOrder = await readFile(new URL("../src/app/api/paypal/capture-order/route.ts", import.meta.url), "utf8");
const orderEmail = await readFile(new URL("../src/lib/order-email.ts", import.meta.url), "utf8");

test("successful checkout creates a short-lived server-side order session only when stock is reserved", () => {
  assert.match(checkoutRoute, /if \(data\.payment_ready === true\)/);
  assert.match(checkoutRoute, /from\("customer_order_status_sessions"\)/);
  assert.match(checkoutRoute, /token_hash: sha256\(paymentSessionToken\)/);
  assert.match(checkoutRoute, /expires_at: new Date\(Date\.now\(\) \+ 20 \* 60 \* 1000\)/);
  assert.match(checkoutRoute, /httpOnly: true/);
  assert.match(checkoutRoute, /sameSite: "strict"/);
  assert.match(checkoutRoute, /path: "\/api"/);
  assert.match(checkoutRoute, /payment_session_ready: paymentSessionReady/);
});

test("checkout shows the PayPal payment control immediately after a reserved order", () => {
  assert.match(checkoutForm, /import \{ PayPalPaymentButton \} from "\.\.\/order-status\/paypal-payment-button"/);
  assert.match(checkoutForm, /order\.payment_session_ready === true/);
  assert.match(checkoutForm, /<PayPalPaymentButton/);
  assert.match(checkoutForm, /no need to look up your order or enter a verification code/);
  assert.match(checkoutForm, /TRACK ORDER & PAY/);
});

test("PayPal endpoints use the automatically-created checkout session and keep the email lookup as a fallback", () => {
  assert.match(createOrder, /jq_order_status_session/);
  assert.match(captureOrder, /jq_order_status_session/);
  assert.match(createOrder, /secure checkout session has expired/);
  assert.match(captureOrder, /secure checkout session has expired/);
});

test("order email explains immediate payment and the fallback order lookup", () => {
  assert.match(orderEmail, /pay securely with PayPal directly on that page/);
  assert.match(orderEmail, /order number and checkout email on our Track Order page/);
});
