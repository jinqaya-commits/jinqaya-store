"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

type Consent = "granted" | "denied" | null;

function getOrCreateId(storage: Storage, key: string) {
  let value = storage.getItem(key);
  if (!value) {
    value = crypto.randomUUID();
    storage.setItem(key, value);
  }
  return value;
}

export function VisitorAnalytics() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [consent, setConsent] = useState<Consent>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem("jq-analytics-consent");
    setConsent(saved === "granted" || saved === "denied" ? saved : null);
    setReady(true);
  }, []);

  useEffect(() => {
    if (consent !== "granted" || !pathname) return;
    try {
      const visitorId = getOrCreateId(window.localStorage, "jq-visitor-id");
      const sessionToken = getOrCreateId(window.sessionStorage, "jq-session-token");
      const params = new URLSearchParams(window.location.search);
      const payload = {
        consent,
        visitorId,
        sessionToken,
        pagePath: pathname,
        pageTitle: document.title,
        referrerUrl: document.referrer,
        source: params.get("utm_source"),
        medium: params.get("utm_medium"),
        campaign: params.get("utm_campaign"),
        term: params.get("utm_term"),
        content: params.get("utm_content"),
        gclid: params.get("gclid"),
        fbclid: params.get("fbclid"),
      };
      fetch("/api/analytics/track", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
        keepalive: true,
        credentials: "same-origin",
      }).catch(() => undefined);
    } catch {
      // Analytics is optional; storage restrictions must never block shopping.
    }
  }, [consent, pathname, searchParams]);

  function chooseConsent(next: Exclude<Consent, null>) {
    window.localStorage.setItem("jq-analytics-consent", next);
    setConsent(next);
  }

  if (!ready || consent !== null) return null;

  return (
    <aside
      aria-label="Privacy preferences"
      className="jq-consent-banner"
      role="dialog"
      aria-modal="false"
    >
      <div>
        <strong>YOUR PRIVACY MATTERS</strong>
        <p>We use optional analytics to understand which pages are useful and where visits come from. You can continue with essential site functions only.</p>
        <a href="/policies/privacy">Read our Privacy Policy</a>
      </div>
      <div className="jq-consent-actions">
        <button type="button" onClick={() => chooseConsent("denied")}>ESSENTIAL ONLY</button>
        <button type="button" onClick={() => chooseConsent("granted")}>ALLOW ANALYTICS</button>
      </div>
    </aside>
  );
}
