import test from "node:test";
import assert from "node:assert/strict";
import { sha256, newCode, newSessionToken, readBoundedJson, parseOrderStatusRequestInput, parseOrderStatusVerifyInput } from "../src/lib/order-status-security.ts";

test("sha256 returns a stable lowercase digest", () => {
  assert.equal(
    sha256("abc"),
    "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
  );
});

test("newCode always returns six decimal digits, including leading zeroes", () => {
  for (let i = 0; i < 500; i += 1) {
    assert.match(newCode(), /^\d{6}$/);
  }
});

test("newSessionToken is a 256-bit hex token", () => {
  const first = newSessionToken();
  const second = newSessionToken();
  assert.match(first, /^[a-f0-9]{64}$/);
  assert.notEqual(first, second);
});

test("readBoundedJson parses a valid JSON request", async () => {
  const request = new Request("https://example.test", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ orderNumber: "JQ-1001" }),
  });
  assert.deepEqual(await readBoundedJson(request, 1024), { orderNumber: "JQ-1001" });
});

test("readBoundedJson rejects a declared body larger than the limit", async () => {
  const request = new Request("https://example.test", {
    method: "POST",
    headers: { "content-length": "2048" },
    body: "{}",
  });
  await assert.rejects(readBoundedJson(request, 1024), /too large/i);
});

test("readBoundedJson rejects a streamed body larger than the limit", async () => {
  const body = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode('{"payload":"1234567890"}'));
      controller.close();
    },
  });
  const request = new Request("https://example.test", { method: "POST", body, duplex: "half" });
  await assert.rejects(readBoundedJson(request, 8), /too large/i);
});

test("readBoundedJson rejects malformed JSON", async () => {
  const request = new Request("https://example.test", { method: "POST", body: "{" });
  await assert.rejects(readBoundedJson(request, 1024), SyntaxError);
});

test("readBoundedJson rejects invalid UTF-8 instead of silently replacing bytes", async () => {
  const body = new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array([0xff, 0xfe]));
      controller.close();
    },
  });
  const request = new Request("https://example.test", { method: "POST", body, duplex: "half" });
  await assert.rejects(readBoundedJson(request, 1024), TypeError);
});

test("readBoundedJson classifies a missing request body as invalid JSON input", async () => {
  const request = new Request("https://example.test", { method: "POST" });
  await assert.rejects(readBoundedJson(request, 1024), SyntaxError);
});

test("request input validation normalizes email and trims order number", () => {
  assert.deepEqual(
    parseOrderStatusRequestInput({ orderNumber: "  JQ-1001  ", email: "  BUYER@EXAMPLE.COM " }),
    { orderNumber: "JQ-1001", email: "buyer@example.com" },
  );
});

test("request input validation rejects malformed objects and emails", () => {
  for (const value of [null, [], "text", {}, { orderNumber: "JQ-1", email: "not-an-email" }, { orderNumber: " ", email: "buyer@example.com" }]) {
    assert.equal(parseOrderStatusRequestInput(value), null);
  }
});

test("request input validation enforces maximum field lengths", () => {
  const parsed = parseOrderStatusRequestInput({ orderNumber: "X".repeat(100), email: "A".repeat(250) + "@b.co" });
  assert.equal(parsed?.orderNumber.length, 80);
  assert.equal(parsed?.email.length, 254);
});

test("verification input accepts exactly six digits and normalizes shared fields", () => {
  assert.deepEqual(
    parseOrderStatusVerifyInput({ orderNumber: " JQ-1001 ", email: " BUYER@EXAMPLE.COM ", code: " 001234 " }),
    { orderNumber: "JQ-1001", email: "buyer@example.com", code: "001234" },
  );
});

test("verification input rejects non-six-digit codes and malformed fields", () => {
  for (const code of ["12345", "1234567", "12a456", "", "１２３４５６"]) {
    assert.equal(parseOrderStatusVerifyInput({ orderNumber: "JQ-1", email: "buyer@example.com", code }), null);
  }
  assert.equal(parseOrderStatusVerifyInput({ orderNumber: "JQ-1", email: "bad", code: "123456" }), null);
});
