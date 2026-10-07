import type { Article } from "./admin";

export type ContentFinding = { postId: string; title: string; issues: string[] };
export function contentFindings(
  articles: Article[],
  staleDays: number,
  now = Date.now(),
): ContentFinding[] {
  const words = (title: string) =>
    new Set(
      title
        .toLowerCase()
        .replace(/[^a-z0-9 ]/g, " ")
        .split(/\s+/)
        .filter((word) => word.length > 2),
    );
  return articles.map((article) => {
    const issues: string[] = [];
    const updated = Date.parse(article.updated_at ?? article.created_at ?? article.date);
    if (Number.isFinite(updated) && now - updated > staleDays * 86400000)
      issues.push(`Not updated for ${staleDays}+ days`);
    if (!article.cover_image_url) issues.push("Missing featured image");
    if (!article.description.trim()) issues.push("Missing search description");
    const own = words(article.title);
    const related = articles.filter((other) => {
      if (other.id === article.id) return false;
      const theirs = words(other.title);
      const intersection = [...own].filter((word) => theirs.has(word)).length;
      return (
        own.size >= 3 &&
        theirs.size >= 3 &&
        intersection / (own.size + theirs.size - intersection) >= 0.65
      );
    });
    if (related.length)
      issues.push(`Possible topic overlap: ${related.map((other) => other.title).join("; ")}`);
    return { postId: article.id!, title: article.title, issues };
  });
}

export type LinkCheck = {
  url: string;
  status: number | null;
  outcome: "ok" | "broken" | "review" | "unreachable";
  detail: string;
};
export type ContentScan = {
  articles: { postId: string; title: string; links: LinkCheck[]; truncated: boolean }[];
  checkedAt: string;
};
export const sourceHosts = [
  "openai.com",
  "www.openai.com",
  "platform.openai.com",
  "help.openai.com",
  "www.anthropic.com",
  "docs.anthropic.com",
  "ai.google.dev",
  "blog.google",
  "deepmind.google",
  "www.microsoft.com",
  "github.com",
  "huggingface.co",
  "arxiv.org",
  "supabase.com",
];
export function checkableUrl(value: string, siteUrl: string): URL | null {
  try {
    const url = new URL(value, siteUrl);
    const imageHost = "gutvbukqlqutjwlbmfpr.supabase.co";
    const isImage =
      url.hostname === imageHost &&
      url.pathname.startsWith("/storage/v1/object/public/blog-images/articles/");
    return url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      (!url.port || url.port === "443") &&
      (url.hostname === new URL(siteUrl).hostname || sourceHosts.includes(url.hostname) || isImage)
      ? url
      : null;
  } catch {
    return null;
  }
}
