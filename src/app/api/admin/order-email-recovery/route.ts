import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { processOrderEmailOutbox } from "@/lib/order-email-outbox";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// One-time, narrowly scoped recovery for the verified PayPal Sandbox test order.
// This endpoint is intentionally unavailable outside Vercel Preview.
const RECOVERY_ORDER_ID = "9f15c369-d5f6-4997-88b8-6eb164ced653";

export async function POST(request: NextRequest) {
  if (process.env.VERCEL_ENV !== "preview") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const supabase = await createClient();
  const { data: claims, error: claimsError } = await supabase.auth.getClaims();
  if (claimsError || !claims?.claims?.sub) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: allowed, error: permissionError } = await supabase.rpc("can_manage_catalog");
  if (permissionError || allowed !== true) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (
    !body ||
    typeof body !== "object" ||
    (body as { orderId?: unknown }).orderId !== RECOVERY_ORDER_ID
  ) {
    return NextResponse.json({ error: "Unsupported recovery target" }, { status: 400 });
  }

  try {
    const result = await processOrderEmailOutbox({ orderId: RECOVERY_ORDER_ID, limit: 3 });
    return NextResponse.json({ ok: true, ...result }, {
      headers: { "Cache-Control": "no-store, private" },
    });
  } catch (error) {
    console.error("[admin-order-email-recovery] processing failed", error);
    return NextResponse.json({ error: "Email recovery failed" }, { status: 500 });
  }
}
