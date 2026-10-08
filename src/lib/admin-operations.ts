import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const credentials = z.object({ token: z.string().min(1).max(10000) });
export const getSubscribers = createServerFn({ method: "POST" })
  .validator(
    credentials.extend({
      cursor: z.string().uuid().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const { adminClient } = await import("./admin-operations.server");
    const client = await adminClient(data.token);
    const { newsletterSubscriberPage } = await import("./newsletter-storage");
    return newsletterSubscriberPage(client, data.cursor);
  });
export const getEmailConfiguration = createServerFn({ method: "POST" })
  .validator(credentials)
  .handler(async ({ data }) => {
    const { adminClient } = await import("./admin-operations.server");
    await adminClient(data.token);
    return {
      resendConfigured: !!process.env["RESEND_API_KEY"],
      newsletterStorageConfigured: !!(
        process.env["SUPABASE_URL"] && process.env["SUPABASE_PUBLISHABLE_KEY"]
      ),
      contactConfigured: !!(
        process.env["RESEND_API_KEY"] &&
        process.env["CONTACT_FROM"] &&
        process.env["CONTACT_TO"]
      ),
    };
  });
export const scanContent = createServerFn({ method: "POST" })
  .validator(credentials.extend({ postIds: z.array(z.string().uuid()).min(1).max(5) }))
  .handler(async ({ data }) => {
    const { scan } = await import("./admin-operations.server");
    return scan(data.token, data.postIds);
  });
export const probeMcp = createServerFn({ method: "POST" })
  .validator(credentials)
  .handler(async ({ data }) => {
    const { probe } = await import("./admin-operations.server");
    return probe(data.token);
  });
export const retryMcp = createServerFn({ method: "POST" })
  .validator(credentials.extend({ operationId: z.string().uuid() }))
  .handler(async ({ data }) => {
    const { retry } = await import("./admin-operations.server");
    return retry(data.token, data.operationId);
  });
export const previewArticle = createServerFn({ method: "POST" })
  .validator(credentials.extend({ body: z.string().max(200000) }))
  .handler(async ({ data }) => {
    const { preview } = await import("./admin-operations.server");
    return preview(data.token, data.body);
  });
export const probeSeo = createServerFn({ method: "POST" })
  .validator(
    credentials.extend({
      slug: z
        .string()
        .max(200)
        .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/)
        .optional(),
    }),
  )
  .handler(async ({ data }) => {
    const { inspectSeo } = await import("./admin-operations.server");
    return inspectSeo(data.token, data.slug);
  });

export type Operation = {
  id: string;
  tool: string;
  arguments: Record<string, unknown>;
  result: {
    post?: {
      id: string;
      title: string;
      slug: string;
      category: string;
      status: string;
      cover_image_url?: string;
    };
    image?: { url: string; alt: string };
    replayed?: boolean;
  };
  outcome: "success" | "failed";
  error: string | null;
  duration_ms: number;
  created_at: string;
};
export type PublishingActivity = {
  id: number;
  post_id: string;
  action: string;
  source: string;
  actor_id?: string | null;
  request_id?: string | null;
  previous_status?: string | null;
  revision: number;
  status: string | null;
  created_at: string;
};
export type Revision = {
  post_id: string;
  revision: number;
  snapshot: import("./admin").Article;
  source: string;
  actor_id?: string | null;
  created_at: string;
};
export const retryableTools = [
  "create_draft",
  "update_draft",
  "publish_post",
  "unpublish_post",
  "import_image_url",
];
