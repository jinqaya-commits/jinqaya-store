import { NextRequest, NextResponse } from "next/server";
import { processOrderEmailOutbox } from "@/lib/order-email-outbox";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await processOrderEmailOutbox({ limit: 100 });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("[order-email-outbox] scheduled processing failed", error);
    return NextResponse.json({ error: "Order email processing failed." }, { status: 500 });
  }
}
