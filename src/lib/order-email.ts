type MailMessage = { to: string; subject: string; html: string; text: string };
type SendResult = {
  ok: boolean;
  retryable: boolean;
  providerMessageId: string | null;
  error: string | null;
};

const FROM = process.env.ORDER_EMAIL_FROM;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_TIMEOUT_MS = 15_000;

function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[char] || char);
}

function shell(title: string, body: string) {
  return `<!doctype html><html><body style="margin:0;background:#f6f4ef;color:#24231f;font-family:Arial,sans-serif">
  <div style="max-width:600px;margin:32px auto;padding:28px;background:#fff">
  <p style="font-size:12px;letter-spacing:2px;color:#777">JINQAYA / A PET LIFESTYLE HOUSE</p>
  <h1 style="font-family:Georgia,serif;font-weight:normal;font-size:30px">${escapeHtml(title)}</h1>
  ${body}
  <p style="margin-top:32px;font-size:13px;color:#777">Questions? Email <a href="mailto:info@jinqaya.com">info@jinqaya.com</a>.</p>
  <p style="font-size:12px;color:#999">JINQAYA · Life is better in good company.</p></div></body></html>`;
}

async function send(message: MailMessage, idempotencyKey?: string): Promise<SendResult> {
  if (!RESEND_API_KEY || !FROM) {
    return {
      ok: false,
      retryable: false,
      providerMessageId: null,
      error: "email_provider_configuration_missing",
    };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
        ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
      },
      body: JSON.stringify({ from: FROM, to: [message.to], subject: message.subject, html: message.html, text: message.text }),
      cache: "no-store",
      signal: AbortSignal.timeout(RESEND_TIMEOUT_MS),
    });

    const responseBody = await response.json().catch(() => null) as
      | { id?: unknown; message?: unknown; name?: unknown }
      | null;

    if (!response.ok) {
      const retryable = response.status === 408 || response.status === 425 ||
        response.status === 429 || response.status >= 500;
      const providerError = typeof responseBody?.message === "string"
        ? responseBody.message
        : `resend_http_${response.status}`;
      return {
        ok: false,
        retryable,
        providerMessageId: null,
        error: providerError.slice(0, 1000),
      };
    }

    return {
      ok: true,
      retryable: false,
      providerMessageId: typeof responseBody?.id === "string" ? responseBody.id : null,
      error: null,
    };
  } catch (error) {
    const timedOut = error instanceof Error &&
      (error.name === "TimeoutError" || error.name === "AbortError");
    return {
      ok: false,
      // A timeout/network error is ambiguous: Resend may have accepted the request.
      // Retrying must reuse the exact same idempotency key.
      retryable: true,
      providerMessageId: null,
      error: (timedOut ? "resend_request_timeout" : "resend_network_error"),
    };
  }
}

export type OrderEmailData = {
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  currency: string;
  subtotal: number | string;
  itemLines?: string[];
  shippingMethod?: string | null;
  shippingAmount?: number | string | null;
  trackingNumber?: string | null;
  trackingUrl?: string | null;
};

function money(amount: number | string | null | undefined, currency: string) {
  if (amount == null || amount === "") return "To be confirmed";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: currency.trim() || "USD" }).format(Number(amount));
}

export type OrderEmailOutboxPayload = {
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  subtotal: number | string;
  currency: string;
};

export async function sendOrderOutboxEmail(
  recipientType: "customer" | "staff",
  recipientEmail: string,
  order: OrderEmailOutboxPayload,
  idempotencyKey: string
): Promise<SendResult> {
  const safeName = escapeHtml(order.customerName || "there");
  const subtotal = money(order.subtotal, order.currency);

  if (recipientType === "customer") {
    return send({
      to: recipientEmail,
      subject: `JINQAYA received your order request ${order.orderNumber}`,
      html: shell("We’ve received your request.", `<p>Hello ${safeName},</p><p>Your order request <strong>${escapeHtml(order.orderNumber)}</strong> has been received.</p>
        <p><strong>Estimated item subtotal:</strong> ${escapeHtml(subtotal)}</p>
        <p>We’ll review availability and confirm shipping options, delivery cost and the final total before requesting payment. This request is not paid and does not mean your order has been dispatched.</p>
        <p>We’ll be in touch soon.</p>`),
      text: `Hello ${order.customerName || "there"},\n\nWe received order request ${order.orderNumber}. Estimated item subtotal: ${subtotal}. We’ll confirm availability, shipping and the final total before requesting payment. This request is not paid or dispatched.\n\nJINQAYA`,
    }, idempotencyKey);
  }

  return send({
    to: recipientEmail,
    subject: `New order request: ${order.orderNumber}`,
    html: shell("New order request.", `<p><strong>Order:</strong> ${escapeHtml(order.orderNumber)}</p><p><strong>Customer:</strong> ${safeName} (${escapeHtml(order.customerEmail)})</p><p><strong>Item subtotal:</strong> ${escapeHtml(subtotal)}</p><p>Please review the order in the JINQAYA admin dashboard. Shipping is not yet quoted and payment has not been collected.</p>`),
    text: `New order request ${order.orderNumber}. Customer: ${order.customerName} (${order.customerEmail}). Item subtotal: ${subtotal}. Review in admin; no payment collected.`,
  }, idempotencyKey);
}

export async function sendOrderStatusEmail(order: OrderEmailData, event: "quote_confirmed" | "payment_received" | "shipped" | "delivered" | "cancelled") {
  const details: Record<typeof event, { subject: string; title: string; copy: string }> = {
    quote_confirmed: { subject: `Shipping quote for JINQAYA order ${order.orderNumber}`, title: "Your order quote is ready.", copy: `We’ve confirmed shipping: ${order.shippingMethod || "Shipping method confirmed"} · ${money(order.shippingAmount, order.currency)}. Please reply to confirm the final total and payment arrangements. Your order is still unpaid.` },
    payment_received: { subject: `Payment confirmed for JINQAYA order ${order.orderNumber}`, title: "Payment confirmed.", copy: "We have verified receipt of your payment. Your order will move into preparation." },
    shipped: { subject: `Your JINQAYA order ${order.orderNumber} has shipped`, title: "Your order is on its way.", copy: `Carrier: ${order.shippingMethod || "Carrier"} · Tracking: ${order.trackingNumber || "Not provided"}.${order.trackingUrl ? ` Track your shipment: ${order.trackingUrl}` : ""}` },
    delivered: { subject: `JINQAYA order ${order.orderNumber} marked delivered`, title: "Delivery update.", copy: "Your order has been marked as delivered. We hope it settles beautifully into your life together." },
    cancelled: { subject: `JINQAYA order ${order.orderNumber} cancelled`, title: "Your order request was cancelled.", copy: "Your order has been cancelled. If you believe this was a mistake, please contact us." },
  };
  const selected = details[event];
  const result = await send({
    to: order.customerEmail,
    subject: selected.subject,
    html: shell(selected.title, `<p>Hello ${escapeHtml(order.customerName || "there")},</p><p>${escapeHtml(selected.copy)}</p><p><strong>Order:</strong> ${escapeHtml(order.orderNumber)}</p>`),
    text: `Hello ${order.customerName || "there"},\n\n${selected.copy}\nOrder: ${order.orderNumber}\n\nJINQAYA`,
  });
  return result.ok;
}

export async function sendOrderStatusVerificationCode(email: string, code: string): Promise<SendResult> {
  const result = await send({
    to: email,
    subject: "Your JINQAYA order status verification code",
    html: shell("View your order.", `<p>Use this six-digit code to securely view your JINQAYA order status:</p><p style="font-size:30px;letter-spacing:8px;font-weight:bold">${escapeHtml(code)}</p><p>This code expires in 10 minutes and can be used only once. If you did not request it, you can ignore this email.</p>`),
    text: `Your JINQAYA order status verification code is ${code}. It expires in 10 minutes and can be used only once. If you did not request it, ignore this email.`,
  });
  return result;
}

export async function sendAfterSalesVerificationCode(email: string, code: string) {
  const result = await send({
    to: email,
    subject: "Your JINQAYA after-sales verification code",
    html: shell("Verify your order.", `<p>Use this code to verify your order and submit an after-sales request:</p><p style="font-size:30px;letter-spacing:8px;font-weight:bold">${escapeHtml(code)}</p><p>This code expires in 10 minutes. If you did not request it, you can ignore this email.</p>`),
    text: `Your JINQAYA verification code is ${code}. It expires in 10 minutes. If you did not request it, ignore this email.`,
  });
  return result.ok;
}
