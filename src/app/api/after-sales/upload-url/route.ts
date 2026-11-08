import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { createEvidenceUploadUrl, sha256, sessionCookieName, readBoundedJson } from "@/lib/after-sales-evidence";

export const dynamic = "force-dynamic";
const MAX_REQUEST_BYTES = 8 * 1024;

const types = new Set([
 "image/jpeg", "image/png", "image/webp", "image/avif", "video/mp4", "video/quicktime",
]);

export async function POST(req: NextRequest) {
 try {
  const body: unknown = await readBoundedJson<unknown>(req, MAX_REQUEST_BYTES);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
   return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const payload = body as Record<string, unknown>;
  if (typeof payload.orderId !== "string" ||
      typeof payload.contentType !== "string" ||
      typeof payload.size !== "number") {
   return NextResponse.json({ error: "Please provide valid order, content type, and size fields." }, { status: 400 });
  }
  const orderId = payload.orderId;
  const contentType = payload.contentType;
  const size = payload.size;

  if (!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(orderId) || !types.has(contentType) ||
      !Number.isSafeInteger(size) || size <= 0 ||
      size > (contentType.startsWith("video/") ? 50 : 10) * 1024 * 1024) {
   return NextResponse.json({ error: "Unsupported file or file size." }, { status: 400 });
  }

  const cookieStore = await cookies();
  const token = cookieStore.get(sessionCookieName)?.value;
  if (!token) return NextResponse.json({ error: "Please verify your email again." }, { status: 401 });

  const supabase = createAdminClient();
  const tokenHash = sha256(token);
  const { data: valid, error: sessionError } = await supabase.rpc(
   "check_after_sales_customer_session",
   { p_order_id: orderId, p_token_hash: tokenHash },
  );
  if (sessionError || valid !== true) {
   return NextResponse.json({ error: "Your verification has expired." }, { status: 401 });
  }

  const ext = contentType === "image/jpeg" ? "jpg" :
   contentType === "image/png" ? "png" :
   contentType === "image/webp" ? "webp" :
   contentType === "image/avif" ? "avif" :
   contentType === "video/mp4" ? "mp4" : "mov";
  const key = `after-sales-staging/${orderId}/${randomUUID()}.${ext}`;

  const { data: reserved, error: reserveError } = await supabase.rpc("reserve_after_sales_upload", {
   p_order_id: orderId, p_token_hash: tokenHash, p_object_key: key,
   p_content_type: contentType, p_expected_size: size,
  });
  if (reserveError || reserved !== true) {
   return NextResponse.json({ error: "Upload limit reached or session expired. Please remove a file or verify again." }, { status: 429 });
  }

  let url: string;
  try {
   url = await createEvidenceUploadUrl(key, contentType, size);
  } catch (signingError) {
   // No upload URL was returned to the customer, so this reservation cannot
   // represent a customer-uploaded object. Release only this exact,
   // unconsumed ticket to avoid charging the session's hourly upload quota.
   const { error: releaseError } = await supabase
    .from("after_sales_upload_tickets")
    .delete()
    .eq("order_id", orderId)
    .eq("token_hash", tokenHash)
    .eq("object_key", key)
    .is("consumed_at", null);
   if (releaseError) {
    console.error("[after-sales-upload-url] reservation release failed", releaseError);
   }
   throw signingError;
  }
  return NextResponse.json({ url, key });
 } catch (error) {
  if (error instanceof Error && error.message === "Request body is too large.") {
   return NextResponse.json({ error: "Request body is too large." }, { status: 413 });
  }
  if (error instanceof SyntaxError || error instanceof TypeError) {
   return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  return NextResponse.json({ error: "Unable to prepare evidence upload." }, { status: 500 });
 }
}
