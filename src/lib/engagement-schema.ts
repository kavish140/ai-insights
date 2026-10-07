import { z } from "zod";

const common = {
  email: z
    .string()
    .trim()
    .email()
    .max(254)
    .transform((value) => value.toLowerCase()),
  website: z.string().max(200).default(""),
  consent: z.literal(true),
};
export const contactSchema = z.object({
  ...common,
  name: z.string().trim().min(1).max(100),
  message: z.string().trim().min(10).max(5000),
  requestId: z.string().uuid(),
});
export const newsletterSchema = z.object(common);
export type EngagementResult = { ok: boolean; message: string };
