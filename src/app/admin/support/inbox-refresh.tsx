"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function SupportInboxRefresh() {
  const router = useRouter();
  useEffect(() => {
    const timer = window.setInterval(() => router.refresh(), 5000);
    return () => window.clearInterval(timer);
  }, [router]);
  return <span className="admin-support-live-indicator"><i aria-hidden="true" /> LIVE · UPDATES EVERY 5 SECONDS</span>;
}
