import assert from "node:assert/strict";
import { subscriberPage } from "../src/lib/resend-subscribers.server.ts";
import { subscriberCsv } from "../src/lib/resend-subscribers.ts";

const segment = "827ed893-8623-4b86-876e-d4a1c3b585b1";
const id = "91fcb547-b5f2-441c-bc46-5f782105c90f";
const contact = {
  id,
  email: "reader@example.com",
  first_name: "Reader",
  last_name: null,
  created_at: "2026-10-07T10:00:00+00:00",
  unsubscribed: false,
};
const env = { RESEND_API_KEY: "test-only-secret", RESEND_SEGMENT_ID: segment };
let calls = 0;
const neverFetch = async () => {
  throw new Error("Provider should not be called");
};
assert.equal((await subscriberPage({}, undefined, false, neverFetch)).available, false);
assert.equal(
  (await subscriberPage({ RESEND_API_KEY: env.RESEND_API_KEY }, undefined, false, neverFetch))
    .available,
  false,
  "Account-wide contacts need an explicit choice",
);
await assert.rejects(
  subscriberPage({ ...env, RESEND_SEGMENT_ID: "invalid" }, undefined, false, neverFetch),
  /segment ID/,
);
await assert.rejects(subscriberPage(env, "invalid", false, neverFetch), /cursor/);
const first = await subscriberPage(env, undefined, false, async (url, options) => {
  calls++;
  assert.equal(url.href, `https://api.resend.com/segments/${segment}/contacts?limit=100`);
  assert.equal(options.headers.authorization, `Bearer ${env.RESEND_API_KEY}`);
  assert.equal(options.redirect, "error");
  return Response.json({ data: [contact], has_more: true });
});
assert.equal(first.scope, "segment");
assert.equal(
  first.canViewAccount,
  true,
  "A configured segment must still allow checking older account-wide signups",
);
assert.equal(first.nextCursor, id);
assert.equal(first.contacts[0].email, contact.email);
assert.ok(!JSON.stringify(first).includes(env.RESEND_API_KEY));
const second = await subscriberPage(env, first.nextCursor, false, async (url) => {
  assert.equal(url.searchParams.get("after"), id);
  return Response.json({
    data: [{ ...contact, id: segment, unsubscribed: true }],
    has_more: false,
  });
});
assert.equal(second.contacts[0].unsubscribed, true);
assert.equal(second.nextCursor, null);
const global = await subscriberPage(
  { RESEND_API_KEY: env.RESEND_API_KEY },
  undefined,
  true,
  async (url) => {
    assert.equal(url.pathname, "/contacts");
    return Response.json({ data: [], has_more: false });
  },
);
assert.equal(global.scope, "account");
assert.match(global.message, /cannot all be attributed/);
const outsideSegment = await subscriberPage(env, undefined, true, async (url) => {
  assert.equal(
    url.pathname,
    "/contacts",
    "Explicit account scope must override the configured segment",
  );
  return Response.json({ data: [contact], has_more: true });
});
assert.equal(outsideSegment.scope, "account");
assert.equal(outsideSegment.contacts.length, 1);
await subscriberPage(env, outsideSegment.nextCursor, true, async (url) => {
  assert.equal(url.pathname, "/contacts");
  assert.equal(url.searchParams.get("after"), id);
  return Response.json({ data: [], has_more: false });
});
const emptySegment = await subscriberPage(env, undefined, false, async (url) => {
  assert.equal(
    url.pathname,
    `/segments/${segment}/contacts`,
    "Returning to newsletter scope must restore segment isolation",
  );
  return Response.json({ data: [], has_more: false });
});
assert.equal(emptySegment.canViewAccount, true);
assert.equal(emptySegment.contacts.length, 0);
for (const status of [401, 403, 429, 500]) {
  await assert.rejects(
    subscriberPage(
      env,
      undefined,
      false,
      async () => new Response("private provider details", { status }),
    ),
    (error) => !error.message.includes("private provider details"),
  );
}
await assert.rejects(
  subscriberPage(env, undefined, false, async () =>
    Response.json({ data: [contact, { ...contact, email: "invalid" }], has_more: false }),
  ),
  /No partial list/,
);
await assert.rejects(
  subscriberPage(env, id, false, async () => Response.json({ data: [contact], has_more: true })),
  /pagination cursor/,
);
await assert.rejects(
  subscriberPage(env, undefined, false, async () => {
    throw new Error(env.RESEND_API_KEY);
  }),
  (error) => !error.message.includes(env.RESEND_API_KEY),
);
const csv = subscriberCsv([
  contact,
  {
    ...contact,
    email: "+reader@example.com",
    first_name: '=HYPERLINK("evil")',
    unsubscribed: true,
  },
]);
assert.match(csv, /"'\+reader@example.com"/);
assert.match(csv, /"'=HYPERLINK\(""evil""\)"/);
assert.match(csv, /Unsubscribed/);
assert.equal(calls, 1);
console.log(
  "Passed: subscriber segment isolation, explicit account scope, cursor pagination, subscription status, provider failures, secret redaction, and CSV escaping.",
);
