import { createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { processOrderEmailOutbox } from "@/lib/order-email-outbox";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function isAuthorized(request: NextRequest) {
  const vercelSecret = process.env.CRON_SECRET;
  if (
    vercelSecret &&
    request.headers.get("authorization") === \`Bearer \${vercelSecret}\`
  ) {
    return true;
  }

  const secret = process.env.SUPABASE_CRON_HMAC_SECRET;
  const timestamp = request.headers.get("x-cron-timestamp");
  const signature = request.headers.get("x-cron-signature");
  if (!secret || !timestamp || !signature || !/^\d{13}$/.test(timestamp)) {
    return false;
  }

  const timestampMs = Number(timestamp);
  if (
    !Number.isSafeInteger(timestampMs) ||
    Math.abs(Date.now() - timestampMs) > 5 * 60 * 1000
  ) {
    return false;
  }

  const expected = createHmac("sha256", secret).update(timestamp, "utf8").digest();
  const received = Buffer.from(signature, "hex");
  return received.length === expected.length && timingSafeEqual(received, expected);
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await processOrderEmailOutbox({ limit: 100 });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("[order-email-outbox-secondary] scheduled processing failed", error);
    return NextResponse.json({ error: "Order email processing failed." }, { status: 500 });
  }
}
