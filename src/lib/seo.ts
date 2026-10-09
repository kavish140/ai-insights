import { SITE, type Post } from "./posts";
import { EDITOR } from "./editorial";

export const INDEX_ROBOTS =
  "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1";
export const ORGANIZATION_ID = `${SITE.url}/#organization`;
export const WEBSITE_ID = `${SITE.url}/#website`;
export const AUTHOR_ID = `${SITE.url}/about#author`;

// JSON in an HTML script must not allow article text to close the script element.
export function jsonLd(value: unknown) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

export const topicDescriptions: Record<string, string> = {
  Automation:
    "Learn AI automation with practical workflow guides, agent explainers and repeatable steps for reducing everyday manual work.",
  Awareness:
    "Understand AI privacy, misinformation and risks with clear explanations that help you make informed decisions at work and online.",
  Strategy:
    "Plan AI adoption, choose useful workflows and measure automation ROI with practical frameworks for teams and small businesses.",
};

export type ListingSearch = {
  category?: string | undefined;
  q?: string | undefined;
  tag?: string | undefined;
  audience?: string | undefined;
  sort?: string | undefined;
  page?: number | undefined;
};

export function listingSeo(search: ListingSearch, empty = false) {
  const page = search.page ?? 1;
  const heading = search.category
    ? `${search.category} articles`
    : "AI automation & awareness articles";
  const title = `${search.category ? `AI ${search.category} Guides` : "AI Automation & Awareness Guides"}${page > 1 ? ` — Page ${page}` : ""} | ${SITE.name}`;
  const description = search.category
    ? Object.prototype.hasOwnProperty.call(topicDescriptions, search.category)
      ? topicDescriptions[search.category]!
      : `Explore ${search.category} articles, practical AI guides and clear explanations from ${SITE.name}.`
    : "Explore practical AI automation guides, agent and workflow explainers, privacy awareness and frameworks for measuring AI adoption ROI.";
  const params = new URLSearchParams();
  if (search.category) params.set("category", search.category);
  if (search.q) params.set("q", search.q);
  if (search.tag) params.set("tag", search.tag);
  if (search.audience) params.set("audience", search.audience);
  if (search.sort && search.sort !== "latest") params.set("sort", search.sort);
  if (page > 1) params.set("page", String(page));
  const path = `/blog${params.size ? `?${params}` : ""}`;
  const noindex =
    empty ||
    Boolean(search.q || search.tag || search.audience || (search.sort && search.sort !== "latest"));
  return {
    heading,
    title,
    description,
    path,
    canonical: SITE.url + path,
    robots: noindex ? "noindex, follow" : INDEX_ROBOTS,
  };
}

export function articleSchema(post: Post) {
  const url = `${SITE.url}/blog/${encodeURIComponent(post.slug)}`;
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "@id": `${url}#article`,
    url,
    headline: post.title,
    description: post.description,
    inLanguage: "en",
    isAccessibleForFree: true,
    keywords: post.tags ?? [],
    articleSection: post.category,
    about: (post.tags ?? []).map((name) => ({ "@type": "Thing", name })),
    audience: (post.audience_tags ?? []).map((audienceType) => ({
      "@type": "Audience",
      audienceType,
    })),
    datePublished: post.date,
    dateModified: post.updatedAt || post.date,
    author: {
      "@type": "Person",
      name: post.author,
      ...(post.author === EDITOR.name ? { "@id": AUTHOR_ID, url: `${SITE.url}/about` } : {}),
    },
    publisher: {
      "@type": "Organization",
      "@id": ORGANIZATION_ID,
      url: SITE.url,
    },
    isPartOf: { "@id": WEBSITE_ID },
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    // An article image must represent the article, rather than a generic site banner.
    ...(post.cover_image_url ? { image: [post.cover_image_url] } : {}),
  };
}

export type SitemapEntry = {
  path: string;
  modified?: string | undefined;
  image?: string | undefined;
};
export const xmlEscape = (value: string) =>
  value.replace(
    /[<>&"']/g,
    (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[c]!,
  );

export function sitemapEntries(posts: Post[]): SitemapEntry[] {
  return [
    ...["/", "/blog", "/about", "/contact", "/privacy"].map((path) => ({ path })),
    ...[...new Set(posts.map((post) => post.category))]
      .filter(Boolean)
      .sort()
      .map((category) => ({ path: listingSeo({ category }).path })),
    ...posts.map((post) => ({
      path: `/blog/${encodeURIComponent(post.slug)}`,
      modified: post.updatedAt || post.date,
      image: post.cover_image_url,
    })),
  ];
}

export function sitemapXml(entries: SitemapEntry[]) {
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">${entries
    .map((entry) => {
      const modified =
        entry.modified &&
        /^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(entry.modified) &&
        Number.isFinite(Date.parse(entry.modified))
          ? `<lastmod>${xmlEscape(entry.modified)}</lastmod>`
          : "";
      const image = entry.image
        ? `<image:image><image:loc>${xmlEscape(entry.image)}</image:loc></image:image>`
        : "";
      return `<url><loc>${xmlEscape(SITE.url + entry.path)}</loc>${modified}${image}</url>`;
    })
    .join("")}</urlset>`;
}
