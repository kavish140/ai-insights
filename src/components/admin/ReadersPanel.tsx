import { useEffect, useState } from "react";
import { browserClient } from "@/lib/supabase-client";
import { messageFor } from "@/lib/admin";
import { Link } from "@tanstack/react-router";
import { ReadingQuality } from "./ReadingQuality";

type Breakdown = { label?: string; tag?: string; views: number };
type Report = {
  views: number;
  sessions: number;
  engaged: number;
  posts: { slug: string; title: string; views: number; engaged: number }[];
  topics: Breakdown[];
  audiences: Breakdown[];
  sources: Breakdown[];
  devices: Breakdown[];
  daily: { day: string; views: number; sessions: number }[];
};
export function ReadersPanel() {
  const [days, setDays] = useState(30);
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    setReport(null);
    void (async () => {
      try {
        const { data, error } = await (
          await browserClient()
        ).rpc("reader_analytics", { p_days: days });
        if (error) throw error;
        if (active) setReport(data as Report);
      } catch (error) {
        if (active) setError(messageFor(error));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [days, refresh]);
  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Reader analytics</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Understand which content gets read and where visits come from.
          </p>
        </div>
        <div className="flex gap-2">
          <select
            aria-label="Analytics period"
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="rounded-lg border border-input bg-surface p-2"
          >
            {[7, 30, 90].map((value) => (
              <option key={value} value={value}>
                Last {value} days
              </option>
            ))}
          </select>
          <button
            disabled={loading}
            onClick={() => setRefresh((value) => value + 1)}
            className="rounded-lg border border-border p-2 disabled:opacity-50"
          >
            Refresh
          </button>
        </div>
      </div>
      {loading && <p role="status">Loading readership…</p>}
      {error && <p role="alert">{error}</p>}
      <ReadingQuality days={days} refresh={refresh} />
      {report && (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              ["Article views", report.views],
              ["Reader sessions", report.sessions],
              ["Engaged reads (30 seconds)", report.engaged],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-border bg-card p-5">
                <p className="text-sm text-muted-foreground">{label}</p>
                <p className="mt-2 text-3xl font-semibold">{Number(value).toLocaleString()}</p>
              </div>
            ))}
          </div>
          {!report.views && (
            <p className="rounded-xl border border-border p-5">
              No recorded reads in this period yet. Data starts when tracking is deployed and
              visitors open articles.
            </p>
          )}
          <div className="grid gap-5 md:grid-cols-2">
            {(
              [
                ["Topic interests", report.topics],
                ["Intended audiences", report.audiences],
                ["Referral sources", report.sources],
                ["Devices", report.devices],
              ] as [string, Breakdown[]][]
            ).map(([title, rows]) => (
              <section key={title} className="rounded-xl border border-border bg-card p-5">
                <h3 className="font-semibold">{title}</h3>
                {rows.length ? (
                  <ul className="mt-3 space-y-3">
                    {rows.map((row) => (
                      <li key={row.tag ?? row.label} className="flex justify-between gap-3 text-sm">
                        <span>{row.tag ?? row.label}</span>
                        <span>{row.views.toLocaleString()} views</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 text-sm text-muted-foreground">No data yet.</p>
                )}
              </section>
            ))}
          </div>
          <section className="overflow-x-auto rounded-xl border border-border bg-card p-5">
            <h3 className="font-semibold">Most-read articles</h3>
            <table className="mt-4 w-full text-left text-sm">
              <thead>
                <tr>
                  <th className="pb-3">Article</th>
                  <th>Views</th>
                  <th>Engaged</th>
                </tr>
              </thead>
              <tbody>
                {report.posts.map((post) => (
                  <tr key={post.slug} className="border-t border-border">
                    <td className="py-3 pr-4">
                      <Link className="text-primary" to="/blog/$slug" params={{ slug: post.slug }}>
                        {post.title}
                      </Link>
                    </td>
                    <td>{post.views}</td>
                    <td>{post.engaged}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
          <details className="rounded-xl border border-border bg-card p-5">
            <summary className="cursor-pointer font-semibold">Daily readership (UTC)</summary>
            <table className="mt-4 w-full text-left text-sm">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Views</th>
                  <th>Sessions</th>
                </tr>
              </thead>
              <tbody>
                {report.daily.map((day) => (
                  <tr key={day.day}>
                    <td className="py-2">{day.day}</td>
                    <td>{day.views}</td>
                    <td>{day.sessions}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </>
      )}
      <p className="text-xs leading-relaxed text-muted-foreground">
        A view is one article per browser session per UTC day. Sessions are approximate, not unique
        people. Engaged reads have at least 30 seconds with the tab visible. Audience interests
        reflect the tags on articles read, not verified occupations or demographics. Multi-tag
        articles count in each tag. Signed-in browsing and browsers requesting privacy are excluded.
        Referral sources are broad groups; direct includes unknown sources. Session records older
        than 90 days are cleared on the next recorded read or analytics refresh; anonymous article
        totals remain. Counts can include automated or manipulated traffic and are not Google Search
        impressions.
      </p>
    </section>
  );
}
