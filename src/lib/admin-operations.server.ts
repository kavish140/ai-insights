import "@tanstack/react-start/server-only";
import { createClient } from "@supabase/supabase-js";
import { publicConfiguration } from "./supabase.server";
import { cleanBody } from "./supabase.server";
import { SITE } from "./posts";
import sanitizeHtml from "sanitize-html";
import type { ContentScan } from "./content-health";
import { inspectContent } from "./content-scanner.server";

const endpoint = "https://gutvbukqlqutjwlbmfpr.supabase.co/functions/v1/blog-mcp";
export async function adminClient(token: string) {
  const { url, key } = publicConfiguration();
  const client = createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) throw new Error("Sign in again to continue.");
  const { data: access, error: accessError } = await client.rpc("admin_access");
  if (accessError || !access) throw new Error("Admin access is required.");
  return client;
}

export async function probe(token: string) {
  const client = await adminClient(token);
  const started = Date.now();
  try {
    const response = await fetch(`${endpoint}/health`, { signal: AbortSignal.timeout(10000) });
    const result = (await response.json()) as {
      version?: string;
      database?: string;
      activity_tracking?: boolean;
      controls_available?: boolean;
      paused?: boolean | null;
    };
    return saveHealth(client, {
      online: response.ok,
      latency: Date.now() - started,
      version: result.version ?? "unknown",
      database: result.database ?? "not reported",
      tracking: !!result.activity_tracking,
      controls: !!result.controls_available,
      paused: result.paused ?? null,
      checkedAt: new Date().toISOString(),
      error: response.ok ? "" : `Health returned HTTP ${response.status}`,
    });
  } catch {
    return saveHealth(client, {
      online: false,
      latency: Date.now() - started,
      version: "unknown",
      database: "unknown",
      tracking: false,
      controls: false,
      paused: null,
      checkedAt: new Date().toISOString(),
      error: "The MCP health endpoint did not respond.",
    });
  }
}

async function saveHealth(
  client: Awaited<ReturnType<typeof adminClient>>,
  result: {
    online: boolean;
    latency: number;
    version: string;
    database: string;
    tracking: boolean;
    controls: boolean;
    paused: boolean | null;
    checkedAt: string;
    error: string;
  },
) {
  const { error } = await client.from("admin_checks").insert({ kind: "health", result });
  return { ...result, saved: !error };
}

export async function scan(token: string, postIds: string[]): Promise<ContentScan> {
  const client = await adminClient(token);
  const { error: checksError } = await client.from("admin_checks").select("id").limit(1);
  if (checksError)
    throw new Error("Apply the Top admin migration before running saved content scans.");
  const { data: posts, error } = await client
    .from("posts")
    .select("id,title,body,cover_image_url")
    .in("id", postIds);
  if (error) throw new Error("Could not load articles for the scan.");
  const result = await inspectContent(posts ?? [], SITE.url);
  const { error: saveError } = await client
    .from("admin_checks")
    .insert({ kind: "content", result });
  if (saveError)
    throw new Error(
      "Scan completed but could not be saved. Apply the Top admin migration and retry.",
    );
  return result;
}

export async function retry(token: string, id: string) {
  const client = await adminClient(token);
  const { data: operation, error } = await client
    .from("mcp_operations")
    .select("tool,arguments,outcome")
    .eq("id", id)
    .single();
  if (error || !operation) throw new Error("Could not load the saved operation.");
  if (
    operation.outcome !== "failed" ||
    ![
      "create_draft",
      "update_draft",
      "publish_post",
      "unpublish_post",
      "import_image_url",
    ].includes(operation.tool)
  )
    throw new Error("This operation cannot be retried here.");
  // Original UUID and expected revision preserve idempotency and stale-edit protection.
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json, text/event-stream" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: crypto.randomUUID(),
      method: "tools/call",
      params: { name: operation.tool, arguments: operation.arguments },
    }),
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error(`MCP returned HTTP ${response.status}.`);
  const text = await response.text();
  const payload = JSON.parse(
    text.startsWith("event:") || text.startsWith("data:")
      ? text
          .split("\n")
          .find((line) => line.startsWith("data:"))!
          .slice(5)
          .trim()
      : text,
  );
  if (payload.error || payload.result?.isError)
    throw new Error(
      payload.error?.message ?? payload.result?.content?.[0]?.text ?? "Retry failed.",
    );
  return { success: true };
}

export async function preview(token: string, body: string) {
  await adminClient(token);
  return { body: cleanBody(body) };
}

export async function inspectSeo(token: string, slug?: string) {
  await adminClient(token);
  const url = `${SITE.url}${slug ? `/blog/${slug}` : "/sitemap.xml"}`;
  const response = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(10000) });
  const html = await response.text();
  if (!slug)
    return {
      url,
      status: response.status,
      sitemap: response.ok && /<urlset[\s>]/.test(html),
      canonical: "",
      structuredData: false,
    };
  let canonical = "";
  sanitizeHtml(html, {
    allowedTags: ["link"],
    allowedAttributes: { link: ["rel", "href"] },
    transformTags: {
      link: (tag, attributes) => {
        if (attributes["rel"] === "canonical") canonical = attributes["href"] ?? "";
        return { tagName: tag, attribs: attributes };
      },
    },
  });
  const structuredData = [
    ...html.matchAll(
      /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
    ),
  ].some((match) => {
    try {
      const value = JSON.parse(match[1]!);
      return value["@type"] === "BlogPosting" && value["mainEntityOfPage"]?.["@id"] === url;
    } catch {
      return false;
    }
  });
  return { url, status: response.status, sitemap: false, canonical, structuredData };
}
