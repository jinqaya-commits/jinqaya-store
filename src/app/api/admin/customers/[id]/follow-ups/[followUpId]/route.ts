import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string; followUpId: string }> }) {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: allowed, error: permissionError } = await supabase.rpc("can_manage_catalog");
  if (permissionError || allowed !== true) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id, followUpId } = await params;
  if (!uuidPattern.test(id) || !uuidPattern.test(followUpId)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

  let body: { status?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request body" }, { status: 400 }); }
  if (!["pending", "completed", "cancelled"].includes(String(body.status))) {
    return NextResponse.json({ error: "Invalid follow-up status." }, { status: 400 });
  }
  const status = body.status as "pending" | "completed" | "cancelled";
  const { data, error } = await supabase.from("customer_follow_ups").update({
    status,
    completed_at: status === "completed" ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  }).eq("id", followUpId).eq("customer_id", id)
    .select("id,title,notes,due_at,status,completed_at,created_at").maybeSingle();
  if (error) return NextResponse.json({ error: "Unable to update follow-up." }, { status: error.code === "42501" ? 403 : 400 });
  if (!data) return NextResponse.json({ error: "Follow-up not found." }, { status: 404 });
  return NextResponse.json({ ok: true, followUp: data });
}
