import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { browserClient } from "@/lib/supabase-client";
import { categories } from "@/lib/posts";
import type { Session } from "@supabase/supabase-js";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [{ title: "Admin — AI Insights" }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: AdminPage,
});

type Draft = {
  id?: string;
  title: string;
  slug: string;
  description: string;
  category: string;
  author: string;
  date: string;
  body: string;
  featured: boolean;
  status: "draft" | "published";
};
const emptyDraft = (): Draft => ({
  title: "",
  slug: "",
  description: "",
  category: categories[0],
  author: "AI Insights",
  date: new Date().toISOString().slice(0, 10),
  body: "",
  featured: false,
  status: "draft",
});
const inputClass = "mt-2 w-full rounded-lg border border-input bg-surface px-3.5 py-2.5 text-sm";

function AdminPage() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [articles, setArticles] = useState<Draft[]>([]);
  const [draft, setDraft] = useState<Draft>(emptyDraft);

  useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | undefined;
    void browserClient()
      .then(async (client) => {
        const { data } = client.auth.onAuthStateChange((_event, nextSession) => {
          if (active) setSession(nextSession);
        });
        unsubscribe = () => data.subscription.unsubscribe();
        if (!active) {
          unsubscribe();
          return;
        }
        const { data: auth, error } = await client.auth.getSession();
        if (error) throw error;
        if (active) {
          setSession(auth.session);
          setLoading(false);
        }
      })
      .catch((error) => {
        if (active) {
          setMessage(error.message);
          setLoading(false);
        }
      });
    return () => {
      active = false;
      unsubscribe?.();
    };
  }, []);

  async function refreshArticles() {
    const client = await browserClient();
    const { data, error } = await client
      .from("posts")
      .select("id,title,slug,description,category,author,date,body,featured,status")
      .order("date", { ascending: false });
    if (error) throw error;
    setArticles(data ?? []);
  }

  useEffect(() => {
    if (session) void refreshArticles().catch((error) => setMessage(error.message));
    else {
      setArticles([]);
      setDraft(emptyDraft());
    }
  }, [session]);

  async function signIn(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const { error } = await (await browserClient()).auth.signInWithPassword({ email, password });
      if (error) throw error;
      setPassword("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Sign-in failed.");
    } finally {
      setBusy(false);
    }
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const client = await browserClient();
      const record = {
        ...draft,
        reading_minutes: Math.max(
          1,
          Math.ceil(draft.body.replace(/<[^>]*>/g, " ").split(/\s+/).length / 200),
        ),
      };
      const query = draft.id
        ? client.from("posts").update(record).eq("id", draft.id)
        : client.from("posts").insert(record);
      const { data, error } = await query.select("id").single();
      if (error) throw error;
      setDraft((previous) => ({ ...previous, id: data.id }));
      await refreshArticles();
      await router.invalidate();
      setMessage(draft.status === "published" ? "Article published." : "Draft saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save the article.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <p className="mx-auto max-w-md px-4 py-16">Loading editor…</p>;
  if (!session)
    return (
      <div className="mx-auto max-w-md px-4 py-16">
        <h1 className="text-2xl font-bold">Admin sign-in</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Sign in with your designated Supabase editor account.
        </p>
        <form onSubmit={signIn} className="mt-6 space-y-4">
          <label className="block">
            Email
            <input
              className={inputClass}
              type="email"
              required
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label className="block">
            Password
            <input
              className={inputClass}
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <button
            disabled={busy}
            className="rounded-lg bg-brand-gradient px-5 py-2.5 text-primary-foreground"
          >
            {busy ? "Signing in…" : "Sign in"}
          </button>
          {message && (
            <p role="status" className="text-sm">
              {message}
            </p>
          )}
        </form>
      </div>
    );

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Article editor</h1>
        <button
          onClick={async () => {
            try {
              const { error } = await (await browserClient()).auth.signOut();
              if (error) throw error;
              setMessage("");
            } catch (error) {
              setMessage(error instanceof Error ? error.message : "Sign-out failed.");
            }
          }}
          className="rounded-lg border border-border px-4 py-2"
        >
          Sign out
        </button>
      </div>
      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <form onSubmit={save} className="space-y-5 rounded-2xl border border-border bg-card p-6">
          <label className="block">
            Title
            <input
              className={inputClass}
              required
              maxLength={200}
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            />
          </label>
          <label className="block">
            Web address
            <input
              className={inputClass}
              required
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
              value={draft.slug}
              onChange={(e) => setDraft({ ...draft, slug: e.target.value })}
            />
            <span className="text-xs text-muted-foreground">
              Use lowercase words separated by hyphens.
            </span>
          </label>
          <label className="block">
            Topic
            <select
              className={inputClass}
              value={draft.category}
              onChange={(e) => setDraft({ ...draft, category: e.target.value })}
            >
              {categories.map((category) => (
                <option key={category}>{category}</option>
              ))}
            </select>
          </label>
          <label className="block">
            Search summary
            <textarea
              className={inputClass}
              required
              maxLength={160}
              rows={3}
              value={draft.description}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            />
          </label>
          <label className="block">
            Author
            <input
              className={inputClass}
              required
              value={draft.author}
              onChange={(e) => setDraft({ ...draft, author: e.target.value })}
            />
          </label>
          <label className="block">
            Publication date
            <input
              className={inputClass}
              type="date"
              required
              value={draft.date}
              onChange={(e) => setDraft({ ...draft, date: e.target.value })}
            />
          </label>
          <label className="block">
            Article HTML
            <textarea
              className={`${inputClass} font-mono`}
              required
              maxLength={200000}
              rows={14}
              value={draft.body}
              onChange={(e) => setDraft({ ...draft, body: e.target.value })}
            />
            <span className="text-xs text-muted-foreground">
              Use paragraph, heading, list, and link tags. Scripts and unsafe markup are removed
              from public pages.
            </span>
          </label>
          <label className="flex gap-2">
            <input
              type="checkbox"
              checked={draft.featured}
              onChange={(e) => setDraft({ ...draft, featured: e.target.checked })}
            />
            Featured article
          </label>
          <label className="block">
            Status
            <select
              className={inputClass}
              value={draft.status}
              onChange={(e) => setDraft({ ...draft, status: e.target.value as Draft["status"] })}
            >
              <option value="draft">Draft</option>
              <option value="published">Published</option>
            </select>
          </label>
          <button
            disabled={busy}
            className="rounded-lg bg-brand-gradient px-5 py-2.5 text-primary-foreground"
          >
            {busy ? "Saving…" : draft.status === "published" ? "Publish article" : "Save draft"}
          </button>
          {message && (
            <p role="status" className="text-sm">
              {message}
            </p>
          )}
        </form>
        <aside className="rounded-2xl border border-border bg-card p-6">
          <button
            onClick={() => {
              setDraft(emptyDraft());
              setMessage("");
            }}
            className="text-primary"
          >
            + New article
          </button>
          <h2 className="mt-6 font-semibold">Your articles</h2>
          <ul className="mt-4 space-y-3">
            {articles.map((article) => (
              <li key={article.id}>
                <button
                  className="text-left text-sm hover:text-primary"
                  onClick={() => {
                    setDraft(article);
                    setMessage("");
                  }}
                >
                  {article.title}
                  <span className="block text-xs text-muted-foreground">{article.status}</span>
                </button>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </div>
  );
}
