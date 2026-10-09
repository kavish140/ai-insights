import { socialMeta } from "@/lib/social-meta";
import { createFileRoute, Link, notFound, useLoaderData } from "@tanstack/react-router";
import { AdSlot } from "@/components/AdSlot";
import { PostCard } from "@/components/PostCard";
import { SITE } from "@/lib/posts";
import { getArticlePage } from "@/lib/post-functions";
import { jsonLd, listingSeo, WEBSITE_ID } from "@/lib/seo";

type BlogSearch = {
  category?: string | undefined;
  tag?: string | undefined;
  audience?: string | undefined;
  q?: string | undefined;
  sort?: "latest" | "oldest" | "shortest" | "popular" | undefined;
  page?: number | undefined;
};

export const Route = createFileRoute("/blog/")({
  loaderDeps: ({ search }) => search,
  loader: async ({ deps }) => {
    const result = await getArticlePage({ data: deps });
    if (result.page > 1 && !result.posts.length) throw notFound();
    return result;
  },
  validateSearch: (search: Record<string, unknown>): BlogSearch => ({
    category: typeof search["category"] === "string" ? search["category"].slice(0, 100) : undefined,
    q: typeof search["q"] === "string" ? search["q"].trim().slice(0, 100) : undefined,
    tag:
      typeof search["tag"] === "string"
        ? search["tag"].trim().toLowerCase().slice(0, 40)
        : undefined,
    audience:
      typeof search["audience"] === "string"
        ? search["audience"].trim().toLowerCase().slice(0, 40)
        : undefined,
    sort:
      search["sort"] === "popular"
        ? "popular"
        : search["sort"] === "oldest" || search["sort"] === "shortest"
          ? search["sort"]
          : "latest",
    page:
      Number.isInteger(Number(search["page"])) && Number(search["page"]) > 0
        ? Math.min(Number(search["page"]), 10000)
        : 1,
  }),
  head: ({ loaderData, match }) => {
    const seo = listingSeo(match.loaderDeps, loaderData?.total === 0);
    return {
      meta: [
        { title: seo.title },
        {
          name: "description",
          content: seo.description,
        },
        { name: "robots", content: seo.robots },
        ...socialMeta({
          title: seo.title,
          description: seo.description,
          path: seo.path,
        }),
      ],
      links: [{ rel: "canonical", href: seo.canonical }],
      scripts: [
        {
          type: "application/ld+json",
          children: jsonLd({
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            "@id": seo.canonical,
            name: seo.heading,
            description: seo.description,
            url: seo.canonical,
            isPartOf: { "@id": WEBSITE_ID },
            mainEntity: {
              "@type": "ItemList",
              itemListElement: (loaderData?.posts ?? []).map((post, index) => ({
                "@type": "ListItem",
                position: index + 1,
                name: post.title,
                url: `${SITE.url}/blog/${encodeURIComponent(post.slug)}`,
              })),
            },
          }),
        },
      ],
    };
  },
  component: BlogIndex,
});

function BlogIndex() {
  const { categories } = useLoaderData({ from: "__root__" });
  const search = Route.useSearch();
  const { category } = search;
  const { posts: list, total, page, pageSize } = Route.useLoaderData();
  const navigate = Route.useNavigate();
  const seo = listingSeo(search);

  return (
    <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
      <header className="max-w-2xl">
        <h1 className="text-3xl font-bold md:text-4xl">{seo.heading}</h1>
        <p className="mt-3 text-muted-foreground">{seo.description}</p>
      </header>

      <form
        className="mt-8 flex flex-wrap items-end gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          const query = String(form.get("q") ?? "");
          void navigate({
            search: {
              ...search,
              q: query.trim() || undefined,
              tag:
                String(form.get("tag") ?? "")
                  .trim()
                  .toLowerCase() || undefined,
              audience:
                String(form.get("audience") ?? "")
                  .trim()
                  .toLowerCase() || undefined,
              page: 1,
            },
          });
        }}
      >
        <label className="w-full text-sm font-medium sm:min-w-64 sm:flex-1">
          Search articles
          <input
            key={search.q}
            type="search"
            name="q"
            maxLength={100}
            defaultValue={search.q ?? ""}
            placeholder="Try email, workflows, privacy…"
            className="mt-2 w-full rounded-lg border border-input bg-surface px-4 py-2.5"
          />
        </label>
        <label className="text-sm font-medium">
          Topic tag
          <input
            key={search.tag}
            name="tag"
            maxLength={40}
            defaultValue={search.tag ?? ""}
            placeholder="e.g. ai agents"
            className="mt-2 block rounded-lg border border-input bg-surface px-3 py-2.5"
          />
        </label>
        <label className="text-sm font-medium">
          For readers
          <input
            key={search.audience}
            name="audience"
            maxLength={40}
            defaultValue={search.audience ?? ""}
            placeholder="e.g. beginners"
            className="mt-2 block rounded-lg border border-input bg-surface px-3 py-2.5"
          />
        </label>
        <button className="rounded-lg bg-brand-gradient px-5 py-2.5 text-sm font-medium text-primary-foreground">
          Search
        </button>
        <label className="text-sm font-medium">
          Sort by
          <select
            value={search.sort ?? "latest"}
            onChange={(event) => {
              void navigate({
                search: { ...search, sort: event.target.value as BlogSearch["sort"], page: 1 },
              });
            }}
            className="mt-2 block rounded-lg border border-input bg-surface px-3 py-2.5"
          >
            <option value="popular">Most read</option>
            <option value="latest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="shortest">Shortest read</option>
          </select>
        </label>
      </form>
      <nav aria-label="Categories" className="mt-6 flex flex-wrap gap-2">
        <Link
          to="/blog"
          search={{ ...search, category: undefined, page: 1 }}
          aria-current={!category ? "page" : undefined}
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
            search={{ ...search, category: c, page: 1 }}
            aria-current={category === c ? "page" : undefined}
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

      <p role="status" className="mt-6 text-sm text-muted-foreground">
        {total} {total === 1 ? "article" : "articles"}
        {search.q ? ` matching “${search.q}”` : ""}
        {category ? ` in ${category}` : ""}
        {search.tag ? ` tagged “${search.tag}”` : ""}
        {search.audience ? ` for ${search.audience}` : ""}
      </p>

      <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((post) => (
          <PostCard key={post.slug} post={post} />
        ))}
      </div>

      {list.length === 0 && (
        <div className="mt-10 rounded-xl border border-border bg-card p-6">
          <p>No articles match these filters.</p>
          <Link to="/blog" search={{}} className="mt-3 inline-block text-primary">
            Clear filters →
          </Link>
        </div>
      )}
      {total > pageSize && (
        <nav aria-label="Article pages" className="mt-8 flex items-center justify-between gap-4">
          {page > 1 ? (
            <Link
              to="/blog"
              search={{ ...search, page: page - 1 }}
              className="rounded-lg border border-border px-4 py-2"
            >
              ← Previous
            </Link>
          ) : (
            <span />
          )}
          <span className="text-sm text-muted-foreground">
            Page {page} of {Math.ceil(total / pageSize)}
          </span>
          {page * pageSize < total ? (
            <Link
              to="/blog"
              search={{ ...search, page: page + 1 }}
              className="rounded-lg border border-border px-4 py-2"
            >
              Next →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
      <div className="mt-12">
        <AdSlot format="leaderboard" />
      </div>
    </div>
  );
}
