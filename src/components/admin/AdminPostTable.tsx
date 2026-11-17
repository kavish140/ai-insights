import {
  FileText,
  Star,
  Pencil,
  MoreHorizontal,
  Eye,
  Copy,
  Archive,
  Send,
  ExternalLink,
  Trash2,
  SearchX,
} from "lucide-react";
import { type Article, changeArticle, duplicateArticle } from "@/lib/admin";
import { currentHomepagePick } from "@/lib/featured-post";
import { formatDate } from "@/lib/posts";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "../ui/dropdown-menu";
const button =
  "admin-button inline-flex items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50";
export function AdminPostTable({
  posts,
  articles,
  busy,
  edit,
  review,
  run,
  onClearFilters,
}: {
  posts: Article[];
  articles: Article[];
  busy: boolean;
  edit: (article: Article) => void;
  review: (article: Article) => void;
  run: (action: () => Promise<void>, success: string) => Promise<void>;
  onClearFilters?: (() => void) | undefined;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const homepage = currentHomepagePick(articles, today);
  return (
    <div className="admin-posts-table-wrap">
      <table className="admin-posts-table">
        <caption className="sr-only">Articles and publishing actions</caption>
        <thead>
          <tr>
            {["Article", "Category", "Publish date", "Status", "Actions"].map((label) => (
              <th key={label}>{label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {posts.map((article) => {
            const scheduled = article.status === "published" && article.date > today;
            const state = scheduled ? "scheduled" : article.status;
            return (
              <tr key={article.id}>
                <td className="admin-post-title-cell">
                  <div className="admin-post-identity">
                    <span className="admin-post-thumbnail">
                      {article.cover_image_url ? (
                        <img src={article.cover_image_url} alt="" loading="lazy" />
                      ) : (
                        <FileText size={19} />
                      )}
                    </span>
                    <div>
                      <button
                        disabled={busy}
                        className="admin-post-title"
                        onClick={() => edit(article)}
                      >
                        {article.title}
                      </button>
                      <p className="admin-post-meta">
                        {article.author}
                        <span> · /blog/{article.slug}</span>
                      </p>
                      {homepage?.id === article.id && (
                        <span className="admin-feature-badge">
                          <Star size={10} /> Homepage pick
                        </span>
                      )}
                    </div>
                  </div>
                </td>
                <td data-label="Category">
                  <span className="admin-category-label">{article.category}</span>
                </td>
                <td data-label="Publish date" className="admin-post-date">
                  {formatDate(article.date)}
                </td>
                <td data-label="Status">
                  <span className="admin-status" data-status={state}>
                    <i />
                    {state === "published"
                      ? "Published"
                      : state === "scheduled"
                        ? "Scheduled"
                        : "Draft"}
                  </span>
                </td>
                <td className="admin-post-actions">
                  <div className="flex items-center gap-2">
                    <button
                      disabled={busy}
                      className="admin-edit-button"
                      onClick={() => edit(article)}
                      aria-label={`Edit ${article.title}`}
                    >
                      <Pencil size={13} />
                      <span>Edit</span>
                    </button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          disabled={busy}
                          className="admin-icon-button"
                          aria-label={`More actions for ${article.title}`}
                        >
                          <MoreHorizontal size={17} />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="admin-action-menu">
                        <DropdownMenuItem disabled={busy} onSelect={() => review(article)}>
                          <Eye size={15} /> Preview & history
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          disabled={busy}
                          onSelect={() =>
                            void run(async () => {
                              const copy = await duplicateArticle(article);
                              edit(copy);
                            }, "Article duplicated as a draft.")
                          }
                        >
                          <Copy size={15} /> Duplicate as draft
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          disabled={busy}
                          onSelect={() => {
                            const next = article.status === "published" ? "draft" : "published";
                            void run(
                              () => changeArticle(article, next),
                              next === "published" ? "Article published." : "Article unpublished.",
                            );
                          }}
                        >
                          {article.status === "published" ? (
                            <Archive size={15} />
                          ) : (
                            <Send size={15} />
                          )}{" "}
                          {article.status === "published"
                            ? "Unpublish"
                            : article.date > today
                              ? "Schedule"
                              : "Publish"}
                        </DropdownMenuItem>
                        {article.status === "published" && !scheduled && (
                          <DropdownMenuItem asChild>
                            <a href={`/blog/${article.slug}`} target="_blank" rel="noreferrer">
                              <ExternalLink size={15} /> View live article
                            </a>
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          disabled={busy}
                          className="text-destructive focus:text-destructive"
                          onSelect={() => {
                            if (
                              window.confirm(
                                `Permanently delete “${article.title}”? This cannot be undone.`,
                              )
                            )
                              void run(() => changeArticle(article, "delete"), "Article deleted.");
                          }}
                        >
                          <Trash2 size={15} /> Delete article
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {!posts.length && (
        <div className="admin-empty">
          <SearchX size={27} />
          <h3>No articles in this view</h3>
          <p>Try another search or adjust your filters.</p>
          {onClearFilters && (
            <button className={button} onClick={onClearFilters}>
              Clear filters
            </button>
          )}
        </div>
      )}
    </div>
  );
}
