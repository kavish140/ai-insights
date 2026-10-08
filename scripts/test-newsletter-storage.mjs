import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import {
  saveNewsletterSubscription,
  newsletterSubscriberPage,
} from "../src/lib/newsletter-storage.ts";

const input = { email: " Reader@example.com ", consent: true, website: "" };
let writes = 0;
const client = createClient("https://example.supabase.co", "test-publishable", {
  auth: { persistSession: false },
  global: {
    fetch: async (url, options) => {
      writes++;
      assert.equal(new URL(url).pathname, "/rest/v1/rpc/subscribe_newsletter");
      assert.deepEqual(JSON.parse(options.body), {
        p_email: "reader@example.com",
        p_consent: true,
      });
      return Response.json(null);
    },
  },
});
assert.equal((await saveNewsletterSubscription(input, client)).ok, true);
for (const invalid of [
  { ...input, consent: false },
  { ...input, email: "invalid" },
  { ...input, website: "spam" },
]) {
  assert.equal((await saveNewsletterSubscription(invalid, client)).ok, false);
}
assert.equal(writes, 1);
const failing = createClient("https://example.supabase.co", "test-publishable", {
  auth: { persistSession: false },
  global: {
    fetch: async () =>
      Response.json({ message: "private database details", code: "42501" }, { status: 403 }),
  },
});
const failure = await saveNewsletterSubscription(input, failing);
assert.equal(failure.ok, false);
assert.ok(!failure.message.includes("private database details"));

const rows = Array.from({ length: 101 }, (_, index) => ({
  id: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
  email: `reader${index}@example.com`,
  created_at: "2026-10-08T00:00:00Z",
  unsubscribed: false,
}));
let requests = 0;
const reader = createClient("https://example.supabase.co", "test-publishable", {
  auth: { persistSession: false },
  global: {
    fetch: async (url) => {
      requests++;
      const parsed = new URL(url);
      assert.equal(parsed.pathname, "/rest/v1/newsletter_subscribers");
      assert.equal(parsed.searchParams.get("limit"), "101");
      assert.equal(parsed.searchParams.get("order"), "id.asc");
      if (requests === 1) return Response.json(rows);
      assert.equal(parsed.searchParams.get("id"), `gt.${rows[99].id}`);
      return Response.json(rows.slice(100));
    },
  },
});
const first = await newsletterSubscriberPage(reader);
assert.equal(first.contacts.length, 100);
assert.equal(first.hasMore, true);
const second = await newsletterSubscriberPage(reader, first.nextCursor);
assert.equal(second.contacts.length, 1);
assert.equal(second.nextCursor, null);
assert.equal(second.scope, "supabase");
await assert.rejects(newsletterSubscriberPage(failing), /Could not load/);
console.log(
  "Passed: Supabase signup normalization, consent, honeypot, failure handling, and admin cursor pagination.",
);
