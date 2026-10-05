import { createFileRoute, Link } from "@tanstack/react-router";
import { SITE } from "@/lib/posts";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About AI Insights — Who Writes This & Why" },
      {
        name: "description",
        content:
          "AI Insights publishes practical AI automation guides and awareness pieces for people who want useful answers, not hype.",
      },
      { property: "og:title", content: "About AI Insights" },
      {
        property: "og:description",
        content: "Practical AI automation guides and awareness pieces, written without hype.",
      },
      { property: "og:url", content: SITE.url + "/about" },
    ],
    links: [{ rel: "canonical", href: SITE.url + "/about" }],
  }),
  component: AboutPage,
});

function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <h1 className="text-3xl font-bold md:text-4xl">About {SITE.name}</h1>
      <div className="prose-article mt-6">
        <p>
          {SITE.name} covers two things: how to automate real work with AI, and how to stay aware of
          what AI is doing to information, privacy and jobs. Every article aims to be something you
          can act on the same week you read it.
        </p>
        <h2>What you'll find here</h2>
        <ul>
          <li>
            <strong>Automation:</strong> step-by-step playbooks for automating repetitive work
          </li>
          <li>
            <strong>Awareness:</strong> plain-language pieces on privacy, misinformation and risk
          </li>
          <li>
            <strong>Strategy:</strong> honest frameworks for measuring whether any of it pays off
          </li>
        </ul>
        <h2>How articles are written</h2>
        <p>
          Recommendations come from things actually tried, and limitations are stated instead of
          skipped. Where a tool is mentioned, the tradeoffs come with it.
        </p>
      </div>
      <Link
        to="/blog"
        className="mt-10 inline-block rounded-lg bg-brand-gradient px-5 py-2.5 text-sm font-medium text-primary-foreground"
      >
        Read the articles
      </Link>
    </div>
  );
}
