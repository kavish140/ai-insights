import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { allRows, adminToken, messageFor, type Article } from "@/lib/admin";
import { previewArticle, type Revision } from "@/lib/admin-operations";

export function ArticleReview({
  article,
  close,
  restore,
}: {
  article: Article;
  close: () => void;
  restore: (snapshot: Article) => void;
}) {
  const [body, setBody] = useState("");
  const [history, setHistory] = useState<Revision[]>([]);
  const [message, setMessage] = useState("Loading sanitized preview…");
  const [selected, setSelected] = useState<Revision | null>(null);
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const token = await adminToken();
        const preview = await previewArticle({ data: { token, body: article.body } });
        if (active) {
          setBody(preview.body);
          setMessage("");
        }
        if (article.id) {
          const revisions = await allRows<Revision>("post_revisions", "revision", {
            column: "post_id",
            value: article.id,
          });
          if (active)
            setHistory(
              revisions
                .filter((revision) => revision.post_id === article.id)
                .sort((a, b) => b.revision - a.revision),
            );
        }
      } catch (error) {
        if (active) setMessage(messageFor(error));
      }
    })();
    return () => {
      active = false;
    };
  }, [article]);
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
        <DialogTitle>Article preview & revisions</DialogTitle>
        <DialogDescription>
          Preview uses the same HTML sanitizer as public pages. Earlier versions begin at the
          revision migration.
        </DialogDescription>
        {message && (
          <p role="status" className="text-sm">
            {message}
          </p>
        )}
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Created:{" "}
            {article.created_at ? new Date(article.created_at).toLocaleString() : "Unsaved draft"} ·
            Last modified:{" "}
            {article.updated_at ? new Date(article.updated_at).toLocaleString() : "Unsaved draft"} ·
            Revision {article.revision ?? "—"}
          </p>
          <p className="text-xs text-muted-foreground">
            {article.category} · {article.author} · {article.status}
          </p>
          <h2 className="text-2xl font-bold">{article.title}</h2>
          <p className="text-sm text-muted-foreground">{article.description}</p>
          {article.cover_image_url && (
            <img
              className="max-h-64 w-full rounded-lg object-contain"
              src={article.cover_image_url}
              alt={article.cover_image_alt}
            />
          )}
          <div className="prose-article max-w-none" dangerouslySetInnerHTML={{ __html: body }} />
        </div>
        {article.id && (
          <section className="mt-6 border-t border-border pt-5">
            <h3 className="font-semibold">Revision history</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {history.map((revision) => (
                <button
                  className="rounded-lg border border-border px-3 py-2 text-xs"
                  key={revision.revision}
                  onClick={() => setSelected(revision)}
                >
                  v{revision.revision} · {revision.source} ·{" "}
                  {new Date(revision.created_at).toLocaleString()}
                </button>
              ))}
            </div>
            {!history.length && (
              <p className="mt-2 text-sm text-muted-foreground">No snapshots available yet.</p>
            )}
            {selected && (
              <div className="mt-4 space-y-3 rounded-lg bg-secondary p-4">
                <p className="font-medium">
                  Revision {selected.revision}: {selected.snapshot.title}
                </p>
                <p className="text-xs">
                  /{selected.snapshot.slug} · {selected.snapshot.category} ·{" "}
                  {selected.snapshot.status}
                </p>
                <p className="text-xs text-muted-foreground">
                  Source: {selected.source} · Actor:{" "}
                  {selected.actor_id ??
                    (selected.source === "admin" ? "Not recorded" : "MCP or baseline snapshot")}
                </p>
                <h4 className="text-sm font-medium">Compare with current article</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr>
                        <th className="p-2">Field</th>
                        <th className="p-2">Saved revision</th>
                        <th className="p-2">Current article</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(
                        [
                          "title",
                          "slug",
                          "description",
                          "category",
                          "author",
                          "date",
                          "status",
                          "featured",
                          "cover_image_url",
                          "cover_image_alt",
                          "body",
                        ] as const
                      )
                        .filter((key) => selected.snapshot[key] !== article[key])
                        .map((key) => (
                          <tr key={key} className="border-t border-border align-top">
                            <th className="p-2">{key}</th>
                            <td className="max-w-72 whitespace-pre-wrap break-all p-2">
                              <div className="max-h-48 overflow-auto">
                                {String(selected.snapshot[key] ?? "")}
                              </div>
                            </td>
                            <td className="max-w-72 whitespace-pre-wrap break-all p-2">
                              <div className="max-h-48 overflow-auto">
                                {String(article[key] ?? "")}
                              </div>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-muted-foreground">
                  Restoration loads an unpublished draft for review. Saving uses the current
                  revision to prevent overwriting another editor's changes.
                </p>
                <details>
                  <summary className="text-sm">Saved content and metadata</summary>
                  <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap break-all text-xs">
                    {JSON.stringify(selected.snapshot, null, 2)}
                  </pre>
                </details>
                <button
                  className="rounded-lg border border-border bg-card px-3 py-2 text-sm"
                  onClick={() => {
                    if (
                      window.confirm(
                        "Load this revision into the editor as a draft? Review it and save to apply it.",
                      )
                    )
                      restore({
                        ...selected.snapshot,
                        id: article.id!,
                        revision: article.revision!,
                        status: "draft",
                      });
                  }}
                >
                  Load revision as draft corrections
                </button>
              </div>
            )}
          </section>
        )}
      </DialogContent>
    </Dialog>
  );
}
