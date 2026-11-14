import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL("../supabase/migrations/20261113180200_enqueue_order_status_emails.sql", import.meta.url),
  "utf8",
);

test("order status transitions enqueue supported notification events", () => {
  for (const [status, event] of [
    ["pending_payment", "quote_confirmed"],
    ["paid", "payment_received"],
    ["shipped", "shipped"],
    ["delivered", "delivered"],
    ["cancelled", "cancelled"],
  ]) {
    assert.match(migration, new RegExp(`when '${status}' then '${event}'`));
  }
  assert.match(migration, /after update of status on public\.orders/i);
  assert.match(migration, /old\.status is distinct from new\.status/i);
});

test("status notification payload includes shipping, tracking, and stock-review context", () => {
  for (const key of ["eventType", "orderNumber", "customerName", "customerEmail", "subtotal", "currency", "shippingAmount", "shippingMethod", "trackingNumber", "trackingUrl", "stockReviewRequired"]) {
    assert.match(migration, new RegExp(`'${key}'`));
  }
  assert.match(migration, /on conflict \(order_id, event_type, recipient_type\) do nothing/i);
  assert.match(migration, /revoke all on function public\.enqueue_order_status_emails\(\) from public, anon, authenticated/i);
});
