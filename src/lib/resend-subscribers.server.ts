import { z } from "zod";
import { subscriberResponseSchema, type SubscriberPage } from "./resend-subscribers.ts";

type Env = Record<string, string | undefined>;
export async function subscriberPage(
  env: Env,
  cursor?: string,
  accountWide = false,
  fetcher: typeof fetch = fetch,
): Promise<SubscriberPage> {
  const empty = {
    available: false,
    canViewAccount: !!env["RESEND_API_KEY"] && !env["RESEND_SEGMENT_ID"],
    contacts: [],
    hasMore: false,
    nextCursor: null,
  };
  if (!env["RESEND_API_KEY"])
    return {
      ...empty,
      scope: "unconfigured",
      message:
        "Configure RESEND_API_KEY on the website server to view subscribers. No emails are stored in Supabase.",
    };
  const segment = env["RESEND_SEGMENT_ID"];
  if (segment && !z.string().uuid().safeParse(segment).success)
    throw new Error(
      "RESEND_SEGMENT_ID must be a valid Resend segment ID. Update the server configuration.",
    );
  if (!segment && !accountWide)
    return {
      ...empty,
      scope: "unconfigured",
      message:
        "No newsletter segment is configured. Set RESEND_SEGMENT_ID for an exact newsletter list, or explicitly view all Resend contacts below. Account-wide contacts may belong to other sites.",
    };
  if (cursor && !z.string().uuid().safeParse(cursor).success)
    throw new Error("Invalid subscriber page cursor.");
  const url = new URL(
    `https://api.resend.com/${segment ? `segments/${segment}/contacts` : "contacts"}`,
  );
  url.searchParams.set("limit", "100");
  if (cursor) url.searchParams.set("after", cursor);
  let response: Response;
  try {
    response = await fetcher(url, {
      headers: { authorization: `Bearer ${env["RESEND_API_KEY"]}` },
      redirect: "error",
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw new Error("Resend did not respond. Try refreshing the subscriber list.");
  }
  if (!response.ok)
    throw new Error(
      response.status === 401 || response.status === 403
        ? "The Resend key cannot read contacts. Use a server key with contact access."
        : response.status === 429
          ? "Resend request limit reached. Wait briefly before refreshing."
          : "Could not retrieve subscribers from Resend. Try again shortly.",
    );
  let parsed: z.infer<typeof subscriberResponseSchema>;
  try {
    parsed = subscriberResponseSchema.parse(await response.json());
  } catch {
    throw new Error(
      "Resend returned an unexpected subscriber response. No partial list was shown.",
    );
  }
  const last = parsed.data.at(-1)?.id ?? null;
  if (parsed.has_more && (!last || last === cursor))
    throw new Error("Resend returned an invalid pagination cursor. Refresh the list.");
  return {
    available: true,
    canViewAccount: !segment,
    scope: segment ? "segment" : "account",
    contacts: parsed.data,
    hasMore: parsed.has_more,
    nextCursor: parsed.has_more ? last : null,
    message: segment
      ? "Showing the configured AI Insights newsletter segment."
      : "Showing account-wide Resend contacts. These cannot all be attributed to this newsletter.",
  };
}
