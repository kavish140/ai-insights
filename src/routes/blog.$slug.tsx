import { socialMeta, DEFAULT_SOCIAL_IMAGE } from "@/lib/social-meta";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { AdSlot } from "@/components/AdSlot";
import { PostCard } from "@/components/PostCard";
import { SITE, formatDate } from "@/lib/posts";
import { listPublishedPosts } from "@/lib/post-functions";

export const Route = createFileRoute("/blog/$slug")({
  loader: async ({ params }) => {
    const all = await listPublishedPosts();
    const post = all.find((post) => post.slug === params.slug);
    if (!post) throw notFound();
    return { post, related: all.filter((p) => p.slug !== post.slug).slice(0, 3) };
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

  return (
    <article>
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
          </div>
          {post.cover_image_url && (
            <img
              src={post.cover_image_url}
              alt={post.cover_image_alt ?? ""}
              fetchPriority="high"
              decoding="async"
              className="mt-8 aspect-[16/9] w-full rounded-2xl object-cover"
            />
          )}
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0">
          <div
            className="prose-article max-w-none"
            dangerouslySetInnerHTML={{ __html: post.body }}
          />
          <div className="my-10">
            <AdSlot format="in-article" />
          </div>

          <section className="mt-16">
            <h2 className="text-2xl font-semibold">Keep reading</h2>
            <div className="mt-6 grid gap-6 sm:grid-cols-2">
              {related.map((p) => (
                <PostCard key={p.slug} post={p} />
              ))}
            </div>
          </section>
        </div>

        <aside className="space-y-6">
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
          <AdSlot format="sidebar" />
        </aside>
      </div>
    </article>
  );
}
