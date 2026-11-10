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
