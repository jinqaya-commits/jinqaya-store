"use client";

import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function requestCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");

    try {
      const supabase = createClient();
      const { error: authError } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { shouldCreateUser: false },
      });

      if (authError) {
        setError(
          authError.message.toLowerCase().includes("rate limit")
            ? "Too many codes have been requested. Please wait before trying again."
            : authError.message
        );
        return;
      }

      setSent(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not send a verification code. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");

    try {
      const supabase = createClient();
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: token.trim(),
        type: "email",
      });

      if (verifyError) {
        setError(
          verifyError.message.toLowerCase().includes("expired")
            ? "This code has expired. Request a new verification code."
            : "The code is invalid or has expired. Please check it and try again."
        );
        return;
      }

      const { data: allowed, error: permissionError } = await supabase.rpc("can_manage_catalog");
      if (permissionError || allowed !== true) {
        await supabase.auth.signOut();
        setError("This email is not authorized to access the administrator area.");
        return;
      }

      window.location.assign("/admin/products");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not verify the code. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="admin-login-form">
      {!sent ? (
        <form onSubmit={requestCode}>
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
          {error && <p className="admin-login-error" role="alert">{error}</p>}
          <button className="admin-primary-button" type="submit" disabled={busy}>
            {busy ? "Sending code…" : "Email me a verification code"}
          </button>
        </form>
      ) : (
        <form onSubmit={verifyCode}>
          <p role="status">Enter the verification code sent to <strong>{email}</strong>.</p>
          <label>
            6-digit verification code
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              required
              value={token}
              onChange={(event) => setToken(event.target.value.replace(/\\D/g, "").slice(0, 6))}
              placeholder="000000"
            />
          </label>
          {error && <p className="admin-login-error" role="alert">{error}</p>}
          <button className="admin-primary-button" type="submit" disabled={busy || token.length !== 6}>
            {busy ? "Verifying…" : "Verify and sign in"}
          </button>
          <button className="admin-table-action" type="button" disabled={busy} onClick={() => { setSent(false); setToken(""); setError(""); }}>
            Use a different email
          </button>
        </form>
      )}
    </div>
  );
}
