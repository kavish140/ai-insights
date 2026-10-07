import { z } from "zod";

const contact = z.object({
  id: z.string().uuid(),
  email: z.string().email().max(254),
  first_name: z.string().nullable().optional(),
  last_name: z.string().nullable().optional(),
  created_at: z.string(),
  unsubscribed: z.boolean(),
});
export const subscriberResponseSchema = z.object({ data: z.array(contact), has_more: z.boolean() });
export type Subscriber = z.infer<typeof contact>;
export type SubscriberPage = {
  available: boolean;
  canViewAccount: boolean;
  scope: "segment" | "account" | "unconfigured";
  contacts: Subscriber[];
  hasMore: boolean;
  nextCursor: string | null;
  message: string;
};
export function subscriberCsv(contacts: Subscriber[]) {
  const cell = (value: string) =>
    `"${(/^[\s]*[=+@-]|^[\t\r\n]/.test(value) ? "'" + value : value).replaceAll('"', '""')}"`;
  return [
    "Email,Name,Status,Contact created",
    ...contacts.map((contact) =>
      [
        contact.email,
        `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim(),
        contact.unsubscribed ? "Unsubscribed" : "Subscribed",
        contact.created_at,
      ]
        .map(cell)
        .join(","),
    ),
  ].join("\r\n");
}
