import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { callOrderStatusApi } from "@/lib/order-status-api";
import { sha256 } from "@/lib/order-status-security";

export const dynamic = "force-dynamic";
const COOKIE = "jq_order_status_session";
const NO_STORE = { "Cache-Control": "no-store, private" };

export async function GET() {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) {
    return NextResponse.json(
      { error: "Please verify your email to view this order." },
      { status: 401, headers: NO_STORE },
    );
  }

  try {
    const data = await callOrderStatusApi<unknown>({
      action: "get-order", tokenHash: sha256(token),
    });
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      const response = NextResponse.json(
        { error: "Your verification has expired. Please verify again." },
        { status: 401, headers: NO_STORE },
      );
      response.cookies.set(COOKIE, "", {
        httpOnly: true, secure: process.env.NODE_ENV === "production",
        sameSite: "strict", path: "/api/order-status", maxAge: 0,
      });
      return response;
    }
    return NextResponse.json({ order: data }, { headers: NO_STORE });
  } catch {
    return NextResponse.json(
      { error: "Unable to retrieve this order. Please try again later." },
      { status: 500, headers: NO_STORE },
    );
  }
}

export async function DELETE() {
  const token = (await cookies()).get(COOKIE)?.value;
  if (token) {
    try {
      await callOrderStatusApi<boolean>({
        action: "end-session", tokenHash: sha256(token),
      });
    } catch {
      const response = NextResponse.json(
        { error: "Unable to end the secure session. Please try again." },
        { status: 503, headers: NO_STORE },
      );
      response.cookies.set(COOKIE, "", {
        httpOnly: true, secure: process.env.NODE_ENV === "production",
        sameSite: "strict", path: "/api/order-status", maxAge: 0,
      });
      return response;
    }
  }
  const response = NextResponse.json({ ok: true }, { headers: NO_STORE });
  response.cookies.set(COOKIE, "", {
    httpOnly: true, secure: process.env.NODE_ENV === "production",
    sameSite: "strict", path: "/api/order-status", maxAge: 0,
  });
  return response;
}
