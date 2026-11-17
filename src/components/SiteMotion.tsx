import { useEffect } from "react";
import { useLocation } from "@tanstack/react-router";

/** Enhance visible content only after hydration; reading never depends on animation. */
export function SiteMotion() {
  const href = useLocation({ select: (location) => location.href });
  useEffect(() => {
    if (
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      document.documentElement.dataset["readerMotion"] === "false" ||
      typeof IntersectionObserver === "undefined"
    )
      return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.setAttribute("data-visible", "true");
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.08 },
    );
    const frame = requestAnimationFrame(() => {
      document
        .querySelectorAll<HTMLElement>("[data-reveal], .post-card, .reading-step")
        .forEach((element) => {
          // Above-the-fold content stays immediately readable.
          if (element.getBoundingClientRect().top < window.innerHeight) return;
          element.setAttribute("data-visible", "false");
          observer.observe(element);
        });
    });
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      document
        .querySelectorAll('[data-visible="false"]')
        .forEach((element) => element.removeAttribute("data-visible"));
    };
  }, [href]);
  return null;
}
