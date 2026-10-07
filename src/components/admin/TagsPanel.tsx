import { useEffect, useState } from "react";
import { allRows, messageFor, type Article } from "@/lib/admin";
import { browserClient } from "@/lib/supabase-client";
import type { ReaderTag, TagAlias } from "@/lib/reader-preferences";

const input = "rounded-lg border border-input bg-surface px-3 py-2 text-sm";
export function TagsPanel({
  articles,
  run,
}: {
  articles: Article[];
  run: (action: () => Promise<void>, success: string) => Promise<void>;
}) {
  const [tags, setTags] = useState<ReaderTag[]>([]);
  const [aliases, setAliases] = useState<TagAlias[]>([]);
  const [kind, setKind] = useState<ReaderTag["kind"]>("topic");
  const [name, setName] = useState("");
  const [search, setSearch] = useState("");
  const [target, setTarget] = useState<{ source: string; name: string } | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  async function load() {
    const [vocabulary, redirects] = await Promise.all([
      allRows<ReaderTag>("reader_tags", ["kind", "name"]),
      allRows<TagAlias>("reader_tag_aliases", ["kind", "alias"]),
    ]);
    setTags(vocabulary);
    setAliases(redirects);
  }
  useEffect(() => {
    void load()
      .catch((e) => setError(messageFor(e)))
      .finally(() => setLoading(false));
  }, []);
  const field = kind === "topic" ? "tags" : "audience_tags";
  const usage = (tag: string) => articles.filter((post) => post[field]?.includes(tag)).length;
  async function change(
    action: "create" | "merge" | "delete",
    source: string,
    destination?: string,
  ) {
    await run(
      async () => {
        const { error } = await (
          await browserClient()
        ).rpc("manage_reader_tag", {
          p_kind: kind,
          p_action: action,
          p_source: source,
          p_target: destination ?? null,
        });
        if (error) throw error;
        await load();
        setName("");
        setTarget(null);
      },
      action === "merge"
        ? "Tags combined. Articles and old links now use the target tag."
        : action === "delete"
          ? "Unused tag removed."
          : "Tag added.",
    );
  }
  return (
    <section className="space-y-5 rounded-2xl border border-border bg-card p-5">
      <h2 className="text-xl font-semibold">Tag library</h2>
      <p className="text-sm text-muted-foreground">
        Keep topics and intended readers consistent. Renaming into a new name or merging into an
        existing tag updates articles and preserves old links and saved reader interests through
        aliases.
      </p>
      {error && <p role="alert">{error}</p>}
      {loading && <p role="status">Loading tags…</p>}
      <div className="flex flex-wrap gap-3">
        <select
          aria-label="Tag type"
          className={input}
          value={kind}
          onChange={(e) => {
            setKind(e.target.value as ReaderTag["kind"]);
            setTarget(null);
          }}
        >
          <option value="topic">Topic tags</option>
          <option value="audience">Intended readers</option>
        </select>
        <input
          className={input}
          type="search"
          aria-label="Search tags"
          placeholder="Search tags"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <form
        className="flex flex-wrap gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          void change("create", name.trim().toLowerCase());
        }}
      >
        <input
          className={input}
          required
          maxLength={40}
          value={name}
          aria-label="New tag name"
          placeholder="New lowercase tag"
          onChange={(e) => setName(e.target.value)}
        />
        <button className={input}>Create tag</button>
      </form>
      {target && (
        <form
          className="space-y-3 rounded-xl bg-secondary p-4"
          onSubmit={(e) => {
            e.preventDefault();
            const destination = target.name.trim().toLowerCase();
            if (
              window.confirm(
                `Replace “${target.source}” with “${destination}” on ${usage(target.source)} articles? Old tag links will still work.`,
              )
            )
              void change("merge", target.source, destination);
          }}
        >
          <p className="text-sm">
            Rename or merge <strong>{target.source}</strong>
          </p>
          <label className="block text-sm">
            Target name
            <input
              className={`${input} ml-3`}
              required
              maxLength={40}
              value={target.name}
              list="merge-tag-targets"
              onChange={(e) => setTarget({ ...target, name: e.target.value })}
            />
          </label>
          <datalist id="merge-tag-targets">
            {tags
              .filter((tag) => tag.kind === kind && tag.name !== target.source)
              .map((tag) => (
                <option key={tag.name} value={tag.name} />
              ))}
          </datalist>
          <div className="flex gap-3">
            <button className={input}>Apply to articles</button>
            <button type="button" className={input} onClick={() => setTarget(null)}>
              Cancel
            </button>
          </div>
        </form>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr>
              <th className="pb-3">Tag</th>
              <th>Articles</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {tags
              .filter((tag) => tag.kind === kind && tag.name.includes(search.trim().toLowerCase()))
              .map((tag) => (
                <tr key={tag.name} className="border-t border-border">
                  <td className="py-3 pr-3">{tag.name}</td>
                  <td>{usage(tag.name)}</td>
                  <td className="flex flex-wrap gap-2 py-3">
                    <button
                      className={input}
                      onClick={() => setTarget({ source: tag.name, name: "" })}
                    >
                      Rename / merge
                    </button>
                    <button
                      className={input}
                      disabled={
                        usage(tag.name) > 0 ||
                        aliases.some((alias) => alias.kind === kind && alias.name === tag.name)
                      }
                      onClick={() => {
                        if (window.confirm(`Delete unused tag “${tag.name}”?`))
                          void change("delete", tag.name);
                      }}
                    >
                      Delete unused
                    </button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      <details>
        <summary className="cursor-pointer text-sm font-medium">Existing aliases</summary>
        <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
          {aliases
            .filter((alias) => alias.kind === kind)
            .map((alias) => (
              <li key={alias.alias}>
                {alias.alias} → {alias.name}
              </li>
            ))}
        </ul>
      </details>
      <p className="text-xs text-muted-foreground">
        Counts include drafts and scheduled articles. Merges create new article revisions.
        Concurrent article edits still require their current revision. Tags with aliases cannot be
        deleted; merge them to preserve readers' links.
      </p>
    </section>
  );
}
