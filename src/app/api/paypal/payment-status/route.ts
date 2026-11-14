import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { callOrderStatusApi } from "@/lib/order-status-api";
import { sha256 } from "@/lib/order-status-security";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type OrderSnapshot = {
  order_number?: string;
  status?: string;
  payment_status?: string | null;
  currency?: string;
  total_amount?: number | string;
};

export async function GET() {
  const sessionToken = (await cookies()).get("jq_order_status_session")?.value;
  if (!sessionToken) {
    return NextResponse.json({ error: "Your secure order session is unavailable. Please use Track Order to verify your order." }, {
      status: 401,
      headers: { "Cache-Control": "no-store, private" },
    });
  }

  try {
    const order = await callOrderStatusApi<OrderSnapshot>({
      action: "get-order",
      tokenHash: sha256(sessionToken),
    });
    if (!order?.order_number) {
      return NextResponse.json({ error: "No order is available in this checkout session." }, {
        status: 404,
        headers: { "Cache-Control": "no-store, private" },
      });
    }

    return NextResponse.json({
      orderNumber: order.order_number,
      status: order.status || "pending_payment",
      paymentStatus: order.payment_status || "pending",
      currency: order.currency || "USD",
      totalAmount: Number(order.total_amount || 0),
    }, { headers: { "Cache-Control": "no-store, private" } });
  } catch {
    return NextResponse.json({ error: "We couldn’t retrieve your payment status. Please try again." }, {
      status: 503,
      headers: { "Cache-Control": "no-store, private" },
    });
  }
}
