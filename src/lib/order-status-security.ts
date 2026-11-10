import "server-only";
import { createHash, randomBytes, randomInt } from "node:crypto";

export type OrderStatusRequestInput = { orderNumber: string; email: string };
export type OrderStatusVerifyInput = OrderStatusRequestInput & { code: string };

export function parseOrderStatusRequestInput(body: unknown): OrderStatusRequestInput | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const input = body as Record<string, unknown>;
  if (typeof input.orderNumber !== "string" || typeof input.email !== "string") return null;
  const orderNumber = input.orderNumber.trim().slice(0, 80);
  const email = input.email.trim().toLowerCase().slice(0, 254);
  if (!orderNumber || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return { orderNumber, email };
}

export function parseOrderStatusVerifyInput(body: unknown): OrderStatusVerifyInput | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const input = body as Record<string, unknown>;
  if (typeof input.code !== "string") return null;
  const requestInput = parseOrderStatusRequestInput(body);
  const code = input.code.trim();
  if (!requestInput || !/^\d{6}$/.test(code)) return null;
  return { ...requestInput, code };
}

export function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function newCode() {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export function newSessionToken() {
  return randomBytes(32).toString("hex");
}

export async function readBoundedJson<T>(request: Request, maxBytes: number): Promise<T> {
  const contentLength = request.headers.get("content-length");
  if (contentLength !== null) {
    const declaredLength = Number(contentLength);
    if (!Number.isSafeInteger(declaredLength) || declaredLength < 0 || declaredLength > maxBytes) {
      throw new Error("Request body is too large.");
    }
  }
  if (!request.body) throw new SyntaxError("Request body is required.");

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw new Error("Request body is too large.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) as T;
}
