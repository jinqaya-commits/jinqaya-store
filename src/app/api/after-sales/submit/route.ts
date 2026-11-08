import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { sha256, sessionCookieName, getEvidenceObjectMetadata, verifyEvidenceObject, readBoundedJson, type EvidenceObjectMetadata, createFinalEvidenceKey, promoteEvidenceObject, deleteEvidenceObjects } from "@/lib/after-sales-evidence";

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

  if (new Set(evidence).size !== evidence.length || evidence.some((key: string) => !key.startsWith(`after-sales-staging/${orderId}/`) || key.length > 500)) {
   return NextResponse.json({ error: "Invalid evidence reference." }, { status: 400 });
  }

  const supabase = createAdminClient();
  const tokenHash = sha256(token);
  const { data: valid, error: sessionError } = await supabase.rpc("check_after_sales_customer_session", { p_order_id: orderId, p_token_hash: tokenHash });
  if (sessionError || valid !== true) return NextResponse.json({ error: "Your verification has expired." }, { status: 401 });

  // Check for a previously committed identical request before validating
  // upload tickets: the original transaction consumes those tickets.
  const { data: replayCase, error: replayLookupError } = await supabase
   .from("after_sales_cases")
   .select("case_number,submission_upload_keys")
   .eq("order_id", orderId)
   .eq("customer_description", description)
   .contains("submission_upload_keys", evidence)
   .maybeSingle();
  const replayKeys = replayCase?.submission_upload_keys;
  const exactReplay = Array.isArray(replayKeys) &&
   replayKeys.length === evidence.length &&
   replayKeys.every((key: unknown, index: number) => key === evidence[index]);
  if (replayLookupError) throw replayLookupError;
  if (replayCase && exactReplay && typeof replayCase.case_number === "string") {
   const response = NextResponse.json({ ok: true, caseNumber: replayCase.case_number });
   response.cookies.set(sessionCookieName, "", {
    httpOnly: true, secure: process.env.NODE_ENV === "production",
    sameSite: "strict", path: "/api/after-sales", maxAge: 0,
   });
   return response;
  }

  // First inspect only object metadata, then validate every ticket. Do not
  // decode images or parse video containers until all files are authorized.
  const metadata: EvidenceObjectMetadata[] = [];
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

  // Promote the client-writable staging objects first, then validate the
  // server-owned final copies. A still-valid staging URL cannot alter a final
  // object after this copy has completed.
  const finalEvidenceKeys = evidence.map((key) => createFinalEvidenceKey(key, orderId));
  // Persist one stable final key per upload ticket before copying. Concurrent
  // retries must reuse the first reservation rather than orphaning competing
  // final objects that the cleanup worker cannot discover.
  for (let index = 0; index < evidence.length; index++) {
   const { data: ticket, error: ticketUpdateError } = await supabase
    .from("after_sales_upload_tickets")
    .update({ promoted_object_key: finalEvidenceKeys[index] })
    .eq("order_id", orderId)
    .eq("token_hash", tokenHash)
    .eq("object_key", evidence[index])
    .gt("expires_at", new Date().toISOString())
    .is("consumed_at", null)
    .is("promoted_object_key", null)
    .select("id")
    .maybeSingle();
   if (ticketUpdateError) throw ticketUpdateError;
   if (!ticket) {
    const { data: existingTicket, error: existingTicketError } = await supabase
     .from("after_sales_upload_tickets")
     .select("promoted_object_key")
     .eq("order_id", orderId)
     .eq("token_hash", tokenHash)
     .eq("object_key", evidence[index])
     .gt("expires_at", new Date().toISOString())
     .is("consumed_at", null)
     .maybeSingle();
    const existingKey = existingTicket?.promoted_object_key;
    if (existingTicketError || typeof existingKey !== "string" ||
        !existingKey.startsWith(`after-sales/${orderId}/`) || existingKey.length > 500) {
     throw new Error("Unable to reserve final evidence storage. Please retry your request.");
    }
    finalEvidenceKeys[index] = existingKey;
   }
  }

  const promotedKeys: string[] = [];
  try {
   for (let index = 0; index < evidence.length; index++) {
    await promoteEvidenceObject(evidence[index], finalEvidenceKeys[index], orderId);
    promotedKeys.push(finalEvidenceKeys[index]);
    await verifyEvidenceObject(finalEvidenceKeys[index], orderId, metadata[index]);
   }
  } catch (promotionError) {
   try { await deleteEvidenceObjects(promotedKeys); }
   catch (cleanupError) { console.error("[after-sales-submit] failed to clean promoted evidence", cleanupError); }
   throw promotionError;
  }

  const { data, error } = await supabase.rpc("submit_customer_after_sales_case", {
   p_order_id: orderId,
   p_token_hash: tokenHash,
   p_description: description,
   p_upload_keys: evidence,
   p_final_evidence_keys: finalEvidenceKeys,
  });

  let caseData = data as { case_number?: unknown } | null;
  if (error) {
   // The RPC may have committed even if its response was lost. Never delete
   // promoted evidence until a successful lookup proves no case references it.
   const { data: existingCase, error: lookupError } = await supabase
    .from("after_sales_cases")
    .select("case_number,submission_upload_keys")
    .eq("order_id", orderId)
    .eq("customer_description", description)
    .contains("submission_upload_keys", evidence)
    .maybeSingle();

   if (lookupError) {
    console.error("[after-sales-submit] unable to resolve ambiguous RPC result; retaining promoted evidence", lookupError);
    throw error;
   }

   const existingKeys = existingCase?.submission_upload_keys;
   const exactEvidenceMatch = Array.isArray(existingKeys) &&
    existingKeys.length === evidence.length &&
    existingKeys.every((key: unknown, index: number) => key === evidence[index]);
   if (existingCase && exactEvidenceMatch && typeof existingCase.case_number === "string") {
    caseData = existingCase as { case_number?: unknown };
   } else {
    try { await deleteEvidenceObjects(promotedKeys); }
    catch (cleanupError) { console.error("[after-sales-submit] failed to clean unreferenced final evidence", cleanupError); }
    throw error;
   }
  } else {
   // A still-valid staging PUT URL may recreate/overwrite only the temporary
   // object. The final evidence key is separate and is never client-writable.
   try { await deleteEvidenceObjects(evidence); }
   catch (cleanupError) { console.error("[after-sales-submit] staging cleanup deferred to scheduled cleanup", cleanupError); }
  }

  if (!caseData || typeof caseData !== "object" || typeof caseData.case_number !== "string") {
   throw new Error("The after-sales RPC returned an unexpected result.");
  }

  const result = caseData as { case_number: string };
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
