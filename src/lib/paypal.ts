import "server-only";

type PayPalEnvironment = "sandbox" | "live";

function environment(): PayPalEnvironment {
  return process.env.PAYPAL_ENVIRONMENT === "live" ? "live" : "sandbox";
}

export function getPayPalSdkUrl() {
  return environment() === "live"
    ? "https://www.paypal.com/web-sdk/v6/core"
    : "https://www.sandbox.paypal.com/web-sdk/v6/core";
}

export async function getPayPalPublicConfig() {
  const configured = Boolean(process.env.PAYPAL_CLIENT_ID?.trim() && process.env.PAYPAL_CLIENT_SECRET);
  if (!configured) return { enabled: false, clientToken: null, sdkUrl: getPayPalSdkUrl() };

  const clientId = process.env.PAYPAL_CLIENT_ID!.trim();
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET!;
  const credentials = Buffer.from(clientId + ":" + clientSecret).toString("base64");
  const body = new URLSearchParams();
  body.set("grant_type", "client_credentials");
  body.append("domains[]", "https://www.jinqaya.com");
  body.set("response_type", "client_token");
  const response = await fetch(apiBase() + "/v1/oauth2/token", {
    method: "POST",
    headers: {
      Authorization: "Basic " + credentials,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
    cache: "no-store",
    signal: AbortSignal.timeout(12_000),
  });
  const result = await response.json().catch(() => null) as { access_token?: unknown } | null;
  if (!response.ok || typeof result?.access_token !== "string") {
    throw new Error("Unable to initialize PayPal checkout.");
  }
  return { enabled: true, clientToken: result.access_token, sdkUrl: getPayPalSdkUrl() };
}

function apiBase() {
  return environment() === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";
}

async function accessToken() {
  const clientId = process.env.PAYPAL_CLIENT_ID?.trim();
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("PayPal is not configured.");

  const credentials = Buffer.from(clientId + ":" + clientSecret).toString("base64");
  const response = await fetch(apiBase() + "/v1/oauth2/token", {
    method: "POST",
    headers: {
      Authorization: "Basic " + credentials,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
    cache: "no-store",
    signal: AbortSignal.timeout(12_000),
  });
  const result = await response.json().catch(() => null) as { access_token?: unknown } | null;
  if (!response.ok || typeof result?.access_token !== "string") {
    throw new Error("Unable to authenticate with PayPal.");
  }
  return result.access_token;
}

export async function paypalRequest<T>(
  path: string,
  init: { method?: "GET" | "POST"; body?: unknown; requestId?: string } = {},
): Promise<T> {
  const token = await accessToken();
  const response = await fetch(apiBase() + path, {
    method: init.method ?? "GET",
    headers: {
      Authorization: "Bearer " + token,
      "Content-Type": "application/json",
      ...(init.requestId ? { "PayPal-Request-Id": init.requestId } : {}),
    },
    ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  const result = await response.json().catch(() => null) as T | null;
  if (!response.ok || result === null) {
    throw new Error("PayPal payment request failed.");
  }
  return result;
}

export function isSameOriginRequest(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}
