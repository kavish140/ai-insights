import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import { crawlPosts } from "./lib/supabase.server";
import { SITE } from "./lib/posts";
import { sitemapEntries, sitemapXml, xmlEscape } from "./lib/seo";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const url = new URL(request.url);
      if (
        (request.method === "GET" || request.method === "HEAD") &&
        url.pathname !== "/" &&
        /\/$/.test(url.pathname)
      ) {
        url.pathname = url.pathname.replace(/\/+$/, "");
        return new Response(null, { status: 301, headers: { location: url.href } });
      }
      const shard = url.pathname.match(/^\/sitemaps\/(\d+)\.xml$/);
      if (url.pathname === "/sitemap.xml" || shard) {
        const entries = sitemapEntries(await crawlPosts());
        const shardSize = 5000;
        const shardCount = Math.ceil(entries.length / shardSize);
        const index = shard ? Number(shard[1]) : 0;
        if (shard && (!Number.isSafeInteger(index) || index < 1 || index > shardCount)) {
          return new Response("Sitemap not found", {
            status: 404,
            headers: { "x-robots-tag": "noindex" },
          });
        }
        const xml =
          !shard && entries.length > shardSize
            ? `<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${Array.from({ length: shardCount }, (_, i) => `<sitemap><loc>${xmlEscape(`${SITE.url}/sitemaps/${i + 1}.xml`)}</loc></sitemap>`).join("")}</sitemapindex>`
            : sitemapXml(
                shard ? entries.slice((index - 1) * shardSize, index * shardSize) : entries,
              );
        return new Response(xml, {
          headers: {
            "content-type": "application/xml; charset=utf-8",
            "cache-control": "public, max-age=300",
          },
        });
      }
      const handler = await getServerEntry();
      const response = await normalizeCatastrophicSsrResponse(
        await handler.fetch(request, env, ctx),
      );
      if (
        response.status >= 400 ||
        url.pathname === "/admin" ||
        url.pathname.startsWith("/admin/")
      ) {
        const headers = new Headers(response.headers);
        headers.set("x-robots-tag", "noindex, nofollow");
        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers,
        });
      }
      return response;
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8", "x-robots-tag": "noindex" },
      });
    }
  },
};
