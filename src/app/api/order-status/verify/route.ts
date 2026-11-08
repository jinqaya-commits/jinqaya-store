import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { newSessionToken, readBoundedJson, sha256 } from "@/lib/order-status-security";

export const dynamic = "force-dynamic";
const COOKIE = "jq_order_status_session";

export async function POST(request: NextRequest) {
  try {
    const body: unknown = await readBoundedJson<unknown>(request, 8 * 1024);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "Enter the six-digit code." }, { status: 400 });
    }
    const input = body as Record<string, unknown>;
    if (typeof input.orderNumber !== "string" || typeof input.email !== "string" || typeof input.code !== "string") {
      return NextResponse.json({ error: "Enter the six-digit code." }, { status: 400 });
    }
    const orderNumber = input.orderNumber.trim().slice(0, 80);
    const email = input.email.trim().toLowerCase().slice(0, 254);
    const code = input.code.trim();
    if (!orderNumber || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !/^\d{6}$/.test(code)) {
      return NextResponse.json({ error: "Enter the six-digit code." }, { status: 400 });
    }

    const token = newSessionToken();
    const supabase = createAdminClient();
    const { data, error } = await supabase.rpc("verify_order_status_email_code", {
      p_order_number: orderNumber, p_email: email, p_code: code, p_token_hash: sha256(token),
    });
    if (error || data !== true) {
      return NextResponse.json({ error: "The code is invalid or expired. Request a new code and try again." }, { status: 400 });
    }

    const response = NextResponse.json({ ok: true });
    response.cookies.set(COOKIE, token, {
      httpOnly: true, secure: process.env.NODE_ENV === "production",
      sameSite: "strict", path: "/api/order-status", maxAge: 1200,
    });
    return response;
  } catch (error) {
    if (error instanceof Error && error.message === "Request body is too large.") {
      return NextResponse.json({ error: "Request body is too large." }, { status: 413 });
    }
    if (error instanceof SyntaxError || error instanceof TypeError) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }
    return NextResponse.json({ error: "Unable to verify this code." }, { status: 500 });
  }
}
