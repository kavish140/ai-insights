import { useEffect, useState } from "react";
import { browserClient } from "@/lib/supabase-client";
import { messageFor } from "@/lib/admin";
import { rate } from "@/lib/reader-preferences";
import { Link } from "@tanstack/react-router";

type QualityReport = {
  measured: number;
  completed: number;
  helpful: number;
  unhelpful: number;
  impressions: number;
  clicks: number;
  posts: {
    slug: string;
    title: string;
    measured: number;
    completed: number;
    helpful: number;
    unhelpful: number;
    avg_scroll: number;
  }[];
  placements: { placement: string; impressions: number; clicks: number }[];
};
export function ReadingQuality({ days, refresh }: { days: number; refresh: number }) {
  const [report, setReport] = useState<QualityReport | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setReport(null);
    setError("");
    void (async () => {
      try {
        const { data, error } = await (
          await browserClient()
        ).rpc("reading_quality_analytics", { p_days: days });
        if (error) throw error;
        if (active) setReport(data as QualityReport);
      } catch (e) {
        if (active) setError(messageFor(e));
      }
    })();
    return () => {
      active = false;
    };
  }, [days, refresh]);
  return (
    <section className="space-y-5 rounded-xl border border-border bg-card p-5">
      <h3 className="text-lg font-semibold">Reading quality</h3>
      {error && <p role="alert">{error}</p>}
      {!report && !error && <p role="status">Loading reading quality…</p>}
      {report && (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              [
                "Estimated completion",
                rate(report.completed, report.measured),
                `${report.completed} of ${report.measured} measured reads`,
              ],
              [
                "Helpful responses",
                rate(report.helpful, report.helpful + report.unhelpful),
                `${report.helpful} helpful · ${report.unhelpful} not yet`,
              ],
              [
                "Recommendation click rate",
                rate(report.clicks, report.impressions),
                `${report.clicks} clicks · ${report.impressions} impressions`,
              ],
            ].map(([label, value, detail]) => (
              <div key={label}>
                <p className="text-sm text-muted-foreground">{label}</p>
                <p className="mt-2 text-2xl font-semibold">{value}</p>
                <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
              </div>
            ))}
          </div>
          {!report.measured && (
            <p className="text-sm text-muted-foreground">
              Quality measurement starts with this update. Earlier views are excluded from
              completion estimates.
            </p>
          )}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] text-left text-sm">
              <thead>
                <tr>
                  {[
                    "Article",
                    "Measured reads",
                    "Completion",
                    "Average depth",
                    "Helpful / Not yet",
                  ].map((label) => (
                    <th key={label} className="pb-3 pr-3">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {report.posts.map((post) => (
                  <tr key={post.slug} className="border-t border-border">
                    <td className="py-3 pr-3">
                      <Link to="/blog/$slug" params={{ slug: post.slug }} className="text-primary">
                        {post.title}
                      </Link>
                    </td>
                    <td>{post.measured}</td>
                    <td>{rate(post.completed, post.measured)}</td>
                    <td>{post.avg_scroll}%</td>
                    <td>
                      {post.helpful} / {post.unhelpful}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="space-y-2 text-sm">
            {report.placements.map((placement) => (
              <li key={placement.placement}>
                {placement.placement === "personalized"
                  ? "Homepage personalized reading"
                  : "Related articles"}
                : {placement.clicks} clicks / {placement.impressions} impressions (
                {rate(placement.clicks, placement.impressions)})
              </li>
            ))}
          </ul>
        </>
      )}
      <p className="text-xs leading-relaxed text-muted-foreground">
        Completion is estimated after 30 visible seconds and reaching 90% of the article body. Depth
        measures the furthest body position visible, not comprehension. A recommendation impression
        requires at least half its card visible or a click. Impressions and clicks are deduplicated
        per source, target, placement, session and UTC day. Feedback keeps the latest response per
        article/session/day. Small samples and client blocking can affect these rates.
      </p>
    </section>
  );
}
