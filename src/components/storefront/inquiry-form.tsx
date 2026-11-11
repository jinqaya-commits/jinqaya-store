"use client";

import { useState, type FormEvent } from "react";

type Props = { productId?: string | null; productName?: string | null };

type FormState = {
  fullName: string;
  email: string;
  phone: string;
  country: string;
  subject: string;
  message: string;
  website: string;
};

const initialState: FormState = {
  fullName: "",
  email: "",
  phone: "",
  country: "",
  subject: "",
  message: "",
  website: "",
};

export function InquiryForm({ productId, productName }: Props) {
  const [values, setValues] = useState<FormState>({
    ...initialState,
    subject: productName ? "Product enquiry: " + productName : "",
  });
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const [reference, setReference] = useState("");

  function update(field: keyof FormState, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("sending");
    setMessage("");
    try {
      const sessionToken = window.sessionStorage.getItem("jq-session-token");
      const response = await fetch("/api/inquiries", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...values,
          productId: productId || null,
          pagePath: window.location.pathname,
          sessionToken,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof result.error === "string" ? result.error : "Your enquiry could not be sent. Please try again.");
      setReference(typeof result.inquiryNumber === "string" ? result.inquiryNumber : "");
      setStatus("success");
      setValues({ ...initialState, subject: productName ? "Product enquiry: " + productName : "" });
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Your enquiry could not be sent. Please try again.");
    }
  }

  return (
    <form className="jq-inquiry-form" onSubmit={submit}>
      {productName && <div className="jq-inquiry-product"><span>ENQUIRY ABOUT</span><strong>{productName}</strong></div>}
      <div className="jq-inquiry-grid">
        <label>Full name<input required maxLength={160} autoComplete="name" value={values.fullName} onChange={(event) => update("fullName", event.target.value)} /></label>
        <label>Email address<input required type="email" maxLength={254} autoComplete="email" value={values.email} onChange={(event) => update("email", event.target.value)} /></label>
        <label>Phone number <span>OPTIONAL</span><input type="tel" maxLength={80} autoComplete="tel" value={values.phone} onChange={(event) => update("phone", event.target.value)} /></label>
        <label>Country / region <span>OPTIONAL</span><input maxLength={100} autoComplete="country-name" value={values.country} onChange={(event) => update("country", event.target.value)} /></label>
      </div>
      <label>Subject<input maxLength={180} value={values.subject} onChange={(event) => update("subject", event.target.value)} /></label>
      <label>Your message<textarea required minLength={5} maxLength={5000} rows={6} value={values.message} onChange={(event) => update("message", event.target.value)} placeholder="Tell us what you would like to know." /></label>
      <label className="jq-inquiry-honeypot" aria-hidden="true">Leave this field empty<input tabIndex={-1} autoComplete="off" value={values.website} onChange={(event) => update("website", event.target.value)} /></label>
      <button type="submit" className="button button-dark" disabled={status === "sending"}>{status === "sending" ? "SENDING…" : "SEND ENQUIRY"} <span aria-hidden="true">↗</span></button>
      {status === "success" && <p className="jq-inquiry-success" role="status">Thank you. Your enquiry has been received{reference ? " as " + reference : ""}. Our team will be in touch by email.</p>}
      {status === "error" && <p className="jq-inquiry-error" role="alert">{message}</p>}
      <p className="jq-inquiry-privacy">By sending this form, you agree that JINQAYA may use your details to respond to your enquiry. We do not add you to marketing emails unless you separately opt in.</p>
    </form>
  );
}
