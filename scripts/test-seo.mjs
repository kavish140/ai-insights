import assert from "node:assert/strict";
import { articleSchema, jsonLd, listingSeo, sitemapEntries, sitemapXml } from "../src/lib/seo.ts";

const home = listingSeo({ page: 1, sort: "latest" });
assert.equal(home.canonical, "https://ai-insights.sitenova.dev/blog");
assert.match(home.robots, /^index/);
const second = listingSeo({ page: 2 });
assert.equal(second.canonical, "https://ai-insights.sitenova.dev/blog?page=2");
assert.match(second.title, /Page 2/);
const topic = listingSeo({ category: "Automation", page: 2 });
assert.match(topic.canonical, /category=Automation&page=2$/);
assert.match(topic.robots, /^index/);
assert.notEqual(topic.description, home.description);
for (const category of ["constructor", "__proto__", "toString"]) {
  assert.equal(typeof listingSeo({ category }).description, "string");
}
for (const search of [
  { q: "workflows" },
  { tag: "agents" },
  { audience: "beginners" },
  { sort: "popular" },
  { sort: "oldest" },
]) {
  assert.equal(listingSeo(search).robots, "noindex, follow");
}
assert.equal(listingSeo({}, true).robots, "noindex, follow");
const malicious = { headline: '</script><script>alert("test")</script>' };
const serialized = jsonLd(malicious);
assert.ok(!serialized.includes("<"));
assert.deepEqual(JSON.parse(serialized), malicious);
const post = {
  slug: "guide",
  title: "A guide & example",
  description: "Useful guidance",
  category: "Automation",
  author: "Kavish Ganatra",
  date: "2026-10-05",
  updatedAt: "2026-10-06T00:00:00Z",
  readingMinutes: 3,
  body: "<p>Guide</p>",
  cover_image_url: "https://example.com/cover.png?width=1200&quality=80",
};
const schema = articleSchema(post);
assert.equal(schema.publisher["@id"], "https://ai-insights.sitenova.dev/#organization");
assert.equal(schema.author.url, "https://ai-insights.sitenova.dev/about");
assert.equal(schema.dateModified, post.updatedAt);
assert.equal(articleSchema({ ...post, author: "Guest" }).author.url, undefined);
assert.equal(articleSchema({ ...post, cover_image_url: "" }).image, undefined);
const xml = sitemapXml(sitemapEntries([post]));
assert.match(xml, /<lastmod>2026-10-06T00:00:00Z<\/lastmod>/);
assert.match(xml, /<image:loc>https:\/\/example.com\/cover.png\?width=1200&amp;quality=80/);
assert.ok(xml.includes("/blog?category=Automation"));
assert.ok(!xml.includes("/admin"));
assert.ok(!sitemapXml([{ path: "/about", modified: "not a date" }]).includes("lastmod"));
console.log(
  "Passed: canonical pagination, topic metadata, index controls, JSON-LD escaping, author/publisher identity, article images, sitemap dates and XML escaping.",
);
