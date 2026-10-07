import { z } from "zod";
import { SITE } from "./posts";

const text = (max: number) => z.string().trim().min(1).max(max);
const socialUrl = z
  .string()
  .trim()
  .max(500)
  .refine((value) => {
    if (!value) return true;
    try {
      const url = new URL(value);
      return url.protocol === "https:" && !url.username && !url.password;
    } catch {
      return false;
    }
  }, "Use an HTTPS URL without login credentials, or leave blank.");
export const siteSettingsSchema = z.object({
  name: text(80),
  tagline: text(160),
  description: text(500),
  default_author: text(200),
  brand_initials: text(3),
  header_cta_label: text(30),
  home_title: text(120),
  home_seo_title: text(120),
  home_seo_description: text(160),
  home_latest_count: z.number().int().min(2).max(24),
  articles_per_page: z.number().int().min(6).max(48),
  show_reading_path: z.boolean(),
  show_house_ads: z.boolean(),
  newsletter_enabled: z.boolean(),
  newsletter_title: text(120),
  newsletter_description: text(400),
  contact_email: z.string().trim().email().max(254),
  contact_form_enabled: z.boolean(),
  footer_note: text(200),
  linkedin_url: socialUrl,
  youtube_url: socialUrl,
  x_url: socialUrl,
  default_category: z.string().trim().min(1).max(80).nullable(),
});
export type SiteSettings = z.infer<typeof siteSettingsSchema>;
export type Settings = SiteSettings & { settings_revision: number; settings_updated_at?: string };
export const defaultSiteSettings: SiteSettings = {
  name: SITE.name,
  tagline: SITE.tagline,
  description: SITE.description,
  default_author: "AI Insights",
  brand_initials: "AI",
  header_cta_label: "Start reading",
  home_title: "AI automation, explained without the hype",
  home_seo_title: "AI Insights — Practical AI Automation & Awareness",
  home_seo_description:
    "Clear guides on AI automation, agents and workflows, plus honest awareness pieces on privacy and misinformation.",
  home_latest_count: 6,
  articles_per_page: 12,
  show_reading_path: true,
  show_house_ads: true,
  newsletter_enabled: true,
  newsletter_title: "Practical AI, in your inbox.",
  newsletter_description:
    "Get new guides and workflow checklists. Useful steps, clear tradeoffs, and no hype.",
  contact_email: "kavishganatra5@gmail.com",
  contact_form_enabled: true,
  footer_note: "All rights reserved.",
  linkedin_url: "",
  youtube_url: "",
  x_url: "",
  default_category: null,
};
export function normalizeSettings(row: Record<string, unknown> | null | undefined): Settings {
  return {
    ...siteSettingsSchema.parse({ ...defaultSiteSettings, ...row }),
    settings_revision:
      typeof row?.["settings_revision"] === "number" ? row["settings_revision"] : 0,
    ...(typeof row?.["settings_updated_at"] === "string"
      ? { settings_updated_at: row["settings_updated_at"] }
      : {}),
  };
}
