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
    supplementary_data?: { related_ids?: { order_id?: string } };
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
