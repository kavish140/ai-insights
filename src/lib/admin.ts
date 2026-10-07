import { browserClient } from "./supabase-client";
import { categories, SITE } from "./posts";

export type Article = {
  id?: string;
  revision?: number;
  title: string;
  slug: string;
  description: string;
  category: string;
  author: string;
  date: string;
  body: string;
  featured: boolean;
  status: "draft" | "published";
  cover_image_url: string;
  cover_image_alt: string;
  created_at?: string;
  updated_at?: string;
};
export type Settings = {
  name: string;
  tagline: string;
  description: string;
  default_author: string;
};
export type Media = {
  path: string;
  url: string;
  alt: string;
  byte_size: number;
  mime_type: string;
  source_url: string;
  credit: string;
  license_note: string;
  created_at: string;
  width?: number | null;
  height?: number | null;
};
export const defaultSettings: Settings = {
  name: SITE.name,
  tagline: SITE.tagline,
  description: SITE.description,
  default_author: "AI Insights",
};
export const emptyArticle = (
  author = "AI Insights",
  category: string = categories[0],
): Article => ({
  title: "",
  slug: "",
  description: "",
  category,
  author,
  date: new Date().toISOString().slice(0, 10),
  body: "",
  featured: false,
  status: "draft",
  cover_image_url: "",
  cover_image_alt: "",
});
export const messageFor = (error: unknown) => {
  const details = error as { code?: string; message?: string };
  if (details.code === "23505") return "That name or web address already exists.";
  if (details.code === "23503")
    return "This category is still used by articles. Move them to another category first.";
  if (["PGRST202", "PGRST204", "PGRST205"].includes(details.code ?? ""))
    return "This feature needs the latest admin SQL migration. Apply it in the AI Insights database, then refresh.";
  return details.message ?? "The operation failed. Please try again.";
};

// Page through every row so totals, filters and image usage include more than the API row limit.
export async function allRows<T>(
  table: string,
  order: string,
  filter?: { column: string; value: string },
): Promise<T[]> {
  const client = await browserClient();
  const rows: T[] = [];
  for (let offset = 0; ; offset += 500) {
    let query = client
      .from(table)
      .select("*")
      .order(order)
      .range(offset, offset + 499);
    if (filter) query = query.eq(filter.column, filter.value);
    const { data, error } = await query;
    if (error) throw error;
    rows.push(...(data as T[]));
    if (data.length < 500) return rows;
  }
}

export async function saveArticle(article: Article) {
  const { id, revision } = article;
  const fields = {
    title: article.title.trim(),
    slug: article.slug,
    description: article.description.trim(),
    category: article.category,
    author: article.author.trim(),
    date: article.date,
    body: article.body,
    featured: article.featured,
    status: article.status,
    cover_image_url: article.cover_image_url,
    cover_image_alt: article.cover_image_alt.trim(),
  };
  const client = await browserClient();
  const record = {
    ...fields,
    reading_minutes: Math.max(
      1,
      Math.ceil(
        fields.body
          .replace(/<[^>]*>/g, " ")
          .trim()
          .split(/\s+/)
          .filter(Boolean).length / 200,
      ),
    ),
  };
  const query = id
    ? client.from("posts").update(record).eq("id", id).eq("revision", revision!)
    : client.from("posts").insert(record);
  const { data, error } = await query.select("*").maybeSingle();
  if (error) throw error;
  if (!data)
    throw new Error("This article changed or was removed. Reload before saving your corrections.");
  return data as Article;
}

export async function changeArticle(article: Article, action: "delete" | "draft" | "published") {
  const client = await browserClient();
  const query =
    action === "delete"
      ? client.from("posts").delete()
      : client.from("posts").update({ status: action });
  const { data, error } = await query
    .eq("id", article.id!)
    .eq("revision", article.revision!)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("This article changed or was removed. Refresh and try again.");
}

export function usedBy(image: Media, articles: Article[]) {
  return articles.filter(
    (article) => article.cover_image_url === image.url || article.body.includes(image.url),
  );
}

export async function uploadImage(
  file: File,
  details: Pick<Media, "alt" | "source_url" | "credit" | "license_note">,
) {
  if (!file.size || file.size > 4194304) throw new Error("Choose an image no larger than 4 MiB.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const starts = (...signature: number[]) =>
    signature.every((value, index) => bytes[index] === value);
  const format: [string, string] | null = starts(137, 80, 78, 71, 13, 10, 26, 10)
    ? ["png", "image/png"]
    : starts(255, 216, 255)
      ? ["jpg", "image/jpeg"]
      : new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" &&
          new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP"
        ? ["webp", "image/webp"]
        : null;
  if (!format) throw new Error("Choose a PNG, JPEG or WebP image.");
  const bitmap = await createImageBitmap(new Blob([bytes], { type: format[1] })).catch(() => {
    throw new Error("The image cannot be decoded. Choose a valid PNG, JPEG or WebP file.");
  });
  const dimensions = { width: bitmap.width, height: bitmap.height };
  bitmap.close();
  const hash = [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
  const path = `articles/${hash}.${format[0]}`;
  const client = await browserClient();
  const { data: existing, error: lookupError } = await client
    .from("blog_images")
    .select("path")
    .eq("path", path)
    .maybeSingle();
  if (lookupError) throw lookupError;
  if (existing) return;
  const { error: uploadError } = await client.storage
    .from("blog-images")
    .upload(path, bytes, { contentType: format[1], upsert: false });
  if (uploadError && !("statusCode" in uploadError && String(uploadError.statusCode) === "409"))
    throw uploadError;
  const {
    data: { publicUrl },
  } = client.storage.from("blog-images").getPublicUrl(path);
  const { error } = await client.from("blog_images").insert({
    ...details,
    path,
    url: publicUrl,
    sha256: hash,
    byte_size: file.size,
    mime_type: format[1],
    ...dimensions,
  });
  if (error) throw error;
}

export async function adminToken() {
  const { data, error } = await (await browserClient()).auth.getSession();
  if (error || !data.session) throw new Error("Sign in again to continue.");
  return data.session.access_token;
}

export async function duplicateArticle(article: Article) {
  const copy = {
    ...article,
    title: `${article.title.slice(0, 190)} (copy)`,
    slug: `${article.slug.slice(0, 180).replace(/-$/, "")}-copy-${crypto.randomUUID().slice(0, 8)}`,
    status: "draft" as const,
    featured: false,
    date: new Date().toISOString().slice(0, 10),
  };
  delete copy.id;
  delete copy.revision;
  return saveArticle(copy);
}
