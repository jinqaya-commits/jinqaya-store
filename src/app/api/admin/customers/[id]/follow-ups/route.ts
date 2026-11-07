import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function authorizedClient() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const { data: allowed, error } = await supabase.rpc("can_manage_catalog");
  if (error || allowed !== true) return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  return { supabase, userId: claims.claims.sub as string };
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizedClient();
  if ("error" in auth) return auth.error;
  const { id } = await params;
  if (!uuidPattern.test(id)) return NextResponse.json({ error: "Invalid customer ID" }, { status: 400 });

  let body: { title?: unknown; dueAt?: unknown; notes?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request body" }, { status: 400 }); }
  if (typeof body.title !== "string" || body.title.trim().length < 2 || body.title.trim().length > 120 ||
      typeof body.dueAt !== "string" || !Number.isFinite(Date.parse(body.dueAt)) ||
      typeof body.notes !== "string" || body.notes.length > 2000) {
    return NextResponse.json({ error: "Enter a task, valid contact date and notes within the limits." }, { status: 400 });
  }

  const { data, error } = await auth.supabase.from("customer_follow_ups").insert({
    customer_id: id,
    title: body.title.trim(),
    due_at: new Date(body.dueAt).toISOString(),
    notes: body.notes.trim() || null,
    created_by: auth.userId,
  }).select("id,title,notes,due_at,status,completed_at,created_at").single();
  if (error) return NextResponse.json({ error: "Unable to save follow-up." }, { status: error.code === "42501" ? 403 : 400 });
  return NextResponse.json({ ok: true, followUp: data }, { status: 201 });
}
