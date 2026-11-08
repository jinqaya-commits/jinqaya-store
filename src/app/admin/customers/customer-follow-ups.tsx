"use client";

import { useEffect, useState } from "react";

type FollowUp = {
  id: string;
  title: string;
  notes: string | null;
  due_at: string;
  status: "pending" | "completed" | "cancelled";
  completed_at: string | null;
  created_at: string;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function localDateTimeDefault() {
  const date = new Date(Date.now() + 24 * 60 * 60 * 1000);
  date.setMinutes(0, 0, 0);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

export default function CustomerFollowUps({ customerId, initialFollowUps }: {
  customerId: string;
  initialFollowUps: FollowUp[];
}) {
  const [items, setItems] = useState(initialFollowUps);
  const [currentTime, setCurrentTime] = useState<number | null>(null);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setCurrentTime(Date.now()), 0);
    return () => window.clearTimeout(timeoutId);
  }, []);
  const [title, setTitle] = useState("");
  const [dueAt, setDueAt] = useState(localDateTimeDefault);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [message, setMessage] = useState("");

  async function addFollowUp(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/customers/${customerId}/follow-ups`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, dueAt: new Date(dueAt).toISOString(), notes }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to save follow-up.");
      setItems(current => [...current, result.followUp].sort((a, b) => a.due_at.localeCompare(b.due_at)));
      setTitle("");
      setNotes("");
      setDueAt(localDateTimeDefault());
      setMessage("Follow-up scheduled.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save follow-up.");
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(id: string, status: "pending" | "completed" | "cancelled") {
    setBusyId(id);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/customers/${customerId}/follow-ups/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to update follow-up.");
      setItems(current => current.map(item => item.id === id ? result.followUp : item));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update follow-up.");
    } finally {
      setBusyId("");
    }
  }

  const pending = items.filter(item => item.status === "pending");
  const overdue = pending.filter(item => currentTime !== null && new Date(item.due_at).getTime() < currentTime);

  return <div className="admin-followups">
    <form className="admin-followup-form" onSubmit={addFollowUp}>
      <div className="admin-followup-fields">
        <label><span className="admin-kicker">FOLLOW-UP TASK</span><input required minLength={2} maxLength={120} value={title} onChange={event => setTitle(event.target.value)} placeholder="e.g. Check delivery feedback" /></label>
        <label><span className="admin-kicker">CONTACT DATE & TIME</span><input required type="datetime-local" value={dueAt} onChange={event => setDueAt(event.target.value)} /></label>
      </div>
      <label className="admin-followup-notes"><span className="admin-kicker">FOLLOW-UP NOTES</span><textarea rows={3} maxLength={2000} value={notes} onChange={event => setNotes(event.target.value)} placeholder="What should be discussed or confirmed? (Internal only)" /></label>
      <div className="admin-crm-footer"><button type="submit" disabled={saving || !title.trim() || !dueAt}>{saving ? "Saving…" : "Schedule follow-up"}</button><small>{notes.length}/2000 characters</small></div>
    </form>

    <div className="admin-followup-summary">
      <span>{pending.length} open</span>
      <span className={overdue.length ? "admin-followup-overdue" : ""}>{overdue.length} overdue</span>
      <span>{items.filter(item => item.status === "completed").length} completed</span>
    </div>

    {!items.length ? <div className="admin-empty"><h3>No follow-ups scheduled.</h3><p>Create a reminder to keep the next customer contact on track.</p></div> : <div className="admin-followup-list">
      {items.map(item => {
        const isOverdue = item.status === "pending" && currentTime !== null && new Date(item.due_at).getTime() < currentTime;
        return <article className="admin-followup-item" key={item.id}>
          <div className="admin-followup-item-main">
            <div className="admin-followup-title-row">
              <strong>{item.title}</strong>
              <span className={item.status === "completed" ? "admin-status status-active" : item.status === "cancelled" ? "admin-status status-draft" : isOverdue ? "admin-status status-warning" : "admin-status status-draft"}>
                {item.status === "completed" ? "Completed" : item.status === "cancelled" ? "Cancelled" : isOverdue ? "Overdue" : "Upcoming"}
              </span>
            </div>
            <p className="admin-followup-due">Due {formatDate(item.due_at)}</p>
            {item.notes && <p className="admin-followup-note-text">{item.notes}</p>}
            {item.completed_at && <small>Completed {formatDate(item.completed_at)}</small>}
          </div>
          {item.status === "pending" && <div className="admin-followup-actions">
            <button type="button" disabled={busyId === item.id} onClick={() => updateStatus(item.id, "completed")}>{busyId === item.id ? "Saving…" : "Mark complete"}</button>
            <button type="button" className="admin-followup-cancel" disabled={busyId === item.id} onClick={() => updateStatus(item.id, "cancelled")}>Cancel</button>
          </div>}
          {item.status === "cancelled" && <button type="button" className="admin-followup-cancel" disabled={busyId === item.id} onClick={() => updateStatus(item.id, "pending")}>Reopen</button>}
        </article>;
      })}
    </div>}
    {message && <p className="admin-help" role="status">{message}</p>}
  </div>;
}
