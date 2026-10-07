import { contactSchema, newsletterSchema } from "./engagement-schema.ts";
import type { EngagementResult } from "./engagement-schema";

type Config = Record<string, string | undefined>;
type Fetcher = typeof fetch;
export function engagementConfig(env: Config) {
  return {
    contact: Boolean(env["RESEND_API_KEY"] && env["CONTACT_FROM"] && env["CONTACT_TO"]),
    newsletter: Boolean(env["RESEND_API_KEY"]),
  };
}

export async function deliverEngagement(
  kind: "contact" | "newsletter",
  input: unknown,
  env: Config,
  fetcher: Fetcher = fetch,
): Promise<EngagementResult> {
  const parsed =
    kind === "contact" ? contactSchema.safeParse(input) : newsletterSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, message: "Check the form fields and your consent before submitting." };
  const data = parsed.data;
  if (data.website)
    return { ok: false, message: "We couldn’t accept this submission. Please try again." };
  if (!engagementConfig(env)[kind])
    return {
      ok: false,
      message:
        kind === "contact"
          ? "Message delivery is temporarily unavailable. Please use the email listed on the Contact page."
          : "Subscriptions are temporarily unavailable. Please try again later.",
    };
  try {
    const contact = kind === "contact" ? contactSchema.parse(data) : null;
    const response = await fetcher(`https://api.resend.com/${contact ? "emails" : "contacts"}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${env["RESEND_API_KEY"]}`,
        ...(contact ? { "Idempotency-Key": contact.requestId } : {}),
      },
      body: JSON.stringify(
        contact
          ? {
              from: env["CONTACT_FROM"],
              to: [env["CONTACT_TO"]],
              reply_to: contact.email,
              subject: "AI Insights — contact message",
              text: `From: ${contact.name}\nEmail: ${contact.email}\n\n${contact.message}`,
            }
          : {
              email: data.email,
              unsubscribed: false,
              ...(env["RESEND_SEGMENT_ID"] ? { segments: [{ id: env["RESEND_SEGMENT_ID"] }] } : {}),
            },
      ),
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok)
      return { ok: false, message: "We couldn’t complete your request. Please try again shortly." };
    const result = (await response.json()) as { id?: unknown };
    if (typeof result.id !== "string" || !result.id)
      return { ok: false, message: "We couldn’t confirm your request. Please try again." };
    return {
      ok: true,
      message: contact
        ? "Your message has been submitted. Thanks for getting in touch."
        : "You’re subscribed to AI Insights. You can unsubscribe using the link in any newsletter.",
    };
  } catch {
    // Do not log email addresses, message bodies, provider responses or secrets.
    return {
      ok: false,
      message: "The service is temporarily unavailable. Please try again shortly.",
    };
  }
}
