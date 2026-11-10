type EdgeResponse<T> = { data: T };

export async function callOrderStatusApi<T>(payload: Record<string, unknown>): Promise<T> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !publishableKey) {
    throw new Error("Order status API is not configured.");
  }

  const response = await fetch(
    `${supabaseUrl.replace(/\/$/, "")}/functions/v1/order-status-api`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: publishableKey,
      },
      body: JSON.stringify(payload),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    },
  );

  const result = await response.json().catch(() => null) as EdgeResponse<T> | null;
  if (!response.ok || !result || !("data" in result)) {
    throw new Error("Order status API request failed.");
  }
  return result.data;
}


/**
 * Server-only privileged operation. The internal secret must never use a NEXT_PUBLIC_ variable.
 */
export async function markOrderStatusEmailDeliveryFailed(
  orderNumber: string,
  email: string,
): Promise<void> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const internalSecret = process.env.ORDER_STATUS_INTERNAL_SECRET;

  if (!supabaseUrl || !publishableKey || !internalSecret) {
    throw new Error("Order status internal API is not configured.");
  }

  const response = await fetch(
    `${supabaseUrl.replace(/\\/$/, "")}/functions/v1/order-status-api`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: publishableKey,
        "x-order-status-internal-secret": internalSecret,
      },
      body: JSON.stringify({ action: "delivery-failed", orderNumber, email }),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    },
  );

  if (!response.ok) {
    throw new Error("Unable to mark order status email delivery failure.");
  }
}
