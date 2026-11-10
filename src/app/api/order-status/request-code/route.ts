import { NextRequest, NextResponse } from "next/server";
import { callOrderStatusApi } from "@/lib/order-status-api";
import { newCode, parseOrderStatusRequestInput, readBoundedJson } from "@/lib/order-status-security";
import { sendOrderStatusVerificationCode } from "@/lib/order-email";

export const dynamic = "force-dynamic";
const NO_STORE = { "Cache-Control": "no-store, private" };

export async function POST(request: NextRequest) {
  try {
    const body: unknown = await readBoundedJson<unknown>(request, 8 * 1024);
    const input = parseOrderStatusRequestInput(body);
    if (!input) {
      return NextResponse.json({ error: "Enter a valid order number and email." }, { status: 400, headers: NO_STORE });
    }
    const { orderNumber, email } = input;

    const code = newCode();
    const allowed = await callOrderStatusApi<boolean>({
      action: "request-code", orderNumber, email, code,
    });
    if (allowed === true) {
      const sent = await sendOrderStatusVerificationCode(email, code);
      // A failed delivery keeps the normal 60-second resend cooldown.
      // The internal delivery-failed RPC is intentionally not exposed by the public Edge Function.
      if (!sent.ok) {
        console.error("[order-status] verification email delivery was not confirmed");
      }
    }
    return NextResponse.json({
      ok: true,
      message: "If the order number and email match, a verification code will be sent.",
    }, { headers: NO_STORE });
  } catch (error) {
    if (error instanceof Error && error.message === "Request body is too large.") {
      return NextResponse.json({ error: "Request body is too large." }, { status: 413, headers: NO_STORE });
    }
    if (error instanceof SyntaxError || error instanceof TypeError) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400, headers: NO_STORE });
    }
    return NextResponse.json({ error: "Unable to process this request. Please try again later." }, { status: 500, headers: NO_STORE });
  }
}
