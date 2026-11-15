import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Temporary production-only diagnostic. Vercel Cron supplies CRON_SECRET as a Bearer token.
export async function GET(request: NextRequest) {
  if (process.env.VERCEL_ENV !== "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404, headers: { "Cache-Control": "no-store" } });
  }

  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }

  if (process.env.PAYPAL_ENVIRONMENT !== "live") {
    return NextResponse.json({ ok: false, environment: "not_live", result: "wrong_environment" }, { status: 409, headers: { "Cache-Control": "no-store" } });
  }

  const clientId = process.env.PAYPAL_CLIENT_ID?.trim();
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.json({ ok: false, environment: "live", result: "credentials_missing" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }

  const startedAt = Date.now();
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
    const authenticated = response.ok && typeof payload?.access_token === "string";
    return NextResponse.json({
      ok: authenticated,
      environment: "live",
      result: authenticated ? "authenticated" : response.status === 401 || response.status === 403 ? "credentials_rejected" : "paypal_auth_http_error",
      httpStatus: response.status,
      durationMs: Date.now() - startedAt,
    }, { status: authenticated ? 200 : 502, headers: { "Cache-Control": "no-store, private" } });
  } catch (error) {
    const timedOut = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
    return NextResponse.json({
      ok: false,
      environment: "live",
      result: timedOut ? "timeout" : "network_error",
      durationMs: Date.now() - startedAt,
    }, { status: 502, headers: { "Cache-Control": "no-store, private" } });
  }
}
