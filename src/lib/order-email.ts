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
  // Final safety boundary: Preview and local environments must never send customer or staff email.
  if (process.env.VERCEL_ENV !== "production") {
    return { ok: false, retryable: false, providerMessageId: null, error: "email_delivery_disabled_outside_production" };
  }

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
  eventType?: "order_received" | "quote_confirmed" | "payment_received" | "shipped" | "delivered" | "cancelled" | "reservation_expired" | "after_sales_submitted" | "after_sales_under_review" | "after_sales_approved" | "after_sales_rejected" | "after_sales_resolved" | "after_sales_refund_recorded";
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  subtotal: number | string;
  currency: string;
  shippingAmount?: number | string | null;
  shippingMethod?: string | null;
  trackingNumber?: string | null;
  trackingUrl?: string | null;
  stockReviewRequired?: boolean;
  caseNumber?: string;
  caseStatus?: string;
  resolution?: string | null;
  refundAmount?: number | string | null;
  refundReference?: string | null;
};

export async function sendOrderOutboxEmail(
  recipientType: "customer" | "staff",
  recipientEmail: string,
  order: OrderEmailOutboxPayload,
  idempotencyKey: string
): Promise<SendResult> {
  const safeName = escapeHtml(order.customerName || "there");
  const event = order.eventType || "order_received";
  if (event !== "order_received") {
    const statusDetails: Record<Exclude<NonNullable<OrderEmailOutboxPayload["eventType"]>, "order_received">, { subject: string; title: string; copy: string; cta?: { href: string; label: string } }> = {
      quote_confirmed: { subject: `Shipping quote for JINQAYA order ${order.orderNumber}`, title: "Your order quote is ready.", copy: `We’ve confirmed shipping: ${order.shippingMethod || "Shipping method confirmed"} · ${money(order.shippingAmount, order.currency)}. Your confirmed total is ready. Sign in with your order number and checkout email to review it and pay securely with PayPal. Your order is still unpaid.`, cta: { href: "https://www.jinqaya.com/order-status", label: "VIEW ORDER & PAY SECURELY" } },
      payment_received: { subject: `Payment confirmed for JINQAYA order ${order.orderNumber}`, title: "Payment confirmed.", copy: order.stockReviewRequired ? "We have received your payment. Our team is reviewing the stock reservation before fulfilment and will contact you if anything needs attention." : "We have verified receipt of your payment. Your order will move into preparation." },
      shipped: { subject: `Your JINQAYA order ${order.orderNumber} has shipped`, title: "Your order is on its way.", copy: `Carrier: ${order.shippingMethod || "Carrier"} · Tracking: ${order.trackingNumber || "Not provided"}.${order.trackingUrl ? ` Track your shipment: ${order.trackingUrl}` : ""}` },
      delivered: { subject: `JINQAYA order ${order.orderNumber} marked delivered`, title: "Delivery update.", copy: "Your order has been marked as delivered. We hope it settles beautifully into your life together." },
      cancelled: { subject: `JINQAYA order ${order.orderNumber} cancelled`, title: "Your order request was cancelled.", copy: "Your order has been cancelled. If you believe this was a mistake, please contact us." },
      reservation_expired: { subject: `Action needed: JINQAYA order ${order.orderNumber} reservation expired`, title: "Your stock reservation has expired.", copy: "The 48-hour payment window has passed, so the stock reserved for this order has been released and the previous shipping quote is no longer valid. No payment was collected and this order will not be dispatched. Please email info@jinqaya.com so we can reconfirm current stock, shipping options and the final total before you proceed." },
      after_sales_submitted: { subject: `We received after-sales case ${order.caseNumber || ""}`, title: "We’ve received your request.", copy: `Your quality-related after-sales request for order ${order.orderNumber} has been received. Your case reference is ${order.caseNumber || "being assigned"}. Our team will review the information and contact you with an update.` },
      after_sales_under_review: { subject: `Your JINQAYA case ${order.caseNumber || ""} is under review`, title: "Your case is being reviewed.", copy: `Our team is reviewing after-sales case ${order.caseNumber || ""} for order ${order.orderNumber}. We’ll contact you when there is an update.` },
      after_sales_approved: { subject: `Update on your JINQAYA case ${order.caseNumber || ""}`, title: "Your request has been approved.", copy: `Your after-sales case ${order.caseNumber || ""} for order ${order.orderNumber} has been approved. Our team will follow up with the agreed next steps.${order.resolution ? ` Resolution: ${order.resolution}` : ""}` },
      after_sales_rejected: { subject: `Update on your JINQAYA case ${order.caseNumber || ""}`, title: "An update on your request.", copy: `After reviewing case ${order.caseNumber || ""} for order ${order.orderNumber}, we’re unable to approve the request. Reason: ${order.resolution || "Please contact our support team for further details."}` },
      after_sales_resolved: { subject: `Your JINQAYA case ${order.caseNumber || ""} is closed`, title: "Your case has been resolved.", copy: `After-sales case ${order.caseNumber || ""} for order ${order.orderNumber} has been marked as resolved. ${order.resolution || "Thank you for working with our team."}` },
      after_sales_refund_recorded: { subject: `Refund update for JINQAYA order ${order.orderNumber}`, title: "Your refund has been recorded.", copy: `We have recorded the refund for after-sales case ${order.caseNumber || ""} in the amount of ${money(order.refundAmount, order.currency)}. This message confirms the refund record; your payment provider may take additional time to show the funds. Reference: ${order.refundReference || "Please contact support if you need the transaction reference."}` },
    };
    const detail = statusDetails[event];
    return send({
      to: recipientEmail, subject: detail.subject,
      html: shell(detail.title, `<p>Hello ${safeName},</p><p>${escapeHtml(detail.copy)}</p>${detail.cta ? `<p><a href="${escapeHtml(detail.cta.href)}" style="display:inline-block;padding:14px 20px;background:#252c25;color:#fff;text-decoration:none;letter-spacing:1px;font-size:12px">${escapeHtml(detail.cta.label)}</a></p>` : ""}<p><strong>Order:</strong> ${escapeHtml(order.orderNumber)}</p>`),
      text: `Hello ${order.customerName || "there"},\n\n${detail.copy}${detail.cta ? `\n${detail.cta.label}: ${detail.cta.href}` : ""}\nOrder: ${order.orderNumber}\n\nJINQAYA`,
    }, idempotencyKey);
  }
  const subtotal = money(order.subtotal, order.currency);
  if (recipientType === "customer") {
    return send({
      to: recipientEmail,
      subject: `JINQAYA received your order request ${order.orderNumber}`,
      html: shell("We’ve received your request.", `<p>Hello ${safeName},</p><p>Your order request <strong>${escapeHtml(order.orderNumber)}</strong> has been received.</p>
        <p><strong>Item subtotal:</strong> ${escapeHtml(subtotal)}</p>
        <p><strong>Shipping:</strong> ${escapeHtml(money(order.shippingAmount, order.currency))}</p>
        <p>Your checkout page shows the confirmed order total. If all items were reserved, you can pay securely with PayPal directly on that page. This order is not paid until PayPal confirms payment.</p>
        <p>If you leave checkout before paying, you can still find your order using your order number and checkout email on our Track Order page.</p>`),
      text: `Hello ${order.customerName || "there"},\n\nWe received order ${order.orderNumber}. Item subtotal: ${subtotal}. Shipping: ${money(order.shippingAmount, order.currency)}. If all items were reserved, you can pay securely with PayPal directly on the checkout page. This order is not paid until PayPal confirms payment. If you leave checkout, you can find your order using your order number and checkout email on our Track Order page.\n\nJINQAYA`,
    }, idempotencyKey);
  }
  const shippingConfirmed = order.shippingAmount !== null && order.shippingAmount !== undefined;
  const shippingSummary = shippingConfirmed
    ? `Shipping: ${money(order.shippingAmount, order.currency)}. Stock is reserved for 48 hours while the customer completes PayPal payment.`
    : "Shipping is not yet quoted and payment has not been collected.";
  return send({
    to: recipientEmail,
    subject: `${shippingConfirmed ? "New order awaiting PayPal payment" : "New order request"}: ${order.orderNumber}`,
    html: shell(shippingConfirmed ? "New order awaiting payment." : "New order request.", `<p><strong>Order:</strong> ${escapeHtml(order.orderNumber)}</p><p><strong>Customer:</strong> ${safeName} (${escapeHtml(order.customerEmail)})</p><p><strong>Item subtotal:</strong> ${escapeHtml(subtotal)}</p><p>${escapeHtml(shippingSummary)}</p><p>Please review the order in the JINQAYA admin dashboard.</p>`),
    text: `${shippingConfirmed ? "New order awaiting PayPal payment" : "New order request"} ${order.orderNumber}. Customer: ${order.customerName} (${order.customerEmail}). Item subtotal: ${subtotal}. ${shippingSummary} Review in admin.`,
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
  return send({
    to: email,
    subject: "Your JINQAYA order status verification code",
    html: shell("View your order.", `<p>Use this six-digit code to securely view your JINQAYA order status:</p><p style="font-size:30px;letter-spacing:8px;font-weight:bold">${escapeHtml(code)}</p><p>This code expires in 10 minutes and can be used only once. If you did not request it, you can ignore this email.</p>`),
    text: `Your JINQAYA order status verification code is ${code}. It expires in 10 minutes and can be used only once. If you did not request it, ignore this email.`,
  });
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


export type LeadInquiryEmailData = {
  inquiryNumber: string;
  customerName: string;
  customerEmail: string;
  subject: string;
  message: string;
  productId: string | null;
  source: string;
};

export async function sendLeadInquiryEmail(
  recipientType: "customer" | "staff",
  recipientEmail: string,
  inquiry: LeadInquiryEmailData,
  idempotencyKey: string
): Promise<SendResult> {
  const safeName = escapeHtml(inquiry.customerName || "there");
  const safeMessage = escapeHtml(inquiry.message).replace(/\n/g, "<br />");
  const subject = recipientType === "staff"
    ? "New website enquiry " + inquiry.inquiryNumber + ": " + inquiry.subject
    : "JINQAYA received your enquiry " + inquiry.inquiryNumber;
  const title = recipientType === "staff" ? "A new website enquiry." : "Thank you for contacting JINQAYA.";
  const body = recipientType === "staff"
    ? "<p><strong>Reference:</strong> " + escapeHtml(inquiry.inquiryNumber) + "</p><p><strong>Customer:</strong> " + safeName + " (" + escapeHtml(inquiry.customerEmail) + ")</p><p><strong>Subject:</strong> " + escapeHtml(inquiry.subject) + "</p><p><strong>Source:</strong> " + escapeHtml(inquiry.source) + "</p><p><strong>Message:</strong></p><p>" + safeMessage + "</p><p>Please review this enquiry in the JINQAYA admin dashboard.</p>"
    : "<p>Hello " + safeName + ",</p><p>We have received your message and our team will review it.</p><p><strong>Reference:</strong> " + escapeHtml(inquiry.inquiryNumber) + "</p><p><strong>Subject:</strong> " + escapeHtml(inquiry.subject) + "</p><p>We will reply to this email address as soon as we can.</p>";
  const text = recipientType === "staff"
    ? "New website enquiry " + inquiry.inquiryNumber + "\nCustomer: " + inquiry.customerName + " (" + inquiry.customerEmail + ")\nSubject: " + inquiry.subject + "\nSource: " + inquiry.source + "\n\n" + inquiry.message + "\n\nReview in the JINQAYA admin dashboard."
    : "Hello " + (inquiry.customerName || "there") + ",\n\nWe have received your enquiry " + inquiry.inquiryNumber + " about \"" + inquiry.subject + "\". Our team will reply to this email address.\n\nJINQAYA";
  return send({
    to: recipientEmail,
    subject,
    html: shell(title, body),
    text,
  }, idempotencyKey);
}
