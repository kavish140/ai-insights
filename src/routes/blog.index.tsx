import { socialMeta } from "@/lib/social-meta";
import { createFileRoute, Link, useLoaderData } from "@tanstack/react-router";
import { AdSlot } from "@/components/AdSlot";
import { PostCard } from "@/components/PostCard";
import { SITE } from "@/lib/posts";
import { listPublishedPosts } from "@/lib/post-functions";

type BlogSearch = { category?: string | undefined };

export const Route = createFileRoute("/blog/")({
  loader: () => listPublishedPosts(),
  validateSearch: (search: Record<string, unknown>): BlogSearch => ({
    category: typeof search["category"] === "string" ? search["category"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "All Articles on AI Automation & Awareness — AI Insights" },
      {
        name: "description",
        content:
          "Every AI Insights article: automation playbooks, agent vs workflow guidance, privacy and misinformation awareness, and ROI frameworks.",
      },
      ...socialMeta({
        title: "All Articles on AI Automation & Awareness — AI Insights",
        description:
          "Every AI Insights article: automation playbooks, agent vs workflow guidance, privacy and misinformation awareness, and ROI frameworks.",
        path: "/blog",
      }),
    ],
    links: [{ rel: "canonical", href: SITE.url + "/blog" }],
  }),
  component: BlogIndex,
});

function BlogIndex() {
  const { categories } = useLoaderData({ from: "__root__" });
  const { category } = Route.useSearch();
  const all = Route.useLoaderData();
  const list = category ? all.filter((p) => p.category === category) : all;

  return (
    <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
      <header className="max-w-2xl">
        <h1 className="text-3xl font-bold md:text-4xl">Articles</h1>
        <p className="mt-3 text-muted-foreground">
          Practical writing on AI automation and staying aware of how AI reshapes work.
        </p>
      </header>

      <nav aria-label="Categories" className="mt-8 flex flex-wrap gap-2">
        <Link
          to="/blog"
          className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
            !category
              ? "border-transparent bg-brand-gradient text-primary-foreground"
              : "border-border bg-surface text-muted-foreground hover:text-foreground"
          }`}
        >
          All
        </Link>
        {categories.map((c) => (
          <Link
            key={c}
            to="/blog"
            search={{ category: c }}
            className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
              category === c
                ? "border-transparent bg-brand-gradient text-primary-foreground"
                : "border-border bg-surface text-muted-foreground hover:text-foreground"
            }`}
          >
            {c}
          </Link>
        ))}
      </nav>

      <div className="mt-8">
        <AdSlot format="leaderboard" />
      </div>

      <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((post) => (
          <PostCard key={post.slug} post={post} />
        ))}
      </div>

      {list.length === 0 && (
        <p className="mt-10 text-sm text-muted-foreground">No articles in this topic yet.</p>
      )}
    </div>
  );
}
