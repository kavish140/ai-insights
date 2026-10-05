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
  date: "2026-10-05",
  reading_minutes: 2,
  author: "AI Insights",
  featured: true,
  cover_image_url: imageUrl,
  cover_image_alt: "SSR cover image",
  body: `<p>Visible without JavaScript.</p><script>unsafe_marker</script><p onclick="unsafe_marker()">Safe paragraph.</p><a href="javascript:unsafe_marker()">Link</a><figure><img src="${imageUrl}" alt="SSR inline image" onerror="unsafe_marker()"><figcaption>SSR image caption</figcaption></figure><img src="https://evil.example/unsafe_marker.png" alt="Unsafe image">`,
};
let empty = false;
let queries = 0;
const database = createServer((request, response) => {
  const url = new URL(request.url, "http://localhost");
  if (url.pathname !== "/rest/v1/posts") {
    response.writeHead(404).end();
    return;
  }
  assert.equal(request.headers.apikey, "test-publishable-key");
  assert.equal(url.searchParams.get("status"), "eq.published");
  assert.match(url.searchParams.get("date"), /^lte\.\d{4}-\d{2}-\d{2}$/);
  queries++;
  response.writeHead(200, { "content-type": "application/json" });
  response.end(JSON.stringify(empty ? [] : [article]));
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
  for (const path of ["/", "/blog", "/blog/ssr-check"]) {
    const response = await fetch(`http://127.0.0.1:8787${path}`);
    assert.equal(response.status, 200, `${path}: ${await response.clone().text()}`);
    const html = await response.text();
    assert.ok(html.includes("SSR test article"), `${path} did not server-render the article`);
    assert.ok(!html.includes("unsafe_marker"), "Unsafe HTML reached the response");
    if (path === "/blog/ssr-check") {
      assert.ok(html.includes("Visible without JavaScript."));
      assert.ok(html.includes("BlogPosting"));
      assert.ok(html.includes('rel="canonical"'));
      assert.ok(html.includes('alt="SSR cover image"'));
      assert.ok(html.includes('alt="SSR inline image"'));
      assert.ok(html.includes("SSR image caption"));
      assert.ok(html.includes('property="og:image" content="' + imageUrl + '"'));
    }
  }
  const sitemap = await fetch("http://127.0.0.1:8787/sitemap.xml");
  assert.equal(sitemap.status, 200);
  assert.ok((await sitemap.text()).includes("/blog/ssr-check"));
  assert.equal((await fetch("http://127.0.0.1:8787/blog/unknown")).status, 404);
  assert.equal((await fetch("http://127.0.0.1:8787/admin")).status, 200);
  empty = true;
  const home = await fetch("http://127.0.0.1:8787/");
  assert.equal(home.status, 200);
  assert.ok((await home.text()).includes("Our first articles are coming soon."));
  assert.ok(queries >= 6);
  console.log(
    "Passed: Worker SSR, article metadata, HTML sanitization, sitemap, 404, admin shell, and empty homepage.",
  );
} finally {
  worker.kill();
  database.close();
}
