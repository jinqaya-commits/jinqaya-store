import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const actions = await readFile(new URL("../src/app/admin/orders/actions.ts", import.meta.url), "utf8");

test("purchase order expected date accepts ISO YYYY-MM-DD values", () => {
  assert.match(actions, /expectedDate && !\/\^\\d\{4\}-\\d\{2\}-\\d\{2\}\$\//);
  const isoDate = /^\d{4}-\d{2}-\d{2}$/;
  assert.equal(isoDate.test("2026-12-31"), true);
  assert.equal(isoDate.test("2026/12/31"), false);
});

test("purchase order payment accepts decimal amounts and ISO payment dates", () => {
  assert.match(actions, /!\/\^\\d\+\(\?:\\\.\\d\{1,2\}\)\?\$\//);
  assert.match(actions, /!\/\^\\d\{4\}-\\d\{2\}-\\d\{2\}\$\/\.test\(paymentDate\)/);
  const amount = /^\d+(?:\.\d{1,2})?$/;
  assert.equal(amount.test("125"), true);
  assert.equal(amount.test("125.50"), true);
  assert.equal(amount.test("125.500"), false);
  assert.equal(amount.test("abc"), false);
});
