import sanitizeHtml from "sanitize-html";
import { checkableUrl, type ContentScan, type LinkCheck } from "./content-health";
export async function inspectContent(
  posts: { id: string; title: string; body: string; cover_image_url: string }[],
  siteUrl: string,
  fetcher: typeof fetch = fetch,
): Promise<ContentScan> {
  const articles = posts.map((post) => {
    const urls = new Set<string>();
    if (post.cover_image_url) urls.add(post.cover_image_url);
    sanitizeHtml(post.body, {
      allowedTags: ["a", "img"],
      allowedAttributes: { a: ["href"], img: ["src"] },
      transformTags: {
        "*": (tag, attrs) => {
          const value = tag === "a" ? attrs["href"] : attrs["src"];
          if (value && !value.startsWith("#") && !value.startsWith("mailto:")) urls.add(value);
          return { tagName: tag, attribs: attrs };
        },
      },
    });
    return {
      postId: post.id as string,
      title: post.title as string,
      urls: [...urls],
      links: [] as LinkCheck[],
    };
  });
  const distinct = [...new Set(articles.flatMap((article) => article.urls))].slice(0, 40);
  const checks = new Map<string, LinkCheck>();
  // Fixed trusted HTTPS hosts; no redirects or fetching arbitrary article-supplied hosts.
  for (let start = 0; start < distinct.length; start += 4) {
    await Promise.all(
      distinct.slice(start, start + 4).map(async (value) => {
        const url = checkableUrl(value, siteUrl);
        if (!url) {
          checks.set(value, {
            url: value,
            status: null,
            outcome: "review",
            detail: "Host or URL requires manual review.",
          });
          return;
        }
        try {
          const response = await fetcher(url, {
            method: "HEAD",
            redirect: "manual",
            signal: AbortSignal.timeout(5000),
          });
          const status = response.status;
          checks.set(value, {
            url: value,
            status,
            outcome: status === 404 || status === 410 ? "broken" : response.ok ? "ok" : "review",
            detail: response.ok
              ? "Responded successfully"
              : status >= 300 && status < 400
                ? "Redirect needs review"
                : "Host may block automated checks; review manually",
          });
        } catch {
          checks.set(value, {
            url: value,
            status: null,
            outcome: "unreachable",
            detail: "No response within the scan timeout; review manually.",
          });
        }
      }),
    );
  }
  const result: ContentScan = {
    checkedAt: new Date().toISOString(),
    articles: articles.map((article) => ({
      postId: article.postId,
      title: article.title,
      links: article.urls.filter((url) => checks.has(url)).map((url) => checks.get(url)!),
      truncated: article.urls.some((url) => !checks.has(url)),
    })),
  };
  return result;
}
