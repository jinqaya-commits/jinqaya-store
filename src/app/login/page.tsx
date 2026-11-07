import Link from "next/link";
import { LoginForm } from "./login-form";

export const metadata = { title: "Admin sign in", robots: { index: false, follow: false, googleBot: { index: false, follow: false } } };

export default function LoginPage() {
  return <main className="admin-login-page">
    <Link href="/" className="admin-brand admin-login-brand">JINQAYA<span>ADMIN</span></Link>
    <section className="admin-login-card">
      <p className="admin-kicker">PRIVATE ACCESS</p>
      <h1>Welcome back.</h1>
      <p>Sign in with your JINQAYA administrator account to manage the catalog.</p>
      <LoginForm />
    </section>
    <Link href="/" className="admin-login-back">← Back to storefront</Link>
  </main>;
}
