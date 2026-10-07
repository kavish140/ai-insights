import "@tanstack/react-start/server-only";
import { createClient } from "@supabase/supabase-js";
import sanitizeHtml from "sanitize-html";
import type { Post } from "./posts";
import { isBlogImageUrl } from "./blog-images";
import { SITE, categories } from "./posts";
import { EDITOR } from "./editorial";
import { normalizeSettings } from "./site-settings";
import type { ReaderPreferences, ReaderTag, TagAlias } from "./reader-preferences";

export async function readerVocabulary() {
  const client = publicClient();
  async function pages<T>(table: string, order: string) {
    const rows: T[] = [];
    for (let start = 0; ; start += 500) {
      const { data, error } = await client
        .from(table)
        .select("*")
        .order("kind")
        .order(order)
        .range(start, start + 499);
      if (error) throw new Error("Reader interests are unavailable.");
      rows.push(...(data as T[]));
      if (data.length < 500) return rows;
    }
  }
  const [tags, aliases] = await Promise.all([
    pages<ReaderTag>("reader_tags", "name"),
    pages<TagAlias>("reader_tag_aliases", "alias"),
  ]);
  return { tags, aliases };
}
export async function personalizedArticles(preferences: ReaderPreferences): Promise<Post[]> {
  const { data, error } = await publicClient().rpc("personalized_articles", {
    p_topics: preferences.topics,
    p_audiences: preferences.audiences,
  });
  if (error) throw new Error("Could not load personalized articles.");
  return ((data ?? []) as PostRow[]).map(toPost);
}

export async function loadSiteSettings(client = publicClient()) {
  const { data, error } = await client.from("site_settings").select("*").single();
  if (error && error.code !== "PGRST205") throw new Error("Could not load site settings.");
  return normalizeSettings(data);
}

export async function siteContent() {
  const client = publicClient();
  const [settings, topics] = await Promise.all([
    loadSiteSettings(client),
    client.from("categories").select("name").order("name"),
  ]);
  // Older deployments can serve their existing branding until the admin migration is applied.
  if (topics.error && topics.error.code !== "PGRST205")
    throw new Error("Could not load categories.");
  return {
    site: { ...SITE, ...settings },
    categories: topics.data?.map((topic) => topic.name) ?? [...categories],
    imageTransforms: process.env["SUPABASE_IMAGE_TRANSFORMS"] === "true",
  };
}

export function publicConfiguration() {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key)
    throw new Error("Supabase is not configured. Set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY.");
  if (key.startsWith("sb_secret_"))
    throw new Error("Use a Supabase publishable key, never a secret key.");
  // Legacy anon JWTs are supported, but service-role JWTs must never be returned.
  if (key.startsWith("eyJ")) {
    const payload = JSON.parse(atob(key.split(".")[1]!.replace(/-/g, "+").replace(/_/g, "/")));
    if (payload.role !== "anon") throw new Error("Use a publishable or anon key.");
  }
  return { url, key };
}

export function publicClient() {
  const { url, key } = publicConfiguration();
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

export function cleanBody(body: string) {
  return sanitizeHtml(body, {
    allowedTags: [
      "p",
      "h2",
      "h3",
      "h4",
      "ul",
      "ol",
      "li",
      "blockquote",
      "strong",
      "em",
      "a",
      "pre",
      "code",
      "br",
      "hr",
      "img",
      "figure",
      "figcaption",
    ],
    allowedAttributes: {
      a: ["href", "title", "rel"],
      img: ["src", "alt", "loading", "decoding"],
      h2: ["id"],
      h3: ["id"],
      h4: ["id"],
    },
    transformTags: {
      img: (_tag, attributes) => ({
        tagName: "img",
        attribs: {
          src: attributes["src"] ?? "",
          alt: attributes["alt"] ?? "",
          loading: "lazy",
          decoding: "async",
        },
      }),
    },
    exclusiveFilter: (frame) =>
      frame.tag === "img" &&
      (!isBlogImageUrl(frame.attribs["src"] ?? "") ||
        !frame.attribs["alt"]?.trim() ||
        frame.attribs["alt"].length > 300),
    allowedSchemes: ["http", "https", "mailto"],
    allowProtocolRelative: false,
  });
}

export async function publishedPosts(): Promise<Post[]> {
  const { data, error } = await publicClient()
    .from("article_catalog")
    // Selecting rows allows this build to work before the optional v2 columns exist.
    .select("*")
    .eq("status", "published")
    .lte("date", new Date().toISOString().slice(0, 10))
    .order("date", { ascending: false });
  if (error)
    throw new Error("Could not load articles. Check the Supabase migration and connection.");
  return (data ?? []).map(toPost);
}

const summaryColumns =
  "slug,title,description,category,date,updated_at,author,featured,reading_minutes,cover_image_url,cover_image_alt,tags,audience_tags,view_count";

type PostRow = {
  tags?: string[];
  audience_tags?: string[];
  view_count?: number;
  slug: string;
  title: string;
  description: string;
  category: string;
  date: string;
  updated_at?: string;
  author: string;
  featured?: boolean;
  reading_minutes: number;
  cover_image_url?: string | null;
  cover_image_alt?: string | null;
  body?: string;
};
export function toPost(row: PostRow): Post {
  return {
    slug: row.slug,
    title: row.title,
    description: row.description,
    category: row.category,
    tags: row.tags ?? [],
    audience_tags: row.audience_tags ?? [],
    views: Number(row.view_count ?? 0),
    date: row.date,
    updatedAt: row.updated_at ?? row.date,
    author: row.author === "AI Insights" ? EDITOR.name : row.author,
    featured: row.featured ?? false,
    readingMinutes: row.reading_minutes,
    cover_image_url: isBlogImageUrl(row.cover_image_url ?? "") ? (row.cover_image_url ?? "") : "",
    cover_image_alt: row.cover_image_alt ?? "",
    body: row.body ? cleanBody(row.body) : "",
  };
}

export type ArticleSearch = {
  q?: string | undefined;
  category?: string | undefined;
  tag?: string | undefined;
  audience?: string | undefined;
  sort?: "latest" | "oldest" | "shortest" | "popular" | undefined;
  page?: number | undefined;
};

export async function articlePage(input: ArticleSearch) {
  const settings = await loadSiteSettings();
  const pageSize = settings.articles_per_page;
  const page = input.page ?? 1;
  let query = publicClient()
    .from("article_catalog")
    .select(summaryColumns, { count: "exact" })
    .eq("status", "published")
    .lte("date", new Date().toISOString().slice(0, 10));
  if (input.category) query = query.eq("category", input.category);
  if (input.tag) {
    const resolved = await publicClient().rpc("resolve_reader_tags", {
      p_kind: "topic",
      p_names: [input.tag],
    });
    if (resolved.error) throw new Error("Could not resolve topic tag.");
    query = query.contains("tags", resolved.data);
  }
  if (input.audience) {
    const resolved = await publicClient().rpc("resolve_reader_tags", {
      p_kind: "audience",
      p_names: [input.audience],
    });
    if (resolved.error) throw new Error("Could not resolve audience tag.");
    query = query.contains("audience_tags", resolved.data);
  }
  // Escape PostgREST grammar and LIKE wildcards; the query is a literal phrase.
  const phrase = input.q?.replace(/[^\p{L}\p{N}\s-]/gu, " ").trim();
  if (phrase) query = query.or(`title.ilike.%${phrase}%,description.ilike.%${phrase}%`);
  query =
    input.sort === "popular"
      ? query.order("view_count", { ascending: false }).order("date", { ascending: false })
      : input.sort === "shortest"
        ? query.order("reading_minutes")
        : query.order("date", { ascending: input.sort === "oldest" });
  const { data, error, count } = await query
    .order("slug")
    .range((page - 1) * pageSize, page * pageSize - 1);
  if (error) throw new Error("Could not load articles. Please try again.");
  return { posts: (data ?? []).map(toPost), total: count ?? 0, page, pageSize };
}

export async function homeArticles() {
  const settings = await loadSiteSettings();
  const base = () =>
    publicClient()
      .from("article_catalog")
      .select(summaryColumns)
      .eq("status", "published")
      .lte("date", new Date().toISOString().slice(0, 10));
  const [latest, featured, ...path] = await Promise.all([
    base()
      .order("date", { ascending: false })
      .order("slug")
      .limit(settings.home_latest_count + 1),
    base().eq("featured", true).order("date", { ascending: false }).order("slug").limit(1),
    ...["Awareness", "Automation", "Strategy"].map((category) =>
      base().eq("category", category).order("date", { ascending: true }).order("slug").limit(1),
    ),
  ]);
  if ([latest, featured, ...path].some((result) => result.error))
    throw new Error("Could not load articles.");
  const lead = featured.data?.[0] ?? latest.data?.[0];
  return {
    settings,
    featured: lead ? toPost(lead) : null,
    latest: (latest.data ?? [])
      .filter((row) => row.slug !== lead?.slug)
      .slice(0, settings.home_latest_count)
      .map(toPost),
    path: path.map((result) => (result.data?.[0] ? toPost(result.data[0]) : null)),
  };
}

export async function articleBySlug(slug: string) {
  const base = () =>
    publicClient()
      .from("article_catalog")
      .select("*")
      .eq("status", "published")
      .lte("date", new Date().toISOString().slice(0, 10));
  const { data, error } = await base().eq("slug", slug).maybeSingle();
  if (error) throw new Error("Could not load this article.");
  if (!data) return null;
  const related = await publicClient().rpc("related_articles", { p_slug: slug });
  if (related.error) throw new Error("Could not load related articles.");
  return { post: toPost(data), related: ((related.data ?? []) as PostRow[]).map(toPost) };
}
