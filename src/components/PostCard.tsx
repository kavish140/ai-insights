import { Link } from "@tanstack/react-router";
import { formatDate, type Post } from "@/lib/posts";
import { ArticleImage } from "./ArticleImage";

export function PostCard({ post, size = "default" }: { post: Post; size?: "default" | "large" }) {
  return (
    <article className="h-full">
      <Link
        to="/blog/$slug"
        params={{ slug: post.slug }}
        aria-label={`Read ${post.title}`}
        className={`group flex h-full flex-col rounded-2xl border border-border bg-card p-6 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-lift focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
          size === "large" ? "md:flex-row md:items-center md:gap-8 md:p-8" : ""
        }`}
      >
        <div
          className={`block overflow-hidden rounded-xl ${size === "large" ? "mb-5 md:mb-0 md:w-1/2 md:shrink-0" : "mb-5"}`}
        >
          <ArticleImage
            src={post.cover_image_url}
            alt={post.cover_image_alt}
            featured={size === "large"}
          />
        </div>
        <div className="flex flex-1 flex-col">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-muted-foreground">
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
        </div>
      </Link>
    </article>
  );
}
