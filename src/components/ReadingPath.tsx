import { Link } from "@tanstack/react-router";
import type { Post } from "@/lib/posts";

const steps = [
  {
    category: "Awareness",
    title: "Understand the basics",
    text: "Learn what AI can do and where human judgment matters.",
  },
  {
    category: "Automation",
    title: "Build your first workflow",
    text: "Pick a repeatable task and start with a small, testable automation.",
  },
  {
    category: "Strategy",
    title: "Measure the result",
    text: "Compare time, cost and quality before expanding.",
  },
];

export function ReadingPath({ posts }: { posts: (Post | null)[] }) {
  return (
    <section id="start-here" className="scroll-mt-24 py-12" aria-labelledby="start-title">
      <p className="text-xs font-semibold uppercase tracking-widest text-primary">
        A practical starting point
      </p>
      <h2 id="start-title" className="mt-2 text-2xl font-semibold">
        New to AI automation? Start here.
      </h2>
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {steps.map((step, index) => {
          const post = posts[index];
          return (
            <div key={step.category} className="rounded-2xl border border-border bg-card p-6">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-primary-soft font-semibold text-primary">
                {index + 1}
              </span>
              <h3 className="mt-4 text-lg font-semibold">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.text}</p>
              {post ? (
                <Link
                  to="/blog/$slug"
                  params={{ slug: post.slug }}
                  className="mt-4 block text-sm font-medium text-primary"
                >
                  {post.title} →
                </Link>
              ) : (
                <Link
                  to="/blog"
                  search={{ category: step.category }}
                  className="mt-4 block text-sm font-medium text-primary"
                >
                  Explore {step.category.toLowerCase()} →
                </Link>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
