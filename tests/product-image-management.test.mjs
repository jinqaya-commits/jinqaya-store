import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("product editor supports multi-image selection, retry and batch description saving", async () => {
  const form = await readFile(new URL("../src/app/admin/products/[id]/edit/product-edit-form.tsx", import.meta.url), "utf8");
  assert.match(form, /type="file"[^>]*multiple/);
  assert.match(form, /Retry remaining images/);
  assert.match(form, /Save all image descriptions/);
  assert.match(form, /updateProductImageAltBatch/);
});

test("batch image descriptions are bounded, validated and scoped to the product", async () => {
  const actions = await readFile(new URL("../src/app/admin/products/actions.ts", import.meta.url), "utf8");
  const batch = actions.slice(actions.indexOf("export async function updateProductImageAltBatch"));
  assert.match(batch, /updates\.length > 100/);
  assert.match(batch, /new Set\(ids\)\.size !== ids\.length/);
  assert.match(batch, /item\.altText\.length > 180/);
  assert.match(batch, /eq\("product_id", productId\)\.in\("id", ids\)/);
  assert.match(batch, /Promise\.all\(normalized\.map/);
});
