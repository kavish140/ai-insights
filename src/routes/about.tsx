import { socialMeta } from "@/lib/social-meta";
import { createFileRoute, Link } from "@tanstack/react-router";
import { SITE } from "@/lib/posts";
import { EDITOR } from "@/lib/editorial";
import { Newsletter } from "@/components/Newsletter";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About AI Insights — Who Writes This & Why" },
      {
        name: "description",
        content:
          "AI Insights publishes practical AI automation guides and awareness pieces for people who want useful answers, not hype.",
      },
      ...socialMeta({
        title: "About AI Insights — Who Writes This & Why",
        description:
          "AI Insights publishes practical AI automation guides and awareness pieces for people who want useful answers, not hype.",
        path: "/about",
      }),
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
        <h2>Meet {EDITOR.name}</h2>
        <p>{EDITOR.bio}</p>
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
          Our editorial standard is to distinguish hands-on observations from documentation and
          opinion. Guides should identify their sources, explain limitations and state the relevant
          tool versions or update dates. Where a tool is mentioned, the tradeoffs belong alongside
          it.
        </p>
        <h2>How to use our guides</h2>
        <p>
          Start with a small task and sample data. Test the output, decide what needs human
          approval, and compare the results with your current process before using a workflow more
          widely.
        </p>
        <h2>Corrections and updates</h2>
        <p>
          AI tools change quickly. Article pages show their latest update date when available. If a
          claim, link or instruction looks wrong, <Link to="/contact">send a correction</Link>
          with the article URL and the detail that needs review.
        </p>
        <h2>Advertising and independence</h2>
        <p>
          SiteNova is promoted in clearly labelled house advertisements. Advertising placements are
          separate from article recommendations. Any sponsored or affiliate content should be
          disclosed on the relevant article.
        </p>
      </div>
      <Link
        to="/blog"
        className="mt-10 inline-block rounded-lg bg-brand-gradient px-5 py-2.5 text-sm font-medium text-primary-foreground"
      >
        Read the articles
      </Link>
      <div className="mt-12">
        <Newsletter />
      </div>
    </div>
  );
}
