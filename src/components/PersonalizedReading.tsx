import { useEffect, useState } from "react";
import { getPersonalizedArticles, getReaderVocabulary } from "@/lib/post-functions";
import {
  emptyPreferences,
  preferenceKey,
  readPreferences,
  resolvePreferences,
  type ReaderPreferences,
  type ReaderTag,
  type TagAlias,
} from "@/lib/reader-preferences";
import type { Post } from "@/lib/posts";
import { PostCard } from "./PostCard";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "./ui/dialog";

export function PersonalizedReading() {
  const [preferences, setPreferences] = useState<ReaderPreferences>(emptyPreferences);
  const [draft, setDraft] = useState<ReaderPreferences>(emptyPreferences);
  const [tags, setTags] = useState<ReaderTag[]>([]);
  const [aliases, setAliases] = useState<TagAlias[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [editing, setEditing] = useState(false);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    let active = true;
    let saved = emptyPreferences;
    try {
      saved = readPreferences(localStorage.getItem(preferenceKey));
    } catch {
      /* In-memory choices still work. */
    }
    void getReaderVocabulary()
      .then((data) => {
        if (!active) return;
        const resolved = resolvePreferences(saved, data.aliases);
        setTags(data.tags);
        setAliases(data.aliases);
        setPreferences(resolved);
        setDraft(resolved);
        setReady(true);
      })
      .catch(() => {
        if (active) {
          setMessage(
            "Personalized reading is temporarily unavailable. You can still browse all articles.",
          );
          setReady(true);
        }
      });
    const sync = (event: StorageEvent) => {
      if (event.key !== preferenceKey && event.key !== null) return;
      const updated = readPreferences(event.newValue);
      setPreferences(updated);
      setDraft(updated);
      setEditing(false);
    };
    window.addEventListener("storage", sync);
    return () => {
      active = false;
      window.removeEventListener("storage", sync);
    };
  }, []);
  useEffect(() => {
    if (!ready) return;
    let active = true;
    setPosts([]);
    if (!preferences.topics.length && !preferences.audiences.length) {
      setLoading(false);
      return;
    }
    setLoading(true);
    void getPersonalizedArticles({ data: preferences })
      .then((result) => {
        if (active) setPosts(result);
      })
      .catch(() => {
        if (active) setMessage("Recommendations could not load. Please try again.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [preferences, ready]);
  const hasInterests = !!(preferences.topics.length || preferences.audiences.length);
  function save(next: ReaderPreferences) {
    const resolved = resolvePreferences(next, aliases);
    setPreferences(resolved);
    setDraft(resolved);
    setEditing(false);
    setMessage("");
    setLoading(false);
    try {
      if (resolved.topics.length || resolved.audiences.length)
        localStorage.setItem(preferenceKey, JSON.stringify(resolved));
      else localStorage.removeItem(preferenceKey);
    } catch {
      setMessage(
        "Your choices apply for this visit. This browser could not save them for next time.",
      );
    }
  }
  function toggle(field: keyof ReaderPreferences, name: string) {
    const selected = draft[field];
    if (!selected.includes(name) && selected.length >= 12) return;
    setDraft({
      ...draft,
      [field]: selected.includes(name)
        ? selected.filter((tag) => tag !== name)
        : [...selected, name],
    });
  }
  return (
    <Dialog
      open={editing}
      onOpenChange={(open) => {
        if (open) setDraft(preferences);
        setEditing(open);
      }}
    >
      <section className="py-10" aria-labelledby="personal-reading-title">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 id="personal-reading-title" className="text-2xl font-semibold">
              Reading for you
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Choose your interests and find articles that fit your work.
            </p>
          </div>
          <div className="flex gap-3">
            <DialogTrigger asChild>
              <button className="rounded-lg border border-border px-3 py-2 text-sm">
                {hasInterests ? "Edit interests" : "Choose interests"}
              </button>
            </DialogTrigger>
            {hasInterests && (
              <button
                className="text-sm text-muted-foreground underline"
                onClick={() => save(emptyPreferences)}
              >
                Reset interests
              </button>
            )}
          </div>
        </div>
        <DialogContent className="max-h-[85dvh] w-[calc(100%-2rem)] overflow-y-auto rounded-2xl sm:max-w-xl">
          <DialogTitle>Your reading interests</DialogTitle>
          <DialogDescription>
            Choose what interests you. You can change or reset your choices anytime.
          </DialogDescription>
          <form
            className="space-y-5"
            onSubmit={(e) => {
              e.preventDefault();
              save(draft);
            }}
          >
            {(
              [
                ["topics", "Topics", "topic"],
                ["audiences", "Who are you reading as?", "audience"],
              ] as const
            ).map(([field, label, kind]) => (
              <fieldset key={field}>
                <legend className="font-medium">
                  {label} <span className="text-xs text-muted-foreground">(choose up to 12)</span>
                </legend>
                <div className="mt-3 flex max-h-48 flex-wrap gap-2 overflow-y-auto">
                  {[
                    ...new Set([
                      ...tags.filter((tag) => tag.kind === kind).map((tag) => tag.name),
                      ...draft[field],
                    ]),
                  ].map((name) => (
                    <label
                      key={name}
                      className={`flex cursor-pointer items-center gap-2 rounded-full border px-3 py-2 text-sm ${draft[field].includes(name) ? "border-primary bg-primary-soft" : "border-border"}`}
                    >
                      <input
                        type="checkbox"
                        checked={draft[field].includes(name)}
                        disabled={!draft[field].includes(name) && draft[field].length >= 12}
                        onChange={() => toggle(field, name)}
                      />
                      {name}
                    </label>
                  ))}
                </div>
              </fieldset>
            ))}
            <p className="text-xs text-muted-foreground">
              Optional. Choices are saved in this browser, and you can reset them at any time.
            </p>
            <div className="flex flex-wrap justify-end gap-3">
              <DialogClose asChild>
                <button type="button" className="rounded-lg border border-border px-4 py-2 text-sm">
                  Maybe later
                </button>
              </DialogClose>
              <button
                disabled={!ready || !tags.length}
                className="rounded-lg bg-brand-gradient px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
              >
                Show my reading
              </button>
            </div>
          </form>
        </DialogContent>
        {message && (
          <p role="status" className="mt-4 text-sm text-muted-foreground">
            {message}
          </p>
        )}
        {hasInterests && (
          <p className="mt-4 text-sm text-muted-foreground">
            Matching {preferences.topics.concat(preferences.audiences).join(", ")}
          </p>
        )}
        {loading && (
          <p role="status" className="mt-4 text-sm">
            Finding your reading…
          </p>
        )}
        {!loading && hasInterests && !posts.length && !message && (
          <p className="mt-4 text-sm text-muted-foreground">
            No matching articles yet. Try another topic or explore the latest articles below.
          </p>
        )}
        {!!posts.length && (
          <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => (
              <PostCard
                key={post.slug}
                post={post}
                recommendation={{ source: "home", placement: "personalized" }}
              />
            ))}
          </div>
        )}
      </section>
    </Dialog>
  );
}
