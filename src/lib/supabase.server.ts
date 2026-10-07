import "@tanstack/react-start/server-only";
import { createClient } from "@supabase/supabase-js";
import sanitizeHtml from "sanitize-html";
import type { Post } from "./posts";
import { isBlogImageUrl } from "./blog-images";
import { SITE, categories } from "./posts";
import { EDITOR } from "./editorial";

export async function siteContent() {
  const client = publicClient();
  const [settings, topics] = await Promise.all([
    client.from("site_settings").select("name,tagline,description").single(),
    client.from("categories").select("name").order("name"),
  ]);
  // Older deployments can serve their existing branding until the admin migration is applied.
  if (settings.error && settings.error.code !== "PGRST205")
    throw new Error("Could not load site settings.");
  if (topics.error && topics.error.code !== "PGRST205")
    throw new Error("Could not load categories.");
  return {
    site: { ...SITE, ...settings.data },
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
    .from("posts")
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
  "slug,title,description,category,date,updated_at,author,featured,reading_minutes,cover_image_url,cover_image_alt";

type PostRow = {
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
  sort?: "latest" | "oldest" | "shortest" | undefined;
  page?: number | undefined;
};

export async function articlePage(input: ArticleSearch) {
  const page = input.page ?? 1;
  let query = publicClient()
    .from("posts")
    .select(summaryColumns, { count: "exact" })
    .eq("status", "published")
    .lte("date", new Date().toISOString().slice(0, 10));
  if (input.category) query = query.eq("category", input.category);
  // Escape PostgREST grammar and LIKE wildcards; the query is a literal phrase.
  const phrase = input.q?.replace(/[^\p{L}\p{N}\s-]/gu, " ").trim();
  if (phrase) query = query.or(`title.ilike.%${phrase}%,description.ilike.%${phrase}%`);
  query =
    input.sort === "shortest"
      ? query.order("reading_minutes")
      : query.order("date", { ascending: input.sort === "oldest" });
  const { data, error, count } = await query.order("slug").range((page - 1) * 12, page * 12 - 1);
  if (error) throw new Error("Could not load articles. Please try again.");
  return { posts: (data ?? []).map(toPost), total: count ?? 0, page };
}

export async function homeArticles() {
  const base = () =>
    publicClient()
      .from("posts")
      .select(summaryColumns)
      .eq("status", "published")
      .lte("date", new Date().toISOString().slice(0, 10));
  const [latest, featured, ...path] = await Promise.all([
    base().order("date", { ascending: false }).order("slug").limit(7),
    base().eq("featured", true).order("date", { ascending: false }).order("slug").limit(1),
    ...["Awareness", "Automation", "Strategy"].map((category) =>
      base().eq("category", category).order("date", { ascending: true }).order("slug").limit(1),
    ),
  ]);
  if ([latest, featured, ...path].some((result) => result.error))
    throw new Error("Could not load articles.");
  const lead = featured.data?.[0] ?? latest.data?.[0];
  return {
    featured: lead ? toPost(lead) : null,
    latest: (latest.data ?? [])
      .filter((row) => row.slug !== lead?.slug)
      .slice(0, 6)
      .map(toPost),
    path: path.map((result) => (result.data?.[0] ? toPost(result.data[0]) : null)),
  };
}

export async function articleBySlug(slug: string) {
  const base = () =>
    publicClient()
      .from("posts")
      .select("*")
      .eq("status", "published")
      .lte("date", new Date().toISOString().slice(0, 10));
  const { data, error } = await base().eq("slug", slug).maybeSingle();
  if (error) throw new Error("Could not load this article.");
  if (!data) return null;
  const related = await publicClient()
    .from("posts")
    .select(summaryColumns)
    .eq("status", "published")
    .lte("date", new Date().toISOString().slice(0, 10))
    .eq("category", data.category)
    .neq("slug", slug)
    .order("date", { ascending: false })
    .order("slug")
    .limit(3);
  if (related.error) throw new Error("Could not load related articles.");
  return { post: toPost(data), related: (related.data ?? []).map(toPost) };
}
