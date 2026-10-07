import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const articleSearchSchema = z.object({
  q: z.string().trim().max(100).optional(),
  category: z.string().max(100).optional(),
  sort: z.enum(["latest", "oldest", "shortest"]).optional(),
  page: z.number().int().min(1).max(10000).optional(),
});

export const getArticlePage = createServerFn({ method: "GET" })
  .validator(articleSearchSchema)
  .handler(async ({ data }) => {
    const { articlePage } = await import("./supabase.server");
    return articlePage(data);
  });

export const getHomeArticles = createServerFn({ method: "GET" }).handler(async () => {
  const { homeArticles } = await import("./supabase.server");
  return homeArticles();
});

export const getArticle = createServerFn({ method: "GET" })
  .validator(z.object({ slug: z.string().min(1).max(200) }))
  .handler(async ({ data }) => {
    const { articleBySlug } = await import("./supabase.server");
    return articleBySlug(data.slug);
  });

export const listPublishedPosts = createServerFn({ method: "GET" }).handler(async () => {
  const { publishedPosts } = await import("./supabase.server");
  return publishedPosts();
});

export const getPublicConfiguration = createServerFn({ method: "GET" }).handler(async () => {
  const { publicConfiguration } = await import("./supabase.server");
  return publicConfiguration();
});

export const getSiteContent = createServerFn({ method: "GET" }).handler(async () => {
  const { siteContent } = await import("./supabase.server");
  const { engagementConfig } = await import("./email-delivery");
  const content = await siteContent();
  const configured = engagementConfig(process.env);
  return {
    ...content,
    engagement: {
      contact: configured.contact && content.site.contact_form_enabled,
      newsletter: configured.newsletter && content.site.newsletter_enabled,
    },
  };
});
