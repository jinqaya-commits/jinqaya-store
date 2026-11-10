import { withSupabase } from "npm:@supabase/server@1.9.2";

type Action = "request-code" | "verify-code" | "get-order" | "delivery-failed";

const json = (body: unknown, status = 200) =>
  Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store, private" },
  });

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validOrderNumber(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.trim().length <= 100;
}

function validEmail(value: unknown): value is string {
  return typeof value === "string" &&
    value.length <= 254 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function validCode(value: unknown): value is string {
  return typeof value === "string" && /^\d{6}$/.test(value);
}

function validTokenHash(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

Deno.serve(
  withSupabase({ auth: "publishable" }, async (req, ctx) => {
    if (req.method !== "POST") {
      return json({ error: "Method not allowed." }, 405);
    }

    const contentLength = Number(req.headers.get("content-length") || "0");
    if (contentLength > 8 * 1024) {
      return json({ error: "Request body is too large." }, 413);
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return json({ error: "Invalid request." }, 400);
    }

    if (!isRecord(body) || typeof body.action !== "string") {
      return json({ error: "Invalid request." }, 400);
    }

    const action = body.action as Action;
    const db = ctx.supabaseAdmin;
    let result: unknown;
    let error: { message?: string } | null = null;

    if (action === "request-code") {
      if (!validOrderNumber(body.orderNumber) || !validEmail(body.email) || !validCode(body.code)) {
        return json({ error: "Invalid request." }, 400);
      }
      ({ data: result, error } = await db.rpc("create_order_status_email_challenge", {
        p_order_number: body.orderNumber.trim(),
        p_email: body.email.trim().toLowerCase(),
        p_code: body.code,
      }));
    } else if (action === "verify-code") {
      if (
        !validOrderNumber(body.orderNumber) ||
        !validEmail(body.email) ||
        !validCode(body.code) ||
        !validTokenHash(body.tokenHash)
      ) {
        return json({ error: "Invalid request." }, 400);
      }
      ({ data: result, error } = await db.rpc("verify_order_status_email_code", {
        p_order_number: body.orderNumber.trim(),
        p_email: body.email.trim().toLowerCase(),
        p_code: body.code,
        p_token_hash: body.tokenHash,
      }));
    } else if (action === "get-order") {
      if (!validTokenHash(body.tokenHash)) {
        return json({ error: "Invalid request." }, 400);
      }
      ({ data: result, error } = await db.rpc("get_customer_order_status", {
        p_token_hash: body.tokenHash,
      }));
    } else if (action === "delivery-failed") {
      if (!validOrderNumber(body.orderNumber) || !validEmail(body.email)) {
        return json({ error: "Invalid request." }, 400);
      }
      ({ data: result, error } = await db.rpc("mark_order_status_email_challenge_delivery_failed", {
        p_order_number: body.orderNumber.trim(),
        p_email: body.email.trim().toLowerCase(),
      }));
    } else {
      return json({ error: "Unsupported action." }, 400);
    }

    if (error) {
      console.error("[order-status-api] database operation failed");
      return json({ error: "Unable to process this request." }, 503);
    }

    return json({ data: result });
  }),
);
