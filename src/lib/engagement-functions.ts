import { createServerFn } from "@tanstack/react-start";
import { contactSchema, newsletterSchema } from "./engagement-schema";

export const sendContact = createServerFn({ method: "POST" })
  .validator(contactSchema)
  .handler(async ({ data }) => {
    const { deliverEngagement } = await import("./email-delivery");
    return deliverEngagement("contact", data, process.env);
  });
export const subscribeNewsletter = createServerFn({ method: "POST" })
  .validator(newsletterSchema)
  .handler(async ({ data }) => {
    const { deliverEngagement } = await import("./email-delivery");
    return deliverEngagement("newsletter", data, process.env);
  });
