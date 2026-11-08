import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { sha256, sessionCookieName, getEvidenceObjectMetadata, verifyEvidenceObject, readBoundedJson } from "@/lib/after-sales-evidence";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
const MAX_REQUEST_BYTES = 16 * 1024;

export async function POST(req: NextRequest) {
 try {
  const body: unknown = await readBoundedJson<unknown>(req, MAX_REQUEST_BYTES);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
   return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const payload = body as Record<string, unknown>;
  if (typeof payload.orderId !== "string" ||
      typeof payload.description !== "string" ||
      !Array.isArray(payload.evidenceKeys) ||
      !payload.evidenceKeys.every((key: unknown) => typeof key === "string")) {
   return NextResponse.json({ error: "Please provide valid order, description, and evidence fields." }, { status: 400 });
  }
  const orderId = payload.orderId;
  const description = payload.description.trim();
  const evidence = payload.evidenceKeys as string[];

  if (!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(orderId) ||
      description.length < 10 || description.length > 5000 ||
      evidence.length < 1 || evidence.length > 5) {
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

  // First inspect only object metadata, then validate every ticket. Do not
  // decode images or parse video containers until all files are authorized.
  const metadata = [];
  for (const key of evidence) {
   metadata.push(await getEvidenceObjectMetadata(key, orderId));
  }
  for (let index = 0; index < evidence.length; index++) {
   const { data: ticket, error: ticketError } = await supabase.rpc("validate_after_sales_upload_ticket", {
    p_order_id: orderId, p_token_hash: tokenHash, p_object_key: evidence[index],
    p_content_type: metadata[index].contentType, p_actual_size: metadata[index].size,
   });
   if (ticketError || ticket !== true) return NextResponse.json({ error: "One or more files were not authorized for this session. Please upload them again." }, { status: 400 });
  }

  // Only authorized files proceed to full signature, image-decode, and video
  // container checks. Re-read metadata and reject changes since the ticket pass.
  for (let index = 0; index < evidence.length; index++) {
   await verifyEvidenceObject(evidence[index], orderId, metadata[index]);
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
