import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const manager = await readFile(new URL("../src/app/admin/categories/category-tree-manager.tsx", import.meta.url), "utf8");
const actions = await readFile(new URL("../src/app/admin/categories/tree-actions.ts", import.meta.url), "utf8");

test("existing category descriptions can be edited and saved by an authorized category manager", () => {
  assert.match(manager, /Customer-facing description/);
  assert.match(manager, /description:draft\.description/);
  assert.match(manager, /maxLength=\{500\}/);
  assert.match(actions, /description\?:string/);
  assert.match(actions, /values\.description=description\|\|null/);
  assert.match(actions, /can_manage_catalog/);
  assert.match(actions, /Category description must be 500 characters or fewer/);
});
