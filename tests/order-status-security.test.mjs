import test from "node:test";
import assert from "node:assert/strict";
import { sha256, newCode, newSessionToken, readBoundedJson } from "../src/lib/order-status-security.ts";

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
