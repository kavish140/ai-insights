import { useCallback, useEffect, useState } from "react";
import {
  allRows,
  adminToken,
  messageFor,
  type Article,
  type Media,
  type Settings,
} from "@/lib/admin";
import { browserClient } from "@/lib/supabase-client";
import { probeMcp, type Operation, type PublishingActivity } from "@/lib/admin-operations";

type Controls = {
  id: boolean;
  revision: number;
  paused: boolean;
  disabled_tools: string[];
  calls_per_minute: number;
  max_image_bytes: number;
  allowed_formats: string[];
  require_cover: boolean;
  require_description: boolean;
  updated_at: string;
};
type Health = Awaited<ReturnType<typeof probeMcp>>;
type Audit = {
  id: number;
  actor_id: string | null;
  created_at: string;
  before_value: Controls;
  after_value: Controls;
};
const tools = [
  "get_site_context",
  "list_posts",
  "get_post",
  "create_draft",
  "update_draft",
  "validate_draft",
  "publish_post",
  "unpublish_post",
  "upload_image",
  "import_image_url",
  "list_images",
];
const panel = "rounded-2xl border border-border bg-card p-5";
const button = "rounded-lg border border-border px-3 py-2 text-sm disabled:opacity-50";
function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function SystemPanel({
  articles,
  media,
  topics,
  settings,
  operations,
  activity,
}: {
  articles: Article[];
  media: Media[];
  topics: string[];
  settings: Settings;
  operations: Operation[];
  activity: PublishingActivity[];
}) {
  const [controls, setControls] = useState<Controls | null>(null);
  const [original, setOriginal] = useState<Controls | null>(null);
  const [history, setHistory] = useState<{ id: string; result: Health; created_at: string }[]>([]);
  const [audit, setAudit] = useState<Audit[]>([]);
  const [health, setHealth] = useState<Health | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const load = useCallback(async () => {
    const client = await browserClient();
    const [config, checks, changes] = await Promise.all([
      client.from("mcp_controls").select("*").single(),
      client
        .from("admin_checks")
        .select("id,result,created_at")
        .eq("kind", "health")
        .order("created_at", { ascending: false })
        .limit(30),
      client
        .from("control_activity")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(30),
    ]);
    for (const response of [config, checks, changes]) if (response.error) throw response.error;
    setControls(config.data);
    setOriginal(config.data);
    setHistory(checks.data as typeof history);
    setAudit(changes.data as Audit[]);
  }, []);
  useEffect(() => {
    void load().catch((error) => setMessage(messageFor(error)));
  }, [load]);
  async function perform(action: () => Promise<void>) {
    setBusy(true);
    setMessage("");
    try {
      await action();
    } catch (error) {
      setMessage(messageFor(error));
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    if (!controls || !original) return;
    if (
      !window.confirm(
        "Apply these controls to new MCP tool calls? Disabled tools and limits can interrupt publishing.",
      )
    )
      return;
    await perform(async () => {
      const fields = {
        paused: controls.paused,
        disabled_tools: controls.disabled_tools,
        calls_per_minute: controls.calls_per_minute,
        max_image_bytes: controls.max_image_bytes,
        allowed_formats: controls.allowed_formats,
        require_cover: controls.require_cover,
        require_description: controls.require_description,
      };
      const { data, error } = await (
        await browserClient()
      )
        .from("mcp_controls")
        .update(fields)
        .eq("id", true)
        .eq("revision", original.revision)
        .select("*")
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Controls changed in another session. Reload before saving.");
      await load();
      setMessage("Controls saved. Deploy MCP version 3.0.0 to enforce them.");
    });
  }
  return (
    <div className="space-y-5">
      <section className={panel}>
        <div className="flex flex-wrap justify-between gap-3">
          <h2 className="text-xl font-semibold">System health</h2>
          <button disabled={busy} className={button} onClick={() => void perform(load)}>
            Reload system
          </button>
          <button
            disabled={busy}
            className={button}
            onClick={() =>
              void perform(async () => {
                const result = await probeMcp({ data: { token: await adminToken() } });
                setHealth(result);
                await load();
                setMessage(
                  result.saved
                    ? "Health check saved."
                    : "Health checked; apply the Top admin migration to save history.",
                );
              })
            }
          >
            Check & record health
          </button>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Manual checks record MCP availability and response time. Controls require MCP version
          3.0.0.
        </p>
        {message && (
          <p className="mt-3 text-sm" role="status">
            {message}
          </p>
        )}
        {health && (
          <p className="mt-3 text-sm">
            {health.online ? "Online" : "Unavailable"} · {health.latency} ms · v{health.version} ·
            Database {health.database} · Controls {health.controls ? "available" : "unavailable"}{" "}
            {health.paused ? "· Paused" : ""}
            {health.error && ` · ${health.error}`}
          </p>
        )}
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {[
            ["Articles loaded", articles.length],
            [
              "Registered image bytes",
              `${(media.reduce((sum, image) => sum + image.byte_size, 0) / 1048576).toFixed(2)} MiB`,
            ],
            ["Recorded MCP calls", operations.length],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg bg-secondary p-3">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="mt-1 font-semibold">{value}</p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Image totals cover registered files. Project-wide storage, billing and API usage remain in
          the Supabase dashboard.
        </p>
      </section>
      {controls && (
        <form
          className={`${panel} space-y-4`}
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <h3 className="text-lg font-semibold">MCP controls & safeguards</h3>
          <p className="text-sm text-muted-foreground">
            Limits apply globally across MCP callers. Calls already in progress may finish.
            Emergency admin corrections remain available. Publish confirmation, unique slugs and
            revision protection are always enforced.
          </p>
          <fieldset disabled={busy} className="space-y-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={controls.paused}
                onChange={(e) => setControls({ ...controls, paused: e.target.checked })}
              />
              Pause all MCP tools
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm">
                Global calls per minute
                <input
                  className={`${button} mt-2 w-full bg-surface`}
                  type="number"
                  min={1}
                  max={1000}
                  required
                  value={controls.calls_per_minute}
                  onChange={(e) =>
                    setControls({ ...controls, calls_per_minute: Number(e.target.value) })
                  }
                />
              </label>
              <label className="text-sm">
                Maximum image size (KiB)
                <input
                  className={`${button} mt-2 w-full bg-surface`}
                  type="number"
                  min={1}
                  max={4096}
                  required
                  value={controls.max_image_bytes / 1024}
                  onChange={(e) =>
                    setControls({ ...controls, max_image_bytes: Number(e.target.value) * 1024 })
                  }
                />
              </label>
            </div>
            <div className="flex gap-4">
              {["png", "jpg", "webp"].map((format) => (
                <label key={format} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={controls.allowed_formats.includes(format)}
                    onChange={(e) =>
                      setControls({
                        ...controls,
                        allowed_formats: e.target.checked
                          ? [...controls.allowed_formats, format]
                          : controls.allowed_formats.filter((value) => value !== format),
                      })
                    }
                  />
                  {format.toUpperCase()}
                </label>
              ))}
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={controls.require_cover}
                onChange={(e) => setControls({ ...controls, require_cover: e.target.checked })}
              />
              Require a featured image before MCP publication
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={controls.require_description}
                onChange={(e) =>
                  setControls({ ...controls, require_description: e.target.checked })
                }
              />
              Require an 80–160 character description before MCP publication
            </label>
            <h4 className="text-sm font-medium">Enabled tools</h4>
            <div className="grid gap-3 sm:grid-cols-3">
              {tools.map((tool) => (
                <label key={tool} className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={!controls.disabled_tools.includes(tool)}
                    onChange={(e) =>
                      setControls({
                        ...controls,
                        disabled_tools: e.target.checked
                          ? controls.disabled_tools.filter((value) => value !== tool)
                          : [...controls.disabled_tools, tool],
                      })
                    }
                  />
                  {tool}
                </label>
              ))}
            </div>
            <button
              className={button}
              disabled={
                !controls.allowed_formats.length ||
                JSON.stringify(controls) === JSON.stringify(original)
              }
            >
              Save controls
            </button>
            <button type="button" className={`${button} ml-2`} onClick={() => void perform(load)}>
              Reload controls
            </button>
          </fieldset>
        </form>
      )}
      <section className={panel}>
        <h3 className="font-semibold">Exports & recovery</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Download article data for safekeeping, including drafts. The full archive includes
          revisions, publication audit, categories, settings, media metadata and MCP controls. Image
          files and Supabase Auth are separate.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            className={button}
            disabled={busy}
            onClick={() =>
              download(
                `ai-insights-posts-${new Date().toISOString().slice(0, 10)}.json`,
                JSON.stringify({ exported_at: new Date().toISOString(), posts: articles }, null, 2),
                "application/json",
              )
            }
          >
            Export posts JSON
          </button>
          <button
            className={button}
            disabled={busy || !controls}
            onClick={() =>
              void perform(async () => {
                const [revisions, checks, controlAudit] = await Promise.all([
                  allRows("post_revisions", ["post_id", "revision"]),
                  allRows("admin_checks", "id"),
                  allRows("control_activity", "id"),
                ]);
                download(
                  `ai-insights-archive-${new Date().toISOString().slice(0, 10)}.json`,
                  JSON.stringify(
                    {
                      format: "ai-insights-content-archive",
                      version: 1,
                      exported_at: new Date().toISOString(),
                      posts: articles,
                      categories: topics,
                      settings,
                      media,
                      revisions,
                      activity,
                      operations,
                      controls,
                      checks,
                      controlAudit,
                    },
                    null,
                    2,
                  ),
                  "application/json",
                );
                setMessage(
                  "Content archive downloaded. Store it securely; it includes unpublished content and operation arguments.",
                );
              })
            }
          >
            Export content archive
          </button>
          <a
            className={button}
            href="https://supabase.com/dashboard/project/gutvbukqlqutjwlbmfpr/database/backups"
            target="_blank"
            rel="noreferrer"
          >
            Open database backups
          </a>
          <a
            className={button}
            href="https://supabase.com/dashboard/project/gutvbukqlqutjwlbmfpr/storage/buckets/blog-images"
            target="_blank"
            rel="noreferrer"
          >
            Open image storage
          </a>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Use article revision history to undo content changes. Full database recovery belongs in
          Supabase and depends on available backups. This archive is an application export, not a
          complete database backup.
        </p>
      </section>
      <section className={panel}>
        <h3 className="font-semibold">Health history</h3>
        <p className="mt-2 text-xs text-muted-foreground">
          Latest 30 requested checks; no background monitoring is running.
        </p>
        {history.map((check) => (
          <p key={check.id} className="mt-3 border-t border-border pt-3 text-sm">
            {new Date(check.created_at).toLocaleString()} ·{" "}
            {check.result.online ? "Online" : "Unavailable"} · {check.result.latency} ms · v
            {check.result.version} {check.result.error && `· ${check.result.error}`}
          </p>
        ))}
      </section>
      <section className={panel}>
        <h3 className="font-semibold">Control change audit</h3>
        {audit.map((change) => (
          <details key={change.id} className="mt-3 border-t border-border pt-3">
            <summary className="text-sm">
              {new Date(change.created_at).toLocaleString()} · v{change.after_value.revision} ·{" "}
              {change.actor_id ?? "Database operator"}
            </summary>
            <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap break-all text-xs">
              {JSON.stringify({ before: change.before_value, after: change.after_value }, null, 2)}
            </pre>
          </details>
        ))}
        {!audit.length && controls && (
          <p className="mt-3 text-sm text-muted-foreground">No control changes recorded.</p>
        )}
      </section>
    </div>
  );
}
