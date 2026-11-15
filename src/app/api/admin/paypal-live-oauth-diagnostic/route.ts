import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getClaims();
  if (authError || !authData?.claims?.sub) {
    return NextResponse.json(
      { ok: false, error: "authentication_required" },
      { status: 401, headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  }

  const { data: canManage, error: permissionError } = await supabase.rpc("can_manage_catalog");
  if (permissionError || canManage !== true) {
    return NextResponse.json(
      { ok: false, error: "administrator_access_required" },
      { status: 403, headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  }

  if (process.env.VERCEL_ENV !== "production" || process.env.PAYPAL_ENVIRONMENT !== "live") {
    return NextResponse.json(
      { ok: false, error: "production_live_environment_not_configured" },
      { status: 503, headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  }

  const clientId = process.env.PAYPAL_CLIENT_ID?.trim();
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.json(
      { ok: false, error: "paypal_credentials_missing" },
      { status: 503, headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  }

  try {
    const credentials = Buffer.from(clientId + ":" + clientSecret).toString("base64");
    const response = await fetch("https://api-m.paypal.com/v1/oauth2/token", {
      method: "POST",
      headers: {
        Authorization: "Basic " + credentials,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    });

    const payload = await response.json().catch(() => null) as { access_token?: unknown } | null;
    if (!response.ok || typeof payload?.access_token !== "string") {
      return NextResponse.json(
        {
          ok: false,
          environment: "live",
          error: response.status === 401 || response.status === 403
            ? "paypal_credentials_rejected"
            : "paypal_oauth_upstream_error",
          upstreamStatus: response.status,
        },
        { status: 502, headers: { "Cache-Control": "no-store, max-age=0" } },
      );
    }

    return NextResponse.json(
      { ok: true, environment: "live", authenticated: true },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch {
    return NextResponse.json(
      { ok: false, environment: "live", error: "paypal_oauth_connection_failed" },
      { status: 502, headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  }
}
