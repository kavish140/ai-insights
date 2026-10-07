import { useState } from "react";
import { adminToken, messageFor, type Article } from "@/lib/admin";
import {
  probeMcp,
  retryMcp,
  retryableTools,
  type Operation,
  type PublishingActivity,
} from "@/lib/admin-operations";

const button = "rounded-lg border border-border px-3 py-2 text-sm disabled:opacity-50";
const panel = "rounded-2xl border border-border bg-card p-5";
export function ActivityPanel({
  operations,
  activity,
  articles,
  error,
  refresh,
  edit,
}: {
  operations: Operation[];
  activity: PublishingActivity[];
  articles: Article[];
  error: string;
  refresh: () => Promise<void>;
  edit: (article: Article) => void;
}) {
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Operation | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [health, setHealth] = useState<Awaited<ReturnType<typeof probeMcp>> | null>(null);
  const filtered = operations.filter(
    (operation) =>
      (filter === "all" || operation.outcome === filter) &&
      `${operation.tool} ${operation.result.post?.title ?? ""} ${operation.error ?? ""}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const pages = Math.max(1, Math.ceil(filtered.length / 25));
  const current = Math.min(page, pages);
  async function checkHealth() {
    setBusy(true);
    setMessage("");
    try {
      setHealth(await probeMcp({ data: { token: await adminToken() } }));
    } catch (err) {
      setMessage(messageFor(err));
    } finally {
      setBusy(false);
    }
  }
  async function retry(operation: Operation) {
    if (
      !window.confirm(
        `Retry ${operation.tool} with its original arguments? Publishing and unpublishing will change the live site.`,
      )
    )
      return;
    setBusy(true);
    setMessage("");
    try {
      await retryMcp({ data: { token: await adminToken(), operationId: operation.id } });
      setMessage("Operation retried successfully.");
    } catch (err) {
      setMessage(messageFor(err));
    } finally {
      await refresh().catch((err) => setMessage(messageFor(err)));
      setBusy(false);
    }
  }
  return (
    <div className="space-y-5">
      <section className={panel}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold">MCP activity & health</h2>
          <button disabled={busy} className={button} onClick={() => void checkHealth()}>
            {busy ? "Checking…" : "Check MCP health"}
          </button>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Health checks contact the deployed MCP. Operation history begins when the updated function
          is deployed.
        </p>
        {health && (
          <div className="mt-4 rounded-lg bg-secondary p-4 text-sm">
            <p>
              {health.online ? "MCP online" : "MCP unavailable"} · {health.latency} ms · Version{" "}
              {health.version}
            </p>
            <p className="mt-1">
              Database: {health.database} · Activity tracking:{" "}
              {health.tracking ? "enabled" : "not enabled in deployed version"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Checked {new Date(health.checkedAt).toLocaleString()}
            </p>
            {health.error && <p>{health.error}</p>}
          </div>
        )}
        {error && (
          <p role="status" className="mt-4 text-sm">
            {error}
          </p>
        )}
        {message && (
          <p role="status" className="mt-4 text-sm">
            {message}
          </p>
        )}
      </section>
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          ["Recorded calls", error ? "Unavailable" : operations.length],
          [
            "Failed calls",
            error
              ? "Unavailable"
              : operations.filter((operation) => operation.outcome === "failed").length,
          ],
          [
            "Success rate",
            operations.length
              ? `${Math.round((operations.filter((operation) => operation.outcome === "success").length / operations.length) * 100)}%`
              : "No calls yet",
          ],
        ].map(([label, value]) => (
          <div key={label} className={panel}>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="mt-2 text-2xl font-semibold">{value}</p>
          </div>
        ))}
      </div>
      <section className={panel}>
        <div className="mb-4 flex flex-wrap gap-3">
          <input
            aria-label="Search operations"
            className={`${button} flex-1 bg-surface`}
            type="search"
            value={search}
            placeholder="Tool, article or error"
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />
          <select
            aria-label="Operation result"
            className={`${button} bg-surface`}
            value={filter}
            onChange={(event) => {
              setFilter(event.target.value);
              setPage(1);
            }}
          >
            <option value="all">All results</option>
            <option value="success">Success</option>
            <option value="failed">Failed</option>
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] text-left text-sm">
            <thead>
              <tr>
                {["Time", "Action", "Article / image", "Result", "Details"].map((label) => (
                  <th className="pb-3" key={label}>
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.slice((current - 1) * 25, current * 25).map((operation) => (
                <tr className="border-t border-border" key={operation.id}>
                  <td className="py-3">{new Date(operation.created_at).toLocaleString()}</td>
                  <td>{operation.tool}</td>
                  <td>
                    {operation.result.post?.title ??
                      operation.result.image?.alt ??
                      (articles.find((article) => article.id === operation.arguments["post_id"])
                        ?.title ||
                        "—")}
                  </td>
                  <td
                    className={operation.outcome === "failed" ? "text-destructive" : "text-primary"}
                  >
                    {operation.outcome}
                    {operation.result.replayed && " (replayed)"}
                  </td>
                  <td>
                    <button className={button} onClick={() => setSelected(operation)}>
                      Details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!filtered.length && (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No matching operation records.
          </p>
        )}
        <div className="mt-4 flex justify-between text-sm">
          <span>
            Page {current} of {pages}
          </span>
          <div className="flex gap-2">
            <button
              className={button}
              disabled={current === 1}
              onClick={() => setPage(current - 1)}
            >
              Previous
            </button>
            <button
              className={button}
              disabled={current === pages}
              onClick={() => setPage(current + 1)}
            >
              Next
            </button>
          </div>
        </div>
      </section>
      {selected && (
        <section className={`${panel} space-y-3`}>
          <div className="flex justify-between">
            <h3 className="font-semibold">
              {selected.tool} · {selected.outcome}
            </h3>
            <button className={button} onClick={() => setSelected(null)}>
              Close
            </button>
          </div>
          <p className="text-sm">Duration: {selected.duration_ms} ms</p>
          {selected.error && (
            <p role="status" className="text-sm text-destructive">
              {selected.error}
            </p>
          )}
          <details open>
            <summary className="text-sm font-medium">Request arguments</summary>
            <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-secondary p-3 text-xs">
              {JSON.stringify(selected.arguments, null, 2)}
            </pre>
          </details>
          <details>
            <summary className="text-sm font-medium">Result details</summary>
            <pre className="mt-2 overflow-auto whitespace-pre-wrap break-all bg-secondary p-3 text-xs">
              {JSON.stringify(selected.result, null, 2)}
            </pre>
          </details>
          <div className="flex flex-wrap gap-2">
            {selected.outcome === "failed" && retryableTools.includes(selected.tool) && (
              <button disabled={busy} className={button} onClick={() => void retry(selected)}>
                Retry failed operation
              </button>
            )}
            {selected.tool === "upload_image" && selected.outcome === "failed" && (
              <p className="text-sm text-muted-foreground">
                Re-upload the original file through Media or MCP; image bytes are not retained.
              </p>
            )}
            {articles.find(
              (article) =>
                article.id === selected.result.post?.id ||
                article.id === selected.arguments["post_id"],
            ) && (
              <button
                className={button}
                onClick={() => {
                  const article = articles.find(
                    (article) =>
                      article.id === selected.result.post?.id ||
                      article.id === selected.arguments["post_id"],
                  );
                  if (article) edit(article);
                }}
              >
                Manage article
              </button>
            )}
          </div>
        </section>
      )}
      <section className={panel}>
        <h3 className="font-semibold">Publishing audit trail</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Successful database changes, including earlier MCP activity and manual corrections.
        </p>
        <ul className="mt-4 divide-y divide-border">
          {activity.slice(0, 30).map((item) => (
            <li className="py-3 text-sm" key={item.id}>
              <p>
                {item.action} ·{" "}
                {articles.find((article) => article.id === item.post_id)?.title ??
                  "Deleted article"}{" "}
                · Revision {item.revision}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {new Date(item.created_at).toLocaleString()} · {item.source} ·{" "}
                {item.status ?? "deleted"}
              </p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
