import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { callOrderStatusApi } from "@/lib/order-status-api";
import { sha256 } from "@/lib/order-status-security";
import { isSameOriginRequest, paypalRequest } from "@/lib/paypal";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const COOKIE = "jq_order_status_session";

type OrderSnapshot = {
  order_id?: string;
  order_number?: string;
  status?: string;
  currency?: string;
  total_amount?: number | string;
  payment_ready?: boolean;
};

type PayPalOrder = { id?: string; status?: string };

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }

  const sessionToken = (await cookies()).get(COOKIE)?.value;
  if (!sessionToken) {
    return NextResponse.json({ error: "Verify your order email before paying." }, { status: 401 });
  }

  try {
    const order = await callOrderStatusApi<OrderSnapshot>({
      action: "get-order",
      tokenHash: sha256(sessionToken),
    });
    if (!order?.order_id || order.status !== "pending_payment" || order.payment_ready !== true) {
      return NextResponse.json({ error: "This order is not ready for online payment. Please contact JINQAYA." }, { status: 409 });
    }

    const currency = String(order.currency || "").trim().toUpperCase();
    const amount = Number(order.total_amount);
    if (!/^[A-Z]{3}$/.test(currency) || !Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: "The confirmed order total is invalid. Please contact JINQAYA." }, { status: 409 });
    }

    const result = await paypalRequest<PayPalOrder>("/v2/checkout/orders", {
      method: "POST",
      requestId: order.order_id,
      body: {
        intent: "CAPTURE",
        purchase_units: [{
          reference_id: order.order_id,
          custom_id: order.order_id,
          description: "JINQAYA order " + String(order.order_number || ""),
          amount: { currency_code: currency, value: amount.toFixed(2) },
        }],
        payment_source: {
          paypal: {
            experience_context: {
              brand_name: "JINQAYA",
              user_action: "PAY_NOW",
              shipping_preference: "NO_SHIPPING",
              return_url: "https://www.jinqaya.com/order-status",
              cancel_url: "https://www.jinqaya.com/order-status",
            },
          },
        },
      },
    });

    if (typeof result.id !== "string") {
      return NextResponse.json({ error: "PayPal did not create a payment order." }, { status: 502 });
    }
    return NextResponse.json({ id: result.id }, {
      headers: { "Cache-Control": "no-store, private" },
    });
  } catch {
    return NextResponse.json({ error: "PayPal is temporarily unavailable. Please try again or contact JINQAYA." }, { status: 503 });
  }
}
