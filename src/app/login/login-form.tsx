"use client";

import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setSent(false);

    try {
      const supabase = createClient();
      const redirectTo = new URL("/auth/callback?next=/admin/products", window.location.origin);

      const { error: authError } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: redirectTo.toString(),
          shouldCreateUser: false,
        },
      });

      if (authError) {
        setError(
          authError.message.includes("rate limit")
            ? "Too many emails have been requested. Please wait before requesting another sign-in link."
            : authError.message
        );
        return;
      }

      setSent(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not request a sign-in link. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="admin-login-form" onSubmit={submit}>
      <label>
        Administrator email
        <input
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
        />
      </label>

      {error && (
        <p className="admin-login-error" role="alert">
          {error}
        </p>
      )}

      {sent && (
        <p role="status">
          If this address is an invited administrator account, a sign-in link will arrive by email. Open it on this same browser to continue.
        </p>
      )}

      <button className="admin-primary-button" type="submit" disabled={busy}>
        {busy ? "Sending link…" : "Email me a sign-in link"}
      </button>
    </form>
  );
}
