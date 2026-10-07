import type { Article } from "@/lib/admin";
import type { Operation, PublishingActivity } from "@/lib/admin-operations";
export function DashboardInsights({
  articles,
  operations,
  activity,
  edit,
  trackingAvailable,
}: {
  articles: Article[];
  operations: Operation[];
  activity: PublishingActivity[];
  edit: (article: Article) => void;
  trackingAvailable: boolean;
}) {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
  const week = monday.toISOString().slice(0, 10);
  const month = today.slice(0, 7);
  const live = articles.filter(
    (article) => article.status === "published" && article.date <= today,
  );
  const counts = new Map<string, number>();
  articles.forEach((article) =>
    counts.set(article.category, (counts.get(article.category) ?? 0) + 1),
  );
  const last = operations.find((operation) => operation.outcome === "success");
  const recentMcp = activity
    .filter((item) => item.action === "create_draft" && item.source === "mcp-public")
    .slice(0, 5);
  const panel = "rounded-2xl border border-border bg-card p-5";
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ["Published this week", live.filter((article) => article.date >= week).length],
          ["Published this month", live.filter((article) => article.date.startsWith(month)).length],
          [
            "Scheduled",
            articles.filter((article) => article.status === "published" && article.date > today)
              .length,
          ],
          [
            "Failed MCP calls",
            trackingAvailable
              ? operations.filter((operation) => operation.outcome === "failed").length
              : "Unavailable",
          ],
        ].map(([label, count]) => (
          <div className={panel} key={label}>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="mt-2 text-2xl font-semibold">{count}</p>
          </div>
        ))}
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <section className={panel}>
          <h3 className="font-semibold">Posts by category</h3>
          <ul className="mt-4 space-y-3">
            {[...counts].map(([category, count]) => (
              <li key={category}>
                <div className="flex justify-between text-sm">
                  <span>{category}</span>
                  <span>{count}</span>
                </div>
                <div className="mt-1 h-1.5 rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${(count / Math.max(1, articles.length)) * 100}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </section>
        <section className={panel}>
          <h3 className="font-semibold">Recent MCP-created posts</h3>
          <ul className="mt-3 space-y-3">
            {recentMcp.map((item) => {
              const article = articles.find((post) => post.id === item.post_id);
              return (
                <li key={item.id} className="text-sm">
                  {article ? (
                    <button className="text-left text-primary" onClick={() => edit(article)}>
                      {article.title}
                    </button>
                  ) : (
                    "Deleted article"
                  )}
                  <p className="text-xs text-muted-foreground">
                    {new Date(item.created_at).toLocaleString()}
                  </p>
                </li>
              );
            })}
          </ul>
          {!recentMcp.length && (
            <p className="mt-3 text-sm text-muted-foreground">No MCP-created posts recorded.</p>
          )}
          <p className="mt-5 text-xs text-muted-foreground">
            Last successful MCP action:{" "}
            {last
              ? `${last.tool} · ${new Date(last.created_at).toLocaleString()}`
              : "No operation log yet"}
          </p>
        </section>
      </div>
      <section className={panel}>
        <h3 className="font-semibold">Recent publishing activity</h3>
        <ul className="mt-3 space-y-2">
          {activity.slice(0, 5).map((item) => (
            <li key={item.id} className="text-sm">
              <span className="font-medium">{item.action}</span> ·{" "}
              {articles.find((article) => article.id === item.post_id)?.title ?? "Deleted article"}
              <span className="block text-xs text-muted-foreground">
                {new Date(item.created_at).toLocaleString()} · {item.source}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
