import { socialMeta } from "@/lib/social-meta";
import { createFileRoute, Link, useLoaderData } from "@tanstack/react-router";
import { AdSlot } from "@/components/AdSlot";
import { PostCard } from "@/components/PostCard";
import { SITE } from "@/lib/posts";
import { getHomeArticles } from "@/lib/post-functions";
import { ReadingPath } from "@/components/ReadingPath";
import { Newsletter } from "@/components/Newsletter";
import { PersonalizedReading } from "@/components/PersonalizedReading";
import { ArrowUpRight, ArrowRight, Search, Clock3, Compass, Sparkles } from "lucide-react";
import { useState } from "react";
import { ReadingShelf } from "@/components/ReadingShelf";
import { SaveArticle } from "@/components/SaveArticle";

export const Route = createFileRoute("/")({
  loader: () => getHomeArticles(),
  head: ({ loaderData }) => ({
    meta: [
      {
        title:
          loaderData?.settings.home_seo_title ??
          "AI Insights — Practical AI Automation & Awareness",
      },
      {
        name: "description",
        content:
          loaderData?.settings.home_seo_description ??
          "Clear guides on AI automation, agents and workflows, plus honest awareness pieces on privacy and misinformation.",
      },
      ...socialMeta({
        title:
          loaderData?.settings.home_seo_title ??
          "AI Insights — Practical AI Automation & Awareness",
        description:
          loaderData?.settings.home_seo_description ??
          "Clear guides on AI automation, agents and workflows, plus honest awareness pieces on privacy and misinformation.",
        path: "/",
      }),
    ],
    links: [{ rel: "canonical", href: SITE.url + "/" }],
  }),
  component: HomePage,
});

function HomePage() {
  const { site, categories } = useLoaderData({ from: "__root__" });
  const { featured, latest: rest, path } = Route.useLoaderData();
  const navigate = Route.useNavigate();
  const [topic, setTopic] = useState("");
  const [shortOnly, setShortOnly] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const stories = rest.filter(
    (post) => (!topic || post.category === topic) && (!shortOnly || post.readingMinutes <= 5),
  );
  const displayed = expanded ? stories : stories.slice(0, 4);
  return (
    <div className="home-editorial mx-auto max-w-6xl px-4 sm:px-6">
      <section className="editorial-intro" aria-labelledby="home-title">
        <div>
          <p className="section-eyebrow">LESS HYPE. MORE UNDERSTANDING.</p>
          <h1 id="home-title">{site.home_title}</h1>
          <p className="intro-description">{site.description}</p>
        </div>
        <form
          className="home-search"
          role="search"
          onSubmit={(event) => {
            event.preventDefault();
            const q = String(new FormData(event.currentTarget).get("q") ?? "").trim();
            void navigate({ to: "/blog", search: { q: q || undefined } });
          }}
        >
          <Search size={18} />
          <input
            name="q"
            aria-label="Search all articles"
            placeholder="What are you curious about?"
            maxLength={100}
          />
          <button type="submit" aria-label="Search">
            <ArrowRight size={18} />
          </button>
        </form>
      </section>
      <nav className="editorial-topics" aria-label="Explore topics">
        <Link to="/blog" className="topic-all">
          <Compass size={14} /> Explore all
        </Link>
        {categories.map((category) => (
          <Link key={category} to="/blog" search={{ category }}>
            {category}
            <ArrowUpRight size={12} />
          </Link>
        ))}
      </nav>
      {featured ? (
        <section className="front-page" aria-label="Featured and recent stories">
          <article className="lead-story">
            <SaveArticle post={featured} />
            <Link
              to="/blog/$slug"
              params={{ slug: featured.slug }}
              aria-label={`Read ${featured.title}`}
              className="lead-story-link"
            >
              <div className="lead-art" aria-hidden="true">
                <span className="art-caption">IDEAS INTO POSSIBILITY</span>
              </div>
              <div className="lead-copy">
                <div className="story-kicker">
                  <span>
                    <Sparkles size={12} /> EDITOR’S PICK
                  </span>
                  <span>{featured.category}</span>
                </div>
                <h2>{featured.title}</h2>
                <p>{featured.description}</p>
                <div className="story-bottom">
                  <span>
                    <Clock3 size={13} />
                    {featured.readingMinutes} min read
                  </span>
                  <strong>
                    Explore the story <ArrowUpRight size={16} />
                  </strong>
                </div>
              </div>
            </Link>
          </article>
          <aside className="front-queue" aria-label="More to explore">
            <div className="queue-heading">
              <span>ON YOUR RADAR</span>
              <span>01 — 03</span>
            </div>
            {rest.slice(0, 3).map((post, index) => (
              <Link
                key={post.slug}
                to="/blog/$slug"
                params={{ slug: post.slug }}
                className="queue-story"
              >
                <span className="queue-number">0{index + 1}</span>
                <div>
                  <small>
                    {post.category} · {post.readingMinutes} min
                  </small>
                  <h3>{post.title}</h3>
                </div>
                <ArrowUpRight size={16} />
              </Link>
            ))}
            <Link to="/blog" search={{ sort: "popular" }} className="queue-more">
              Browse most-read articles <ArrowRight size={15} />
            </Link>
          </aside>
        </section>
      ) : (
        <section className="empty-front">
          <p>Our first articles are coming soon.</p>
          <Link to="/blog">Explore the library →</Link>
        </section>
      )}
      <ReadingShelf />
      <div className="discovery-layout">
        <section className="latest-stories" aria-labelledby="latest-title">
          <div className="discovery-heading">
            <div>
              <p className="section-eyebrow">FIND YOUR NEXT GOOD READ</p>
              <h2 id="latest-title">The latest thinking</h2>
            </div>
            <Link to="/blog">
              All articles <ArrowUpRight size={15} />
            </Link>
          </div>
          <div className="discovery-controls">
            <div className="feed-topics" role="group" aria-label="Filter latest stories by topic">
              <button
                aria-pressed={!topic}
                onClick={() => {
                  setTopic("");
                  setExpanded(false);
                }}
              >
                All topics
              </button>
              {categories.map((category) => (
                <button
                  key={category}
                  aria-pressed={topic === category}
                  onClick={() => {
                    setTopic(category);
                    setExpanded(false);
                  }}
                >
                  {category}
                </button>
              ))}
            </div>
            <button
              className="quick-read-filter"
              aria-pressed={shortOnly}
              onClick={() => {
                setShortOnly(!shortOnly);
                setExpanded(false);
              }}
            >
              <Clock3 size={13} /> 5 min or less
            </button>
          </div>
          <p className="sr-only" role="status">
            {stories.length} recent stories match your selection
          </p>
          <div className="home-feed">
            {displayed.map((post) => (
              <PostCard key={post.slug} post={post} />
            ))}
          </div>
          {!stories.length && (
            <div className="feed-empty">
              <p>No recent stories match these filters.</p>
              <Link
                to="/blog"
                search={{ category: topic || undefined, sort: shortOnly ? "shortest" : "latest" }}
              >
                Explore more in the library →
              </Link>
            </div>
          )}
          <div className="feed-actions">
            {stories.length > 4 && (
              <button className="secondary-action" onClick={() => setExpanded(!expanded)}>
                {expanded ? "Show fewer stories" : `Show ${stories.length - 4} more stories`}
              </button>
            )}
            <Link to="/blog" className="text-sm font-medium text-primary">
              Explore the full library <ArrowRight size={15} />
            </Link>
          </div>
        </section>
        <aside className="discovery-sidebar">
          <div className="personalization-panel">
            <PersonalizedReading />
          </div>
          <Newsletter />
        </aside>
      </div>
      {site.show_reading_path && (
        <details className="beginner-path">
          <summary>
            <span>
              <Compass size={18} />
              <strong>New to AI? Start with a clear path.</strong>
            </span>
            <span>3 steps to get going</span>
          </summary>
          <ReadingPath posts={path} />
        </details>
      )}
      <div className="home-house-ad">
        <AdSlot format="leaderboard" />
      </div>
    </div>
  );
}
