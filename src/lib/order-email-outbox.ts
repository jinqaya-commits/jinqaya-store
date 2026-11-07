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
  return {
    orderNumber: row.orderNumber,
    customerName: typeof row.customerName === "string" ? row.customerName : "",
    customerEmail: row.customerEmail,
    subtotal: row.subtotal,
    currency: row.currency,
  };
}

export async function processOrderEmailOutbox(options: { orderId?: string; limit?: number } = {}) {
  const supabase = createAdminClient();
  const limit = Math.min(Math.max(options.limit ?? 20, 1), 100);
  let processed = 0;
  let sent = 0;
  let retried = 0;
  let dead = 0;

  // Reclaim newly enqueued rows in a later pass (e.g. the staff copy created by the DB trigger).
  for (let pass = 0; pass < 5 && processed < limit; pass += 1) {
    const { data, error } = await supabase.rpc("claim_order_email_outbox", {
      p_order_id: options.orderId ?? null,
      p_limit: Math.min(20, limit - processed),
    });
    if (error) throw error;
    const rows = (data ?? []) as OutboxRow[];
    if (rows.length === 0) break;

    for (const row of rows) {
      processed += 1;
      const payload = parsePayload(row.payload);
      let success = false;
      let failure = "invalid_outbox_payload";

      if (payload && (row.recipient_type === "customer" || row.recipient_type === "staff")) {
        try {
          success = await sendOrderOutboxEmail(row.recipient_type, row.recipient_email, payload, `jinqaya-order-email/${row.id}`);
          failure = success ? "" : "resend_send_failed_or_email_configuration_missing";
        } catch (error) {
          failure = error instanceof Error ? error.message : "unknown_email_delivery_error";
        }
      }

      const { error: completeError } = await supabase.rpc("complete_order_email_outbox", {
        p_id: row.id,
        p_success: success,
        p_error: success ? null : failure,
        p_provider_message_id: null,
      });
      if (completeError) {
        // Leave the lease to expire; the next worker can safely reclaim the row.
        console.error("[order-email-outbox] unable to persist delivery result", row.id, completeError);
        retried += 1;
        continue;
      }
      if (success) sent += 1;
      else if (failure === "resend_send_failed_or_email_configuration_missing") retried += 1;
      else dead += 1;
    }
  }

  return { processed, sent, retried, dead };
}
