"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";

type Ticket = {
  id: string;
  ticket_number: string;
  subject: string;
  status: string;
  priority: string;
  customer_name: string | null;
  customer_email: string | null;
  last_message_at: string | null;
  unread_by_staff: number;
  unread_by_customer: number;
};
type Message = { id: string; sender_type: string; message: string; is_internal: boolean; created_at: string };
type Visitor = { ip_country: string | null; ip_region: string | null; ip_city: string | null; source: string | null; medium: string | null; campaign: string | null; landing_page: string | null; device_type: string | null; browser: string | null; operating_system: string | null; started_at: string; last_seen_at: string } | null;

function time(value: string) {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export default function SupportThread({ initialTicket, initialMessages, initialVisitor }: { initialTicket: Ticket; initialMessages: Message[]; initialVisitor: Visitor }) {
  const [ticket, setTicket] = useState(initialTicket);
  const [messages, setMessages] = useState(initialMessages);
  const [visitor, setVisitor] = useState<Visitor>(initialVisitor);
  const [draft, setDraft] = useState("");
  const [internal, setInternal] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState(initialTicket.status);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/support/" + ticket.id, { cache: "no-store" });
      if (!response.ok) return;
      const result = await response.json();
      setTicket(result.ticket);
      setMessages(result.messages || []);
      setVisitor(result.visitor || null);
      setStatus(result.ticket.status);
    } catch {
      // Retain existing conversation while reconnecting.
    }
  }, [ticket.id]);

  useEffect(() => {
    const timer = window.setInterval(() => { void refresh(); }, 5000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  async function reply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft.trim() || sending) return;
    setSending(true);
    setError("");
    try {
      const response = await fetch("/api/admin/support/" + ticket.id, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: draft.trim(), isInternal: internal }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Reply could not be sent.");
      setDraft("");
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Reply could not be sent.");
    } finally {
      setSending(false);
    }
  }

  async function changeStatus(next: string) {
    setStatus(next);
    setError("");
    try {
      const response = await fetch("/api/admin/support/" + ticket.id, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Status could not be updated.");
      await refresh();
    } catch (cause) {
      setStatus(ticket.status);
      setError(cause instanceof Error ? cause.message : "Status could not be updated.");
    }
  }

  return (
    <div className="admin-support-layout">
      <section className="admin-panel admin-support-conversation">
        <div className="admin-panel-heading">
          <div><p className="admin-kicker">{ticket.ticket_number}</p><h2>{ticket.subject}</h2></div>
          <span>{ticket.priority.toUpperCase()} PRIORITY</span>
        </div>
        <div className="admin-support-thread">
          {messages.map((message) => (
            <article className={"admin-support-message " + (message.sender_type === "staff" ? "is-staff" : message.sender_type === "system" ? "is-system" : "is-customer") + (message.is_internal ? " is-internal" : "")} key={message.id}>
              <header><strong>{message.is_internal ? "Internal note" : message.sender_type === "staff" ? "JINQAYA team" : message.sender_type === "system" ? "System" : ticket.customer_name || "Website visitor"}</strong><time>{time(message.created_at)}</time></header>
              <p>{message.message}</p>
            </article>
          ))}
          {!messages.length && <div className="admin-empty"><p>No messages in this conversation.</p></div>}
        </div>
        {ticket.status !== "closed" && ticket.status !== "resolved" ? (
          <form className="admin-support-reply" onSubmit={reply}>
            <label className="admin-support-internal"><input type="checkbox" checked={internal} onChange={(event) => setInternal(event.target.checked)} /> Add internal note (not visible to customer)</label>
            <textarea rows={4} maxLength={2000} value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={internal ? "Write an internal note…" : "Write your reply…"} required />
            {error && <p className="admin-error" role="alert">{error}</p>}
            <div><small>{internal ? "Only staff can see this note." : "The customer can see this reply in the website chat."}</small><button type="submit" disabled={sending || !draft.trim()}>{sending ? "SENDING…" : internal ? "SAVE NOTE" : "SEND REPLY"}</button></div>
          </form>
        ) : <div className="admin-support-closed"><p>This conversation is {ticket.status}.</p><button type="button" onClick={() => void changeStatus("open")}>REOPEN CHAT</button></div>}
      </section>
      <aside className="admin-panel admin-support-context">
        <div className="admin-panel-heading"><div><p className="admin-kicker">CONVERSATION DETAILS</p><h2>Visitor</h2></div></div>
        <dl>
          <dt>Customer</dt><dd>{ticket.customer_name || "Anonymous visitor"}</dd>
          <dt>Email</dt><dd>{ticket.customer_email ? <a href={"mailto:" + ticket.customer_email}>{ticket.customer_email}</a> : "Not provided"}</dd>
          <dt>Status</dt><dd><select value={status} onChange={(event) => void changeStatus(event.target.value)}><option value="open">Open</option><option value="in_progress">In progress</option><option value="waiting_customer">Waiting for customer</option><option value="resolved">Resolved</option><option value="closed">Closed</option></select></dd>
          <dt>Started</dt><dd>{time(ticket.last_message_at || new Date().toISOString())}</dd>
          <dt>Page at start</dt><dd>{ticket.page_url || "Not recorded"}</dd>
          <dt>Traffic source</dt><dd>{[visitor?.source || ticket.source, visitor?.medium, visitor?.campaign].filter(Boolean).join(" / ") || "Unknown"}</dd>
          <dt>Location</dt><dd>{[visitor?.ip_city, visitor?.ip_region, visitor?.ip_country].filter(Boolean).join(", ") || "Not available"}</dd>
          <dt>Device</dt><dd>{[visitor?.device_type, visitor?.browser, visitor?.operating_system].filter(Boolean).join(" · ") || "Not available"}</dd>
          <dt>Landing page</dt><dd>{visitor?.landing_page || "Not available"}</dd>
          <dt>Analytics link</dt><dd>{ticket.visitor_id ? "Linked to consented visitor history" : "Not linked (analytics consent not given)"}</dd>
        </dl>
        {error && <p className="admin-error">{error}</p>}
      </aside>
    </div>
  );
}
