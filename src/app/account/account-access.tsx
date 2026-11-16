"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import styles from "./account.module.css";

export function AccountAccess({ mode }: { mode: "login" | "logout" }) {
  const router=useRouter();
  const [email,setEmail]=useState("");
  const [code,setCode]=useState("");
  const [sent,setSent]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");

  async function requestCode(event:FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const supabase=createClient();
      const {error:authError}=await supabase.auth.signInWithOtp({email:email.trim().toLowerCase(),options:{shouldCreateUser:true}});
      if(authError) { setError(authError.message.toLowerCase().includes("rate limit")?"Too many codes requested. Please wait before trying again.":"We couldn’t send a code. Check your email address and try again."); return; }
      setSent(true);
    } catch { setError("We couldn’t send a verification code. Please try again."); }
    finally { setBusy(false); }
  }

  async function verifyCode(event:FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const supabase=createClient();
      const {error:verifyError}=await supabase.auth.verifyOtp({email:email.trim().toLowerCase(),token:code.trim(),type:"email"});
      if(verifyError) { setError("That code is invalid or has expired. Request a new code and try again."); return; }
      router.refresh();
    } catch { setError("We couldn’t verify your email. Please try again."); }
    finally { setBusy(false); }
  }

  async function signOut() {
    setBusy(true);
    const supabase=createClient();
    await supabase.auth.signOut();
    router.push("/account");
    router.refresh();
  }

  if(mode==="logout") return <button className={styles.signOut} type="button" onClick={signOut} disabled={busy}>{busy?"SIGNING OUT…":"SIGN OUT"}</button>;

  return <div className={styles.form}>
    {!sent ? <form onSubmit={requestCode}>
      <label htmlFor="account-email">Email address</label>
      <input id="account-email" type="email" autoComplete="email" required maxLength={254} value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com"/>
      <button type="submit" disabled={busy||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())}>{busy?"SENDING CODE…":"EMAIL ME A SIGN-IN CODE ↗"}</button>
    </form> : <form onSubmit={verifyCode}>
      <p className={styles.sent}>A six-digit code has been sent to <strong>{email}</strong>.</p>
      <label htmlFor="account-code">Verification code</label>
      <input id="account-code" type="text" inputMode="numeric" autoComplete="one-time-code" required pattern="[0-9]{6}" maxLength={6} value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,"").slice(0,6))} placeholder="000000"/>
      <button type="submit" disabled={busy||code.length!==6}>{busy?"VERIFYING…":"VERIFY AND CONTINUE ↗"}</button>
      <button className={styles.secondary} type="button" disabled={busy} onClick={()=>{setSent(false);setCode("");setError("");}}>USE A DIFFERENT EMAIL</button>
    </form>}
    {error?<p className={styles.error} role="alert">{error}</p>:null}
  </div>;
}
