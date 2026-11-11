import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 20;

const RECIPIENT = "jinqaya@gmail.com";
const IDEMPOTENCY_KEY = "jinqaya-one-time-staff-mail-check-2026-11-11";

export async function GET() {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.ORDER_EMAIL_FROM;

  if (!apiKey || !from) {
    return NextResponse.json(
      { ok: false, error: "Email provider configuration is missing." },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": IDEMPOTENCY_KEY,
      },
      body: JSON.stringify({
        from,
        to: [RECIPIENT],
        subject: "JINQAYA email delivery test — no customer order",
        html: "<div style=\"font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#24231f\"><p style=\"letter-spacing:2px;color:#777\">JINQAYA</p><h2>Email delivery test</h2><p>This is a one-time operational test of the JINQAYA order-notification email service.</p><p><strong>No customer order was created.</strong> No payment was collected and no customer was contacted.</p><p>If you received this message, the configured sender and Resend delivery path are working.</p></div>",
        text: "JINQAYA email delivery test. This is a one-time operational test. No customer order was created, no payment was collected, and no customer was contacted. If you received this message, the configured sender and Resend delivery path are working.",
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });

    const result = await response.json().catch(() => null) as
      | { id?: unknown; message?: unknown }
      | null;

    if (!response.ok) {
      console.error("[one-time-mail-check] Resend rejected the test", response.status);
      return NextResponse.json(
        { ok: false, error: "Email provider rejected the test.", status: response.status },
        { status: 502, headers: { "Cache-Control": "no-store" } }
      );
    }

    return NextResponse.json(
      { ok: true, sentTo: RECIPIENT, providerAccepted: true,
        messageId: typeof result?.id === "string" ? result.id : null },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    console.error("[one-time-mail-check] Email provider request failed");
    return NextResponse.json(
      { ok: false, error: "Email provider request failed." },
      { status: 502, headers: { "Cache-Control": "no-store" } }
    );
  }
}
