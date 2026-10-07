import { createFileRoute } from "@tanstack/react-router";
import { SITE } from "@/lib/posts";
import { socialMeta } from "@/lib/social-meta";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy — AI Insights" },
      {
        name: "description",
        content: "How AI Insights handles contact messages and newsletter subscriptions.",
      },
      ...socialMeta({
        title: "Privacy — AI Insights",
        description: "How contact messages and newsletter subscriptions are handled.",
        path: "/privacy",
      }),
    ],
    links: [{ rel: "canonical", href: SITE.url + "/privacy" }],
  }),
  component: () => (
    <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
      <h1 className="text-3xl font-bold">Privacy</h1>
      <div className="prose-article mt-6">
        <p>
          AI Insights is maintained by Kavish Ganatra. For questions about your information, email{" "}
          <a href="mailto:kavishganatra5@gmail.com">kavishganatra5@gmail.com</a>.
        </p>
        <h2>Contact messages</h2>
        <p>
          When the contact form is enabled, your name, email address and message are sent through
          Resend to our inbox so we can respond. Sending a contact message does not subscribe you to
          marketing emails. You can request deletion by email; copies may also be held in
          email-provider systems and backups.
        </p>
        <h2>Newsletter subscriptions</h2>
        <p>
          When subscriptions are enabled, your email address is stored in Resend’s contacts system
          for AI Insights newsletters. Subscribe only with an address you own. You can unsubscribe
          using the link in each newsletter or ask us to remove your details by email. We do not
          sell the subscriber list.
        </p>
        <h2>Spam prevention and hosting</h2>
        <p>
          Forms use input validation and a hidden spam-trap field to reduce automated submissions.
          Cloudflare hosts this site, and Supabase serves article content and images. These
          providers may process technical request data to operate their services.
        </p>
        <h2>Article readership</h2>
        <p>
          We count article reads using a random identifier stored only for your browser tab session.
          A view is counted once per article, session and UTC day. We record the article, date, a
          broad referral source (such as Google or direct), mobile or desktop device group, and
          whether the tab was visible for at least 30 seconds. We do not store IP addresses, full
          referring URLs or browser fingerprints in our readership database. Session records older
          than 90 days are removed on the next recorded read or admin analytics refresh; aggregate
          article view totals remain.
        </p>
        <p>
          Browsers with Do Not Track or Global Privacy Control enabled are excluded. Closing the tab
          clears its session identifier. Article tags describe intended readers; they do not
          establish your occupation or demographic identity. Hosting providers may separately
          process request logs.
        </p>
        <h2>External resources</h2>
        <p>
          Pages may load fonts from Google Fonts. External links and advertisements take you to
          services with their own privacy policies. Public pages do not require an account; the
          admin area uses a separate authenticated session.
        </p>
        <h2>Your choices</h2>
        <p>
          You can read articles without submitting personal information. Contact us to request
          access, correction or deletion of information you have provided.
        </p>
      </div>
    </div>
  ),
});
