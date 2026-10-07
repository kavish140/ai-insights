import { Link, useLoaderData } from "@tanstack/react-router";
import { useState } from "react";
import { subscribeNewsletter } from "@/lib/engagement-functions";

export function Newsletter() {
  const { engagement, site } = useLoaderData({ from: "__root__" });
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [done, setDone] = useState(false);
  if (!site.newsletter_enabled) return null;
  return (
    <section
      aria-label={`${site.name} newsletter`}
      className="rounded-2xl border border-border bg-primary-soft/50 p-6"
    >
      <p className="text-xs font-semibold uppercase tracking-widest text-primary">Keep learning</p>
      <h2 className="mt-2 text-xl font-semibold">{site.newsletter_title}</h2>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        {site.newsletter_description}
      </p>
      {!engagement.newsletter ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Email subscriptions are coming soon.{" "}
          <Link to="/blog" className="text-primary">
            Browse the latest guides →
          </Link>
        </p>
      ) : (
        !done && (
          <form
            className="mt-5 space-y-4"
            onSubmit={async (event) => {
              event.preventDefault();
              if (busy) return;
              setBusy(true);
              setFeedback("");
              const fields = new FormData(event.currentTarget);
              try {
                const result = await subscribeNewsletter({
                  data: {
                    email: String(fields.get("email")),
                    website: String(fields.get("website") ?? ""),
                    consent: true,
                  },
                });
                setFeedback(result.message);
                setDone(result.ok);
              } catch {
                setFeedback("We couldn’t complete your subscription. Please try again.");
              } finally {
                setBusy(false);
              }
            }}
          >
            <label className="block text-sm font-medium">
              Email address
              <input
                name="email"
                type="email"
                autoComplete="email"
                maxLength={254}
                required
                className="mt-2 w-full rounded-lg border border-input bg-surface px-3 py-2.5"
              />
            </label>
            <label className="honeypot" aria-hidden="true">
              Website
              <input name="website" tabIndex={-1} autoComplete="off" />
            </label>
            <label className="flex items-start gap-2 text-xs leading-relaxed">
              <input type="checkbox" name="consent" required className="mt-1" />
              <span>
                I agree to receive {site.name} emails. Unsubscribe anytime.{" "}
                <Link to="/privacy" className="text-primary underline">
                  Privacy details
                </Link>
              </span>
            </label>
            <button
              disabled={busy}
              className="w-full rounded-lg bg-brand-gradient px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              {busy ? "Subscribing…" : "Subscribe"}
            </button>
          </form>
        )
      )}
      <p role="status" aria-live="polite" className="mt-3 text-sm">
        {feedback}
      </p>
    </section>
  );
}
