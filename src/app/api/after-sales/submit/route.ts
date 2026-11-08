import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { sha256, sessionCookieName, verifyEvidenceObject, readBoundedJson } from "@/lib/after-sales-evidence";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
const MAX_REQUEST_BYTES = 16 * 1024;

export async function POST(req: NextRequest) {
 try {
  const body = await readBoundedJson<{ orderId?: unknown; description?: unknown; evidenceKeys?: unknown }>(req, MAX_REQUEST_BYTES);
  const orderId = String(body.orderId || "");
  const description = String(body.description || "").trim();
  const evidence = Array.isArray(body.evidenceKeys) ? body.evidenceKeys.map((value: unknown) => String(value)) : [];

  if (!/^[0-9a-f-]{36}$/i.test(orderId) || description.length < 10 || description.length > 5000 || evidence.length < 1 || evidence.length > 5) {
   return NextResponse.json({ error: "Please check your description and evidence files." }, { status: 400 });
  }

  const cookieStore = await cookies();
  const token = cookieStore.get(sessionCookieName)?.value;
  if (!token) return NextResponse.json({ error: "Please verify your email again." }, { status: 401 });

  if (new Set(evidence).size !== evidence.length || evidence.some((key: string) => !key.startsWith(`after-sales/${orderId}/`) || key.length > 500)) {
   return NextResponse.json({ error: "Invalid evidence reference." }, { status: 400 });
  }

  const supabase = createAdminClient();
  const tokenHash = sha256(token);
  const { data: valid, error: sessionError } = await supabase.rpc("check_after_sales_customer_session", { p_order_id: orderId, p_token_hash: tokenHash });
  if (sessionError || valid !== true) return NextResponse.json({ error: "Your verification has expired." }, { status: 401 });

  const metadata: Array<Awaited<ReturnType<typeof verifyEvidenceObject>>> = [];
  for (const key of evidence) {
   metadata.push(await verifyEvidenceObject(key, orderId));
  }
  for (let index = 0; index < evidence.length; index++) {
   const { data: ticket, error: ticketError } = await supabase.rpc("validate_after_sales_upload_ticket", {
    p_order_id: orderId, p_token_hash: tokenHash, p_object_key: evidence[index],
    p_content_type: metadata[index].contentType, p_actual_size: metadata[index].size,
   });
   if (ticketError || ticket !== true) return NextResponse.json({ error: "One or more files were not authorized for this session. Please upload them again." }, { status: 400 });
  }

  const { data, error } = await supabase.rpc("submit_customer_after_sales_case", {
   p_order_id: orderId, p_token_hash: tokenHash, p_description: description, p_evidence_keys: evidence,
  });
  if (error) throw error;
  if (!data || typeof data !== "object" || Array.isArray(data) || typeof (data as { case_number?: unknown }).case_number !== "string") {
   throw new Error("The after-sales RPC returned an unexpected result.");
  }

  const result = data as { case_number: string };
  const response = NextResponse.json({ ok: true, caseNumber: result.case_number });
  response.cookies.set(sessionCookieName, "", {
   httpOnly: true, secure: process.env.NODE_ENV === "production",
   sameSite: "strict", path: "/api/after-sales", maxAge: 0,
  });
  return response;
 } catch (error) {
  if (error instanceof Error && error.message === "Request body is too large.") {
   return NextResponse.json({ error: "Request body is too large." }, { status: 413 });
  }
  if (error instanceof SyntaxError || error instanceof TypeError) {
   return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  return NextResponse.json({ error: "Unable to submit your request. Please try again later." }, { status: 500 });
 }
}
