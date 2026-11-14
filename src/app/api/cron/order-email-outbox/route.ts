import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { processOrderEmailOutbox } from "@/lib/order-email-outbox";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  // This worker can release reservations and send queued emails. Never run it in Preview.
  if (process.env.VERCEL_ENV !== "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = createAdminClient();
    const { data: reservationExpiry, error: reservationExpiryError } = await supabase.rpc(
      "release_expired_stock_reservations",
      { p_limit: 100 },
    );
    if (reservationExpiryError) throw reservationExpiryError;

    const emailOutbox = await processOrderEmailOutbox({ limit: 100 });
    return NextResponse.json({ ok: true, reservationExpiry, emailOutbox });
  } catch (error) {
    console.error("[order-email-outbox] scheduled processing failed", error);
    return NextResponse.json({ error: "Scheduled order processing failed." }, { status: 500 });
  }
}
