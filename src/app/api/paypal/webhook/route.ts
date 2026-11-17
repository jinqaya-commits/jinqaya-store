import { after, NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { paypalRequest } from "@/lib/paypal";
import { processOrderEmailOutbox } from "@/lib/order-email-outbox";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type WebhookEvent = {
  id?: string;
  event_type?: string;
  resource?: {
    id?: string;
    status?: string;
    amount?: { value?: string; currency_code?: string };
    supplementary_data?: { related_ids?: { order_id?: string; capture_id?: string } };
    disputed_transactions?: Array<{ seller_transaction_id?: string; buyer_transaction_id?: string }>;
    reason?: string;
    dispute_amount?: { value?: string; currency_code?: string };
  };
};
type PayPalOrder = {
  id?: string;
  status?: string;
  purchase_units?: Array<{
    custom_id?: string;
    amount?: { value?: string; currency_code?: string };
    payments?: { captures?: Array<{
      id?: string;
      status?: string;
      amount?: { value?: string; currency_code?: string };
    }> };
  }>;
};

export async function POST(request: NextRequest) {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID?.trim();
  if (!webhookId) return NextResponse.json({ error: "Webhook is not configured." }, { status: 503 });

  let event: WebhookEvent;
  try {
    const raw = await request.text();
    if (raw.length > 64_000) return NextResponse.json({ error: "Payload too large." }, { status: 413 });
    event = JSON.parse(raw) as WebhookEvent;
  } catch {
    return NextResponse.json({ error: "Invalid webhook payload." }, { status: 400 });
  }

  const header = (name: string) => request.headers.get(name);
  const transmissionId = header("paypal-transmission-id");
  const transmissionTime = header("paypal-transmission-time");
  const certUrl = header("paypal-cert-url");
  const authAlgo = header("paypal-auth-algo");
  const transmissionSig = header("paypal-transmission-sig");
  if (!transmissionId || !transmissionTime || !certUrl || !authAlgo || !transmissionSig) {
    return NextResponse.json({ error: "Missing PayPal signature headers." }, { status: 400 });
  }

  try {
    const verification = await paypalRequest<{ verification_status?: string }>(
      "/v1/notifications/verify-webhook-signature",
      {
        method: "POST",
        body: {
          transmission_id: transmissionId,
          transmission_time: transmissionTime,
          cert_url: certUrl,
          auth_algo: authAlgo,
          transmission_sig: transmissionSig,
          webhook_id: webhookId,
          webhook_event: event,
        },
      },
    );
    if (verification.verification_status !== "SUCCESS") {
      return NextResponse.json({ error: "Invalid PayPal signature." }, { status: 400 });
    }

    const supportedEvents = new Set([
      "PAYMENT.CAPTURE.REFUNDED",
      "PAYMENT.CAPTURE.REVERSED",
      "CUSTOMER.DISPUTE.CREATED",
      "CUSTOMER.DISPUTE.UPDATED",
      "CUSTOMER.DISPUTE.RESOLVED",
    ]);

    if (supportedEvents.has(event.event_type || "")) {
      const resource = event.resource;
      const dispute = event.event_type?.startsWith("CUSTOMER.DISPUTE.") === true;
      let captureId = resource?.supplementary_data?.related_ids?.capture_id;
      if (event.event_type === "PAYMENT.CAPTURE.REVERSED") captureId = resource?.id;
      if (dispute) {
        captureId = resource?.disputed_transactions?.find(
          (item) => typeof item.seller_transaction_id === "string" && item.seller_transaction_id.length > 0,
        )?.seller_transaction_id;
      }
      const eventId = event.id;
      const resourceId = resource?.id;
      if (!eventId || !resourceId || !captureId) {
        return NextResponse.json({ error: "Incomplete PayPal refund or dispute event." }, { status: 400 });
      }

      const rawAmount = dispute ? resource?.dispute_amount : resource?.amount;
      const parsedAmount = rawAmount?.value ? Number(rawAmount.value) : null;
      const amount = parsedAmount !== null && Number.isFinite(parsedAmount) && parsedAmount > 0
        ? parsedAmount : null;
      const currency = rawAmount?.currency_code || null;

      const supabase = createAdminClient();
      const typed = supabase as unknown as {
        rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
      };
      const { data, error } = await typed.rpc("process_paypal_webhook_event", {
        p_event_id: eventId,
        p_event_type: event.event_type,
        p_resource_id: resourceId,
        p_capture_id: captureId,
        p_amount: amount,
        p_currency: currency,
        p_dispute_status: resource?.status || null,
        p_reason: resource?.reason || null,
        p_payload: event,
      });
      if (error) {
        console.error("[paypal-webhook] refund or dispute event could not be processed", error.message);
        return NextResponse.json({ error: "Unable to record the verified PayPal event." }, { status: 503 });
      }
      const result = data && typeof data === "object" ? data as Record<string, unknown> : {};
      if (result.retry === true) {
        return NextResponse.json({ error: "Related PayPal payment is not yet available. Retry this event." }, { status: 503 });
      }
      if (result.ok !== true) {
        return NextResponse.json({ error: "PayPal event requires manual review." }, { status: 422 });
      }
      return NextResponse.json({ received: true, processed: true, duplicate: result.duplicate === true });
    }

    if (event.event_type !== "PAYMENT.CAPTURE.COMPLETED") {
      return NextResponse.json({ received: true });
    }

    const paypalOrderId = event.resource?.supplementary_data?.related_ids?.order_id;
    const captureId = event.resource?.id;
    if (!paypalOrderId || !captureId) {
      return NextResponse.json({ error: "Incomplete capture event." }, { status: 400 });
    }

    const paypalOrder = await paypalRequest<PayPalOrder>("/v2/checkout/orders/" + encodeURIComponent(paypalOrderId));
    const unit = paypalOrder.purchase_units?.[0];
    const capture = unit?.payments?.captures?.find((item) => item.id === captureId && item.status === "COMPLETED");
    if (paypalOrder.status !== "COMPLETED" || !unit?.custom_id || !capture?.amount?.value || !capture.amount.currency_code) {
      return NextResponse.json({ error: "Capture could not be verified." }, { status: 503 });
    }
    if (event.resource?.amount?.value !== capture.amount.value ||
      event.resource?.amount?.currency_code !== capture.amount.currency_code) {
      return NextResponse.json({ error: "Capture amount mismatch." }, { status: 400 });
    }

    const supabase = createAdminClient();
    const typed = supabase as unknown as {
      rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
    };
    const { error } = await typed.rpc("record_paypal_order_payment", {
      p_order_id: unit.custom_id,
      p_paypal_order_id: paypalOrderId,
      p_capture_id: captureId,
      p_amount: capture.amount.value,
      p_currency: capture.amount.currency_code,
    });
    if (error) {
      console.error("[paypal-webhook] verified capture could not be recorded", error.message);
      return NextResponse.json({ error: "Unable to record the verified capture." }, { status: 503 });
    }

    // Only Production sends order emails automatically; Preview keeps test messages queued.
    if (process.env.VERCEL_ENV === "production") {
      after(async () => {
        try { await processOrderEmailOutbox({ orderId: unit.custom_id!, limit: 20 }); }
        catch (emailError) { console.error("[paypal-webhook] payment email processing failed", emailError); }
      });
    }
    return NextResponse.json({ received: true });
  } catch {
    return NextResponse.json({ error: "Unable to verify the PayPal webhook." }, { status: 503 });
  }
}
