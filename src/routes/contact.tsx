import { socialMeta } from "@/lib/social-meta";
import { createFileRoute, Link, useLoaderData } from "@tanstack/react-router";
import { useState } from "react";
import { SITE } from "@/lib/posts";
import { sendContact } from "@/lib/engagement-functions";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact AI Insights — Questions, Topics & Sponsorships" },
      {
        name: "description",
        content:
          "Get in touch with AI Insights about article topics, corrections, collaborations or sponsorship enquiries.",
      },
      ...socialMeta({
        title: "Contact AI Insights — Questions, Topics & Sponsorships",
        description:
          "Get in touch with AI Insights about article topics, corrections, collaborations or sponsorship enquiries.",
        path: "/contact",
      }),
    ],
    links: [{ rel: "canonical", href: SITE.url + "/contact" }],
  }),
  component: ContactPage,
});

function ContactPage() {
  const [sent, setSent] = useState(false);
  const { engagement } = useLoaderData({ from: "__root__" });
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [requestId, setRequestId] = useState("");

  return (
    <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
      <h1 className="text-3xl font-bold md:text-4xl">Get in touch</h1>
      <p className="mt-3 text-muted-foreground">
        Topic suggestions, corrections and sponsorship enquiries are all welcome.
      </p>
      <p className="mt-3 text-sm text-muted-foreground">
        You can also email{" "}
        <a href="mailto:kavishganatra5@gmail.com" className="text-primary underline">
          kavishganatra5@gmail.com
        </a>
        .
      </p>

      {sent ? (
        <div className="mt-8 rounded-2xl border border-border bg-card p-6 shadow-card">
          <h2 className="text-lg font-semibold">Thanks — message submitted</h2>
          <p role="status" className="mt-2 text-sm text-muted-foreground">
            {feedback}
          </p>
        </div>
      ) : !engagement.contact ? (
        <p className="mt-8 rounded-xl border border-border bg-card p-6 text-sm">
          The contact form is temporarily unavailable. Please use the email address above.
        </p>
      ) : (
        <form
          className="mt-8 space-y-5"
          onSubmit={async (e) => {
            e.preventDefault();
            if (busy) return;
            const fields = new FormData(e.currentTarget);
            const id = requestId || crypto.randomUUID();
            setRequestId(id);
            setBusy(true);
            setFeedback("");
            try {
              const result = await sendContact({
                data: {
                  name: String(fields.get("name")),
                  email: String(fields.get("email")),
                  message: String(fields.get("message")),
                  website: String(fields.get("website") ?? ""),
                  consent: true,
                  requestId: id,
                },
              });
              setSent(result.ok);
              setFeedback(result.message);
            } catch {
              setFeedback(
                "We couldn’t submit your message. Please try again or email us directly.",
              );
            } finally {
              setBusy(false);
            }
          }}
          onChange={() => setRequestId("")}
        >
          <div>
            <label htmlFor="name" className="text-sm font-medium">
              Name
            </label>
            <input
              id="name"
              name="name"
              autoComplete="name"
              maxLength={100}
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
              name="email"
              autoComplete="email"
              maxLength={254}
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
              name="message"
              minLength={10}
              maxLength={5000}
              rows={5}
              required
              className="mt-2 w-full rounded-lg border border-input bg-surface px-3.5 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/30"
            />
          </div>
          <label className="honeypot" aria-hidden="true">
            Website
            <input name="website" tabIndex={-1} autoComplete="off" />
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" required className="mt-1" />
            <span>
              I agree to have these details used to respond to my message.{" "}
              <Link to="/privacy" className="text-primary underline">
                Privacy details
              </Link>
            </span>
          </label>
          <p role="status" aria-live="polite" className="text-sm">
            {feedback}
          </p>
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-brand-gradient px-5 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {busy ? "Sending…" : "Send message"}
          </button>
        </form>
      )}
    </div>
  );
}
