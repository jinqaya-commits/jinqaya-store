import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: allowed, error: permissionError } = await supabase.rpc("can_manage_catalog");
  if (permissionError || allowed !== true) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    return NextResponse.json({ error: "Invalid customer ID" }, { status: 400 });
  }

  let body: { notes?: unknown; tags?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request body" }, { status: 400 }); }
  if (typeof body.notes !== "string" || body.notes.length > 5000 || !Array.isArray(body.tags) ||
      body.tags.length > 20 || body.tags.some(tag => typeof tag !== "string" || tag.length > 30)) {
    return NextResponse.json({ error: "Please check the notes and tags." }, { status: 400 });
  }
  const tags = [...new Set((body.tags as string[]).map(tag => tag.trim()).filter(Boolean))].slice(0, 10);
  const { data, error } = await supabase.rpc("admin_update_customer_crm", {
    p_customer_id: id, p_notes: body.notes, p_tags: tags,
  });
  if (error) {
    const status = error.code === "42501" ? 403 : error.code === "P0002" ? 404 : 400;
    return NextResponse.json({ error: status === 403 ? "Forbidden" : status === 404 ? "Customer not found" : "Unable to save customer details." }, { status });
  }
  const result = data && typeof data === "object" && !Array.isArray(data)
    ? data as { tags?: unknown }
    : null;
  const savedTags = Array.isArray(result?.tags)
    ? result.tags.filter((tag): tag is string => typeof tag === "string")
    : tags;
  return NextResponse.json({ ok: true, tags: savedTags });
}
