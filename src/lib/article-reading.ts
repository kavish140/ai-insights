import type { Post } from "./posts";

const plain = (html: string) =>
  html
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .trim();

/** Input is sanitized server-side. Deterministic anchors avoid duplicate heading IDs. */
export function articleOutline(body: string) {
  const headings: { id: string; title: string; level: number }[] = [];
  const html = body.replace(/<h([234])(?:\s[^>]*)?>([\s\S]*?)<\/h\1>/gi, (_match, level, text) => {
    const id = `section-${headings.length + 1}`;
    headings.push({ id, title: plain(text), level: Number(level) });
    return `<h${level} id="${id}">${text}</h${level}>`;
  });
  return { html, headings };
}

export function articleTakeaways(body: string) {
  // Only surface points the author explicitly placed under a summary heading.
  const section = body.match(
    /<h[234](?:\s[^>]*)?>\s*(?:Key takeaways|Takeaways|The takeaway|At a glance|Summary)\s*<\/h[234]>([\s\S]*?)(?=<h[234]|$)/i,
  )?.[1];
  if (!section) return [];
  const bullets = [...section.matchAll(/<li(?:\s[^>]*)?>([\s\S]*?)<\/li>/gi)]
    .slice(0, 5)
    .map((match) => plain(match[1]!));
  if (bullets.length) return bullets;
  const paragraph = section.match(/<p(?:\s[^>]*)?>([\s\S]*?)<\/p>/i)?.[1];
  return paragraph ? [plain(paragraph)] : [];
}

export function checklistText(post: Pick<Post, "title" | "slug">) {
  return `AI Insights — Workflow launch checklist\n\nCompanion to: ${post.title}\nhttps://ai-insights.sitenova.dev/blog/${post.slug}\n\n[ ] Define the task, owner and expected result.\n[ ] Record the current time and cost as a baseline.\n[ ] Check what data the tools will receive.\n[ ] Use sample data before connecting production systems.\n[ ] Define what requires human approval.\n[ ] Test success, failure and retry behavior.\n[ ] Keep an audit trail and a manual fallback.\n[ ] Measure time saved and review output quality.\n\nThis is a general implementation checklist; adapt it to your workflow.\n`;
}
