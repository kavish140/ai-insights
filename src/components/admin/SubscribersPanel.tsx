import { useEffect, useState } from "react";
import { adminToken, messageFor } from "@/lib/admin";
import { getSubscribers } from "@/lib/admin-operations";
import { subscriberCsv, type Subscriber, type SubscriberPage } from "@/lib/resend-subscribers";

const button = "rounded-lg border border-border px-3 py-2 text-sm disabled:opacity-50";
export function SubscribersPanel() {
  const [contacts, setContacts] = useState<Subscriber[]>([]);
  const [result, setResult] = useState<SubscriberPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const data = await getSubscribers({
          data: { token: await adminToken() },
        });
        if (active) {
          setResult(data);
          setContacts(data.contacts);
        }
      } catch (error) {
        if (active) setMessage(messageFor(error));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);
  async function load(more = false) {
    setLoading(true);
    setMessage("");
    try {
      const data = await getSubscribers({
        data: {
          token: await adminToken(),
          cursor: more ? (result?.nextCursor ?? undefined) : undefined,
        },
      });
      setResult(data);
      setContacts((current) => [
        ...new Map(
          (more ? [...current, ...data.contacts] : data.contacts).map((contact) => [
            contact.id,
            contact,
          ]),
        ).values(),
      ]);
      if (!more) setPage(1);
    } catch (error) {
      setMessage(messageFor(error));
    } finally {
      setLoading(false);
    }
  }
  const filtered = contacts.filter(
    (contact) =>
      (status === "all" ||
        (status === "subscribed" ? !contact.unsubscribed : contact.unsubscribed)) &&
      `${contact.email} ${contact.first_name ?? ""} ${contact.last_name ?? ""}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const pages = Math.max(1, Math.ceil(filtered.length / 25));
  const current = Math.min(page, pages);
  function exportCsv() {
    const url = URL.createObjectURL(
      new Blob([subscriberCsv(filtered)], { type: "text/csv;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `ai-insights-contacts-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <section className="space-y-5 rounded-2xl border border-border bg-card p-5 sm:p-6">
      <div className="flex flex-wrap justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Newsletter subscribers</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Read-only list from Supabase. Unsubscribed contacts are marked so they can be excluded
            from campaigns.
          </p>
        </div>
        <button className={button} disabled={loading} onClick={() => void load()}>
          Refresh subscribers
        </button>
      </div>
      {result?.message && <p className="rounded-lg bg-secondary p-3 text-sm">{result.message}</p>}
      {message && (
        <p role="alert" className="text-sm">
          {message}
        </p>
      )}
      {result?.available && (
        <>
          <p className="text-sm">
            {contacts.length} contacts loaded ·{" "}
            {contacts.filter((contact) => !contact.unsubscribed).length} subscribed ·{" "}
            {contacts.filter((contact) => contact.unsubscribed).length} unsubscribed
            {result.hasMore ? " · More contacts available" : " · All contacts loaded"}
          </p>
          {!contacts.length && (
            <p role="status" className="rounded-lg bg-secondary p-3 text-sm">
              No newsletter signups have been stored yet. New subscriptions appear here
              automatically. Existing Resend contacts need to be imported separately.
            </p>
          )}
          <div className="flex flex-wrap gap-3">
            <input
              aria-label="Search loaded contacts"
              className={`${button} flex-1 bg-surface`}
              type="search"
              placeholder="Search loaded emails or names"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
            <select
              aria-label="Subscription status"
              className={`${button} bg-surface`}
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
            >
              <option value="all">All statuses</option>
              <option value="subscribed">Subscribed</option>
              <option value="unsubscribed">Unsubscribed</option>
            </select>
            <button className={button} disabled={!filtered.length || loading} onClick={exportCsv}>
              Export filtered loaded contacts
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[550px] text-left text-sm">
              <thead>
                <tr>
                  {["Email", "Name", "Status", "Contact created"].map((label) => (
                    <th key={label} className="pb-3">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.slice((current - 1) * 25, current * 25).map((contact) => (
                  <tr key={contact.id} className="border-t border-border">
                    <td className="py-3 break-all">{contact.email}</td>
                    <td>
                      {`${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim() || "—"}
                    </td>
                    <td>{contact.unsubscribed ? "Unsubscribed" : "Subscribed"}</td>
                    <td>{new Date(contact.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!!contacts.length && !filtered.length && (
              <p role="status" className="py-4 text-sm text-muted-foreground">
                No loaded contacts match your search or status filter.
              </p>
            )}
          </div>
          {!filtered.length && (
            <p className="text-sm text-muted-foreground">No matching contacts.</p>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <button
              className={button}
              disabled={current === 1}
              onClick={() => setPage(current - 1)}
            >
              Previous
            </button>
            <span className="text-xs">
              Page {current} of {pages} loaded
            </span>
            <button
              className={button}
              disabled={current === pages}
              onClick={() => setPage(current + 1)}
            >
              Next
            </button>
            {result.hasMore && (
              <button className={button} disabled={loading} onClick={() => void load(true)}>
                {loading ? "Loading…" : "Load more subscribers"}
              </button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Signup time and subscription status come from Supabase. Consent does not imply double
            opt-in verification. CSV exports include only the filtered contacts loaded here.
          </p>
        </>
      )}
      {loading && (
        <p role="status" className="text-sm">
          Loading subscribers…
        </p>
      )}
    </section>
  );
}
