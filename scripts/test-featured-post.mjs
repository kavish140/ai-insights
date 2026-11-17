import assert from "node:assert/strict";
import {
  homepageCandidates,
  currentHomepagePick,
  featureSelectionMatches,
} from "../src/lib/featured-post.ts";

const today = "2026-11-17";
const articles = [
  { id: "first", slug: "a-story", date: today, status: "published", featured: false },
  { id: "second", slug: "b-story", date: today, status: "published", featured: false },
  { id: "old", slug: "old-story", date: "2026-10-01", status: "published", featured: true },
  { id: "future", slug: "future", date: "2026-11-18", status: "published", featured: true },
  { id: "draft", slug: "draft", date: today, status: "draft", featured: true },
];
assert.deepEqual(
  homepageCandidates(articles, today).map((post) => post.id),
  ["first", "second", "old"],
);
assert.equal(currentHomepagePick(articles, today).id, "old");
assert.equal(
  featureSelectionMatches(articles, "old"),
  false,
  "Old extra flags must be cleared even if the displayed pick stays the same",
);
const automatic = articles.map((post) => ({ ...post, featured: false }));
assert.equal(
  currentHomepagePick(automatic, today).id,
  "first",
  "Automatic selection matches homepage date and slug order",
);
assert.equal(featureSelectionMatches(automatic, ""), true);
assert.equal(featureSelectionMatches(automatic, "first"), false);
const one = automatic.map((post) => ({ ...post, featured: post.id === "second" }));
assert.equal(featureSelectionMatches(one, "second"), true);
assert.equal(featureSelectionMatches(one, ""), false);
assert.equal(currentHomepagePick([], today), undefined);
assert.equal(homepageCandidates(articles, today).length, 3);
assert.equal(articles[0].id, "first", "Sorting must not mutate admin state");
console.log(
  "Passed: live-only choices, pinned and automatic selection, stable homepage order, old flag cleanup and no-op detection.",
);
