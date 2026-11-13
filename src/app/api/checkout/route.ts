import { after, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { processOrderEmailOutbox } from "@/lib/order-email-outbox";
import { newSessionToken, sha256 } from "@/lib/order-status-security";
import { isRestrictedShippingDestination } from "@/lib/shipping-country";

export const runtime = "nodejs";

type CheckoutBody = {
  customer?: { first_name?: string; last_name?: string; email?: string; phone?: string };
  shipping_address?: {
    country_code?: string; country?: string; state_region?: string; city?: string;
    address_line1?: string; address_line2?: string; postal_code?: string;
  };
  items?: Array<{ variant_id?: string; quantity?: number }>;
  customer_note?: string; idempotency_key?: string; website?: string;
};

export async function POST(request: Request) {
  let body: CheckoutBody;
  try {
    const rawBody = await request.text();
    if (rawBody.length > 20_000) return NextResponse.json({ error: "Your checkout details are too large." }, { status: 413 });
    body = JSON.parse(rawBody) as CheckoutBody;
  } catch {
    return NextResponse.json({ error: "Please check your checkout details and try again." }, { status: 400 });
  }

  if (!body.customer || !body.shipping_address || !Array.isArray(body.items) || !body.idempotency_key) {
    return NextResponse.json({ error: "Please complete your contact and shipping details." }, { status: 400 });
  }
  // Enforce destination restrictions against both fields. Never trust a customer-entered
  // country code alone: a mismatched country name must not bypass the shipping policy.
  if (isRestrictedShippingDestination(body.shipping_address.country_code, body.shipping_address.country)) {
    return NextResponse.json({ error: "We do not currently ship to this destination." }, { status: 400 });
  }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.idempotency_key)) {
    return NextResponse.json({ error: "Your checkout session has expired. Please refresh and try again." }, { status: 400 });
  }
  if (body.items.some((item) => !item || typeof item !== "object")) {
    return NextResponse.json({ error: "Your bag contains an invalid item." }, { status: 400 });
  }

  const items = body.items.map((item) => ({ variant_id: String(item.variant_id || ""), quantity: Number(item.quantity) }));
  if (items.length < 1 || items.length > 30 || items.some((item) =>
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(item.variant_id) ||
    !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 99
  )) {
    return NextResponse.json({ error: "Your bag contains an invalid item. Please return to your bag and try again." }, { status: 400 });
  }

  try {
    // Privileged database access stays server-side; public clients cannot call this RPC directly.
    const supabase = createAdminClient();
    const { data, error } = await supabase.rpc("submit_guest_order", {
      p_idempotency_key: body.idempotency_key,
      p_customer: {
        first_name: String(body.customer.first_name || ""), last_name: String(body.customer.last_name || ""),
        email: String(body.customer.email || ""), phone: String(body.customer.phone || ""),
      },
      p_shipping_address: {
        country_code: String(body.shipping_address.country_code || ""), country: String(body.shipping_address.country || ""),
        state_region: String(body.shipping_address.state_region || ""), city: String(body.shipping_address.city || ""),
        address_line1: String(body.shipping_address.address_line1 || ""), address_line2: String(body.shipping_address.address_line2 || ""),
        postal_code: String(body.shipping_address.postal_code || ""),
      },
      p_items: items,
      p_customer_note: String(body.customer_note || ""),
      p_honeypot: String(body.website || ""),
    });

    if (error) {
      const message = error.message.toLowerCase();
      if (message.includes("do not currently ship to this destination")) return NextResponse.json({ error: "We do not currently ship to this destination." }, { status: 400 });
      if (message.includes("too many checkout")) return NextResponse.json({ error: "Too many checkout attempts. Please try again later." }, { status: 429 });
      if (message.includes("no longer available") || message.includes("different currencies") || message.includes("quantities")) {
        return NextResponse.json({ error: error.message }, { status: 409 });
      }
      if (message.includes("already been used")) {
        return NextResponse.json({ error: "This checkout request has already been used. Please refresh checkout and try again." }, { status: 409 });
      }
      if (message.includes("please") || message.includes("invalid") || message.includes("empty") || message.includes("complete")) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      return NextResponse.json({ error: "We couldn't submit your order request. Please try again." }, { status: 500 });
    }

    let paymentSessionToken = "";
    let paymentSessionReady = false;
    if (data && typeof data === "object" && !Array.isArray(data)) {
      const orderId = typeof data.order_id === "string" ? data.order_id : "";
      if (orderId) {
        after(async () => {
          try {
            await processOrderEmailOutbox({ orderId, limit: 20 });
          } catch (error) {
            console.error("[checkout] order email outbox processing failed", error);
          }
        });

        // Create a short-lived, server-issued order session so the customer can pay
        // immediately after checkout without looking up the order or entering an OTP.
        if (data.payment_ready === true) {
          const email = String(body.customer.email || "").trim().toLowerCase();
          paymentSessionToken = newSessionToken();
          const sessionClient = supabase as unknown as {
            from: (table: string) => {
              insert: (values: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
            };
          };
          const { error: sessionError } = await sessionClient
            .from("customer_order_status_sessions")
            .insert({
              order_id: orderId,
              email,
              token_hash: sha256(paymentSessionToken),
              expires_at: new Date(Date.now() + 20 * 60 * 1000).toISOString(),
            });
          if (sessionError) {
            paymentSessionToken = "";
            console.error("[checkout] secure payment session could not be created", sessionError.message);
          } else {
            paymentSessionReady = true;
          }
        }
      }
    }
    const response = NextResponse.json({
      order: data && typeof data === "object" && !Array.isArray(data)
        ? { ...data, payment_session_ready: paymentSessionReady }
        : data,
    }, { status: 201 });
    if (paymentSessionToken) {
      response.cookies.set("jq_order_status_session", paymentSessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        path: "/api",
        maxAge: 20 * 60,
      });
    }
    return response;
  } catch {
    return NextResponse.json({ error: "Checkout is temporarily unavailable. Please try again shortly." }, { status: 503 });
  }
}
