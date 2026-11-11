"use client";

import { useCallback, useEffect, useState, useSyncExternalStore, type FormEvent } from "react";
import styles from "./live-chat-widget.module.css";

type ChatSession = { ticketId: string; ticketNumber: string; chatToken: string; status: string };
type ChatMessage = { id: string; sender_type: "customer" | "staff" | "system"; message: string; created_at: string };
type ChatResponse = { ticket: { id: string; ticket_number: string; subject: string; status: string; created_at: string }; messages: ChatMessage[] };

const STORAGE_KEY = "jq-live-chat-session";
const sessionListeners = new Set<() => void>();
function subscribeSession(onChange: () => void) {
  sessionListeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => { sessionListeners.delete(onChange); window.removeEventListener("storage", onChange); };
}
function subscribeMount() { return () => undefined; }
function getMountedSnapshot() { return true; }
function getServerMountedSnapshot() { return false; }
function notifySessionChange() { sessionListeners.forEach((listener) => listener()); }
function saveSession(session: ChatSession) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  notifySessionChange();
}
function clearSession() {
  window.localStorage.removeItem(STORAGE_KEY);
  notifySessionChange();
}

function readSession(): ChatSession | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ChatSession>;
    if (typeof parsed.ticketId !== "string" || typeof parsed.ticketNumber !== "string" || typeof parsed.chatToken !== "string") return null;
    return { ticketId: parsed.ticketId, ticketNumber: parsed.ticketNumber, chatToken: parsed.chatToken, status: parsed.status || "open" };
  } catch {
    return null;
  }
}

function timeLabel(value: string) {
  return new Intl.DateTimeFormat("en", { hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

export function LiveChatWidget() {
  const mounted = useSyncExternalStore(subscribeMount, getMountedSnapshot, getServerMountedSnapshot);
  const [open, setOpen] = useState(false);
  const session = useSyncExternalStore(subscribeSession, readSession, () => null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [website, setWebsite] = useState("");

  const loadMessages = useCallback(async (current: ChatSession) => {
    try {
      const response = await fetch("/api/chat?ticketId=" + encodeURIComponent(current.ticketId), {
        headers: { "x-chat-token": current.chatToken },
        cache: "no-store",
      });
      if (!response.ok) {
        if (response.status === 404) {
          window.localStorage.removeItem(STORAGE_KEY);
          setSession(null);
          setMessages([]);
        }
        return;
      }
      const result = await response.json() as ChatResponse;
      setMessages(result.messages || []);
      if (session) saveSession({ ...session, status: result.ticket.status });
    } catch {
      // Keep the current conversation visible if a refresh briefly fails.
    }
  }, [session]);

  useEffect(() => {
    if (session) void loadMessages(session);
  }, [session?.ticketId, loadMessages]);

  useEffect(() => {
    if (!open || !session || session.status === "closed" || session.status === "resolved") return;
    void loadMessages(session);
    const timer = window.setInterval(() => { void loadMessages(session); }, 5000);
    return () => window.clearInterval(timer);
  }, [open, session, loadMessages]);

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = draft.trim();
    if (!message || sending) return;
    setSending(true);
    setError("");
    try {
      if (session) {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "message", ticketId: session.ticketId, chatToken: session.chatToken, message }),
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(typeof result.error === "string" ? result.error : "Message could not be sent.");
        setDraft("");
        await loadMessages(session);
      } else {
        const consent = window.localStorage.getItem("jq-analytics-consent");
        const params = new URLSearchParams(window.location.search);
        const visitorId = consent === "granted" ? window.localStorage.getItem("jq-visitor-id") : null;
        const sessionToken = consent === "granted" ? window.sessionStorage.getItem("jq-session-token") : null;
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            action: "start",
            website,
            name: name.trim() || null,
            email: email.trim() || null,
            message,
            pageUrl: window.location.pathname,
            analyticsConsent: consent,
            visitorId,
            sessionToken,
            source: consent === "granted" ? params.get("utm_source") : null,
          }),
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(typeof result.error === "string" ? result.error : "Chat could not be started.");
        const next: ChatSession = {
          ticketId: result.ticket.id,
          ticketNumber: result.ticket.ticket_number,
          chatToken: result.chatToken,
          status: result.ticket.status,
        };
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        saveSession(next);
        setDraft("");
        await loadMessages(next);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Something went wrong. Please try again.");
    } finally {
      setSending(false);
    }
  }

  function startNewChat() {
    clearSession();
    setMessages([]);
    setError("");
  }

  if (!mounted || (typeof window !== "undefined" && (window.location.pathname.startsWith("/admin") || window.location.pathname.startsWith("/login")))) return null;

  return (
    <div className={styles.root}>
      {open && (
        <section className={styles.panel} aria-label="JINQAYA live chat">
          <header className={styles.header}>
            <div><span className={styles.eyebrow}>JINQAYA · CUSTOMER CARE</span><strong>How can we help?</strong><small>Send us a message and our team will reply here.</small></div>
            <button type="button" className={styles.close} aria-label="Close chat" onClick={() => setOpen(false)}>×</button>
          </header>
          {session && <div className={styles.reference}>Conversation {session.ticketNumber}</div>}
          <div className={styles.messages} aria-live="polite">
            {!session && <div className={styles.welcome}><span>✳</span><p>Welcome to JINQAYA. Leave us a message and we’ll be happy to help.</p></div>}
            {messages.map((item) => (
              <div key={item.id} className={item.sender_type === "customer" ? styles.customerMessage : styles.staffMessage}>
                <p>{item.message}</p><time>{timeLabel(item.created_at)}</time>
              </div>
            ))}
            {session && messages.length === 1 && <p className={styles.waiting}>Thanks for reaching out. Our team will respond as soon as possible.</p>}
          </div>
          {session && (session.status === "closed" || session.status === "resolved") ? (
            <div className={styles.closed}><p>This conversation has been closed.</p><button type="button" onClick={startNewChat}>START A NEW CHAT</button></div>
          ) : (
            <form className={styles.form} onSubmit={send}>
              {!session && (
                <label className={styles.honeypot} aria-hidden="true">Leave this field empty<input tabIndex={-1} autoComplete="off" value={website} onChange={(event) => setWebsite(event.target.value)} /></label>
              )}
              {!session && (
                <div className={styles.identity}>
                  <label>Your name <span>OPTIONAL</span><input value={name} onChange={(event) => setName(event.target.value)} maxLength={120} placeholder="Name" /></label>
                  <label>Email <span>OPTIONAL</span><input value={email} onChange={(event) => setEmail(event.target.value)} maxLength={254} type="email" placeholder="name@example.com" /></label>
                </div>
              )}
              <label className={styles.messageLabel}><span className={styles.srOnly}>Your message</span><textarea required maxLength={2000} rows={3} value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Write your message…" /></label>
              {error && <p className={styles.error} role="alert">{error}</p>}
              <div className={styles.formFooter}><small>We usually reply during business hours.</small><button type="submit" disabled={sending || !draft.trim()}>{sending ? "SENDING…" : "SEND MESSAGE"} <span aria-hidden="true">↗</span></button></div>
            </form>
          )}
          <footer className={styles.footer}>For email support: <a href="mailto:info@jinqaya.com">info@jinqaya.com</a></footer>
        </section>
      )}
      <button type="button" className={styles.launcher} aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        <span className={styles.launchIcon}>{open ? "×" : "✳"}</span>{open ? "CLOSE CHAT" : "CHAT WITH US"}
      </button>
    </div>
  );
}
