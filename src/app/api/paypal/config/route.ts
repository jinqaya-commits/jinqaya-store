import { NextResponse } from "next/server";
import { getPayPalPublicConfig } from "@/lib/paypal";

export const dynamic = "force-dynamic";

export async function GET() {
  let config: Awaited<ReturnType<typeof getPayPalPublicConfig>>;
  try { config = await getPayPalPublicConfig(); }
  catch { return NextResponse.json({ enabled: false, error: "PayPal is temporarily unavailable." }, { status: 503, headers: { "Cache-Control": "no-store, private" } }); }
  return NextResponse.json(config, {
    headers: { "Cache-Control": "no-store, private" },
  });
}
