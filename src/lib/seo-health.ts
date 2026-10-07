import type { Article } from "./admin";
import { SITE } from "./posts";
export type HtmlFacts = { images: { alt: string; src: string }[]; links: string[] };
export function seoIssues(
  article: Article,
  articles: Article[],
  facts: HtmlFacts,
  today = new Date().toISOString().slice(0, 10),
) {
  const issues: string[] = [];
  if (!article.description.trim()) issues.push("Missing meta description");
  if (article.description.length > 160) issues.push("Meta description exceeds 160 characters");
  if (article.title.length > 60) issues.push("Title exceeds the recommended 60 characters");
  if (!article.cover_image_url) issues.push("Missing featured image");
  if (article.cover_image_url && !article.cover_image_alt.trim())
    issues.push("Missing featured-image alt text");
  const missing = facts.images.filter((image) => !image.alt.trim()).length;
  if (missing) issues.push(`${missing} inline image(s) missing alt text`);
  if (articles.some((other) => other.id !== article.id && other.slug === article.slug))
    issues.push("Duplicate slug");
  const live = new Set(
    articles
      .filter((post) => post.status === "published" && post.date <= today)
      .map((post) => `/blog/${post.slug}`),
  );
  for (const href of new Set(facts.links)) {
    try {
      const url = new URL(href, SITE.url);
      if (url.origin !== SITE.url) continue;
      const path = decodeURIComponent(url.pathname).replace(/\/$/, "") || "/";
      if (path.startsWith("/blog/") && !live.has(path))
        issues.push(`Broken or unpublished internal link: ${path}`);
    } catch {
      issues.push(`Invalid link: ${href}`);
    }
  }
  return issues;
}
