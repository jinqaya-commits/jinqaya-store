"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { retryOrderEmailAction } from "./actions";

type EmailItem = {
  id: string;
  recipient_type: string;
  recipient_email: string;
  status: string;
  attempt_count: number;
  max_attempts: number;
  next_attempt_at: string | null;
  last_error: string | null;
  sent_at: string | null;
  created_at: string;
};

const statusLabels: Record<string, string> = {
  pending: "Queued",
  processing: "Sending",
  retry: "Retry scheduled",
  sent: "Sent",
  dead: "Failed permanently",
};

function formatDate(value: string | null) {
  return value ? new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "—";
}

export function OrderEmailOutboxManager({ orderId, items }: { orderId: string; items: EmailItem[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [pending, startTransition] = useTransition();

  function retry(item: EmailItem) {
    if (!window.confirm(`Queue another send attempt to ${item.recipient_email}? If the previous provider result was ambiguous, a duplicate email is possible.`)) return;
    setError("");
    setSuccess("");
    setBusyId(item.id);
    startTransition(async () => {
      try {
        const result = await retryOrderEmailAction(orderId, item.id);
        if (result.error) setError(result.error);
        else {
          setSuccess("Email queued for retry. The scheduled worker will process it.");
          router.refresh();
        }
      } catch {
        setError("Unable to queue this email for retry.");
      } finally {
        setBusyId("");
      }
    });
  }

  return (
    <section className="admin-panel">
      <div className="admin-panel-heading">
        <div><p className="admin-kicker">CUSTOMER COMMUNICATION</p><h2>Order emails</h2></div>
        <span>{items.length} EMAILS</span>
      </div>
      {!items.length ? <p className="admin-help">No order email tasks have been recorded.</p> : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th>RECIPIENT</th><th>STATUS</th><th>ATTEMPTS</th><th>LAST SENT</th><th>NEXT RETRY</th><th>ACTION</th></tr></thead>
            <tbody>{items.map(item => (
              <tr key={item.id}>
                <td><strong>{item.recipient_type === "staff" ? "Admin notification" : "Customer confirmation"}</strong><small>{item.recipient_email}</small></td>
                <td><span className={item.status === "sent" ? "admin-status status-active" : "admin-status status-draft"}>{statusLabels[item.status] || item.status}</span>{item.last_error && <small title={item.last_error}>{item.last_error.slice(0, 120)}</small>}</td>
                <td>{item.attempt_count} / {item.max_attempts}</td>
                <td>{formatDate(item.sent_at)}</td>
                <td>{formatDate(item.next_attempt_at)}</td>
                <td>{(item.status === "dead" || item.status === "retry") && !item.sent_at ? <button type="button" className="admin-secondary-button" disabled={pending || busyId === item.id} onClick={() => retry(item)}>{busyId === item.id ? "Queuing…" : "Retry email"}</button> : "—"}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
      {error && <p className="admin-error" role="alert">{error}</p>}
      {success && <p className="admin-success" role="status">{success}</p>}
      <p className="admin-help">Retrying queues the email; it does not send immediately. If a previous send timed out after delivery, a duplicate is still possible.</p>
    </section>
  );
}
