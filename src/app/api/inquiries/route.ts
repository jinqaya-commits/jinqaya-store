import { createHash, randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendLeadInquiryEmail } from "@/lib/order-email";

export const runtime = "nodejs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function textValue(input: unknown, max: number) {
  if (typeof input !== "string") return null;
  const value = input.trim().slice(0, max);
  return value || null;
}

function safeReferrer(input: string | null) {
  if (!input) return null;
  try {
    const url = new URL(input);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.origin;
  } catch {
    return null;
  }
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
    if (raw.length > 10000) return NextResponse.json({ error: "Request too large." }, { status: 413 });
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    body = parsed as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  if (textValue(body.website, 200)) return NextResponse.json({ ok: true });
  const fullName = textValue(body.fullName, 160);
  const email = textValue(body.email, 254)?.toLowerCase() || null;
  const phone = textValue(body.phone, 80);
  const country = textValue(body.country, 100);
  const subject = textValue(body.subject, 180) || "Website enquiry";
  const message = textValue(body.message, 5000);
  const pagePath = textValue(body.pagePath, 500);
  if (!fullName || !email || !EMAIL.test(email) || !message || message.length < 5) {
    return NextResponse.json({ error: "Please provide your name, a valid email address and a message." }, { status: 400 });
  }

  const admin = createAdminClient();
  const now = new Date();
  const nowIso = now.toISOString();
  const windowStart = new Date(now.getTime() - 10 * 60 * 1000).toISOString();
  const { count: recentCount, error: rateError } = await admin.from("lead_inquiries")
    .select("id", { count: "exact", head: true })
    .ilike("email", email)
    .gte("submitted_at", windowStart);
  if (rateError) return NextResponse.json({ error: "Unable to submit your enquiry right now." }, { status: 500 });
  if ((recentCount || 0) >= 3) return NextResponse.json({ error: "Please wait a few minutes before sending another enquiry." }, { status: 429 });

  const referrer = safeReferrer(request.headers.get("referer"));
  const sessionToken = textValue(body.sessionToken, 36);
  let session: {
    id: string;
    visitor_id: string;
    source: string | null;
    medium: string | null;
    campaign: string | null;
    landing_page: string | null;
    referrer_url: string | null;
  } | null = null;

  if (sessionToken && UUID.test(sessionToken)) {
    const tokenHash = createHash("sha256").update(sessionToken).digest("hex");
    const { data } = await admin.from("visitor_sessions")
      .select("id,visitor_id,source,medium,campaign,landing_page,referrer_url")
      .eq("session_token_hash", tokenHash)
      .maybeSingle();
    session = data;
  }

  const nameParts = fullName.split(/\s+/);
  const firstName = nameParts.shift() || null;
  const lastName = nameParts.join(" ") || null;
  const { data: existingCustomer, error: customerLookupError } = await admin.from("customers")
    .select("id,first_name,last_name,phone")
    .ilike("email", email)
    .limit(1)
    .maybeSingle();
  if (customerLookupError) return NextResponse.json({ error: "Unable to save your enquiry right now." }, { status: 500 });

  let customerId = existingCustomer?.id || null;
  if (!customerId) {
    const { data: createdCustomer, error } = await admin.from("customers").insert({
      email,
      first_name: firstName,
      last_name: lastName,
      phone,
      accepts_marketing: false,
    }).select("id").single();
    if (error || !createdCustomer) return NextResponse.json({ error: "Unable to save your enquiry right now." }, { status: 500 });
    customerId = createdCustomer.id;
  }

  if (session) {
    await admin.from("visitor_identity_links").upsert({
      visitor_id: session.visitor_id,
      customer_id: customerId,
      link_method: "inquiry",
    }, { onConflict: "visitor_id,customer_id", ignoreDuplicates: true });
    await Promise.all([
      admin.from("visitor_sessions").update({ customer_id: customerId }).eq("visitor_id", session.visitor_id),
      admin.from("visitor_page_views").update({ customer_id: customerId }).eq("visitor_id", session.visitor_id),
      admin.from("visitor_events").update({ customer_id: customerId }).eq("visitor_id", session.visitor_id),
    ]);
  }

  let productId: string | null = null;
  const submittedProductId = textValue(body.productId, 36);
  if (submittedProductId && UUID.test(submittedProductId)) {
    const { data: product } = await admin.from("products").select("id").eq("id", submittedProductId).maybeSingle();
    productId = product?.id || null;
  }

  const countryCode = request.headers.get("x-vercel-ip-country")?.slice(0, 2).toUpperCase() || null;
  const inquiryNumber = "INQ-" + now.toISOString().slice(0, 10).replaceAll("-", "") + "-" + randomBytes(3).toString("hex").toUpperCase();
  const referrerHost = referrer ? new URL(referrer).hostname.replace(/^www\./, "") : null;
  const source = session?.source || referrerHost || "direct";
  const { data: inquiry, error: inquiryError } = await admin.from("lead_inquiries").insert({
    inquiry_number: inquiryNumber,
    customer_id: customerId,
    visitor_id: session?.visitor_id || null,
    session_id: session?.id || null,
    product_id: productId,
    full_name: fullName,
    email,
    phone,
    country_code: countryCode,
    country,
    subject,
    message,
    source,
    medium: session?.medium || (referrerHost ? "referral" : "direct"),
    campaign: session?.campaign || null,
    landing_page: session?.landing_page || pagePath,
    referrer_url: session?.referrer_url || referrer,
    submitted_at: nowIso,
  }).select("id,inquiry_number").single();

  if (inquiryError || !inquiry) return NextResponse.json({ error: "Unable to save your enquiry right now." }, { status: 500 });

  const emailData = {
    inquiryNumber: inquiry.inquiry_number,
    customerName: fullName,
    customerEmail: email,
    subject,
    message,
    productId,
    source,
  };
  const [staffEmail, customerEmail] = await Promise.all([
    sendLeadInquiryEmail("staff", process.env.ORDER_NOTIFICATION_EMAIL || "jinqaya@gmail.com", emailData, "jinqaya-inquiry-staff/" + inquiry.id),
    sendLeadInquiryEmail("customer", email, emailData, "jinqaya-inquiry-customer/" + inquiry.id),
  ]);
  if (!staffEmail.ok || !customerEmail.ok) console.warn("[lead-inquiry] saved, but one or more notification emails were not sent", inquiry.id);

  return NextResponse.json({ ok: true, inquiryNumber: inquiry.inquiry_number }, { status: 201 });
}
