import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const migration = await readFile(new URL("../supabase/migrations/20261112090000_reserve_stock_during_guest_checkout.sql", import.meta.url), "utf8");
const checkoutForm = await readFile(new URL("../src/app/checkout/checkout-form.tsx", import.meta.url), "utf8");

test("guest checkout locks inventory rows and only reserves when every variant is available", () => {
  assert.match(migration, /FOR UPDATE OF i/);
  assert.match(migration, /on_hand-reserved-damaged >= v_stock_item\.quantity/);
  assert.match(migration, /IF v_stock_ready THEN/);
  assert.match(migration, /v_stock_ready := false/);
  assert.match(migration, /v_stock_plan := v_stock_plan \\|\\|/);
  assert.match(migration, /INSERT INTO public\.stock_reservations/);
  assert.match(migration, /expires_at[\s\S]*?interval '48 hours'/);
});

test("stock reservation and order status transition are atomic and recorded in inventory history", () => {
  assert.match(migration, /SET reserved=reserved\+v_stock_item\.quantity/);
  assert.match(migration, /INSERT INTO public\.inventory_movements/);
  assert.match(migration, /status='pending_payment'/);
  assert.match(migration, /INSERT INTO public\.order_status_history/);
  assert.match(migration, /else 'on_hold' end/);
  assert.match(migration, /'payment_ready',v_stock_ready/);
});

test("checkout confirmation distinguishes reserved stock from an order awaiting review", () => {
  assert.match(checkoutForm, /order\.payment_ready \?\? order\.status === "pending_payment"/);
  assert.match(checkoutForm, /\/order-status/);
  assert.match(checkoutForm, /Your items have been reserved for 48 hours/);
});

test("checkout copy explains the confirmed total and email-verified PayPal path", () => {
  assert.match(checkoutForm, /your confirmed total is shown after the server checks destination restrictions, current prices and stock/);
  assert.match(checkoutForm, /verify your email and continue to PayPal using the confirmed order total/);
  assert.match(checkoutForm, /payment remains unavailable/);
});
