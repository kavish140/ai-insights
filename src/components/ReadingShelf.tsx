import { Bookmark, History, ArrowUpRight } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useReader } from "./ReaderProvider";

export function ReadingShelf() {
  const { saved, recent, toggleSave, clearRecent } = useReader();
  if (!saved.length && !recent.length) return null;
  const unfinished = recent.filter((item) => item.progress > 0 && item.progress < 95);
  return (
    <details className="reading-shelf">
      <summary>
        <span className="flex items-center gap-2">
          <Bookmark size={16} /> Your reading space
        </span>
        <span>
          {saved.length} saved{unfinished.length ? ` · ${unfinished.length} in progress` : ""}
        </span>
      </summary>
      <div className="shelf-content">
        {unfinished.length > 0 && (
          <div>
            <h3>
              <History size={14} /> Pick up where you left off
            </h3>
            {unfinished.slice(0, 2).map((item) => (
              <Link
                className="shelf-item"
                key={item.slug}
                to="/blog/$slug"
                params={{ slug: item.slug }}
              >
                <span>
                  {item.title}
                  <small>{item.progress}% read · resume inside the article</small>
                </span>
                <ArrowUpRight size={16} />
              </Link>
            ))}
          </div>
        )}
        <div>
          <h3>
            <Bookmark size={14} /> Saved for later
          </h3>
          {saved.length ? (
            saved.map((item) => (
              <div className="shelf-item" key={item.slug}>
                <Link to="/blog/$slug" params={{ slug: item.slug }}>
                  {item.title}
                  <small>
                    {item.minutes} min · {item.category}
                  </small>
                </Link>
                <button
                  aria-label={`Remove ${item.title} from saved articles`}
                  className="text-xs text-muted-foreground underline"
                  onClick={() => toggleSave(item)}
                >
                  Remove
                </button>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">
              Tap the bookmark on a story to keep it here.
            </p>
          )}
        </div>
      </div>
      {recent.length > 0 && (
        <div className="border-t border-border px-5 py-3">
          <button className="text-xs text-muted-foreground underline" onClick={clearRecent}>
            Clear reading history
          </button>
        </div>
      )}
    </details>
  );
}
