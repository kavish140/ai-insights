import { browserClient } from "./supabase-client";

export function readerSession(): string | null {
  if (
    typeof window === "undefined" ||
    navigator.doNotTrack === "1" ||
    (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl ||
    /bot|crawler|spider|headless/i.test(navigator.userAgent)
  )
    return null;
  try {
    const id = sessionStorage.getItem("ai-reader-session") || crypto.randomUUID();
    sessionStorage.setItem("ai-reader-session", id);
    return id;
  } catch {
    return null;
  }
}

// Shared gate for views, feedback and recommendations; signed-in sessions are excluded.
export async function trackReaderEvent(
  rpc: string,
  args: Record<string, unknown>,
): Promise<boolean> {
  const session = readerSession();
  if (!session) return false;
  try {
    const client = await browserClient();
    const { data, error } = await client.auth.getSession();
    if (error || data.session) return false;
    const result = await client.rpc(rpc, { ...args, p_session: session });
    return !result.error;
  } catch {
    return false;
  }
}

export type Recommendation = { source: string; placement: "personalized" | "related" };
const pendingReads = new Map<string, Promise<boolean>>();
export function beginArticleRead(slug: string, source: string, device: string) {
  const pending = trackReaderEvent("record_article_read", {
    p_slug: slug,
    p_source: source,
    p_device: device,
    p_engaged: false,
  });
  pendingReads.set(slug, pending);
  return pending;
}
export async function trackArticleQuality(
  slug: string,
  event: "progress" | "helpful" | "unhelpful",
  scroll = 0,
  completed = false,
) {
  const ready = pendingReads.get(slug);
  if (!ready || !(await ready)) return false;
  return trackReaderEvent("record_article_quality", {
    p_slug: slug,
    p_event: event,
    p_scroll: scroll,
    p_completed: completed,
  });
}
export function trackRecommendation(
  slug: string,
  recommendation: Recommendation,
  clicked: boolean,
) {
  return trackReaderEvent("record_recommendation", {
    p_target: slug,
    p_source: recommendation.source,
    p_placement: recommendation.placement,
    p_clicked: clicked,
  });
}
