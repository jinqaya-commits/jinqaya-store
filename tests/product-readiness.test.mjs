import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { getProductReadiness } from "../src/lib/product-readiness.ts";

const completeProduct = {
  shortDescription: "A clear product summary.",
  description: "A full description with confirmed product details.",
  material: "Cotton canvas",
  seoTitle: "Everyday Pet Carrier | JINQAYA",
  seoDescription: "A practical carrier for everyday outings with your pet.",
  images: [{ alt_text: "Beige pet carrier shown from the front", is_primary: true }],
  variants: [{ sku: "JQ-001-BE", price: "49.00", is_active: true }],
  categories: [{ is_primary: true, parent_id: "parent-category", is_active: true }],
};

test("a product with complete content, a main image, a priced SKU and an active primary category is publish-ready", () => {
  assert.deepEqual(getProductReadiness(completeProduct), { ready: true, missing: [] });
});

test("publishing checklist identifies missing product content and commerce details", () => {
  const result = getProductReadiness({
    ...completeProduct,
    shortDescription: "",
    images: [{ alt_text: "", is_primary: false }],
    variants: [{ sku: "", price: null, is_active: true }],
    categories: [],
  });
  assert.equal(result.ready, false);
  assert.deepEqual(result.missing, [
    "Short description",
    "Main image",
    "Image alt text",
    "Variant SKU",
    "Variant price",
    "Active primary category",
  ]);
});

test("inactive variants do not satisfy the publish requirement", () => {
  const result = getProductReadiness({
    ...completeProduct,
    variants: [{ sku: "JQ-001-BE", price: "49.00", is_active: false }],
  });
  assert.deepEqual(result.missing, ["Active variant"]);
});

test("the server action enforces readiness before publishing", async () => {
  const actions = await readFile(new URL("../src/app/admin/products/actions.ts", import.meta.url), "utf8");
  const publishAction = actions.slice(actions.indexOf("export async function setProductStatus"));
  assert.ok(publishAction.indexOf("getProductReadiness") < publishAction.indexOf('.update({'));
  assert.match(publishAction, /if \(!readiness\.ready\) return \{ error:/);
});
