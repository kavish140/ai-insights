import { createFileRoute, Link } from "@tanstack/react-router";
import { AdSlot } from "@/components/AdSlot";
import { PostCard } from "@/components/PostCard";
import { SITE, categories } from "@/lib/posts";
import { listPublishedPosts } from "@/lib/post-functions";

export const Route = createFileRoute("/")({
  loader: () => listPublishedPosts(),
  head: () => ({
    meta: [
      { title: "AI Insights — Practical AI Automation & Awareness" },
      {
        name: "description",
        content:
          "Clear guides on AI automation, agents and workflows, plus honest awareness pieces on privacy and misinformation.",
      },
      { property: "og:title", content: "AI Insights — Practical AI Automation & Awareness" },
      {
        property: "og:description",
        content:
          "Clear guides on AI automation, agents and workflows, plus honest awareness pieces on privacy and misinformation.",
      },
      { property: "og:url", content: SITE.url + "/" },
      { property: "og:image", content: SITE.url + "/images/og-cover.jpg" },
      { name: "twitter:image", content: SITE.url + "/images/og-cover.jpg" },
    ],
    links: [{ rel: "canonical", href: SITE.url + "/" }],
  }),
  component: HomePage,
});

function HomePage() {
  const all = Route.useLoaderData();
  const featured = all.find((p) => p.featured) ?? all[0];
  const rest = all.filter((p) => p.slug !== featured?.slug);

  return (
    <>
      <section className="bg-hero border-b border-border">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 md:py-28">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface/80 px-3 py-1 text-xs font-medium text-muted-foreground">
            New articles every week
          </span>
          <h1 className="mt-6 max-w-3xl text-4xl font-bold leading-[1.1] md:text-6xl">
            AI automation, <span className="text-brand-gradient">explained without the hype</span>
          </h1>
          <p className="mt-6 max-w-xl text-base leading-relaxed text-muted-foreground md:text-lg">
            {SITE.description}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/blog"
              className="rounded-lg bg-brand-gradient px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-card"
            >
              Read the latest
            </Link>
            <Link
              to="/about"
              className="rounded-lg border border-border bg-surface px-5 py-2.5 text-sm font-medium transition-colors hover:bg-accent"
            >
              What this site covers
            </Link>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="pt-10">
          <AdSlot format="leaderboard" />
        </div>

        <section className="py-14">
          <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Featured
          </h2>
          <div className="mt-5">
            {featured ? (
              <PostCard post={featured} size="large" />
            ) : (
              <p className="text-muted-foreground">Our first articles are coming soon.</p>
            )}
          </div>
        </section>

        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_300px]">
          <section>
            <h2 className="text-2xl font-semibold">Latest articles</h2>
            <div className="mt-6 grid gap-6 sm:grid-cols-2">
              {rest.map((post) => (
                <PostCard key={post.slug} post={post} />
              ))}
            </div>
          </section>

          <div className="space-y-6">
            <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
              <h3 className="text-base font-semibold">Browse by topic</h3>
              <ul className="mt-4 space-y-2 text-sm">
                {categories.map((c) => (
                  <li key={c}>
                    <Link
                      to="/blog"
                      search={{ category: c }}
                      className="text-muted-foreground hover:text-primary"
                    >
                      {c}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <AdSlot format="sidebar" />
          </div>
        </div>
      </div>
    </>
  );
}
