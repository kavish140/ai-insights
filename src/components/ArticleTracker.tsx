import { useEffect } from "react";
import { browserClient } from "@/lib/supabase-client";

// Session-scoped IDs only: no fingerprint, persistent cookie, or stored referrer URL.
export function ArticleTracker({ slug }: { slug: string }) {
  useEffect(() => {
    if (
      navigator.doNotTrack === "1" ||
      (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl ||
      /bot|crawler|spider|headless/i.test(navigator.userAgent)
    )
      return;
    let session: string;
    try {
      session = sessionStorage.getItem("ai-reader-session") || crypto.randomUUID();
      sessionStorage.setItem("ai-reader-session", session);
    } catch {
      return;
    }
    let source = "direct";
    try {
      const host = new URL(document.referrer).hostname;
      source =
        host === location.hostname
          ? "internal"
          : /(^|\.)google\./.test(host)
            ? "google"
            : /(^|\.)(bing|duckduckgo)\./.test(host)
              ? "other-search"
              : "external";
    } catch {
      /* Empty referrers are direct/unknown traffic. */
    }
    const device = /Mobi|Android/i.test(navigator.userAgent) ? "mobile" : "desktop";
    let active = true;
    const record = async (engaged: boolean) => {
      try {
        const client = await browserClient();
        if (!active) return;
        const { data } = await client.auth.getSession();
        if (data.session || !active) return; // Exclude signed-in admin browsing.
        await client.rpc("record_article_read", {
          p_slug: slug,
          p_session: session,
          p_source: source,
          p_device: device,
          p_engaged: engaged,
        });
      } catch {
        /* Analytics must never interrupt reading. */
      }
    };
    void record(false);
    let visibleSeconds = 0;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") visibleSeconds += 1;
      if (visibleSeconds >= 30) {
        window.clearInterval(timer);
        void record(true);
      }
    }, 1000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [slug]);
  return null;
}
