import { createClient } from "npm:@supabase/supabase-js@2";

type Action = "request-code" | "verify-code" | "get-order";

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

function isAllowedApplicationKey(req: Request): boolean {
  const supplied = req.headers.get("apikey");
  if (!supplied) return false;

  const accepted = new Set<string>();
  const publishableKeys = Deno.env.get("SUPABASE_PUBLISHABLE_KEYS");
  if (publishableKeys) {
    try {
      const parsed = JSON.parse(publishableKeys) as Record<string, unknown>;
      for (const value of Object.values(parsed)) {
        if (typeof value === "string") accepted.add(value);
      }
    } catch {
      return false;
    }
  }
  const legacyAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (legacyAnonKey) accepted.add(legacyAnonKey);
  return accepted.has(supplied);
}

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Supabase server configuration is unavailable.");
}
const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

Deno.serve(async (req: Request) => {
  if (!isAllowedApplicationKey(req)) {
    return json({ error: "Unauthorized." }, 401);
  }
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
  let result: unknown;
  let error: { message?: string } | null = null;

  if (action === "request-code") {
    if (!validOrderNumber(body.orderNumber) || !validEmail(body.email) || !validCode(body.code)) {
      return json({ error: "Invalid request." }, 400);
    }
    ({ data: result, error } = await admin.rpc("create_order_status_email_challenge", {
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
    ({ data: result, error } = await admin.rpc("verify_order_status_email_code", {
      p_order_number: body.orderNumber.trim(),
      p_email: body.email.trim().toLowerCase(),
      p_code: body.code,
      p_token_hash: body.tokenHash,
    }));
  } else if (action === "get-order") {
    if (!validTokenHash(body.tokenHash)) {
      return json({ error: "Invalid request." }, 400);
    }
    ({ data: result, error } = await admin.rpc("get_customer_order_status", {
      p_token_hash: body.tokenHash,
    }));
  } else {
    return json({ error: "Unsupported action." }, 400);
  }

  if (error) {
    console.error("[order-status-api] database operation failed");
    return json({ error: "Unable to process this request." }, 503);
  }

  return json({ data: result });
});
