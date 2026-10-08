import type { SupabaseClient } from "@supabase/supabase-js";
import { newsletterSchema, type EngagementResult } from "./engagement-schema.ts";
import type { SubscriberPage } from "./resend-subscribers.ts";

export async function saveNewsletterSubscription(
  input: unknown,
  client: SupabaseClient,
): Promise<EngagementResult> {
  const parsed = newsletterSchema.safeParse(input);
  if (!parsed.success || parsed.data.website)
    return { ok: false, message: "Check your email address and consent before submitting." };
  try {
    const { error } = await client.rpc("subscribe_newsletter", {
      p_email: parsed.data.email,
      p_consent: parsed.data.consent,
    });
    if (error) throw error;
    return {
      ok: true,
      message:
        "Thanks—your subscription request has been saved. To change an existing subscription, contact us.",
    };
  } catch {
    return { ok: false, message: "We couldn’t save your subscription. Please try again shortly." };
  }
}

export async function newsletterSubscriberPage(
  client: SupabaseClient,
  cursor?: string,
): Promise<SubscriberPage> {
  let query = client
    .from("newsletter_subscribers")
    .select("id,email,first_name,last_name,created_at,unsubscribed")
    .order("id")
    .limit(101);
  if (cursor) query = query.gt("id", cursor);
  const { data, error } = await query;
  if (error)
    throw new Error(
      "Could not load newsletter subscribers from Supabase. Please refresh and try again.",
    );
  const contacts = (data ?? []).slice(0, 100);
  const hasMore = (data?.length ?? 0) > 100;
  return {
    available: true,
    canViewAccount: false,
    scope: "supabase",
    contacts,
    hasMore,
    nextCursor: hasMore ? contacts.at(-1)!.id : null,
    message: "Newsletter signups are stored in Supabase and visible only to designated admins.",
  };
}
