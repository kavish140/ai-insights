export type Post = {
  slug: string;
  title: string;
  description: string;
  category: string;
  date: string;
  readingMinutes: number;
  author: string;
  featured?: boolean;
  /** Simple HTML body. */
  body: string;
};

export const SITE = {
  name: "AI Insights",
  domain: "ai-insights.sitenova.dev",
  url: "https://ai-insights.sitenova.dev",
  tagline: "Practical AI automation, explained clearly",
  description:
    "Guides, breakdowns and honest opinions on AI automation, workflow tooling and staying aware of how AI changes work.",
};

export const categories = ["Automation", "Awareness", "Strategy"] as const;

export function formatDate(iso: string) {
  return new Date(iso + "T00:00:00Z").toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}
