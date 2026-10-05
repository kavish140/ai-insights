import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { SITE } from "@/lib/posts";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact AI Insights — Questions, Topics & Sponsorships" },
      {
        name: "description",
        content:
          "Get in touch with AI Insights about article topics, corrections, collaborations or sponsorship enquiries.",
      },
      { property: "og:title", content: "Contact AI Insights" },
      {
        property: "og:description",
        content: "Suggest a topic, report a correction or ask about sponsorships.",
      },
      { property: "og:url", content: SITE.url + "/contact" },
    ],
    links: [{ rel: "canonical", href: SITE.url + "/contact" }],
  }),
  component: ContactPage,
});

function ContactPage() {
  const [sent, setSent] = useState(false);

  return (
    <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
      <h1 className="text-3xl font-bold md:text-4xl">Get in touch</h1>
      <p className="mt-3 text-muted-foreground">
        Topic suggestions, corrections and sponsorship enquiries are all welcome.
      </p>

      {sent ? (
        <div className="mt-8 rounded-2xl border border-border bg-card p-6 shadow-card">
          <h2 className="text-lg font-semibold">Thanks — message received</h2>
          <p className="mt-2 text-sm text-muted-foreground">We'll be in touch soon.</p>
        </div>
      ) : (
        <form
          className="mt-8 space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            setSent(true);
          }}
        >
          <div>
            <label htmlFor="name" className="text-sm font-medium">
              Name
            </label>
            <input
              id="name"
              required
              className="mt-2 w-full rounded-lg border border-input bg-surface px-3.5 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/30"
            />
          </div>
          <div>
            <label htmlFor="email" className="text-sm font-medium">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              className="mt-2 w-full rounded-lg border border-input bg-surface px-3.5 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/30"
            />
          </div>
          <div>
            <label htmlFor="message" className="text-sm font-medium">
              Message
            </label>
            <textarea
              id="message"
              rows={5}
              required
              className="mt-2 w-full rounded-lg border border-input bg-surface px-3.5 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/30"
            />
          </div>
          <button
            type="submit"
            className="rounded-lg bg-brand-gradient px-5 py-2.5 text-sm font-medium text-primary-foreground"
          >
            Send message
          </button>
        </form>
      )}
    </div>
  );
}
