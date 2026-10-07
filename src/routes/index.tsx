import { socialMeta } from "@/lib/social-meta";
import { createFileRoute, Link, useLoaderData } from "@tanstack/react-router";
import { AdSlot } from "@/components/AdSlot";
import { PostCard } from "@/components/PostCard";
import { SITE } from "@/lib/posts";
import { getHomeArticles } from "@/lib/post-functions";
import { ReadingPath } from "@/components/ReadingPath";
import { Newsletter } from "@/components/Newsletter";

export const Route = createFileRoute("/")({
  loader: () => getHomeArticles(),
  head: () => ({
    meta: [
      { title: "AI Insights — Practical AI Automation & Awareness" },
      {
        name: "description",
        content:
          "Clear guides on AI automation, agents and workflows, plus honest awareness pieces on privacy and misinformation.",
      },
      ...socialMeta({
        title: "AI Insights — Practical AI Automation & Awareness",
        description:
          "Clear guides on AI automation, agents and workflows, plus honest awareness pieces on privacy and misinformation.",
        path: "/",
      }),
    ],
    links: [{ rel: "canonical", href: SITE.url + "/" }],
  }),
  component: HomePage,
});

function HomePage() {
  const { site, categories } = useLoaderData({ from: "__root__" });
  const { featured, latest: rest, path } = Route.useLoaderData();

  return (
    <>
      <section className="bg-hero border-b border-border">
        <div className="mx-auto grid max-w-6xl items-center gap-8 px-4 py-10 sm:px-6 md:grid-cols-[1fr_300px] md:py-12">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface/80 px-3 py-1 text-xs font-medium text-muted-foreground">
              {site.tagline}
            </span>
            <h1 className="mt-6 max-w-3xl text-4xl font-bold leading-[1.1] md:text-6xl">
              AI automation, <span className="text-brand-gradient">explained without the hype</span>
            </h1>
            <p className="mt-6 max-w-xl text-base leading-relaxed text-muted-foreground md:text-lg">
              {site.description}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/blog"
                className="rounded-lg bg-brand-gradient px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-card"
              >
                Read the latest
              </Link>
              <Link
                to="/"
                hash="start-here"
                className="rounded-lg border border-border bg-surface px-5 py-2.5 text-sm font-medium transition-colors hover:bg-accent"
              >
                Start with the basics
              </Link>
            </div>
          </div>
          <div className="hidden rounded-2xl border border-primary/15 bg-surface/70 p-6 md:block">
            <p className="text-xs font-semibold uppercase tracking-widest text-primary">
              From idea to useful work
            </p>
            <ol className="mt-5 space-y-3 text-sm font-medium">
              <li className="rounded-lg bg-surface p-3">01 · Choose a repeatable task</li>
              <li className="rounded-lg bg-primary-soft p-3">02 · Automate, then review</li>
              <li className="rounded-lg bg-surface p-3">03 · Measure what improved</li>
            </ol>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <section className="py-10">
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
        <ReadingPath posts={path} />
        <div className="mb-10">
          <AdSlot format="leaderboard" />
        </div>

        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_300px]">
          <section>
            <h2 className="text-2xl font-semibold">Latest articles</h2>
            <div className="mt-6 grid gap-6 sm:grid-cols-2">
              {rest.map((post) => (
                <PostCard key={post.slug} post={post} />
              ))}
            </div>
            <Link to="/blog" className="mt-6 inline-block font-medium text-primary">
              View all articles →
            </Link>
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
            <Newsletter />
          </div>
        </div>
      </div>
    </>
  );
}
