import { createServerFn } from "@tanstack/react-start";
import { contactSchema, newsletterSchema } from "./engagement-schema";

export const sendContact = createServerFn({ method: "POST" })
  .validator(contactSchema)
  .handler(async ({ data }) => {
    const { loadSiteSettings } = await import("./supabase.server");
    if (!(await loadSiteSettings()).contact_form_enabled)
      return {
        ok: false,
        message:
          "The contact form is currently paused. Please use the email listed on the Contact page.",
      };
    const { deliverEngagement } = await import("./email-delivery");
    return deliverEngagement("contact", data, process.env);
  });
export const subscribeNewsletter = createServerFn({ method: "POST" })
  .validator(newsletterSchema)
  .handler(async ({ data }) => {
    const { loadSiteSettings } = await import("./supabase.server");
    if (!(await loadSiteSettings()).newsletter_enabled)
      return { ok: false, message: "New newsletter subscriptions are currently paused." };
    const { deliverEngagement } = await import("./email-delivery");
    return deliverEngagement("newsletter", data, process.env);
  });
