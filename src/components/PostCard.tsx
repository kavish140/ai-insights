import { Link } from "@tanstack/react-router";
import { formatDate, type Post } from "@/lib/posts";

export function PostCard({ post, size = "default" }: { post: Post; size?: "default" | "large" }) {
  return (
    <article
      className={`group flex flex-col rounded-2xl border border-border bg-card p-6 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-lift ${
        size === "large" ? "md:p-8" : ""
      }`}
    >
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
        <Link
          to="/blog/$slug"
          params={{ slug: post.slug }}
          className="transition-colors group-hover:text-primary"
        >
          {post.title}
        </Link>
      </h3>

      <p className="mt-3 flex-1 text-sm leading-relaxed text-muted-foreground">
        {post.description}
      </p>

      <Link
        to="/blog/$slug"
        params={{ slug: post.slug }}
        className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-primary"
      >
        Read article
        <span aria-hidden="true" className="transition-transform group-hover:translate-x-0.5">
          →
        </span>
      </Link>
    </article>
  );
}
