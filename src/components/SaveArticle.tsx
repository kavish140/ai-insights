import { Bookmark, BookmarkCheck } from "lucide-react";
import { useReader } from "./ReaderProvider";
import type { Post } from "@/lib/posts";

export function SaveArticle({ post, label = false }: { post: Post; label?: boolean }) {
  const { saved, toggleSave } = useReader();
  const isSaved = saved.some((item) => item.slug === post.slug);
  const Icon = isSaved ? BookmarkCheck : Bookmark;
  return (
    <button
      type="button"
      className={`save-article ${label ? "save-article--label" : ""}`}
      aria-pressed={isSaved}
      aria-label={`${isSaved ? "Unsave" : "Save"} ${post.title}`}
      onClick={() =>
        toggleSave({
          slug: post.slug,
          title: post.title,
          category: post.category,
          minutes: post.readingMinutes,
          progress: 0,
        })
      }
    >
      <Icon size={17} />
      {label && <span>{isSaved ? "Saved" : "Save for later"}</span>}
    </button>
  );
}
