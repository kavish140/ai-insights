import { useEffect, useState } from "react";
import { readerSession, trackArticleQuality } from "@/lib/reader-tracking";

export function ArticleFeedback({ slug }: { slug: string }) {
  const [vote, setVote] = useState<"helpful" | "unhelpful" | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const key = `ai-feedback:${slug}:${new Date().toISOString().slice(0, 10)}`;
  useEffect(() => {
    setVote(null);
    setMessage("");
    setBusy(false);
    try {
      const saved = sessionStorage.getItem(key);
      if (saved === "helpful" || saved === "unhelpful") setVote(saved);
    } catch {
      /* Feedback works without saved UI state. */
    }
  }, [key]);
  async function submit(next: "helpful" | "unhelpful") {
    if (!readerSession()) {
      setMessage("Feedback is unavailable with this browser's privacy or storage settings.");
      return;
    }
    setBusy(true);
    setMessage("");
    const saved = await trackArticleQuality(slug, next);
    if (saved) {
      setVote(next);
      setMessage("Thanks for your feedback. You can change your response.");
      try {
        sessionStorage.setItem(key, next);
      } catch {
        /* Optional UI persistence. */
      }
    } else setMessage("Your response could not be recorded. Try again while signed out.");
    setBusy(false);
  }
  return (
    <section
      className="mt-8 rounded-xl border border-border bg-card p-5"
      aria-labelledby="helpful-title"
    >
      <h2 id="helpful-title" className="font-semibold">
        Was this article helpful?
      </h2>
      <div className="mt-3 flex gap-3">
        {(["helpful", "unhelpful"] as const).map((choice) => (
          <button
            key={choice}
            disabled={busy}
            aria-pressed={vote === choice}
            onClick={() => void submit(choice)}
            className={`rounded-lg border px-4 py-2 text-sm disabled:opacity-50 ${vote === choice ? "border-primary bg-primary-soft" : "border-border"}`}
          >
            {choice === "helpful" ? "Yes, helpful" : "Not yet"}
          </button>
        ))}
      </div>
      {message && (
        <p role="status" className="mt-3 text-sm text-muted-foreground">
          {message}
        </p>
      )}
    </section>
  );
}
