import { createAdminClient } from "@/lib/supabase/admin";
import { sendOrderOutboxEmail, type OrderEmailOutboxPayload } from "@/lib/order-email";

type OutboxRow = {
  id: string;
  order_id: string;
  recipient_type: string;
  recipient_email: string;
  payload: unknown;
};

function parsePayload(value: unknown): OrderEmailOutboxPayload | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (
    typeof row.orderNumber !== "string" ||
    typeof row.customerEmail !== "string" ||
    typeof row.currency !== "string" ||
    (typeof row.subtotal !== "number" && typeof row.subtotal !== "string")
  ) return null;
  const allowedEvents = ["order_received", "quote_confirmed", "payment_received", "shipped", "delivered", "cancelled"] as const;
  const eventType = typeof row.eventType === "string" && allowedEvents.includes(row.eventType as typeof allowedEvents[number])
    ? row.eventType as typeof allowedEvents[number] : "order_received";
  return {
    eventType,
    orderNumber: row.orderNumber,
    customerName: typeof row.customerName === "string" ? row.customerName : "",
    customerEmail: row.customerEmail,
    subtotal: row.subtotal,
    currency: row.currency,
    shippingAmount: typeof row.shippingAmount === "number" || typeof row.shippingAmount === "string" ? row.shippingAmount : null,
    shippingMethod: typeof row.shippingMethod === "string" ? row.shippingMethod : null,
    trackingNumber: typeof row.trackingNumber === "string" ? row.trackingNumber : null,
    trackingUrl: typeof row.trackingUrl === "string" ? row.trackingUrl : null,
  };
}

async function processRow(supabase: ReturnType<typeof createAdminClient>, row: OutboxRow) {
  const payload = parsePayload(row.payload);
  let success = false;
  let failure = "invalid_outbox_payload";
  let retryable = false;
  let providerMessageId: string | null = null;

  if (payload && (row.recipient_type === "customer" || row.recipient_type === "staff")) {
    const result = await sendOrderOutboxEmail(
      row.recipient_type,
      row.recipient_email,
      payload,
      `jinqaya-order-email/${row.id}`
    );
    success = result.ok;
    failure = result.error ?? "";
    retryable = result.retryable;
    providerMessageId = result.providerMessageId;
  }

  const { error: completeError } = await supabase.rpc("complete_order_email_outbox", {
    p_id: row.id,
    p_success: success,
    p_error: success ? null : failure,
    p_provider_message_id: providerMessageId,
    p_retryable: retryable,
  });

  if (completeError) {
    // Keep the lease until expiry. A retry uses the same stable provider idempotency key.
    console.error("[order-email-outbox] unable to persist delivery result", row.id, completeError);
    return { sent: 0, retried: 1, dead: 0 };
  }
  if (success) return { sent: 1, retried: 0, dead: 0 };
  return retryable
    ? { sent: 0, retried: 1, dead: 0 }
    : { sent: 0, retried: 0, dead: 1 };
}

export async function processOrderEmailOutbox(options: { orderId?: string; limit?: number } = {}) {
  const supabase = createAdminClient();
  const limit = Math.min(Math.max(options.limit ?? 20, 1), 100);
  let processed = 0;
  let sent = 0;
  let retried = 0;
  let dead = 0;

  // Claim small batches, then send concurrently so a batch finishes well inside its lease.
  for (let pass = 0; pass < 5 && processed < limit; pass += 1) {
    const { data, error } = await supabase.rpc("claim_order_email_outbox", {
      p_order_id: options.orderId ?? null,
      p_limit: Math.min(20, limit - processed),
    });
    if (error) throw error;
    const rows = (data ?? []) as OutboxRow[];
    if (rows.length === 0) break;

    processed += rows.length;
    const results = await Promise.all(rows.map((row) => processRow(supabase, row)));
    for (const result of results) {
      sent += result.sent;
      retried += result.retried;
      dead += result.dead;
    }
  }

  return { processed, sent, retried, dead };
}
