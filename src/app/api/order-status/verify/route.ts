import { NextRequest, NextResponse } from "next/server";
import { callOrderStatusApi } from "@/lib/order-status-api";
import { newSessionToken, parseOrderStatusVerifyInput, readBoundedJson, sha256 } from "@/lib/order-status-security";

export const dynamic = "force-dynamic";
const COOKIE = "jq_order_status_session";
const NO_STORE = { "Cache-Control": "no-store, private" };

export async function POST(request: NextRequest) {
  try {
    const body: unknown = await readBoundedJson<unknown>(request, 8 * 1024);
    const input = parseOrderStatusVerifyInput(body);
    if (!input) {
      return NextResponse.json({ error: "Enter the six-digit code." }, { status: 400, headers: NO_STORE });
    }
    const { orderNumber, email, code } = input;

    const token = newSessionToken();
    const verified = await callOrderStatusApi<boolean>({
      action: "verify-code", orderNumber, email, code, tokenHash: sha256(token),
    });
    if (verified !== true) {
      return NextResponse.json(
        { error: "The code is invalid or expired. Request a new code and try again." },
        { status: 400, headers: NO_STORE },
      );
    }

    const response = NextResponse.json({ ok: true }, { headers: NO_STORE });
    response.cookies.set(COOKIE, token, {
      httpOnly: true, secure: process.env.NODE_ENV === "production",
      sameSite: "strict", path: "/api/order-status", maxAge: 1200,
    });
    return response;
  } catch (error) {
    if (error instanceof Error && error.message === "Request body is too large.") {
      return NextResponse.json({ error: "Request body is too large." }, { status: 413, headers: NO_STORE });
    }
    if (error instanceof SyntaxError || error instanceof TypeError) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400, headers: NO_STORE });
    }
    return NextResponse.json({ error: "Unable to verify this code." }, { status: 500, headers: NO_STORE });
  }
}
