import "@tanstack/react-start/server-only";
import { createClient } from "@supabase/supabase-js";
import sanitizeHtml from "sanitize-html";
import type { Post } from "./posts";

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
    ],
    allowedAttributes: { a: ["href", "title", "rel"] },
    allowedSchemes: ["http", "https", "mailto"],
    allowProtocolRelative: false,
  });
}

export async function publishedPosts(): Promise<Post[]> {
  const { data, error } = await publicClient()
    .from("posts")
    .select("slug,title,description,category,date,reading_minutes,author,featured,body")
    .eq("status", "published")
    .lte("date", new Date().toISOString().slice(0, 10))
    .order("date", { ascending: false });
  if (error)
    throw new Error("Could not load articles. Check the Supabase migration and connection.");
  return (data ?? []).map((row) => ({
    ...row,
    readingMinutes: row.reading_minutes,
    body: cleanBody(row.body),
  }));
}
