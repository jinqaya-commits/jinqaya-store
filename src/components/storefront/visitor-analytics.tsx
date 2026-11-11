"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import styles from "./visitor-analytics.module.css";

type Consent = "granted" | "denied" | null;
type ConsentSnapshot = Consent | "loading";

const consentListeners = new Set<() => void>();

function subscribeConsent(onChange: () => void) {
  consentListeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    consentListeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

function getConsentSnapshot(): Consent {
  try {
    const saved = window.localStorage.getItem("jq-analytics-consent");
    return saved === "granted" || saved === "denied" ? saved : null;
  } catch {
    return null;
  }
}

function getServerConsentSnapshot(): ConsentSnapshot {
  return "loading";
}

function saveConsent(next: Exclude<Consent, null>) {
  try {
    window.localStorage.setItem("jq-analytics-consent", next);
  } catch {
    // Keep the storefront usable when browser storage is unavailable.
  }
  consentListeners.forEach((listener) => listener());
}

function getOrCreateId(storage: Storage, key: string) {
  let value = storage.getItem(key);
  if (!value) {
    value = crypto.randomUUID();
    storage.setItem(key, value);
  }
  return value;
}

function getSessionToken() {
  const lastSeen = Number(window.sessionStorage.getItem("jq-session-last-seen") || 0);
  let token = window.sessionStorage.getItem("jq-session-token");
  if (!token || !lastSeen || Date.now() - lastSeen > 30 * 60 * 1000) {
    token = crypto.randomUUID();
    window.sessionStorage.setItem("jq-session-token", token);
  }
  window.sessionStorage.setItem("jq-session-last-seen", String(Date.now()));
  return token;
}

export function VisitorAnalytics() {
  const pathname = usePathname();
  const consent = useSyncExternalStore(subscribeConsent, getConsentSnapshot, getServerConsentSnapshot);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    if (consent !== "granted" || !pathname || pathname.startsWith("/admin") || pathname.startsWith("/login")) return;
    try {
      const visitorId = getOrCreateId(window.localStorage, "jq-visitor-id");
      const sessionToken = getSessionToken();
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
  }, [consent, pathname]);

  function chooseConsent(next: Exclude<Consent, null>) {
    saveConsent(next);
    setShowSettings(false);
  }

  if (consent === "loading") return null;

  return (
    <>
      {(consent === null || showSettings) && (
        <aside
          aria-label="Privacy preferences"
          className={styles.banner}
          role="dialog"
          aria-modal="false"
        >
          <div>
            <strong>YOUR PRIVACY MATTERS</strong>
            <p>We use optional analytics to understand which pages are useful and where visits come from. You can continue with essential site functions only.</p>
            <a href="/policies/privacy">Read our Privacy Policy</a>
          </div>
          <div className={styles.actions}>
            <button type="button" onClick={() => chooseConsent("denied")}>ESSENTIAL ONLY</button>
            <button type="button" onClick={() => chooseConsent("granted")}>ALLOW ANALYTICS</button>
          </div>
        </aside>
      )}
      {consent !== null && !showSettings && (
        <button type="button" className={styles.settings} onClick={() => setShowSettings(true)}>PRIVACY SETTINGS</button>
      )}
    </>
  );
}
