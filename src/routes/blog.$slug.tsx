import { ArticleTracker } from "@/components/ArticleTracker";
import { ArticleFeedback } from "@/components/ArticleFeedback";
import { socialMeta, DEFAULT_SOCIAL_IMAGE } from "@/lib/social-meta";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { AdSlot } from "@/components/AdSlot";
import { PostCard } from "@/components/PostCard";
import { SITE, formatDate } from "@/lib/posts";
import { getArticle } from "@/lib/post-functions";
import { articleOutline, articleTakeaways, checklistText } from "@/lib/article-reading";
import { ArticleImage } from "@/components/ArticleImage";
import { Newsletter } from "@/components/Newsletter";

export const Route = createFileRoute("/blog/$slug")({
  loader: async ({ params }) => {
    const article = await getArticle({ data: { slug: params.slug } });
    if (!article) throw notFound();
    return article;
  },
  head: ({ params, loaderData }) => {
    if (!loaderData) {
      return {
        meta: [
          { title: "Article not found — AI Insights" },
          { name: "robots", content: "noindex" },
        ],
      };
    }
    const { post } = loaderData;
    const url = `${SITE.url}/blog/${params.slug}`;
    return {
      meta: [
        { title: `${post.title} — AI Insights` },
        { name: "description", content: post.description },
        ...socialMeta({
          title: post.title,
          description: post.description,
          path: "/blog/" + params.slug,
          type: "article",
          image: post.cover_image_url || DEFAULT_SOCIAL_IMAGE,
          imageAlt: post.cover_image_url ? post.cover_image_alt || post.title : undefined,
        }),
        { name: "author", content: post.author },
        { property: "article:modified_time", content: post.updatedAt || post.date },
        { property: "article:published_time", content: post.date },
        { property: "article:section", content: post.category },
      ],
      links: [{ rel: "canonical", href: url }],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BlogPosting",
            headline: post.title,
            keywords: post.tags ?? [],
            articleSection: post.category,
            about: (post.tags ?? []).map((name) => ({ "@type": "Thing", name })),
            audience: (post.audience_tags ?? []).map((audienceType) => ({
              "@type": "Audience",
              audienceType,
            })),
            description: post.description,
            datePublished: post.date,
            dateModified: post.updatedAt || post.date,
            author: { "@type": "Person", name: post.author },
            publisher: { "@type": "Organization", name: SITE.name },
            mainEntityOfPage: { "@type": "WebPage", "@id": url },
            image: post.cover_image_url || SITE.url + "/images/og-cover.jpg",
          }),
        },
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Home", item: SITE.url + "/" },
              { "@type": "ListItem", position: 2, name: "Articles", item: SITE.url + "/blog" },
              { "@type": "ListItem", position: 3, name: post.title, item: url },
            ],
          }),
        },
      ],
    };
  },
  component: PostPage,
});

function PostPage() {
  const { post, related } = Route.useLoaderData();
  const { html, headings } = articleOutline(post.body);
  const takeaways = articleTakeaways(post.body);

  return (
    <article>
      <ArticleTracker slug={post.slug} />
      <header className="bg-hero border-b border-border">
        <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6 md:py-20">
          <nav aria-label="Breadcrumb" className="text-xs text-muted-foreground">
            <Link to="/" className="hover:text-foreground">
              Home
            </Link>
            <span className="mx-1.5">/</span>
            <Link to="/blog" className="hover:text-foreground">
              Articles
            </Link>
          </nav>
          <span className="mt-5 inline-block rounded-full bg-primary-soft px-2.5 py-1 text-xs font-medium text-primary">
            {post.category}
          </span>
          <h1 className="mt-4 text-3xl font-bold leading-tight md:text-5xl">{post.title}</h1>
          <p className="mt-5 text-base text-muted-foreground md:text-lg">{post.description}</p>
          <div className="mt-6 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{post.author}</span>
            <span aria-hidden="true">·</span>
            <time dateTime={post.date}>{formatDate(post.date)}</time>
            <span aria-hidden="true">·</span>
            <span>{post.readingMinutes} min read</span>
            {post.updatedAt && post.updatedAt.slice(0, 10) !== post.date && (
              <span>
                Updated <time dateTime={post.updatedAt}>{formatDate(post.updatedAt)}</time>
              </span>
            )}
          </div>
          <div className="mt-5 flex flex-wrap gap-2" aria-label="Article topics">
            {(post.tags ?? []).map((tag) => (
              <Link
                key={tag}
                to="/blog"
                search={{ tag, sort: "popular" }}
                className="rounded-full border border-border px-3 py-1 text-xs text-primary"
              >
                {tag}
              </Link>
            ))}
          </div>
          {!!post.audience_tags?.length && (
            <p className="mt-3 text-sm text-muted-foreground">
              For:{" "}
              {post.audience_tags.map((audience, index) => (
                <span key={audience}>
                  {index > 0 && ", "}
                  <Link to="/blog" search={{ audience, sort: "popular" }} className="text-primary">
                    {audience}
                  </Link>
                </span>
              ))}
            </p>
          )}
          {post.cover_image_url && (
            <ArticleImage
              src={post.cover_image_url}
              alt={post.cover_image_alt ?? ""}
              featured
              className="mt-8 aspect-[16/9] w-full rounded-2xl object-cover"
            />
          )}
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0">
          {headings.length > 0 && (
            <details className="mb-6 rounded-xl border border-border bg-card p-5 lg:hidden">
              <summary className="cursor-pointer font-semibold">On this page</summary>
              <nav aria-label="Article sections" className="mt-4">
                <ol className="space-y-3 text-sm">
                  {headings.map((heading) => (
                    <li key={heading.id}>
                      <a href={`#${heading.id}`} className="text-primary">
                        {heading.title}
                      </a>
                    </li>
                  ))}
                </ol>
              </nav>
            </details>
          )}
          {takeaways.length > 0 && (
            <section
              aria-label="Key takeaways"
              className="mb-8 rounded-2xl border border-border bg-primary-soft/50 p-6"
            >
              <h2 className="text-lg font-semibold">Key takeaways</h2>
              <ul className="mt-3 list-disc space-y-2 pl-5 text-sm">
                {takeaways.map((point, index) => (
                  <li key={index}>{point}</li>
                ))}
              </ul>
            </section>
          )}
          {headings.length > 0 && (
            <section
              aria-labelledby="overview-title"
              className="mb-8 rounded-2xl border border-border bg-primary-soft/50 p-6"
            >
              <h2 id="overview-title" className="text-lg font-semibold">
                What you’ll learn
              </h2>
              <ul className="mt-3 list-disc space-y-2 pl-5 text-sm">
                {headings
                  .filter((heading) => heading.level === 2)
                  .slice(0, 4)
                  .map((heading) => (
                    <li key={heading.id}>
                      <a href={`#${heading.id}`} className="hover:text-primary">
                        {heading.title}
                      </a>
                    </li>
                  ))}
              </ul>
              <p className="mt-4 text-sm text-muted-foreground">{post.description}</p>
            </section>
          )}
          <div
            data-article-body
            className="prose-article max-w-[70ch]"
            dangerouslySetInnerHTML={{ __html: html }}
          />
          <ArticleFeedback key={post.slug} slug={post.slug} />
          {post.category === "Automation" && (
            <section className="mt-10 rounded-2xl border border-border bg-card p-6">
              <h2 className="text-lg font-semibold">Turn the guide into a tested workflow</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Use this general checklist to define approvals, test failure cases and measure the
                result.
              </p>
              <a
                href={`data:text/plain;charset=utf-8,${encodeURIComponent(checklistText(post))}`}
                download={`${post.slug}-checklist.txt`}
                className="mt-4 inline-block font-medium text-primary"
              >
                Download workflow checklist ↓
              </a>
            </section>
          )}
          <section className="mt-8 rounded-xl border border-border p-5 text-sm">
            <h2 className="font-semibold">About the author</h2>
            <p className="mt-2">{post.author}</p>
            {post.author === "Kavish Ganatra" && (
              <p className="mt-2 text-muted-foreground">
                Kavish works on SiteNova websites and the AI Insights publishing workflow, with a
                focus on making AI automation easier to understand and use.
              </p>
            )}
            <Link to="/about" className="mt-3 inline-block text-primary">
              Editorial standards →
            </Link>
            <span className="mx-3">·</span>
            <Link to="/contact" className="text-primary">
              Suggest a correction
            </Link>
          </section>
          <div className="my-10">
            <AdSlot format="in-article" />
          </div>

          {related.length > 0 && (
            <section className="mt-16">
              <h2 className="text-2xl font-semibold">Keep reading</h2>
              <div className="mt-6 grid gap-6 sm:grid-cols-2">
                {related.map((p) => (
                  <PostCard
                    key={p.slug}
                    post={p}
                    recommendation={{ source: post.slug, placement: "related" }}
                  />
                ))}
              </div>
            </section>
          )}
        </div>

        <aside className="space-y-6">
          {headings.length > 0 && (
            <nav
              aria-label="On this page"
              className="hidden rounded-2xl border border-border bg-card p-6 lg:block"
            >
              <h2 className="font-semibold">On this page</h2>
              <ol className="mt-4 space-y-3 text-sm">
                {headings.map((heading) => (
                  <li key={heading.id} className={heading.level > 2 ? "pl-3" : ""}>
                    <a href={`#${heading.id}`} className="text-muted-foreground hover:text-primary">
                      {heading.title}
                    </a>
                  </li>
                ))}
              </ol>
            </nav>
          )}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
            <h3 className="text-base font-semibold">About {SITE.name}</h3>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{SITE.tagline}.</p>
            <Link
              to="/blog"
              className="mt-4 inline-block text-sm font-medium text-primary hover:underline"
            >
              All articles →
            </Link>
          </div>
          <Newsletter />
        </aside>
      </div>
    </article>
  );
}
