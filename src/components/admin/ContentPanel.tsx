import { useEffect, useState } from "react";
import { adminToken, messageFor, type Article } from "@/lib/admin";
import { browserClient } from "@/lib/supabase-client";
import { contentFindings, sourceHosts, type ContentScan } from "@/lib/content-health";
import { scanContent } from "@/lib/admin-operations";

const panel = "rounded-2xl border border-border bg-card p-5";
const button = "rounded-lg border border-border px-3 py-2 text-sm disabled:opacity-50";
export function ContentPanel({
  articles,
  topics,
  edit,
}: {
  articles: Article[];
  topics: string[];
  edit: (article: Article) => void;
}) {
  const [days, setDays] = useState(180);
  const [selected, setSelected] = useState<string[]>([]);
  const [history, setHistory] = useState<{ id: string; result: ContentScan }[]>([]);
  const [busy, setBusy] = useState(false);
  const [historyAvailable, setHistoryAvailable] = useState(false);
  const [message, setMessage] = useState("");
  const findings = contentFindings(articles, days);
  async function load() {
    const { data, error } = await (
      await browserClient()
    )
      .from("admin_checks")
      .select("id,result")
      .eq("kind", "content")
      .order("created_at", { ascending: false })
      .limit(10);
    if (error) throw error;
    setHistory(data as { id: string; result: ContentScan }[]);
    setHistoryAvailable(true);
  }
  useEffect(() => {
    void load().catch((error) => setMessage(messageFor(error)));
  }, []);
  async function scan() {
    setBusy(true);
    setMessage("");
    try {
      await scanContent({ data: { token: await adminToken(), postIds: selected } });
      await load();
      setMessage("Link and image scan saved.");
    } catch (error) {
      setMessage(messageFor(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-5">
      <section className={panel}>
        <h2 className="text-xl font-semibold">Content health & opportunities</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Find refresh candidates and possible topic overlap. Topic similarity is a review hint.
          Select up to five articles to check links and images on the live site.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <label className="text-sm">
            Refresh after{" "}
            <select
              className={`${button} ml-2 bg-surface`}
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
            >
              {[90, 180, 365].map((value) => (
                <option key={value} value={value}>
                  {value} days
                </option>
              ))}
            </select>
          </label>
          <button
            disabled={busy || !selected.length}
            className={button}
            onClick={() => void scan()}
          >
            {busy ? "Scanning…" : `Scan ${selected.length} selected articles`}
          </button>
        </div>
        <details className="mt-3 text-xs text-muted-foreground">
          <summary>How link checks work</summary>
          <p className="mt-2">
            Up to 40 distinct URLs per batch. HTTPS requests check the site, its image bucket, and
            these source hosts: {sourceHosts.join(", ")}. Other hosts and redirects are marked for
            manual review. Timeouts and blocked requests do not prove a link is broken. Scans run
            when requested.
          </p>
        </details>
        {message && (
          <p role="status" className="mt-3 text-sm">
            {message}
          </p>
        )}
      </section>
      <section className={panel}>
        <h3 className="font-semibold">Category coverage</h3>
        <div className="mt-3 flex flex-wrap gap-3">
          {topics.map((topic) => {
            const count = articles.filter(
              (article) =>
                article.category === topic &&
                article.status === "published" &&
                article.date <= new Date().toISOString().slice(0, 10),
            ).length;
            return (
              <span key={topic} className="rounded-lg bg-secondary px-3 py-2 text-sm">
                {topic}: {count} live {count < 3 ? "· Consider more coverage" : ""}
              </span>
            );
          })}
        </div>
      </section>
      <section className={panel}>
        <h3 className="mb-3 font-semibold">Article review queue</h3>
        <div className="space-y-3">
          {findings.map((finding) => (
            <div
              key={finding.postId}
              className="flex items-start gap-3 border-t border-border pt-3"
            >
              <input
                type="checkbox"
                aria-label={`Scan ${finding.title}`}
                checked={selected.includes(finding.postId)}
                disabled={busy || (!selected.includes(finding.postId) && selected.length >= 5)}
                onChange={(e) =>
                  setSelected(
                    e.target.checked
                      ? [...selected, finding.postId]
                      : selected.filter((id) => id !== finding.postId),
                  )
                }
              />
              <div className="flex-1">
                <button
                  className="text-left font-medium text-primary"
                  onClick={() => edit(articles.find((article) => article.id === finding.postId)!)}
                >
                  {finding.title}
                </button>
                <p className="mt-1 text-xs text-muted-foreground">
                  {finding.issues.join(" · ") || "No local health issues detected"}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>
      <section className={panel}>
        <h3 className="font-semibold">Saved scans</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Latest ten requested scans. Results describe the time of the scan.
        </p>
        <button
          disabled={busy}
          className={`${button} mt-3`}
          onClick={() => {
            setBusy(true);
            void load()
              .then(() => setMessage(""))
              .catch((error) => setMessage(messageFor(error)))
              .finally(() => setBusy(false));
          }}
        >
          Reload saved scans
        </button>
        {!history.length && historyAvailable && <p className="mt-3 text-sm">No saved scans yet.</p>}
        {history.map((scan) => (
          <details key={scan.id} className="mt-4 border-t border-border pt-3">
            <summary className="text-sm">
              {new Date(scan.result.checkedAt).toLocaleString()} · {scan.result.articles.length}{" "}
              articles
            </summary>
            {scan.result.articles.map((article) => (
              <div key={article.postId} className="mt-3">
                <h4 className="text-sm font-medium">{article.title}</h4>
                {article.truncated && (
                  <p className="text-xs">Some links were skipped at the batch limit.</p>
                )}
                {!article.links.length && (
                  <p className="text-xs text-muted-foreground">
                    No checkable links or images found.
                  </p>
                )}
                {article.links.map((link) => (
                  <p key={link.url} className="mt-2 break-all text-xs">
                    <strong>
                      {link.outcome.toUpperCase()}
                      {link.status ? ` (${link.status})` : ""}
                    </strong>{" "}
                    · {link.url}
                    <br />
                    {link.detail}
                  </p>
                ))}
              </div>
            ))}
          </details>
        ))}
      </section>
    </div>
  );
}
