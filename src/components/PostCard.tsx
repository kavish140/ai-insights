import { Link } from "@tanstack/react-router";
import { formatDate, type Post } from "@/lib/posts";

export function PostCard({ post, size = "default" }: { post: Post; size?: "default" | "large" }) {
  return (
    <article className="h-full">
      <Link
        to="/blog/$slug"
        params={{ slug: post.slug }}
        aria-label={`Read ${post.title}`}
        className={`group flex h-full flex-col rounded-2xl border border-border bg-card p-6 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-lift focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
          size === "large" ? "md:p-8" : ""
        }`}
      >
        {post.cover_image_url && (
          <div className="mb-5 block overflow-hidden rounded-xl">
            <img
              src={post.cover_image_url}
              alt={post.cover_image_alt ?? ""}
              loading="lazy"
              decoding="async"
              className="aspect-[16/9] w-full object-cover"
            />
          </div>
        )}
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="rounded-full bg-primary-soft px-2.5 py-1 font-medium text-primary">
            {post.category}
          </span>
          <time dateTime={post.date}>{formatDate(post.date)}</time>
          <span aria-hidden="true">·</span>
          <span>{post.readingMinutes} min read</span>
        </div>

        <h3
          className={`mt-4 font-semibold leading-snug text-foreground ${
            size === "large" ? "text-2xl md:text-3xl" : "text-lg"
          }`}
        >
          <span className="transition-colors group-hover:text-primary">{post.title}</span>
        </h3>

        <p className="mt-3 flex-1 text-sm leading-relaxed text-muted-foreground">
          {post.description}
        </p>

        <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-primary">
          Read article
          <span aria-hidden="true" className="transition-transform group-hover:translate-x-0.5">
            →
          </span>
        </span>
      </Link>
    </article>
  );
}
