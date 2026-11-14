import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);

test("after-sales lifecycle changes enqueue customer mail without sending inline", async () => {
  const migration = await readFile(new URL("supabase/migrations/20261114150000_after_sales_customer_email_notifications.sql", root), "utf8");
  const updateRoute = await readFile(new URL("src/app/api/admin/orders/[id]/after-sales/[caseId]/route.ts", root), "utf8");
  assert.match(migration, /AFTER INSERT ON public\.after_sales_cases/);
  assert.match(migration, /AFTER UPDATE OF status, refund_status ON public\.after_sales_cases/);
  assert.match(migration, /after_sales_submitted/);
  assert.match(migration, /after_sales_under_review/);
  assert.match(migration, /after_sales_approved/);
  assert.match(migration, /after_sales_rejected/);
  assert.match(migration, /after_sales_resolved/);
  assert.match(migration, /after_sales_refund_recorded/);
  assert.doesNotMatch(updateRoute, /sendOrderOutboxEmail|processOrderEmailOutbox/);
});

test("after-sales email event payloads are strictly allowlisted and rendered as customer templates", async () => {
  const parser = await readFile(new URL("src/lib/order-email-outbox.ts", root), "utf8");
  const mail = await readFile(new URL("src/lib/order-email.ts", root), "utf8");
  assert.match(parser, /after_sales_refund_recorded/);
  assert.match(parser, /if \(!eventType\) return null/);
  assert.match(mail, /We’ve received your request/);
  assert.match(mail, /Your case is being reviewed/);
  assert.match(mail, /Your request has been approved/);
  assert.match(mail, /unable to approve the request/);
  assert.match(mail, /Your case has been resolved/);
  assert.match(mail, /Your refund has been recorded/);
  assert.match(mail, /escapeHtml\(detail\.copy\)/);
});

test("after-sales email delivery retains production-only and idempotent outbox safeguards", async () => {
  const outbox = await readFile(new URL("src/lib/order-email-outbox.ts", root), "utf8");
  const mail = await readFile(new URL("src/lib/order-email.ts", root), "utf8");
  assert.match(outbox, /process\.env\.VERCEL_ENV !== "production"/);
  assert.match(outbox, /jinqaya-order-email\/\$\{row\.id\}/);
  assert.match(mail, /process\.env\.VERCEL_ENV !== "production"/);
  assert.match(mail, /"Idempotency-Key"/);
  const dedupe = await readFile(new URL("supabase/migrations/20261114152000_after_sales_outbox_dedupe_by_case.sql", root), "utf8");
  assert.match(dedupe, /payload->>'caseNumber'/);
});
