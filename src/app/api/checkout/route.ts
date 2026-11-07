import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendOrderRequestEmails } from "@/lib/order-email";

export const runtime = "nodejs";

type CheckoutBody = {
  customer?: { first_name?: string; last_name?: string; email?: string; phone?: string };
  shipping_address?: {
    country_code?: string;
    country?: string;
    state_region?: string;
    city?: string;
    address_line1?: string;
    address_line2?: string;
    postal_code?: string;
  };
  items?: Array<{ variant_id?: string; quantity?: number }>;
  customer_note?: string;
  idempotency_key?: string;
  website?: string;
};

export async function POST(request: Request) {
  let body: CheckoutBody;
  try {
    const rawBody = await request.text();
    if (rawBody.length > 20_000) {
      return NextResponse.json({ error: "Your checkout details are too large." }, { status: 413 });
    }
    body = JSON.parse(rawBody) as CheckoutBody;
  } catch {
    return NextResponse.json({ error: "Please check your checkout details and try again." }, { status: 400 });
  }

  if (!body.customer || !body.shipping_address || !Array.isArray(body.items) || !body.idempotency_key) {
    return NextResponse.json({ error: "Please complete your contact and shipping details." }, { status: 400 });
  }

  if (body.items.some((item) => !item || typeof item !== "object")) {
    return NextResponse.json({ error: "Your bag contains an invalid item." }, { status: 400 });
  }

  const items = body.items.map((item) => ({
    variant_id: String(item.variant_id || ""),
    quantity: Number(item.quantity),
  }));

  if (items.length < 1 || items.length > 30 || items.some((item) =>
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(item.variant_id) ||
    !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 99
  )) {
    return NextResponse.json({ error: "Your bag contains an invalid item. Please return to your bag and try again." }, { status: 400 });
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("submit_guest_order", {
      p_idempotency_key: body.idempotency_key,
      p_customer: {
        first_name: String(body.customer.first_name || ""),
        last_name: String(body.customer.last_name || ""),
        email: String(body.customer.email || ""),
        phone: String(body.customer.phone || ""),
      },
      p_shipping_address: {
        country_code: String(body.shipping_address.country_code || ""),
        country: String(body.shipping_address.country || ""),
        state_region: String(body.shipping_address.state_region || ""),
        city: String(body.shipping_address.city || ""),
        address_line1: String(body.shipping_address.address_line1 || ""),
        address_line2: String(body.shipping_address.address_line2 || ""),
        postal_code: String(body.shipping_address.postal_code || ""),
      },
      p_items: items,
      p_customer_note: String(body.customer_note || ""),
      p_honeypot: String(body.website || ""),
    });

    if (error) {
      const message = error.message.toLowerCase();
      if (message.includes("too many checkout")) {
        return NextResponse.json({ error: "Too many checkout attempts. Please try again later." }, { status: 429 });
      }
      if (message.includes("no longer available") || message.includes("different currencies") || message.includes("quantities")) {
        return NextResponse.json({ error: error.message }, { status: 409 });
      }
      if (message.includes("please") || message.includes("invalid") || message.includes("empty") || message.includes("complete")) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      return NextResponse.json({ error: "We couldn't submit your order request. Please try again." }, { status: 500 });
    }

    // Email delivery is best-effort and must not undo a successfully recorded order request.
    if (data && typeof data === "object") {
      const order = data as {
        order_number?: string; customer_email?: string; customer_name?: string;
        subtotal?: number | string; currency?: string;
      };
      if (order.order_number && order.customer_email) {
        void sendOrderRequestEmails({
          orderNumber: order.order_number,
          customerName: order.customer_name || String(body.customer.first_name || ""),
          customerEmail: order.customer_email,
          subtotal: order.subtotal ?? 0,
          currency: order.currency || "USD",
        }).catch((error) => console.error("Order request notification failed:", error));
      }
    }
    return NextResponse.json({ order: data }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Checkout is temporarily unavailable. Please try again shortly." }, { status: 503 });
  }
}
