import { useEffect } from "react";
import { completionEstimate } from "@/lib/reader-preferences";
import {
  beginArticleRead,
  readerSession,
  trackArticleQuality,
  trackReaderEvent,
} from "@/lib/reader-tracking";

export function ArticleTracker({ slug }: { slug: string }) {
  useEffect(() => {
    if (!readerSession()) return;
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
      /* An absent referrer is direct/unknown. */
    }
    const device = /Mobi|Android/i.test(navigator.userAgent) ? "mobile" : "desktop";
    const ready = beginArticleRead(slug, source, device);
    void ready.then((recorded) => {
      if (recorded) void trackArticleQuality(slug, "progress");
    });
    let seconds = 0;
    let scroll = 0;
    let completed = false;
    let engagedSent = false;
    let frame = 0;
    const progress = () => {
      const body = document.querySelector<HTMLElement>("[data-article-body]");
      if (!body || document.visibilityState !== "visible") return;
      const rect = body.getBoundingClientRect();
      const reached = Math.max(
        0,
        Math.min(
          100,
          Math.round(((window.innerHeight - rect.top) / Math.max(1, rect.height)) * 100),
        ),
      );
      scroll = Math.max(scroll, reached);
      if (!completed && completionEstimate(seconds, scroll)) {
        completed = true;
        void trackArticleQuality(slug, "progress", scroll, true);
      }
    };
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        progress();
      });
    };
    progress();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") seconds++;
      progress();
      if (seconds >= 30 && !engagedSent) {
        engagedSent = true;
        void ready.then((recorded) => {
          if (recorded)
            void trackReaderEvent("record_article_read", {
              p_slug: slug,
              p_source: source,
              p_device: device,
              p_engaged: true,
            });
        });
      }
      if (seconds > 0 && seconds % 15 === 0 && document.visibilityState === "visible")
        void trackArticleQuality(slug, "progress", scroll, completed);
    }, 1000);
    return () => {
      window.clearInterval(timer);
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      void trackArticleQuality(slug, "progress", scroll, completed);
    };
  }, [slug]);
  return null;
}
