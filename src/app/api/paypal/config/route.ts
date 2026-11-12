import { NextResponse } from "next/server";
import { getPayPalPublicConfig } from "@/lib/paypal";

export const dynamic = "force-dynamic";

export async function GET() {
  const config = getPayPalPublicConfig();
  return NextResponse.json(config, {
    headers: { "Cache-Control": "no-store, private" },
  });
}
