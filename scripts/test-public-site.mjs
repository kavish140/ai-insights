import assert from "node:assert/strict";
import { deliverEngagement, engagementConfig } from "../src/lib/email-delivery.ts";
import { articleOutline, articleTakeaways, checklistText } from "../src/lib/article-reading.ts";
import { formatDate } from "../src/lib/posts.ts";

const env = {
  RESEND_API_KEY: "test-only",
  CONTACT_FROM: "hello@example.com",
  CONTACT_TO: "owner@example.com",
  RESEND_SEGMENT_ID: "segment",
};
const contact = {
  name: "Visitor",
  email: "Visitor@example.com",
  message: "A useful topic suggestion.",
  website: "",
  consent: true,
  requestId: "c74b2818-655e-43c8-9717-9fb28cb9c854",
};
const calls = [];
const fakeFetch = async (url, options) => {
  calls.push({ url, options });
  assert.ok(url.startsWith("https://api.resend.com/"), "Only Resend should be called");
  return Response.json({ id: "accepted-id" });
};
assert.equal(engagementConfig({}).contact, false);
assert.equal(engagementConfig(env).contact, true, "Contact needs only Resend configuration");
assert.equal(engagementConfig({ RESEND_API_KEY: "test-only" }).newsletter, true);
assert.equal((await deliverEngagement("contact", contact, {}, fakeFetch)).ok, false);
assert.equal(calls.length, 0, "Missing configuration must not contact providers");
assert.equal(
  (await deliverEngagement("contact", { ...contact, consent: false }, env, fakeFetch)).ok,
  false,
);
assert.equal(
  (await deliverEngagement("contact", { ...contact, website: "spam" }, env, fakeFetch)).ok,
  false,
);
assert.equal(calls.length, 0, "Invalid input/honeypots must not reach providers");
assert.equal((await deliverEngagement("contact", contact, env, fakeFetch)).ok, true);
assert.equal(calls.length, 1, "Submission should call Resend directly without a challenge");
const payload = JSON.parse(calls[0].options.body);
assert.deepEqual(payload.to, ["owner@example.com"]);
assert.equal(payload.reply_to, "visitor@example.com");
assert.equal(calls[0].options.headers["Idempotency-Key"], contact.requestId);
assert.match(payload.text, /A useful topic suggestion/);
assert.equal(payload.html, undefined, "Visitor messages must be plain text");

for (const response of [
  new Response("provider failure", { status: 500 }),
  Response.json({}),
  Response.json({ id: null }),
]) {
  const result = await deliverEngagement("contact", contact, env, async () => response);
  assert.equal(result.ok, false, "Only confirmed provider acceptance is successful");
}
assert.equal(
  (
    await deliverEngagement("contact", contact, env, async () => {
      throw new Error("network failure");
    })
  ).ok,
  false,
);

let newsletterPayload;
assert.equal(
  (
    await deliverEngagement("newsletter", contact, env, async (url, options) => {
      assert.equal(url, "https://api.resend.com/contacts");
      newsletterPayload = JSON.parse(options.body);
      return Response.json({ id: "contact-id" });
    })
  ).ok,
  true,
);
assert.deepEqual(newsletterPayload, {
  email: "visitor@example.com",
  unsubscribed: false,
  segments: [{ id: "segment" }],
});
const outline = articleOutline(
  '<h2 id="old">Repeated &amp; useful</h2><p>Text</p><h3>Repeated</h3>',
);
assert.deepEqual(
  outline.headings.map((heading) => heading.id),
  ["section-1", "section-2"],
);
assert.equal(outline.headings[0].title, "Repeated & useful");
assert.match(outline.html, /id="section-1"/);
assert.deepEqual(
  articleTakeaways(
    "<h2>Key takeaways</h2><ul><li>Test <strong>first</strong>.</li></ul><h2>Details</h2><ul><li>Other</li></ul>",
  ),
  ["Test first."],
);
assert.deepEqual(articleTakeaways("<p>No explicit summary</p>"), []);
assert.match(checklistText({ title: "Guide", slug: "guide" }), /human approval/);
assert.equal(formatDate("2026-10-06T00:00:00Z"), "October 6, 2026");
console.log(
  "Passed: contact/newsletter without challenges, validation, consent, honeypots, Resend configuration/payloads, idempotency, failure handling, article anchors, takeaways and dates.",
);
