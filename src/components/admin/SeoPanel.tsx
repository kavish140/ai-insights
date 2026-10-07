import { useMemo, useState } from "react";
import { adminToken, messageFor, type Article } from "@/lib/admin";
import { probeSeo } from "@/lib/admin-operations";
import { seoIssues } from "@/lib/seo-health";
import { SITE } from "@/lib/posts";
const button = "rounded-lg border border-border px-3 py-2 text-sm disabled:opacity-50";
export function SeoPanel({
  articles,
  edit,
}: {
  articles: Article[];
  edit: (article: Article) => void;
}) {
  const [onlyIssues, setOnlyIssues] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const reports = useMemo(
    () =>
      articles.map((article) => {
        const doc = new DOMParser().parseFromString(article.body, "text/html");
        return {
          article,
          issues: seoIssues(article, articles, {
            images: [...doc.querySelectorAll("img")].map((image) => ({
              alt: image.alt,
              src: image.src,
            })),
            links: [...doc.querySelectorAll("a[href]")].map(
              (link) => link.getAttribute("href") ?? "",
            ),
          }),
        };
      }),
    [articles],
  );
  async function inspect(slug?: string) {
    setBusy(true);
    setMessage("");
    try {
      const result = await probeSeo({
        data: { token: await adminToken(), ...(slug ? { slug } : {}) },
      });
      setMessage(
        slug
          ? `Live page: HTTP ${result.status}. Canonical ${result.canonical === `${SITE.url}/blog/${slug}` ? "matches" : "missing or mismatched"}. BlogPosting structured data ${result.structuredData ? "present" : "missing or invalid"}.`
          : `Live sitemap: HTTP ${result.status}. ${result.sitemap ? "Valid urlset found." : "Sitemap missing or invalid."}`,
      );
    } catch (error) {
      setMessage(messageFor(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="space-y-5 rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-wrap justify-between gap-3">
        <h2 className="text-xl font-semibold">SEO health</h2>
        <button disabled={busy} className={button} onClick={() => void inspect()}>
          Check live sitemap
        </button>
      </div>
      <p className="text-sm text-muted-foreground">
        {reports.filter((report) => report.issues.length).length} of {articles.length} articles have
        checks to review. Title length is advisory. Canonical and structured data checks inspect the
        deployed site.
      </p>
      {message && (
        <p role="status" className="rounded-lg bg-secondary p-3 text-sm">
          {message}
        </p>
      )}
      <label className="flex gap-2 text-sm">
        <input
          type="checkbox"
          checked={onlyIssues}
          onChange={(event) => setOnlyIssues(event.target.checked)}
        />
        Show only articles with issues
      </label>
      <ul className="divide-y divide-border">
        {reports
          .filter((report) => !onlyIssues || report.issues.length)
          .map(({ article, issues }) => (
            <li key={article.id} className="space-y-3 py-5">
              <div className="flex flex-wrap justify-between gap-3">
                <div>
                  <h3 className="font-semibold">{article.title}</h3>
                  <p className="text-xs text-muted-foreground">
                    /{article.slug} · {article.status}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button className={button} onClick={() => edit(article)}>
                    Correct article
                  </button>
                  {article.status === "published" &&
                    article.date <= new Date().toISOString().slice(0, 10) && (
                      <button
                        disabled={busy}
                        className={button}
                        onClick={() => void inspect(article.slug)}
                      >
                        Check live SEO
                      </button>
                    )}
                </div>
              </div>
              {issues.length ? (
                <ul className="space-y-1 text-sm text-muted-foreground">
                  {issues.map((issue) => (
                    <li key={issue}>• {issue}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-primary">Local checks passed.</p>
              )}
            </li>
          ))}
      </ul>
      {!reports.some((report) => !onlyIssues || report.issues.length) && (
        <p className="py-5 text-sm text-muted-foreground">No articles match this filter.</p>
      )}
    </section>
  );
}
