import { after, NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { paypalRequest } from "@/lib/paypal";
import { processOrderEmailOutbox } from "@/lib/order-email-outbox";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type PayPalAmount = { value?: string; currency_code?: string };
type WebhookEvent = {
  id?: string;
  event_type?: string;
  resource?: {
    id?: string;
    status?: string;
    dispute_id?: string;
    reason?: string;
    amount?: PayPalAmount;
    seller_transaction_id?: string;
    supplementary_data?: { related_ids?: { order_id?: string; capture_id?: string } };
    disputed_transactions?: Array<{
      seller_transaction_id?: string;
      buyer_transaction_id?: string;
      seller?: { email?: string; merchant_id?: string };
    }>;
    links?: Array<{ rel?: string; href?: string }>;
  };
};
type PayPalOrder = {
  id?: string;
  status?: string;
  purchase_units?: Array<{
    custom_id?: string;
    amount?: PayPalAmount;
    payments?: { captures?: Array<{
      id?: string;
      status?: string;
      amount?: PayPalAmount;
    }> };
  }>;
};

const SUPPORTED_NON_CAPTURE_EVENTS = new Set([
  "PAYMENT.CAPTURE.REFUNDED",
  "PAYMENT.CAPTURE.REVERSED",
  "CUSTOMER.DISPUTE.CREATED",
  "CUSTOMER.DISPUTE.UPDATED",
  "CUSTOMER.DISPUTE.RESOLVED",
]);

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

    if (
      event.event_type !== "PAYMENT.CAPTURE.COMPLETED"
      && (!event.event_type || !SUPPORTED_NON_CAPTURE_EVENTS.has(event.event_type))
    ) {
      return NextResponse.json({ received: true });
    }

    if (event.event_type === "PAYMENT.CAPTURE.COMPLETED") {
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

      if (process.env.VERCEL_ENV === "production") {
        after(async () => {
          try { await processOrderEmailOutbox({ orderId: unit.custom_id!, limit: 20 }); }
          catch (emailError) { console.error("[paypal-webhook] payment email processing failed", emailError); }
        });
      }
      return NextResponse.json({ received: true });
    }

    if (event.event_type && SUPPORTED_NON_CAPTURE_EVENTS.has(event.event_type)) {
      const resource = event.resource ?? {};
      const relatedIds = resource.supplementary_data?.related_ids;
      const captureLink = resource.links?.find((link) => link.rel === "up")?.href;
      const captureIdFromLink = captureLink?.split("/captures/")[1]?.split("/")[0]?.split("?")[0];
      const captureId = relatedIds?.capture_id
        || resource.seller_transaction_id
        || resource.disputed_transactions?.[0]?.seller_transaction_id
        || captureIdFromLink
        || (event.event_type === "PAYMENT.CAPTURE.REVERSED" ? resource.id : undefined);
      const disputeEvent = event.event_type.startsWith("CUSTOMER.DISPUTE.");
      const amountValue = resource.amount?.value;
      const amount = amountValue && /^\d+(\.\d{1,2})?$/.test(amountValue) ? amountValue : null;
      const currency = resource.amount?.currency_code?.trim().toUpperCase() || null;

      if (!event.id || !captureId) {
        console.error("[paypal-webhook] supported event missing event or capture reference", event.event_type);
        return NextResponse.json({ error: "PayPal event is missing its payment reference." }, { status: 503 });
      }

      const supabase = createAdminClient();
      const typed = supabase as unknown as {
        rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
      };
      const { data, error } = await typed.rpc("process_paypal_non_capture_webhook", {
        p_event_id: event.id,
        p_event_type: event.event_type,
        p_resource_id: resource.id ?? null,
        p_resource: resource,
        p_capture_id: captureId,
        p_amount: amount,
        p_currency: currency,
        p_dispute_id: disputeEvent ? (resource.dispute_id || resource.id || null) : null,
      });
      if (error) {
        console.error("[paypal-webhook] non-capture event could not be processed", event.event_type, error.message);
        return NextResponse.json({ error: "Unable to record the PayPal refund or dispute event." }, { status: 503 });
      }
      return NextResponse.json({ received: true, result: data ?? null });
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[paypal-webhook] verification or processing failed", error);
    return NextResponse.json({ error: "Unable to verify the PayPal webhook." }, { status: 503 });
  }
}
