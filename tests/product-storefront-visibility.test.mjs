import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const products = await readFile(new URL("../src/lib/products.ts", import.meta.url), "utf8");

test("internal checkout fixtures are excluded from public product listings", () => {
  assert.match(products, /internalPreviewProductSlugs\s*=\s*\["preview-checkout-test-item",\s*"test-harness-item"\]/);
  assert.match(products, /\.not\("slug",\s*"in",\s*`\(\$\{internalPreviewProductSlugs\.map/);
});

test("internal checkout fixtures cannot be opened by their direct product URL", () => {
  const directLookup = products.slice(products.indexOf("export async function getStoreProductBySlug"));
  assert.match(directLookup, /if \(\(internalPreviewProductSlugs as readonly string\[\]\)\.includes\(slug\)\) return null;/);
  assert.ok(directLookup.indexOf("includes(slug)") < directLookup.indexOf("const { data, error }"));
});
