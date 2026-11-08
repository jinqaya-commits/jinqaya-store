import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { sha256 } from "@/lib/after-sales-evidence";

export const dynamic = "force-dynamic";
const COOKIE = "jq_order_status_session";

export async function GET() {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return NextResponse.json({ error: "Please verify your email to view this order." }, { status: 401 });

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase.rpc("get_customer_order_status", {
      p_token_hash: sha256(token),
    });
    if (error) throw error;
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      const response = NextResponse.json({ error: "Your verification has expired. Please verify again." }, { status: 401 });
      response.cookies.set(COOKIE, "", {
        httpOnly: true, secure: process.env.NODE_ENV === "production",
        sameSite: "strict", path: "/api/order-status", maxAge: 0,
      });
      return response;
    }
    return NextResponse.json({ order: data }, { headers: { "Cache-Control": "no-store, private" } });
  } catch {
    return NextResponse.json({ error: "Unable to retrieve this order. Please try again later." }, { status: 500 });
  }
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(COOKIE, "", {
    httpOnly: true, secure: process.env.NODE_ENV === "production",
    sameSite: "strict", path: "/api/order-status", maxAge: 0,
  });
  return response;
}
