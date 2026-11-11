import { createHash, randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TOKEN = /^[a-f0-9]{64}$/i;

function value(input: unknown, max: number) {
  if (typeof input !== "string") return null;
  return input.trim().slice(0, max) || null;
}
function hash(input: string) {
  return createHash("sha256").update(input).digest("hex");
}
function validOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
  if (!origin || !host) return true;
  try { return new URL(origin).host === host; } catch { return false; }
}
function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(request: NextRequest) {
  const ticketId = value(request.nextUrl.searchParams.get("ticketId"), 36);
  const token = value(request.headers.get("x-chat-token"), 64);
  if (!ticketId || !UUID.test(ticketId) || !token || !TOKEN.test(token)) return jsonError("Chat session not found.", 404);

  const admin = createAdminClient();
  const { data: ticket, error } = await admin.from("support_tickets")
    .select("id,ticket_number,subject,status,customer_name,created_at,last_message_at,unread_by_customer")
    .eq("id", ticketId)
    .eq("guest_token_hash", hash(token))
    .maybeSingle();
  if (error || !ticket) return jsonError("Chat session not found.", 404);

  const { data: messages, error: messagesError } = await admin.from("support_messages")
    .select("id,sender_type,message,created_at")
    .eq("ticket_id", ticketId)
    .eq("is_internal", false)
    .order("created_at", { ascending: true })
    .limit(100);
  if (messagesError) return jsonError("Unable to load chat messages.", 500);

  return NextResponse.json({ ticket, messages: messages || [] }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  if (!validOrigin(request)) return jsonError("Invalid origin.", 403);

  let body: Record<string, unknown>;
  try {
    const raw = await request.text();
    if (raw.length > 7000) return jsonError("Message is too large.", 413);
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return jsonError("Invalid request.", 400);
    body = parsed as Record<string, unknown>;
  } catch {
    return jsonError("Invalid request.", 400);
  }

  if (value(body.website, 200)) return NextResponse.json({ ok: true }, { status: 201 });
  const action = value(body.action, 20);
  const message = value(body.message, 2000);
  if (!message || message.length < 1) return jsonError("Please enter a message.", 400);

  const admin = createAdminClient();
  const now = new Date().toISOString();

  if (action === "start") {
    const name = value(body.name, 120);
    const email = value(body.email, 254)?.toLowerCase() || null;
    if (email && !EMAIL.test(email)) return jsonError("Please enter a valid email address.", 400);
    if (email) {
      const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { count, error: rateError } = await admin.from("support_tickets")
        .select("id", { count: "exact", head: true })
        .ilike("customer_email", email)
        .gte("created_at", hourAgo);
      if (rateError) return jsonError("Unable to start chat. Please try again.", 500);
      if ((count || 0) >= 3) return jsonError("Please wait before starting another chat.", 429);
    }
    const subject = value(body.subject, 160) || "Website live chat";
    const pageUrl = value(body.pageUrl, 500);
    let customerId: string | null = null;

    if (email) {
      const { data: existing, error: lookupError } = await admin.from("customers")
        .select("id")
        .ilike("email", email)
        .limit(1)
        .maybeSingle();
      if (lookupError) return jsonError("Unable to start chat. Please try again.", 500);
      if (existing) customerId = existing.id;
      else {
        const parts = (name || "").split(/\s+/);
        const firstName = parts.shift() || null;
        const lastName = parts.join(" ") || null;
        const { data: created, error: createError } = await admin.from("customers")
          .insert({ email, first_name: firstName, last_name: lastName, accepts_marketing: false })
          .select("id")
          .single();
        if (createError || !created) return jsonError("Unable to start chat. Please try again.", 500);
        customerId = created.id;
      }
    }

    const visitorId = value(body.visitorId, 36);
    const sessionToken = value(body.sessionToken, 36);
    let linkedVisitorId: string | null = null;
    let linkedSessionId: string | null = null;
    if (body.analyticsConsent === "granted" && visitorId && UUID.test(visitorId) && sessionToken && UUID.test(sessionToken)) {
      const { data: session } = await admin.from("visitor_sessions")
        .select("id,visitor_id")
        .eq("session_token_hash", hash(sessionToken))
        .eq("visitor_id", visitorId)
        .maybeSingle();
      if (session) {
        linkedVisitorId = session.visitor_id;
        linkedSessionId = session.id;
        if (customerId) {
          await admin.from("visitor_identity_links").upsert({
            visitor_id: session.visitor_id,
            customer_id: customerId,
            link_method: "chat",
          }, { onConflict: "visitor_id,customer_id", ignoreDuplicates: true });
          await admin.from("visitor_sessions").update({ customer_id: customerId }).eq("visitor_id", session.visitor_id);
        }
      }
    }

    const token = randomBytes(32).toString("hex");
    const ticketNumber = "CHAT-" + now.slice(0, 10).replaceAll("-", "") + "-" + randomBytes(3).toString("hex").toUpperCase();
    const { data: ticket, error: ticketError } = await admin.from("support_tickets").insert({
      ticket_number: ticketNumber,
      customer_id: customerId,
      customer_email: email,
      customer_name: name,
      subject,
      status: "open",
      priority: "normal",
      guest_token_hash: hash(token),
      visitor_id: linkedVisitorId,
      session_id: linkedSessionId,
      source: value(body.source, 120),
      page_url: pageUrl,
      last_message_at: now,
      unread_by_staff: 1,
      unread_by_customer: 0,
    }).select("id,ticket_number,subject,status,created_at,last_message_at").single();
    if (ticketError || !ticket) return jsonError("Unable to start chat. Please try again.", 500);

    const { error: firstMessageError } = await admin.from("support_messages").insert({
      ticket_id: ticket.id,
      sender_type: "customer",
      message,
      is_internal: false,
    });
    if (firstMessageError) {
      await admin.from("support_tickets").delete().eq("id", ticket.id);
      return jsonError("Unable to send your message. Please try again.", 500);
    }
    return NextResponse.json({ ticket, chatToken: token }, { status: 201, headers: { "Cache-Control": "no-store" } });
  }

  if (action === "message") {
    const ticketId = value(body.ticketId, 36);
    const token = value(body.chatToken, 64);
    if (!ticketId || !UUID.test(ticketId) || !token || !TOKEN.test(token)) return jsonError("Chat session not found.", 404);

    const { data: ticket, error } = await admin.from("support_tickets")
      .select("id,status,unread_by_staff")
      .eq("id", ticketId)
      .eq("guest_token_hash", hash(token))
      .maybeSingle();
    if (error || !ticket) return jsonError("Chat session not found.", 404);
    if (ticket.status === "resolved" || ticket.status === "closed") return jsonError("This chat has been closed. Please start a new chat.", 409);

    const since = new Date(Date.now() - 60 * 1000).toISOString();
    const { count, error: rateError } = await admin.from("support_messages")
      .select("id", { count: "exact", head: true })
      .eq("ticket_id", ticketId)
      .eq("sender_type", "customer")
      .gte("created_at", since);
    if (rateError) return jsonError("Unable to send your message. Please try again.", 500);
    if ((count || 0) >= 8) return jsonError("Please wait a moment before sending another message.", 429);

    const { error: insertError } = await admin.from("support_messages").insert({
      ticket_id: ticketId,
      sender_type: "customer",
      message,
      is_internal: false,
    });
    if (insertError) return jsonError("Unable to send your message. Please try again.", 500);

    const { error: updateError } = await admin.from("support_tickets").update({
      last_message_at: now,
      updated_at: now,
      unread_by_staff: Number(ticket.unread_by_staff || 0) + 1,
      ...(ticket.status === "waiting_customer" ? { status: "open" as const } : {}),
    }).eq("id", ticketId);
    if (updateError) return jsonError("Your message was sent, but the chat status could not be updated.", 500);

    return NextResponse.json({ ok: true }, { status: 201, headers: { "Cache-Control": "no-store" } });
  }

  return jsonError("Unknown chat action.", 400);
}
