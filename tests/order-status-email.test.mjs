import test from "node:test";
import assert from "node:assert/strict";

process.env.ORDER_EMAIL_FROM = "JINQAYA Test <test@example.test>";
process.env.RESEND_API_KEY = "re_test_only";
process.env.VERCEL_ENV = "production";

const { sendOrderStatusVerificationCode } = await import("../src/lib/order-email.ts");

function mockFetch(handler) {
  const original = globalThis.fetch;
  globalThis.fetch = handler;
  return () => { globalThis.fetch = original; };
}

test("verification email sends the correct recipient, subject, code and expiry copy", async () => {
  let captured;
  const restore = mockFetch(async (url, init) => {
    captured = { url, init, body: JSON.parse(init.body) };
    return Response.json({ id: "email_test_123" }, { status: 200 });
  });
  try {
    const result = await sendOrderStatusVerificationCode("buyer@example.test", "004219");
    assert.equal(result.ok, true);
    assert.equal(result.retryable, false);
    assert.equal(captured.url, "https://api.resend.com/emails");
    assert.equal(captured.init.method, "POST");
    assert.equal(captured.init.headers.Authorization, "Bearer re_test_only");
    assert.deepEqual(captured.body.to, ["buyer@example.test"]);
    assert.equal(captured.body.subject, "Your JINQAYA order status verification code");
    assert.match(captured.body.text, /004219/);
    assert.match(captured.body.text, /10 minutes/);
    assert.match(captured.body.html, /004219/);
  } finally {
    restore();
  }
});

test("verification email reports provider rejection without throwing", async () => {
  const restore = mockFetch(async () => Response.json({ message: "rate limited" }, { status: 429 }));
  try {
    const result = await sendOrderStatusVerificationCode("buyer@example.test", "123456");
    assert.equal(result.ok, false);
    assert.equal(result.retryable, true);
  } finally {
    restore();
  }
});

test("verification email reports server errors without throwing", async () => {
  const restore = mockFetch(async () => new Response("unavailable", { status: 503 }));
  try {
    const result = await sendOrderStatusVerificationCode("buyer@example.test", "123456");
    assert.equal(result.ok, false);
    assert.equal(result.retryable, true);
  } finally {
    restore();
  }
});

test("verification email handles network failures without leaking provider details", async () => {
  const restore = mockFetch(async () => { throw new Error("simulated network failure"); });
  try {
    const result = await sendOrderStatusVerificationCode("buyer@example.test", "123456");
    assert.equal(result.ok, false);
    assert.equal(result.retryable, true);
  } finally {
    restore();
  }
});

test("verification email uses no-store and a bounded provider timeout", async () => {
  let captured;
  const restore = mockFetch(async (_url, init) => {
    captured = init;
    return Response.json({ id: "email_test_456" });
  });
  try {
    await sendOrderStatusVerificationCode("buyer@example.test", "123456");
    assert.equal(captured.cache, "no-store");
    assert.ok(captured.signal instanceof AbortSignal);
  } finally {
    restore();
  }
});


test("email delivery is blocked outside Production without contacting the provider", async () => {
  const originalEnvironment = process.env.VERCEL_ENV;
  process.env.VERCEL_ENV = "preview";
  let providerCalled = false;
  const restore = mockFetch(async () => {
    providerCalled = true;
    return Response.json({ id: "must_not_send" }, { status: 200 });
  });
  try {
    const result = await sendOrderStatusVerificationCode("buyer@example.test", "123456");
    assert.equal(result.ok, false);
    assert.equal(result.retryable, false);
    assert.equal(result.error, "email_delivery_disabled_outside_production");
    assert.equal(providerCalled, false);
  } finally {
    restore();
    if (originalEnvironment === undefined) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = originalEnvironment;
  }
});
