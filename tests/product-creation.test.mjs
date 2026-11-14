import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const actions = await readFile(new URL("../src/app/admin/products/actions.ts", import.meta.url), "utf8");
const form = await readFile(new URL("../src/app/admin/products/new/product-create-form.tsx", import.meta.url), "utf8");

test("new product creation accepts multiple SKU variants and persists the first through the catalog RPC", () => {
  assert.match(actions, /variants:\s*CreateProductVariantInput\[\]/);
  assert.match(actions, /p_variant:\s*firstVariant\s*\?/);
  assert.match(actions, /insertMissingProductVariants\(supabase, productId, input\.variants/);
  assert.match(form, /useState<CreateProductVariantInput\[\]\>/);
  assert.match(form, /Add another SKU/);
});

test("variant validation rejects missing and duplicate SKUs case-insensitively", () => {
  assert.match(actions, /Every variant row with details must have a SKU/);
  assert.match(actions, /sku\.toLocaleLowerCase\(\)/);
  assert.match(actions, /Duplicate SKU in this product/);
  assert.match(actions, /Number\.isFinite\(price\)/);
});

test("a partially failed SKU save can be retried without inserting existing SKUs again", () => {
  assert.match(actions, /export async function saveProductVariants/);
  assert.match(actions, /existingSkus\.has\(item\.sku\.toLocaleLowerCase\(\)\)/);
  assert.match(form, /saveProductVariants\(productId, variants\)/);
  assert.match(form, /Retry SKU & image saving/);
});

test("variant rows are capped at 100 and blank rows remain optional", () => {
  assert.match(actions, /variants\.length > 100/);
  assert.match(actions, /if \(!sku && !variantName && !color && !size && !rawPrice && !rawCompare\) continue/);
  assert.match(form, /variants\.length >= 100/);
});
