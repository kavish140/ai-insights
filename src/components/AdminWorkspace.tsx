import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "@tanstack/react-router";
import {
  LayoutDashboard,
  FileText,
  Tags,
  Images,
  Settings2,
  ExternalLink,
  RefreshCw,
  Activity,
  SearchCheck,
} from "lucide-react";
import { browserClient } from "@/lib/supabase-client";
import {
  allRows,
  changeArticle,
  defaultSettings,
  emptyArticle,
  messageFor,
  saveArticle,
  uploadImage,
  usedBy,
  type Article,
  type Media,
  type Settings,
  duplicateArticle,
} from "@/lib/admin";
import { formatDate } from "@/lib/posts";
import { ActivityPanel } from "./admin/ActivityPanel";
import { ArticleReview } from "./admin/ArticleReview";
import { SeoPanel } from "./admin/SeoPanel";
import { MediaTools } from "./admin/MediaTools";
import { DashboardInsights } from "./admin/DashboardInsights";
import type { Operation, PublishingActivity } from "@/lib/admin-operations";

const input = "mt-2 w-full rounded-lg border border-input bg-surface px-3 py-2.5 text-sm";
const button =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50";
const primary = `${button} border-transparent bg-brand-gradient text-primary-foreground`;
const panel = "rounded-2xl border border-border bg-card p-5 sm:p-6";
const tabs = [
  { name: "Overview", icon: LayoutDashboard },
  { name: "Posts", icon: FileText },
  { name: "MCP Activity", icon: Activity },
  { name: "SEO", icon: SearchCheck },
  { name: "Categories", icon: Tags },
  { name: "Media", icon: Images },
  { name: "Settings", icon: Settings2 },
] as const;
type Tab = (typeof tabs)[number]["name"] | "Editor";
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block text-sm font-medium">
      {label}
      {children}
    </label>
  );
}

export function AdminWorkspace({ signOut }: { signOut: () => Promise<void> }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("Overview");
  const [articles, setArticles] = useState<Article[]>([]);
  const [topics, setTopics] = useState<string[]>([]);
  const [media, setMedia] = useState<Media[]>([]);
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [draft, setDraft] = useState<Article>(emptyArticle);
  const [original, setOriginal] = useState<Article>(emptyArticle);
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [category, setCategory] = useState("all");
  const [sort, setSort] = useState("newest");
  const [page, setPage] = useState(1);
  const [newCategory, setNewCategory] = useState("");
  const [rename, setRename] = useState<{ old: string; name: string } | null>(null);
  const [mediaSearch, setMediaSearch] = useState("");
  const [unusedOnly, setUnusedOnly] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploadKey, setUploadKey] = useState(0);
  const [imageDetails, setImageDetails] = useState({
    alt: "",
    source_url: "",
    credit: "",
    license_note: "",
  });
  const [editingMedia, setEditingMedia] = useState<Media | null>(null);
  const [review, setReview] = useState<Article | null>(null);
  const [operations, setOperations] = useState<Operation[]>([]);
  const [activity, setActivity] = useState<PublishingActivity[]>([]);
  const [operationsError, setOperationsError] = useState("");
  const dirty = JSON.stringify(draft) !== JSON.stringify(original);
  const today = new Date().toISOString().slice(0, 10);

  async function refresh() {
    const client = await browserClient();
    const { data: access, error: accessError } = await client.rpc("admin_access");
    if (accessError) throw accessError;
    if (!access)
      throw new Error(
        "This account does not have admin access. Use your designated editor account.",
      );
    const [posts, categories, images, configuration] = await Promise.all([
      allRows<Article>("posts", "id"),
      allRows<{ name: string }>("categories", "name"),
      allRows<Media>("blog_images", "path"),
      client.from("site_settings").select("name,tagline,description,default_author").single(),
    ]);
    if (configuration.error) throw configuration.error;
    setArticles(
      posts.sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title)),
    );
    setTopics(categories.map((item) => item.name));
    setMedia(images.sort((a, b) => b.created_at.localeCompare(a.created_at)));
    setSettings(configuration.data);
    setAuthorized(true);
    const audit = await allRows<PublishingActivity>("post_activity", "id");
    setActivity(audit.sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id - a.id));
    try {
      const calls = await allRows<Operation>("mcp_operations", "id");
      setOperations(calls.sort((a, b) => b.created_at.localeCompare(a.created_at)));
      setOperationsError("");
    } catch {
      setOperationsError(
        "Operation tracking is not available. Apply the Good admin migration and deploy the updated MCP function.",
      );
    }
  }
  useEffect(() => {
    void refresh()
      .catch((error) => setMessage(messageFor(error)))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    if (!dirty || tab !== "Editor") return;
    const prevent = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", prevent);
    return () => window.removeEventListener("beforeunload", prevent);
  }, [dirty, tab]);

  async function run(action: () => Promise<void>, success: string) {
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      await action();
      await refresh();
      await router.invalidate();
      setMessage(success);
    } catch (error) {
      setMessage(messageFor(error));
    } finally {
      setBusy(false);
    }
  }
  function navigate(next: Tab) {
    if (tab === "Editor" && dirty && !window.confirm("Discard unsaved article corrections?"))
      return;
    setTab(next);
    setMessage("");
  }
  function edit(article: Article) {
    if (tab === "Editor" && dirty && !window.confirm("Discard unsaved article corrections?"))
      return;
    setDraft({ ...article });
    setOriginal({ ...article });
    setTab("Editor");
    setMessage("");
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    if (draft.cover_image_url && !draft.cover_image_alt.trim()) {
      setMessage("Add alt text for the featured image.");
      return;
    }
    await run(async () => {
      const saved = await saveArticle(draft);
      setDraft(saved);
      setOriginal(saved);
    }, "Article saved.");
  }
  const filtered = articles
    .filter(
      (article) =>
        (status === "all" ||
          (status === "scheduled"
            ? article.status === "published" && article.date > today
            : status === "published"
              ? article.status === "published" && article.date <= today
              : article.status === status)) &&
        (category === "all" || article.category === category) &&
        `${article.title} ${article.slug} ${article.author}`
          .toLowerCase()
          .includes(search.toLowerCase()),
    )
    .sort((a, b) =>
      sort === "title"
        ? a.title.localeCompare(b.title)
        : sort === "oldest"
          ? a.date.localeCompare(b.date)
          : b.date.localeCompare(a.date),
    );
  const totalPages = Math.max(1, Math.ceil(filtered.length / 20));
  const currentPage = Math.min(page, totalPages);
  const visible = filtered.slice((currentPage - 1) * 20, currentPage * 20);

  function postTable(posts: Article[]) {
    return (
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-border text-xs uppercase text-muted-foreground">
            <tr>
              {["Article", "Category", "Publish date", "Status", "Actions"].map((label) => (
                <th key={label} className="px-3 py-3">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {posts.map((article) => (
              <tr key={article.id} className="border-b border-border/60">
                <td className="max-w-[300px] px-3 py-4">
                  <button
                    disabled={busy}
                    className="text-left font-medium hover:text-primary"
                    onClick={() => edit(article)}
                  >
                    {article.title}
                  </button>
                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    /blog/{article.slug}
                  </p>
                </td>
                <td className="px-3 py-4">{article.category}</td>
                <td className="whitespace-nowrap px-3 py-4">{formatDate(article.date)}</td>
                <td className="px-3 py-4">
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs ${article.status === "published" ? "bg-primary/10 text-primary" : "bg-secondary text-muted-foreground"}`}
                  >
                    {article.status === "published" &&
                    article.date > new Date().toISOString().slice(0, 10)
                      ? "Scheduled"
                      : article.status}
                  </span>
                </td>
                <td className="px-3 py-4">
                  <div className="flex flex-wrap gap-2">
                    <button disabled={busy} className={button} onClick={() => edit(article)}>
                      Edit
                    </button>
                    <button disabled={busy} className={button} onClick={() => setReview(article)}>
                      Preview / history
                    </button>
                    <button
                      disabled={busy}
                      className={button}
                      onClick={() =>
                        void run(async () => {
                          const copy = await duplicateArticle(article);
                          edit(copy);
                        }, "Article duplicated as a draft.")
                      }
                    >
                      Duplicate
                    </button>
                    <button
                      disabled={busy}
                      className={button}
                      onClick={() => {
                        const next = article.status === "published" ? "draft" : "published";
                        void run(
                          () => changeArticle(article, next),
                          next === "published" ? "Article published." : "Article unpublished.",
                        );
                      }}
                    >
                      {article.status === "published"
                        ? "Unpublish"
                        : article.date > new Date().toISOString().slice(0, 10)
                          ? "Schedule"
                          : "Publish"}
                    </button>
                    {article.status === "published" &&
                      article.date <= new Date().toISOString().slice(0, 10) && (
                        <a
                          className={button}
                          href={`/blog/${article.slug}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          View live <ExternalLink size={13} />
                        </a>
                      )}
                    <button
                      disabled={busy}
                      className={`${button} text-destructive`}
                      onClick={() => {
                        if (
                          window.confirm(
                            `Permanently delete “${article.title}”? This cannot be undone.`,
                          )
                        )
                          void run(() => changeArticle(article, "delete"), "Article deleted.");
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!posts.length && (
          <p className="py-10 text-center text-sm text-muted-foreground">No articles found.</p>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">
            AI Insights / Admin
          </p>
          <h1 className="mt-2 text-3xl font-bold">Publishing control</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            ChatGPT and MCP publish. Manage and correct the results here.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            className={button}
            disabled={busy || loading}
            onClick={() => void run(async () => {}, "Up to date.")}
          >
            <RefreshCw size={15} />
            Refresh
          </button>
          <button
            className={button}
            disabled={busy}
            onClick={() => {
              if (
                tab === "Editor" &&
                dirty &&
                !window.confirm("Discard unsaved article corrections and sign out?")
              )
                return;
              void signOut().catch((error) => setMessage(messageFor(error)));
            }}
          >
            Sign out
          </button>
        </div>
      </header>
      {message && (
        <p role="status" className="mt-5 rounded-lg border border-border bg-secondary p-4 text-sm">
          {message}
        </p>
      )}
      {loading ? (
        <p className="py-16">Loading admin…</p>
      ) : !authorized ? (
        <p className="py-16 text-muted-foreground">
          Admin data is unavailable. Check your account access and refresh.
        </p>
      ) : (
        <>
          <nav aria-label="Admin sections" className="my-8 flex flex-wrap gap-2">
            {tabs.map(({ name, icon: Icon }) => (
              <button
                key={name}
                disabled={busy}
                aria-current={tab === name ? "page" : undefined}
                onClick={() => navigate(name)}
                className={`${button} ${tab === name ? "bg-primary text-primary-foreground hover:bg-primary" : "bg-card text-muted-foreground"}`}
              >
                <Icon size={16} />
                {name}
              </button>
            ))}
          </nav>
          <fieldset disabled={busy} className="min-w-0">
            {tab === "Overview" && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                  {[
                    ["Total posts", articles.length],
                    [
                      "Published",
                      articles.filter(
                        (article) => article.status === "published" && article.date <= today,
                      ).length,
                    ],
                    ["Drafts", articles.filter((article) => article.status === "draft").length],
                    ["Categories", topics.length],
                  ].map(([label, count]) => (
                    <div key={label} className={panel}>
                      <p className="text-sm text-muted-foreground">{label}</p>
                      <p className="mt-3 text-3xl font-semibold">{count}</p>
                    </div>
                  ))}
                </div>
                <section className={panel}>
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-lg font-semibold">Latest posts</h2>
                    <button className={button} onClick={() => navigate("Posts")}>
                      All posts
                    </button>
                  </div>
                  {postTable(articles.slice(0, 5))}
                </section>
                {operationsError && (
                  <p
                    role="status"
                    className="rounded-lg border border-border bg-secondary p-4 text-sm"
                  >
                    {operationsError}
                  </p>
                )}
                <DashboardInsights
                  articles={articles}
                  operations={operations}
                  activity={activity}
                  edit={edit}
                  trackingAvailable={!operationsError}
                />
                <div className={panel}>
                  <h2 className="font-semibold">Your publishing workflow</h2>
                  <p className="mt-3 text-sm text-muted-foreground">
                    You → ChatGPT → AI Insights MCP → Published article
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Use the editor when an article needs an emergency correction.
                  </p>
                </div>
              </div>
            )}
            {tab === "MCP Activity" && (
              <ActivityPanel
                operations={operations}
                activity={activity}
                articles={articles}
                error={operationsError}
                refresh={refresh}
                edit={edit}
              />
            )}
            {tab === "SEO" && <SeoPanel articles={articles} edit={edit} />}
            {tab === "Posts" && (
              <section className={panel}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-xl font-semibold">
                    Posts <span className="text-sm text-muted-foreground">({filtered.length})</span>
                  </h2>
                  <button
                    className={button}
                    onClick={() => edit(emptyArticle(settings.default_author, topics[0]))}
                  >
                    New emergency draft
                  </button>
                </div>
                <div className="my-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <Field label="Search">
                    <input
                      type="search"
                      className={input}
                      placeholder="Title, slug or author"
                      value={search}
                      onChange={(event) => {
                        setSearch(event.target.value);
                        setPage(1);
                      }}
                    />
                  </Field>
                  <Field label="Status">
                    <select
                      className={input}
                      value={status}
                      onChange={(event) => {
                        setStatus(event.target.value);
                        setPage(1);
                      }}
                    >
                      <option value="all">All statuses</option>
                      <option value="published">Published</option>
                      <option value="draft">Drafts</option>
                      <option value="scheduled">Scheduled</option>
                    </select>
                  </Field>
                  <Field label="Category">
                    <select
                      className={input}
                      value={category}
                      onChange={(event) => {
                        setCategory(event.target.value);
                        setPage(1);
                      }}
                    >
                      <option value="all">All categories</option>
                      {topics.map((topic) => (
                        <option key={topic}>{topic}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Sort">
                    <select
                      className={input}
                      value={sort}
                      onChange={(event) => setSort(event.target.value)}
                    >
                      <option value="newest">Newest first</option>
                      <option value="oldest">Oldest first</option>
                      <option value="title">Title A–Z</option>
                    </select>
                  </Field>
                </div>
                <p className="text-xs text-muted-foreground">
                  A published article with a future date is scheduled and becomes public on that
                  date (UTC).
                </p>
                {postTable(visible)}
                <div className="mt-5 flex items-center justify-between text-sm">
                  <span>
                    Page {currentPage} of {totalPages}
                  </span>
                  <div className="flex gap-2">
                    <button
                      className={button}
                      disabled={busy || currentPage === 1}
                      onClick={() => setPage(currentPage - 1)}
                    >
                      Previous
                    </button>
                    <button
                      className={button}
                      disabled={busy || currentPage === totalPages}
                      onClick={() => setPage(currentPage + 1)}
                    >
                      Next
                    </button>
                  </div>
                </div>
              </section>
            )}
            {tab === "Editor" && (
              <form onSubmit={save} className={`${panel} space-y-5`}>
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-semibold">
                      {draft.id ? "Correct article" : "Emergency draft"}
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Changes to published articles take effect when saved.
                    </p>
                  </div>
                  <button type="button" className={button} onClick={() => navigate("Posts")}>
                    Back to posts
                  </button>
                </div>
                <div className="grid gap-5 md:grid-cols-2">
                  <Field label="Title">
                    <input
                      className={input}
                      required
                      maxLength={200}
                      value={draft.title}
                      onChange={(event) => setDraft({ ...draft, title: event.target.value })}
                    />
                  </Field>
                  <Field label="Web address (slug)">
                    <input
                      className={input}
                      required
                      maxLength={200}
                      pattern="[a-z0-9]+(-[a-z0-9]+)*"
                      value={draft.slug}
                      onChange={(event) => setDraft({ ...draft, slug: event.target.value })}
                    />
                    <span className="mt-1 block text-xs text-muted-foreground">
                      Lowercase words separated by hyphens. Changing this breaks the old link.
                    </span>
                  </Field>
                  <Field label="Category">
                    <select
                      className={input}
                      value={draft.category}
                      required
                      onChange={(event) => setDraft({ ...draft, category: event.target.value })}
                    >
                      {topics.map((topic) => (
                        <option key={topic}>{topic}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Author">
                    <input
                      className={input}
                      required
                      maxLength={200}
                      value={draft.author}
                      onChange={(event) => setDraft({ ...draft, author: event.target.value })}
                    />
                  </Field>
                  <Field label="Publish date">
                    <input
                      className={input}
                      type="date"
                      required
                      value={draft.date}
                      onChange={(event) => setDraft({ ...draft, date: event.target.value })}
                    />
                  </Field>
                  <Field label="Status">
                    <select
                      className={input}
                      value={draft.status}
                      onChange={(event) =>
                        setDraft({ ...draft, status: event.target.value as Article["status"] })
                      }
                    >
                      <option value="draft">Draft</option>
                      <option value="published">Published</option>
                    </select>
                  </Field>
                </div>
                <Field label="Search summary">
                  <textarea
                    className={input}
                    required
                    maxLength={160}
                    rows={3}
                    value={draft.description}
                    onChange={(event) => setDraft({ ...draft, description: event.target.value })}
                  />
                </Field>
                <div className="grid gap-5 md:grid-cols-2">
                  <Field label="Featured image">
                    <select
                      className={input}
                      value={draft.cover_image_url}
                      onChange={(event) =>
                        setDraft({
                          ...draft,
                          cover_image_url: event.target.value,
                          cover_image_alt:
                            media.find((image) => image.url === event.target.value)?.alt ?? "",
                        })
                      }
                    >
                      <option value="">No featured image</option>
                      {draft.cover_image_url &&
                        !media.some((image) => image.url === draft.cover_image_url) && (
                          <option value={draft.cover_image_url}>Current image</option>
                        )}
                      {media.map((image) => (
                        <option key={image.path} value={image.url}>
                          {image.alt}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Featured image alt text">
                    <input
                      className={input}
                      maxLength={300}
                      required={!!draft.cover_image_url}
                      value={draft.cover_image_alt}
                      onChange={(event) =>
                        setDraft({ ...draft, cover_image_alt: event.target.value })
                      }
                    />
                  </Field>
                </div>
                {draft.cover_image_url && (
                  <img
                    className="max-h-48 rounded-lg object-contain"
                    src={draft.cover_image_url}
                    alt={draft.cover_image_alt}
                  />
                )}
                <Field label="Article HTML">
                  <textarea
                    className={`${input} font-mono`}
                    required
                    maxLength={200000}
                    rows={18}
                    value={draft.body}
                    onChange={(event) => setDraft({ ...draft, body: event.target.value })}
                  />
                  <span className="mt-1 block text-xs text-muted-foreground">
                    Paragraphs, headings, lists and links. Unsafe HTML is removed on public pages.
                  </span>
                </Field>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={draft.featured}
                    onChange={(event) => setDraft({ ...draft, featured: event.target.checked })}
                  />
                  Featured article
                </label>
                <div className="flex items-center gap-3">
                  <button type="button" className={button} onClick={() => setReview(draft)}>
                    Preview / history
                  </button>
                  <button className={primary}>{busy ? "Saving…" : "Save article"}</button>
                  {dirty && <span className="text-xs text-muted-foreground">Unsaved changes</span>}
                  <button
                    type="button"
                    className={button}
                    onClick={() => {
                      const current = articles.find((article) => article.id === draft.id);
                      if (current) edit(current);
                    }}
                  >
                    Reload saved version
                  </button>
                </div>
              </form>
            )}
            {tab === "Categories" && (
              <section className={`${panel} space-y-5`}>
                <h2 className="text-xl font-semibold">Categories</h2>
                <p className="text-sm text-muted-foreground">
                  Renaming a category updates its articles. Categories with articles cannot be
                  deleted.
                </p>
                <form
                  className="flex items-end gap-3"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void run(async () => {
                      const { error } = await (
                        await browserClient()
                      )
                        .from("categories")
                        .insert({ name: newCategory.trim() });
                      if (error) throw error;
                      setNewCategory("");
                    }, "Category added.");
                  }}
                >
                  <div className="flex-1">
                    <Field label="New category">
                      <input
                        className={input}
                        required
                        maxLength={80}
                        value={newCategory}
                        onChange={(event) => setNewCategory(event.target.value)}
                      />
                    </Field>
                  </div>
                  <button className={primary}>Add</button>
                </form>
                <ul className="divide-y divide-border">
                  {topics.map((topic) => {
                    const count = articles.filter((article) => article.category === topic).length;
                    return (
                      <li
                        key={topic}
                        className="flex flex-wrap items-center justify-between gap-3 py-4"
                      >
                        <div>
                          <p className="font-medium">{topic}</p>
                          <p className="text-xs text-muted-foreground">
                            {count} {count === 1 ? "article" : "articles"}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            className={button}
                            onClick={() => setRename({ old: topic, name: topic })}
                          >
                            Rename
                          </button>
                          <button
                            className={`${button} text-destructive`}
                            disabled={busy || count > 0 || topics.length <= 1}
                            onClick={() => {
                              if (window.confirm(`Delete category “${topic}”?`))
                                void run(async () => {
                                  const { data, error } = await (
                                    await browserClient()
                                  )
                                    .from("categories")
                                    .delete()
                                    .eq("name", topic)
                                    .select("name")
                                    .single();
                                  if (error || !data)
                                    throw error ?? new Error("Category could not be deleted.");
                                }, "Category deleted.");
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
                {rename && (
                  <form
                    className="flex flex-wrap items-end gap-3 rounded-lg bg-secondary p-4"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void run(async () => {
                        const { error } = await (
                          await browserClient()
                        )
                          .from("categories")
                          .update({ name: rename.name.trim() })
                          .eq("name", rename.old)
                          .select("name")
                          .single();
                        if (error) throw error;
                        setRename(null);
                      }, "Category renamed and articles updated.");
                    }}
                  >
                    <div className="flex-1">
                      <Field label={`Rename ${rename.old}`}>
                        <input
                          className={input}
                          required
                          maxLength={80}
                          value={rename.name}
                          onChange={(event) => setRename({ ...rename, name: event.target.value })}
                        />
                      </Field>
                    </div>
                    <button className={primary}>Save</button>
                    <button type="button" className={button} onClick={() => setRename(null)}>
                      Cancel
                    </button>
                  </form>
                )}
              </section>
            )}
            {tab === "Media" && (
              <div className="space-y-6">
                <form
                  className={`${panel} space-y-4`}
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (!file) return;
                    void run(async () => {
                      await uploadImage(file, imageDetails);
                      setFile(null);
                      setUploadKey((key) => key + 1);
                      setImageDetails({ alt: "", source_url: "", credit: "", license_note: "" });
                    }, "Image is available in the media library.");
                  }}
                >
                  <h2 className="text-xl font-semibold">Media library</h2>
                  <p className="text-sm text-muted-foreground">
                    PNG, JPEG or WebP, up to 4 MiB. Uploaded images are public, including images
                    used in drafts.
                  </p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Image file">
                      <input
                        key={uploadKey}
                        className={input}
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        required
                        onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                      />
                    </Field>
                    {(
                      [
                        ["alt", "Alt text", 300],
                        ["source_url", "Source URL", 2000],
                        ["credit", "Credit", 300],
                        ["license_note", "Permission / license note", 500],
                      ] as const
                    ).map(([key, label, max]) => (
                      <Field key={key} label={label}>
                        <input
                          className={input}
                          required
                          type={key === "source_url" ? "url" : "text"}
                          maxLength={max}
                          value={imageDetails[key]}
                          onChange={(event) =>
                            setImageDetails({ ...imageDetails, [key]: event.target.value })
                          }
                        />
                      </Field>
                    ))}
                  </div>
                  <button className={primary}>Upload image</button>
                </form>
                <div className="flex flex-wrap items-end gap-4">
                  <div className="flex-1">
                    <Field label="Search media">
                      <input
                        className={input}
                        type="search"
                        placeholder="Alt text or credit"
                        value={mediaSearch}
                        onChange={(event) => setMediaSearch(event.target.value)}
                      />
                    </Field>
                  </div>
                  <label className="flex items-center gap-2 pb-3 text-sm">
                    <input
                      type="checkbox"
                      checked={unusedOnly}
                      onChange={(event) => setUnusedOnly(event.target.checked)}
                    />
                    Unused only
                  </label>
                </div>
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {media
                    .filter(
                      (image) =>
                        `${image.alt} ${image.credit}`
                          .toLowerCase()
                          .includes(mediaSearch.toLowerCase()) &&
                        (!unusedOnly || !usedBy(image, articles).length),
                    )
                    .map((image) => {
                      const uses = usedBy(image, articles);
                      return (
                        <article key={image.path} className={`${panel} space-y-3`}>
                          <a href={image.url} target="_blank" rel="noreferrer">
                            <img
                              className="h-40 w-full rounded-lg bg-secondary object-contain"
                              src={image.url}
                              alt={image.alt}
                              loading="lazy"
                            />
                          </a>
                          <p className="text-sm font-medium">{image.alt}</p>
                          <p className="text-xs text-muted-foreground">
                            {image.mime_type.replace("image/", "").toUpperCase()} ·{" "}
                            {(image.byte_size / 1024).toFixed(0)} KiB · {uses.length} articles
                          </p>
                          <p className="text-xs text-muted-foreground">Credit: {image.credit}</p>
                          <MediaTools image={image} run={run} />
                          {uses.map((article) => (
                            <button
                              className="block text-left text-xs text-primary"
                              key={article.id}
                              onClick={() => edit(article)}
                            >
                              {article.title}
                            </button>
                          ))}
                          <div className="flex flex-wrap gap-2">
                            <button
                              className={button}
                              onClick={() => setEditingMedia({ ...image })}
                            >
                              Edit details
                            </button>
                            <button
                              className={button}
                              onClick={() =>
                                void navigator.clipboard
                                  .writeText(image.url)
                                  .then(() => setMessage("Image URL copied."))
                                  .catch(() =>
                                    setMessage("Could not copy. Open the image to copy its URL."),
                                  )
                              }
                            >
                              Copy URL
                            </button>
                            <button
                              className={`${button} text-destructive`}
                              disabled={busy || !!uses.length}
                              onClick={() => {
                                if (window.confirm("Permanently delete this unused image?"))
                                  void run(async () => {
                                    const client = await browserClient();
                                    const fresh = await allRows<Article>("posts", "id");
                                    if (usedBy(image, fresh).length)
                                      throw new Error(
                                        "An article now uses this image. Refresh the library.",
                                      );
                                    const { error: storageError } = await client.storage
                                      .from("blog-images")
                                      .remove([image.path]);
                                    if (storageError) throw storageError;
                                    const { error } = await client
                                      .from("blog_images")
                                      .delete()
                                      .eq("path", image.path)
                                      .select("path")
                                      .single();
                                    if (error) throw error;
                                  }, "Unused image deleted.");
                              }}
                            >
                              Delete
                            </button>
                          </div>
                        </article>
                      );
                    })}
                </div>
                {!media.length && (
                  <p className="py-8 text-center text-muted-foreground">
                    No images yet. MCP uploads also appear here.
                  </p>
                )}
                {editingMedia && (
                  <form
                    className={`${panel} space-y-4`}
                    onSubmit={(event) => {
                      event.preventDefault();
                      void run(async () => {
                        const { error } = await (
                          await browserClient()
                        )
                          .from("blog_images")
                          .update({
                            alt: editingMedia.alt,
                            credit: editingMedia.credit,
                            source_url: editingMedia.source_url,
                            license_note: editingMedia.license_note,
                          })
                          .eq("path", editingMedia.path)
                          .select("path")
                          .single();
                        if (error) throw error;
                        setEditingMedia(null);
                      }, "Media details saved. Existing article alt text is unchanged.");
                    }}
                  >
                    <h3 className="font-semibold">Edit media details</h3>
                    {(
                      [
                        ["alt", "Alt text", 300],
                        ["source_url", "Source URL", 2000],
                        ["credit", "Credit", 300],
                        ["license_note", "Permission / license note", 500],
                      ] as const
                    ).map(([key, label, max]) => (
                      <Field key={key} label={label}>
                        <input
                          required
                          className={input}
                          maxLength={max}
                          type={key === "source_url" ? "url" : "text"}
                          value={editingMedia[key]}
                          onChange={(event) =>
                            setEditingMedia({ ...editingMedia, [key]: event.target.value })
                          }
                        />
                      </Field>
                    ))}
                    <div className="flex gap-2">
                      <button className={primary}>Save details</button>
                      <button
                        type="button"
                        className={button}
                        onClick={() => setEditingMedia(null)}
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}
            {tab === "Settings" && (
              <form
                className={`${panel} max-w-3xl space-y-5`}
                onSubmit={(event) => {
                  event.preventDefault();
                  void run(async () => {
                    const { error } = await (
                      await browserClient()
                    )
                      .from("site_settings")
                      .update(settings)
                      .eq("id", true)
                      .select("id")
                      .single();
                    if (error) throw error;
                  }, "Site settings saved.");
                }}
              >
                <h2 className="text-xl font-semibold">Site settings</h2>
                <p className="text-sm text-muted-foreground">
                  Name, tagline and description appear on the public site. The default author is
                  used for new emergency drafts.
                </p>
                {(
                  [
                    ["name", "Site name", 80],
                    ["tagline", "Tagline", 160],
                    ["description", "Site description", 500],
                    ["default_author", "Default author", 200],
                  ] as const
                ).map(([key, label, max]) => (
                  <Field key={key} label={label}>
                    <textarea
                      required
                      className={input}
                      rows={key === "description" ? 3 : 1}
                      maxLength={max}
                      value={settings[key]}
                      onChange={(event) => setSettings({ ...settings, [key]: event.target.value })}
                    />
                  </Field>
                ))}
                <button className={primary}>Save settings</button>
              </form>
            )}
          </fieldset>
          {review && (
            <ArticleReview
              article={review}
              close={() => setReview(null)}
              restore={(snapshot) => {
                const current = articles.find((article) => article.id === snapshot.id);
                if (!current) {
                  setMessage("This article was removed. Refresh before restoring.");
                  setReview(null);
                  return;
                }
                if (
                  tab === "Editor" &&
                  dirty &&
                  !window.confirm("Discard your unsaved corrections?")
                )
                  return;
                setOriginal({ ...current });
                const imageAvailable =
                  !snapshot.cover_image_url ||
                  media.some((image) => image.url === snapshot.cover_image_url);
                setDraft({
                  ...snapshot,
                  revision: current.revision!,
                  category: topics.includes(snapshot.category)
                    ? snapshot.category
                    : current.category,
                  cover_image_url: imageAvailable ? snapshot.cover_image_url : "",
                  cover_image_alt: imageAvailable ? snapshot.cover_image_alt : "",
                });
                setMessage(
                  imageAvailable
                    ? "Revision loaded as unsaved draft corrections. Review and save to apply it."
                    : "Revision loaded. Its featured image was removed from the library; choose a replacement before saving.",
                );
                setReview(null);
                setTab("Editor");
              }}
            />
          )}
        </>
      )}
    </div>
  );
}
