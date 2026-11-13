import test from "node:test";
import assert from "node:assert/strict";
import { isRestrictedShippingDestination } from "../src/lib/shipping-country.ts";

test("restricted country codes are blocked even if the country name claims another destination", () => {
  assert.equal(isRestrictedShippingDestination("KR", "United States"), true);
  assert.equal(isRestrictedShippingDestination("BR", "Canada"), true);
});

test("restricted country names are blocked even if the submitted country code is different", () => {
  assert.equal(isRestrictedShippingDestination("US", "Brazil"), true);
  assert.equal(isRestrictedShippingDestination("CA", "South Korea"), true);
  assert.equal(isRestrictedShippingDestination("GB", "Republic of Korea"), true);
  assert.equal(isRestrictedShippingDestination("FR", "Brasil"), true);
});

test("country matching is case and accent insensitive", () => {
  assert.equal(isRestrictedShippingDestination("us", "República Federativa do Brasil"), true);
  assert.equal(isRestrictedShippingDestination("us", "  SOUTH   KOREA "), true);
});

test("unrestricted destinations remain available", () => {
  assert.equal(isRestrictedShippingDestination("US", "United States"), false);
  assert.equal(isRestrictedShippingDestination("FR", "France"), false);
  assert.equal(isRestrictedShippingDestination("AU", "Australia"), false);
});

test("missing or malformed destination fields do not create a false positive", () => {
  assert.equal(isRestrictedShippingDestination("", ""), false);
  assert.equal(isRestrictedShippingDestination(null, null), false);
});
