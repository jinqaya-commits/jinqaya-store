import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

async function staffUser() {
  const auth = await createClient();
  const { data: claims } = await auth.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) return null;
  const { data: allowed, error } = await auth.rpc("is_staff");
  if (error || allowed !== true) return null;
  return userId;
}

function validId(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const userId = await staffUser();
  if (!userId) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const { id } = await context.params;
  if (!validId(id)) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const admin = createAdminClient();
  const { data: ticket, error } = await admin.from("support_tickets")
    .select("id,ticket_number,subject,status,priority,customer_id,customer_name,customer_email,visitor_id,session_id,source,page_url,created_at,updated_at,last_message_at,unread_by_staff,unread_by_customer")
    .eq("id", id).maybeSingle();
  if (error || !ticket) return NextResponse.json({ error: "Chat not found." }, { status: 404 });

  const [{ data: messages, error: messageError }, { data: session }] = await Promise.all([
    admin.from("support_messages").select("id,sender_type,sender_user_id,message,is_internal,created_at")
      .eq("ticket_id", id).order("created_at", { ascending: true }).limit(300),
    ticket.session_id
      ? admin.from("visitor_sessions").select("ip_country,ip_region,ip_city,source,medium,campaign,landing_page,device_type,browser,operating_system,started_at,last_seen_at").eq("id", ticket.session_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  if (messageError) return NextResponse.json({ error: "Unable to load chat." }, { status: 500 });

  await admin.from("support_tickets").update({ unread_by_staff: 0 }).eq("id", id);
  return NextResponse.json({ ticket: { ...ticket, unread_by_staff: 0 }, messages: messages || [], visitor: session }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const userId = await staffUser();
  if (!userId) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const { id } = await context.params;
  if (!validId(id)) return NextResponse.json({ error: "Not found." }, { status: 404 });

  let body: Record<string, unknown>;
  try {
    const raw = await request.text();
    if (raw.length > 5000) return NextResponse.json({ error: "Message too large." }, { status: 413 });
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    body = parsed as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const message = typeof body.message === "string" ? body.message.trim().slice(0, 2000) : "";
  const isInternal = body.isInternal === true;
  if (!message) return NextResponse.json({ error: "Please enter a message." }, { status: 400 });

  const admin = createAdminClient();
  const { data: ticket, error: ticketError } = await admin.from("support_tickets")
    .select("id,status,unread_by_customer").eq("id", id).maybeSingle();
  if (ticketError || !ticket) return NextResponse.json({ error: "Chat not found." }, { status: 404 });
  if (ticket.status === "closed" && !isInternal) return NextResponse.json({ error: "Reopen this chat before replying." }, { status: 409 });

  const now = new Date().toISOString();
  const { error: insertError } = await admin.from("support_messages").insert({
    ticket_id: id,
    sender_type: "staff",
    sender_user_id: userId,
    message,
    is_internal: isInternal,
  });
  if (insertError) return NextResponse.json({ error: "Unable to send reply." }, { status: 500 });

  const { error: updateError } = await admin.from("support_tickets").update({
    last_message_at: now,
    updated_at: now,
    ...(isInternal ? {} : {
      status: "waiting_customer" as const,
      unread_by_customer: Number(ticket.unread_by_customer || 0) + 1,
      unread_by_staff: 0,
    }),
  }).eq("id", id);
  if (updateError) return NextResponse.json({ error: "Reply sent but ticket update failed." }, { status: 500 });
  return NextResponse.json({ ok: true }, { status: 201 });
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const userId = await staffUser();
  if (!userId) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const { id } = await context.params;
  if (!validId(id)) return NextResponse.json({ error: "Not found." }, { status: 404 });

  let body: Record<string, unknown>;
  try {
    const parsed: unknown = await request.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    body = parsed as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const status = body.status;
  const allowed = ["open", "in_progress", "waiting_customer", "resolved", "closed"];
  if (typeof status !== "string" || !allowed.includes(status)) return NextResponse.json({ error: "Invalid status." }, { status: 400 });

  const now = new Date().toISOString();
  const admin = createAdminClient();
  const { error } = await admin.from("support_tickets").update({
    status: status as "open" | "in_progress" | "waiting_customer" | "resolved" | "closed",
    resolved_at: status === "resolved" || status === "closed" ? now : null,
    updated_at: now,
    ...(status === "open" || status === "in_progress" ? { unread_by_staff: 0 } : {}),
  }).eq("id", id);
  if (error) return NextResponse.json({ error: "Unable to update chat status." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
