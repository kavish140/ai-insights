import { useEffect, useState } from "react";
import { Star } from "lucide-react";
import { setFeaturedArticle, type Article } from "@/lib/admin";
import {
  currentHomepagePick,
  featureSelectionMatches,
  homepageCandidates,
} from "@/lib/featured-post";

export function FeaturedPostPicker({
  articles,
  busy,
  run,
  collapsible = false,
}: {
  collapsible?: boolean;
  articles: Article[];
  busy: boolean;
  run: (action: () => Promise<void>, success: string) => Promise<void>;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const live = homepageCandidates(articles, today);
  const current = currentHomepagePick(articles, today);
  const currentId = live.find((article) => article.featured)?.id ?? "";
  const [selected, setSelected] = useState(currentId);
  useEffect(() => setSelected(currentId), [currentId]);
  const unchanged = featureSelectionMatches(articles, selected);
  const picker = (
    <section
      className="admin-featured-picker rounded-2xl border border-border bg-card p-5 sm:p-6"
      aria-labelledby="homepage-feature-title"
    >
      <div className="admin-featured-copy">
        <div className="flex items-center gap-2">
          <Star size={19} className="text-primary" />
          <h2 id="homepage-feature-title" className="text-lg font-semibold">
            Homepage featured post
          </h2>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Choose the article that appears at the top of the homepage. Your choice automatically
          replaces the previous featured article.
        </p>
        <div className="admin-featured-current">
          <span className="admin-featured-image">
            {current?.cover_image_url ? (
              <img src={current.cover_image_url} alt="" loading="lazy" />
            ) : (
              <Star size={18} />
            )}
          </span>
          <div>
            <small>Currently at the top</small>
            <strong>{current?.title ?? "No published articles yet"}</strong>
            {!currentId && current && (
              <span className="text-xs text-muted-foreground">Selected automatically</span>
            )}
          </div>
        </div>
      </div>
      <div className="admin-featured-controls">
        <form
          className="mt-4 flex flex-wrap items-end gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (busy || unchanged) return;
            void run(
              () => setFeaturedArticle(selected || null),
              selected
                ? "Homepage featured post updated. The previous featured post was cleared automatically."
                : "Homepage now shows the newest published article automatically.",
            );
          }}
        >
          <label className="min-w-0 flex-1 basis-72 text-sm font-medium">
            Featured article
            <select
              value={selected}
              disabled={busy}
              onChange={(event) => setSelected(event.target.value)}
              className="mt-2 w-full rounded-lg border border-input bg-surface px-3 py-2.5 text-sm"
            >
              <option value="">Automatic — newest published article</option>
              {live.map((article) => (
                <option key={article.id} value={article.id}>
                  {article.title}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            disabled={busy || unchanged}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-gradient px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            <Star size={15} />
            {busy ? "Saving…" : "Set featured post"}
          </button>
        </form>
        <p className="mt-3 text-xs text-muted-foreground">
          Only published articles that are already live can be selected. Choose Automatic to follow
          the newest article.
        </p>
      </div>
    </section>
  );
  return collapsible ? (
    <details className="admin-featured-disclosure">
      <summary>
        <span>
          <Star size={16} /> Homepage featured post
        </span>
        <span>Manage pick</span>
      </summary>
      {picker}
    </details>
  ) : (
    picker
  );
}
