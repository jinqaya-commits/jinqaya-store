import { after, NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { callOrderStatusApi } from "@/lib/order-status-api";
import { sha256 } from "@/lib/order-status-security";
import { isSameOriginRequest, paypalRequest } from "@/lib/paypal";
import { processOrderEmailOutbox } from "@/lib/order-email-outbox";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const COOKIE = "jq_order_status_session";

type OrderSnapshot = {
  order_id?: string;
  order_number?: string;
  status?: string;
  currency?: string;
  total_amount?: number | string;
};

type PayPalCapture = {
  id?: string;
  status?: string;
  amount?: { value?: string; currency_code?: string };
};
type PayPalOrder = {
  id?: string;
  status?: string;
  purchase_units?: Array<{
    custom_id?: string;
    amount?: { value?: string; currency_code?: string };
    payments?: { captures?: PayPalCapture[] };
  }>;
};

function captureDetails(result: PayPalOrder, expectedOrderId: string, amount: number, currency: string) {
  const unit = result.purchase_units?.[0];
  if (!unit || unit.custom_id !== expectedOrderId) return null;
  if (unit.amount?.currency_code !== currency || Number(unit.amount.value).toFixed(2) !== amount.toFixed(2)) return null;
  const capture = unit.payments?.captures?.find((item) => item.status === "COMPLETED");
  if (!capture?.id || !capture.amount?.value || capture.amount.currency_code !== currency) return null;
  if (Number(capture.amount.value).toFixed(2) !== amount.toFixed(2)) return null;
  return capture;
}

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }

  const sessionToken = (await cookies()).get(COOKIE)?.value;
  if (!sessionToken) {
    return NextResponse.json({ error: "Verify your order email before paying." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid payment request." }, { status: 400 });
  }
  const paypalOrderId = body && typeof body === "object" && "paypalOrderId" in body
    ? (body as { paypalOrderId?: unknown }).paypalOrderId : null;
  if (typeof paypalOrderId !== "string" || !/^[A-Z0-9]{8,40}$/.test(paypalOrderId)) {
    return NextResponse.json({ error: "Invalid PayPal order reference." }, { status: 400 });
  }

  try {
    const order = await callOrderStatusApi<OrderSnapshot>({
      action: "get-order",
      tokenHash: sha256(sessionToken),
    });
    if (!order?.order_id || !["pending_payment", "paid", "on_hold"].includes(String(order.status))) {
      return NextResponse.json({ error: "This order is not available for payment." }, { status: 409 });
    }
    const currency = String(order.currency || "").trim().toUpperCase();
    const amount = Number(order.total_amount);
    if (!Number.isFinite(amount) || amount <= 0 || !/^[A-Z]{3}$/.test(currency)) {
      return NextResponse.json({ error: "The confirmed order total is invalid." }, { status: 409 });
    }

    let paypalOrder = await paypalRequest<PayPalOrder>("/v2/checkout/orders/" + paypalOrderId);
    if (paypalOrder.id !== paypalOrderId) {
      return NextResponse.json({ error: "PayPal order could not be verified." }, { status: 409 });
    }

    if (paypalOrder.status === "APPROVED") {
      paypalOrder = await paypalRequest<PayPalOrder>("/v2/checkout/orders/" + paypalOrderId + "/capture", {
        method: "POST",
        requestId: "jinqaya-capture-" + paypalOrderId,
        body: {},
      });
    }

    if (paypalOrder.status !== "COMPLETED") {
      return NextResponse.json({ error: "PayPal has not completed this payment. Please try again." }, { status: 409 });
    }
    const capture = captureDetails(paypalOrder, order.order_id, amount, currency);
    if (!capture) {
      return NextResponse.json({ error: "The PayPal payment details do not match this order. Please contact JINQAYA." }, { status: 409 });
    }

    const supabase = createAdminClient();
    const typed = supabase as unknown as {
      rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
    };
    const { data, error } = await typed.rpc("record_paypal_order_payment", {
      p_order_id: order.order_id,
      p_paypal_order_id: paypalOrderId,
      p_capture_id: capture.id,
      p_amount: amount.toFixed(2),
      p_currency: currency,
    });
    if (error) {
      console.error("[paypal] captured payment could not be recorded", error.message);
      return NextResponse.json({ error: "PayPal received the payment, but order confirmation needs assistance. Please contact info@jinqaya.com." }, { status: 503 });
    }

    after(async () => {
      try { await processOrderEmailOutbox({ orderId: order.order_id, limit: 20 }); }
      catch (emailError) { console.error("[paypal] payment email processing failed", emailError); }
    });

    const result = data && typeof data === "object" ? data as Record<string, unknown> : {};
    return NextResponse.json({
      ok: true,
      status: result.status || "paid",
      stockReviewRequired: result.stock_review_required === true,
      captureId: capture.id,
    }, { headers: { "Cache-Control": "no-store, private" } });
  } catch {
    return NextResponse.json({ error: "Unable to verify the PayPal payment right now. Please refresh your order status." }, { status: 503 });
  }
}
