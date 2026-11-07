"use client";

import { useState } from "react";

const suggestedTags = ["VIP", "Repeat customer", "High potential", "Follow-up", "After-sales"];

export default function CustomerCrmEditor({ customerId, initialNotes, initialTags }: {
  customerId: string; initialNotes: string; initialTags: string[];
}) {
  const [notes, setNotes] = useState(initialNotes);
  const [tags, setTags] = useState(initialTags);
  const [tagInput, setTagInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  function addTag(value: string) {
    const next = value.trim().replace(/\s+/g, " ");
    if (!next) return;
    if (next.length > 30) { setMessage("Each tag must be 30 characters or fewer."); return; }
    if (tags.some(tag => tag.toLowerCase() === next.toLowerCase())) { setTagInput(""); return; }
    if (tags.length >= 10) { setMessage("A customer can have up to 10 tags."); return; }
    setTags(current => [...current, next]);
    setTagInput("");
    setMessage("");
  }

  async function save() {
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/customers/${customerId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes, tags }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to save.");
      setTags(result.tags || tags);
      setMessage("Customer details saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save customer details.");
    } finally {
      setSaving(false);
    }
  }

  return <div className="admin-crm-editor">
    <div>
      <span className="admin-kicker">CUSTOMER TAGS</span>
      <div className="admin-crm-tags">{tags.map(tag => <span className="admin-crm-tag" key={tag}>{tag}<button type="button" aria-label={`Remove ${tag}`} onClick={() => setTags(current => current.filter(item => item !== tag))}>×</button></span>)}</div>
      <div className="admin-crm-tag-entry">
        <input value={tagInput} maxLength={30} placeholder="Add a tag, e.g. VIP" onChange={event => setTagInput(event.target.value)} onKeyDown={event => { if (event.key === "Enter" || event.key === ",") { event.preventDefault(); addTag(tagInput); } }} />
        <button type="button" onClick={() => addTag(tagInput)}>Add tag</button>
      </div>
      <div className="admin-crm-suggestions">{suggestedTags.map(tag => <button type="button" key={tag} disabled={tags.some(item => item.toLowerCase() === tag.toLowerCase()) || tags.length >= 10} onClick={() => addTag(tag)}>+ {tag}</button>)}</div>
    </div>
    <label className="admin-crm-notes"><span className="admin-kicker">INTERNAL CUSTOMER NOTES</span><textarea rows={5} maxLength={5000} value={notes} onChange={event => setNotes(event.target.value)} placeholder="Record customer preferences, conversations, follow-up details or after-sales notes. These notes are internal only."/><small>{notes.length}/5000 characters · Visible to authorized staff only</small></label>
    <div className="admin-crm-footer"><button type="button" disabled={saving} onClick={save}>{saving ? "Saving…" : "Save customer details"}</button>{message && <span role="status">{message}</span>}</div>
  </div>;
}
