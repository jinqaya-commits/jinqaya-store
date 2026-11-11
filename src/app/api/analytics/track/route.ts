import { createHash } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function value(input: unknown, max = 160): string | null {
  if (typeof input !== "string") return null;
  const cleaned = input.trim().slice(0, max);
  return cleaned || null;
}

function safeReferrer(input: unknown): string | null {
  const raw = value(input, 1200);
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.origin + url.pathname.slice(0, 500);
  } catch {
    return null;
  }
}

function headerValue(request: NextRequest, name: string, max = 120): string | null {
  const raw = request.headers.get(name);
  if (!raw) return null;
  try {
    return decodeURIComponent(raw).trim().slice(0, max) || null;
  } catch {
    return raw.trim().slice(0, max) || null;
  }
}

function deviceDetails(userAgent: string) {
  const ua = userAgent.toLowerCase();
  const device = /ipad|tablet/.test(ua) ? "tablet" : /mobile|iphone|android/.test(ua) ? "mobile" : "desktop";
  const browser = /edg\//.test(ua) ? "Edge" : /firefox\//.test(ua) ? "Firefox" : /opr\//.test(ua) ? "Opera" : /chrome\//.test(ua) ? "Chrome" : /safari\//.test(ua) ? "Safari" : "Other";
  const os = /windows/.test(ua) ? "Windows" : /mac os|macintosh/.test(ua) ? "macOS" : /iphone|ipad/.test(ua) ? "iOS" : /android/.test(ua) ? "Android" : /linux/.test(ua) ? "Linux" : "Other";
  return { device, browser, os };
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
  if (origin && host) {
    try {
      if (new URL(origin).host !== host) return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
    } catch {
      return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
    }
  }

  let body: Record<string, unknown>;
  try {
    const raw = await request.text();
    if (raw.length > 8000) return NextResponse.json({ error: "Request too large." }, { status: 413 });
    body = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  if (body.consent !== "granted") return new Response(null, { status: 204 });

  const visitorId = value(body.visitorId, 36);
  const sessionToken = value(body.sessionToken, 36);
  const pagePath = value(body.pagePath, 500);
  if (!visitorId || !UUID.test(visitorId) || !sessionToken || !UUID.test(sessionToken) || !pagePath || !pagePath.startsWith("/") || pagePath.startsWith("//")) {
    return NextResponse.json({ error: "Invalid tracking data." }, { status: 400 });
  }

  const sessionTokenHash = createHash("sha256").update(sessionToken).digest("hex");
  const now = new Date().toISOString();
  const referrer = safeReferrer(body.referrerUrl);
  const userAgent = request.headers.get("user-agent") || "";
  const details = deviceDetails(userAgent);
  const query = new URL(request.url).searchParams;
  const sourceParam = value(body.source, 120);
  const medium = value(body.medium, 120);
  const campaign = value(body.campaign, 160);
  const term = value(body.term, 160);
  const content = value(body.content, 160);
  const gclid = value(body.gclid, 240);
  const fbclid = value(body.fbclid, 240);
  const countryCode = headerValue(request, "x-vercel-ip-country", 2)?.toUpperCase() || null;
  const country = countryCode;
  const region = headerValue(request, "x-vercel-ip-country-region");
  const city = headerValue(request, "x-vercel-ip-city");

  const admin = createAdminClient();
  const { data: existing, error: lookupError } = await admin
    .from("visitor_sessions")
    .select("id,visitor_id")
    .eq("session_token_hash", sessionTokenHash)
    .maybeSingle();

  if (lookupError) return NextResponse.json({ error: "Unable to record visit." }, { status: 500 });

  let sessionId: string;
  let canonicalVisitorId: string;
  if (existing) {
    sessionId = existing.id;
    canonicalVisitorId = existing.visitor_id;
    const { error } = await admin.from("visitor_sessions").update({
      last_seen_at: now,
      exit_page: pagePath,
      ip_country_code: countryCode,
      ip_country: country,
      ip_region: region,
      ip_city: city,
    }).eq("id", sessionId);
    if (error) return NextResponse.json({ error: "Unable to update visit." }, { status: 500 });
  } else {
    const referrerHost = referrer ? new URL(referrer).hostname.replace(/^www\./, "") : null;
    const source = sourceParam || referrerHost || "direct";
    const { data: created, error } = await admin.from("visitor_sessions").insert({
      visitor_id: visitorId,
      session_token_hash: sessionTokenHash,
      consent_status: "granted",
      consent_updated_at: now,
      started_at: now,
      last_seen_at: now,
      landing_page: pagePath,
      exit_page: pagePath,
      referrer_url: referrer,
      source,
      medium: medium || (referrerHost ? "referral" : "direct"),
      campaign,
      term,
      content,
      gclid,
      fbclid,
      ip_country_code: countryCode,
      ip_country: country,
      ip_region: region,
      ip_city: city,
      ip_anonymized_at: now,
      device_type: details.device,
      browser: details.browser,
      operating_system: details.os,
    }).select("id,visitor_id").single();

    if (error || !created) {
      if (error?.code === "23505") {
        const { data: raced } = await admin.from("visitor_sessions").select("id,visitor_id").eq("session_token_hash", sessionTokenHash).maybeSingle();
        if (!raced) return NextResponse.json({ error: "Unable to start visit." }, { status: 500 });
        sessionId = raced.id;
        canonicalVisitorId = raced.visitor_id;
      } else {
        return NextResponse.json({ error: "Unable to start visit." }, { status: 500 });
      }
    } else {
      sessionId = created.id;
      canonicalVisitorId = created.visitor_id;
    }
  }

  const pathOnly = pagePath.split("?")[0].split("#")[0];
  const { error: pageError } = await admin.from("visitor_page_views").insert({
    session_id: sessionId,
    visitor_id: canonicalVisitorId,
    page_path: pathOnly,
    page_title: value(body.pageTitle, 200),
    page_type: pathOnly.startsWith("/products/") ? "product" : pathOnly.startsWith("/shop/") ? "collection" : "page",
    referrer_url: referrer,
    metadata: {},
    viewed_at: now,
  });

  if (pageError) return NextResponse.json({ error: "Unable to record page view." }, { status: 500 });
  return NextResponse.json({ ok: true }, { status: 200 });
}
