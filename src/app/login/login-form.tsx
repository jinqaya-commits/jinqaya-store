"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function LoginForm() {
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const [error,setError]=useState("");
  const [busy,setBusy]=useState(false);
  const router=useRouter();

  async function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();setBusy(true);setError("");
    const supabase=createClient();
    const {error:authError}=await supabase.auth.signInWithPassword({email,password});
    if(authError){setError(authError.message);setBusy(false);return;}
    const {data:allowed,error:roleError}=await supabase.rpc("can_manage_catalog");
    if(roleError||allowed!==true){await supabase.auth.signOut();setError("This account does not have catalog management permission.");setBusy(false);return;}
    router.replace("/admin/products");router.refresh();
  }

  return <form className="admin-login-form" onSubmit={submit}>
    <label>Email address<input type="email" autoComplete="username" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com"/></label>
    <label>Password<input type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)} placeholder="Your password"/></label>
    {error&&<p className="admin-login-error" role="alert">{error}</p>}
    <button className="admin-primary-button" type="submit" disabled={busy}>{busy?"Signing in…":"Sign in"}</button>
  </form>;
}
