import { createServer } from "node:http";
import { spawn } from "node:child_process";
import assert from "node:assert/strict";

// Exercise the production Worker with a local Supabase API fixture, without changing real data.
const imageUrl = `https://gutvbukqlqutjwlbmfpr.supabase.co/storage/v1/object/public/blog-images/articles/${"a".repeat(64)}.png`;
const article = {
  slug: "ssr-check",
  title: "SSR test article",
  description: "An article rendered by the server.",
  category: "Automation",
  tags: ["workflows"],
  audience_tags: ["beginners"],
  view_count: 42,
  date: "2026-10-05",
  updated_at: "2026-10-06T00:00:00Z",
  reading_minutes: 2,
  author: "AI Insights",
  featured: true,
  cover_image_url: imageUrl,
  cover_image_alt: "SSR cover image",
  body: `<p>Visible without JavaScript.</p><script>unsafe_marker</script><p onclick="unsafe_marker()">Safe paragraph.</p><a href="javascript:unsafe_marker()">Link</a><figure><img src="${imageUrl}" alt="SSR inline image" onerror="unsafe_marker()"><figcaption>SSR image caption</figcaption></figure><img src="https://evil.example/unsafe_marker.png" alt="Unsafe image">`,
};
article.body =
  "<h2>Key takeaways</h2><ul><li>Test with sample data.</li></ul><h2>Workflow steps</h2>" +
  article.body;
let customSettings = false;
let expanded = false;
let empty = false;
let coverEnabled = true;
let queries = 0;
const database = createServer((request, response) => {
  response.setHeader("access-control-allow-origin", "http://127.0.0.1:8787");
  response.setHeader(
    "access-control-allow-headers",
    "authorization, apikey, content-type, x-client-info",
  );
  response.setHeader("access-control-allow-methods", "GET, POST, OPTIONS");
  if (request.method === "OPTIONS") {
    response.setHeader(
      "access-control-allow-headers",
      request.headers["access-control-request-headers"] || "content-type",
    );
    response.writeHead(204);
    response.end();
    return;
  }
  const url = new URL(request.url, "http://localhost");
  if (url.pathname === "/rest/v1/reader_tags" || url.pathname === "/rest/v1/reader_tag_aliases") {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(
      JSON.stringify(
        url.pathname.endsWith("reader_tags")
          ? [
              { kind: "topic", name: "workflows" },
              { kind: "audience", name: "beginners" },
            ]
          : [],
      ),
    );
    return;
  }
  if (url.pathname === "/rest/v1/rpc/resolve_reader_tags") {
    let body = "";
    request.on("data", (chunk) => (body += chunk));
    request.on("end", () => {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify(JSON.parse(body).p_names));
    });
    return;
  }
  if (url.pathname === "/rest/v1/rpc/personalized_articles") {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify(empty ? [] : [article]));
    return;
  }
  if (
    ["record_article_read", "record_article_quality", "record_recommendation"].some(
      (rpc) => url.pathname === `/rest/v1/rpc/${rpc}`,
    )
  ) {
    response.writeHead(200, { "content-type": "application/json" });
    response.end("null");
    return;
  }
  if (url.pathname === "/rest/v1/site_settings") {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(
      JSON.stringify({
        ...(customSettings
          ? {
              brand_initials: "CI",
              header_cta_label: "Explore guides",
              home_title: "Custom home heading",
              home_seo_title: "Custom SEO title",
              home_seo_description: "Custom SEO description",
              articles_per_page: 6,
              home_latest_count: 2,
              show_reading_path: false,
              show_house_ads: false,
              newsletter_enabled: false,
              contact_form_enabled: false,
              contact_email: "editor@example.com",
              footer_note: "Custom footer note",
              linkedin_url: "https://www.linkedin.com/company/example",
            }
          : {}),
        name: "Configured Insights",
        tagline: "Practical AI automation, explained clearly",
        description: "An article rendered by the server.",
      }),
    );
    return;
  }
  if (url.pathname === "/rest/v1/categories") {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(
      JSON.stringify([
        { name: "Automation" },
        { name: "Awareness" },
        { name: "Strategy" },
        { name: "Custom topic" },
      ]),
    );
    return;
  }
  if (url.pathname === "/rest/v1/rpc/related_articles") {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify([]));
    return;
  }
  if (url.pathname !== "/rest/v1/article_catalog") {
    response.writeHead(404).end();
    return;
  }
  assert.equal(request.headers.apikey, "test-publishable-key");
  assert.equal(url.searchParams.get("status"), "eq.published");
  assert.match(url.searchParams.get("date"), /^lte\.\d{4}-\d{2}-\d{2}$/);
  queries++;
  let rows = empty
    ? []
    : [
        {
          ...article,
          cover_image_url: coverEnabled ? imageUrl : "",
          cover_image_alt: coverEnabled ? article.cover_image_alt : "",
        },
      ];
  if (expanded && !empty)
    rows.push(
      ...Array.from({ length: 26 }, (_, index) => ({
        ...article,
        slug: `guide-${index}`,
        title: `Guide ${index}`,
        category: index % 2 ? "Awareness" : "Automation",
        featured: false,
        reading_minutes: index + 1,
        view_count: index,
      })),
    );
  for (const field of ["slug", "category", "featured"]) {
    const filter = url.searchParams.get(field);
    if (filter?.startsWith("eq."))
      rows = rows.filter((row) => String(row[field]) === filter.slice(3));
    if (filter?.startsWith("neq."))
      rows = rows.filter((row) => String(row[field]) !== filter.slice(4));
  }
  for (const field of ["tags", "audience_tags"]) {
    const filter = url.searchParams.get(field);
    if (filter?.startsWith("cs."))
      rows = rows.filter((row) => row[field]?.includes(filter.slice(4, -1).replaceAll('"', "")));
  }
  const phrase = url.searchParams.get("or")?.match(/title\.ilike\.%([^%]+)%/)?.[1];
  if (phrase)
    rows = rows.filter((row) =>
      `${row.title} ${row.description}`.toLowerCase().includes(phrase.toLowerCase()),
    );
  const order = url.searchParams.get("order") ?? "date.desc";
  if (order.startsWith("view_count")) rows.sort((a, b) => b.view_count - a.view_count);
  else if (order.startsWith("reading_minutes"))
    rows.sort((a, b) => a.reading_minutes - b.reading_minutes);
  else
    rows.sort(
      (a, b) =>
        (order.startsWith("date.asc")
          ? a.date.localeCompare(b.date)
          : b.date.localeCompare(a.date)) || a.slug.localeCompare(b.slug),
    );
  const total = rows.length;
  const offset = Number(url.searchParams.get("offset") ?? 0);
  const limit = Number(url.searchParams.get("limit") ?? total);
  rows = rows.slice(offset, offset + limit);
  if (url.searchParams.get("select") !== "*")
    rows = rows.map((row) =>
      Object.fromEntries(Object.entries(row).filter(([key]) => key !== "body")),
    );
  response.writeHead(200, {
    "content-type": "application/json",
    "content-range": `${offset}-${offset + rows.length - 1}/${total}`,
  });
  response.end(JSON.stringify(rows));
});
await new Promise((resolve) => database.listen(54322, "127.0.0.1", resolve));
const worker = spawn(
  process.execPath,
  [
    "node_modules/wrangler/bin/wrangler.js",
    "dev",
    "--config",
    ".output/server/wrangler.json",
    "--local",
    "--ip",
    "127.0.0.1",
    "--port",
    "8787",
    "--var",
    "SUPABASE_URL:http://127.0.0.1:54322",
    "--var",
    "SUPABASE_PUBLISHABLE_KEY:test-publishable-key",
  ],
  { stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, WRANGLER_SEND_METRICS: "false" } },
);
let logs = "";
worker.stdout.on("data", (chunk) => {
  logs += chunk;
});
worker.stderr.on("data", (chunk) => {
  logs += chunk;
});
try {
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (worker.exitCode !== null) throw new Error(logs);
    try {
      await fetch("http://127.0.0.1:8787/about");
      ready = true;
      break;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }
  assert.ok(ready, logs);
  function metaContent(html, attribute, key) {
    const tags = [...html.matchAll(/<meta\b[^>]*>/g)]
      .map((match) => match[0])
      .filter((tag) => tag.includes(`${attribute}="${key}"`));
    assert.equal(tags.length, 1, `Expected exactly one ${key} tag`);
    return tags[0].match(/content="([^"]*)"/)?.[1];
  }
  for (const path of ["/", "/blog", "/about", "/contact", "/privacy", "/blog/ssr-check"]) {
    const response = await fetch(`http://127.0.0.1:8787${path}`);
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.ok(html.includes("Configured Insights"), "Public branding uses persisted settings");
    assert.ok(html.includes("Custom topic"), "Managed categories appear on public pages");
    assert.ok(metaContent(html, "property", "og:title"));
    assert.ok(metaContent(html, "property", "og:description"));
    assert.equal(
      metaContent(html, "property", "og:url"),
      `https://ai-insights.sitenova.dev${path}`,
    );
    assert.equal(
      metaContent(html, "property", "og:type"),
      path === "/blog/ssr-check" ? "article" : "website",
    );
    assert.equal(metaContent(html, "name", "twitter:card"), "summary_large_image");
    assert.equal(
      metaContent(html, "name", "twitter:title"),
      metaContent(html, "property", "og:title"),
    );
    assert.equal(
      metaContent(html, "name", "twitter:description"),
      metaContent(html, "property", "og:description"),
    );
    assert.equal(
      metaContent(html, "name", "twitter:image"),
      metaContent(html, "property", "og:image"),
    );
    assert.ok(metaContent(html, "property", "og:image:alt"));
    if (path === "/blog/ssr-check") {
      assert.equal(metaContent(html, "property", "og:image"), imageUrl);
      assert.equal(metaContent(html, "property", "og:image:type"), "image/png");
      assert.equal(metaContent(html, "property", "article:modified_time"), article.updated_at);
      assert.ok(
        !html.includes('property="og:image:width"'),
        "Do not invent dimensions for uploaded covers",
      );
    } else {
      assert.equal(
        metaContent(html, "property", "og:image"),
        "https://ai-insights.sitenova.dev/images/og-cover.jpg",
      );
      assert.equal(metaContent(html, "property", "og:image:width"), "1200");
      assert.equal(metaContent(html, "property", "og:image:height"), "640");
    }
  }
  for (const path of ["/", "/blog", "/blog/ssr-check"]) {
    const response = await fetch(`http://127.0.0.1:8787${path}`);
    assert.equal(response.status, 200, `${path}: ${await response.clone().text()}`);
    const html = await response.text();
    assert.ok(html.includes("SSR test article"), `${path} did not server-render the article`);
    assert.ok(!html.includes("unsafe_marker"), "Unsafe HTML reached the response");
    if (path === "/blog/ssr-check") {
      assert.ok(html.includes("Visible without JavaScript."));
      assert.ok(html.includes("BlogPosting"));
      assert.ok(html.includes("workflows"));
      assert.ok(html.includes("beginners"));
      assert.ok(html.includes("audienceType"));
      assert.ok(html.includes('rel="canonical"'));
      assert.ok(html.includes('alt="SSR cover image"'));
      assert.ok(html.includes('alt="SSR inline image"'));
      assert.ok(html.includes("SSR image caption"));
      assert.ok(html.includes('id="section-1"'));
      assert.ok(html.includes('aria-label="On this page"'));
      assert.ok(html.includes("Updated"));
      assert.ok(html.includes("Download workflow checklist"));
      assert.ok(html.includes('property="og:image" content="' + imageUrl + '"'));
    }
  }
  const sitemap = await fetch("http://127.0.0.1:8787/sitemap.xml");
  assert.equal(sitemap.status, 200);
  assert.ok((await sitemap.text()).includes("/blog/ssr-check"));
  assert.equal((await fetch("http://127.0.0.1:8787/blog/unknown")).status, 404);
  assert.equal((await fetch("http://127.0.0.1:8787/admin")).status, 200);
  coverEnabled = false;
  const withoutCover = await fetch("http://127.0.0.1:8787/blog/ssr-check");
  const fallbackHtml = await withoutCover.text();
  assert.equal(
    metaContent(fallbackHtml, "property", "og:image"),
    "https://ai-insights.sitenova.dev/images/og-cover.jpg",
  );
  assert.equal(metaContent(fallbackHtml, "property", "og:image:width"), "1200");
  const contact = await (await fetch("http://127.0.0.1:8787/contact")).text();
  assert.ok(contact.includes("contact form is temporarily unavailable"));
  assert.ok(!contact.includes("message received"));
  expanded = true;
  const firstPage = await (await fetch("http://127.0.0.1:8787/blog")).text();
  assert.equal([...firstPage.matchAll(/aria-label="Read /g)].length, 12);
  assert.ok(firstPage.replace(/<!--.*?-->/g, "").includes("Page 1 of 3"));
  const thirdPage = await (await fetch("http://127.0.0.1:8787/blog?page=3")).text();
  assert.equal([...thirdPage.matchAll(/aria-label="Read /g)].length, 3);
  const filtered = await (
    await fetch("http://127.0.0.1:8787/blog?category=Awareness&q=Guide%201&sort=shortest")
  ).text();
  assert.ok(filtered.includes("Guide 11"));
  assert.ok(!filtered.includes('aria-label="Read SSR test article"'));
  const tagged = await (
    await fetch("http://127.0.0.1:8787/blog?tag=workflows&audience=beginners&sort=popular")
  ).text();
  assert.equal([...tagged.matchAll(/aria-label="Read /g)].length, 12);
  assert.ok(
    tagged.indexOf('aria-label="Read SSR test article"') <
      tagged.indexOf('aria-label="Read Guide 25"'),
  );
  const noTag = await (await fetch("http://127.0.0.1:8787/blog?tag=unknown-topic")).text();
  assert.ok(noTag.includes("No articles match these filters"));
  const faviconPage = await (await fetch("http://127.0.0.1:8787/")).text();
  assert.ok(faviconPage.includes('href="/favicon.png"'));
  const icon = await fetch("http://127.0.0.1:8787/favicon.png");
  assert.equal(icon.status, 200);
  assert.ok(icon.headers.get("content-type").includes("image/png"));
  const noMatch = await (await fetch("http://127.0.0.1:8787/blog?q=notfound")).text();
  assert.ok(noMatch.includes("No articles match these filters"));
  const homepage = await (await fetch("http://127.0.0.1:8787/")).text();
  assert.ok(homepage.includes("Reading for you"));
  assert.ok(homepage.includes("Choose interests"));
  const qualityArticle = await (await fetch("http://127.0.0.1:8787/blog/ssr-check")).text();
  assert.ok(qualityArticle.includes("Was this article helpful?"));
  assert.ok(qualityArticle.includes("data-article-body"));
  assert.ok(homepage.indexOf("Featured") < homepage.indexOf("Advertisement"));
  assert.ok(homepage.includes("start-here"));
  assert.equal([...homepage.matchAll(/aria-label="Read /g)].length, 7);
  customSettings = true;
  const configuredHome = await (await fetch("http://127.0.0.1:8787/")).text();
  assert.equal(metaContent(configuredHome, "property", "og:title"), "Custom SEO title");
  assert.equal(metaContent(configuredHome, "name", "description"), "Custom SEO description");
  assert.ok(configuredHome.includes("Custom home heading"));
  assert.ok(configuredHome.includes("Explore guides"));
  assert.ok(configuredHome.includes("Custom footer note"));
  assert.ok(configuredHome.includes('href="https://www.linkedin.com/company/example"'));
  assert.ok(!configuredHome.includes('id="start-here"'));
  assert.ok(!configuredHome.includes('aria-label="Advertisement"'));
  assert.ok(!configuredHome.includes('aria-label="Configured Insights newsletter"'));
  assert.equal([...configuredHome.matchAll(/aria-label="Read /g)].length, 3);
  const configuredBlog = await (await fetch("http://127.0.0.1:8787/blog?page=2")).text();
  assert.equal([...configuredBlog.matchAll(/aria-label="Read /g)].length, 6);
  assert.ok(configuredBlog.replace(/<!--.*?-->/g, "").includes("Page 2 of 5"));
  const configuredContact = await (await fetch("http://127.0.0.1:8787/contact")).text();
  assert.ok(configuredContact.includes('href="mailto:editor@example.com"'));
  assert.ok(!configuredContact.includes("<form"));
  empty = true;
  const home = await fetch("http://127.0.0.1:8787/");
  assert.equal(home.status, 200);
  assert.ok((await home.text()).includes("Our first articles are coming soon."));
  assert.ok(queries >= 6);
  console.log(
    "Passed: Worker SSR, public metadata/privacy, cover/fallback previews, sanitization, article navigation/checklists, unavailable contact, search/filters/pagination, homepage limits, sitemap, 404, admin shell, and empty homepage.",
  );
  if (process.env.READER_BROWSER_CHECK === "1") {
    empty = false;
    expanded = false;
    customSettings = false;
    coverEnabled = true;
    console.log("Reader browser fixture ready at http://127.0.0.1:8787 (Ctrl+C to stop)");
    await new Promise((resolve) => process.once("SIGINT", resolve));
  }
} finally {
  worker.kill();
  database.close();
}
