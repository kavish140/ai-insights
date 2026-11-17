import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, BookOpen, X } from "lucide-react";
import type { Post } from "@/lib/posts";
import { useReader } from "./ReaderProvider";
import { SaveArticle } from "./SaveArticle";

export function ArticleReadingTools({ post, next }: { post: Post; next?: Post | undefined }) {
  const { remember, recent, ready } = useReader();
  const [progress, setProgress] = useState(0);
  const [resume, setResume] = useState<number | null>(null);
  const initialized = useRef(false);
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    if (ready && !initialized.current) {
      initialized.current = true;
      setResume(recent.find((item) => item.slug === post.slug)?.progress ?? 0);
    }
  }, [ready, recent, post.slug]);
  useEffect(() => {
    setProgress(0);
    let frame = 0,
      latest = 0,
      lastSaved = -1;
    const item = {
      slug: post.slug,
      title: post.title,
      category: post.category,
      minutes: post.readingMinutes,
    };
    const measure = () => {
      frame = 0;
      const body = document.querySelector<HTMLElement>("[data-article-body]");
      if (!body) return;
      const rect = body.getBoundingClientRect();
      latest = Math.round(
        Math.max(
          0,
          Math.min(
            100,
            (100 * (80 - rect.top)) / Math.max(1, rect.height - window.innerHeight + 80),
          ),
        ),
      );
      setProgress(latest);
      if (latest > 0 && Math.floor(latest / 10) !== lastSaved) {
        lastSaved = Math.floor(latest / 10);
        remember({ ...item, progress: latest });
      }
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    const flush = () => {
      if (latest > 0) remember({ ...item, progress: latest });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    window.addEventListener("pagehide", flush);
    measure();
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, [post.slug, post.title, post.category, post.readingMinutes, remember]);
  // Capture a previous position once; never move the page without the reader asking.
  const resumeProgress = resume ?? 0;
  return (
    <>
      <div
        className="article-progress"
        role="progressbar"
        aria-label="Article reading progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progress}
      >
        <span style={{ width: `${progress}%` }} />
      </div>
      <div className="article-tools">
        <span>
          <BookOpen size={15} />
          {Math.max(0, Math.ceil(post.readingMinutes * (1 - progress / 100)))} min left
        </span>
        <SaveArticle post={post} label />
        {resumeProgress > 5 && resumeProgress < 95 && progress < 5 && (
          <button
            className="resume-reading"
            onClick={() => {
              const body = document.querySelector<HTMLElement>("[data-article-body]");
              if (body)
                window.scrollTo({
                  top:
                    window.scrollY +
                    body.getBoundingClientRect().top +
                    (resumeProgress / 100) *
                      Math.max(1, body.offsetHeight - window.innerHeight + 80) -
                    80,
                  behavior: "instant",
                });
              body?.focus({ preventScroll: true });
              setResume(0);
            }}
          >
            Resume at {resumeProgress}% <ArrowRight size={14} />
          </button>
        )}
      </div>
      {next && progress >= 65 && !dismissed && (
        <div className="read-next-dock">
          <span>UP NEXT</span>
          <Link to="/blog/$slug" params={{ slug: next.slug }}>
            {next.title}
            <ArrowRight size={16} />
          </Link>
          <small>{next.readingMinutes} min</small>
          <button aria-label="Dismiss next article suggestion" onClick={() => setDismissed(true)}>
            <X size={16} />
          </button>
        </div>
      )}
    </>
  );
}
