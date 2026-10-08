import { useEffect, useState } from "react";
import { browserClient } from "@/lib/supabase-client";
import { adminToken, messageFor } from "@/lib/admin";
import { getEmailConfiguration } from "@/lib/admin-operations";
import {
  defaultSiteSettings,
  normalizeSettings,
  siteSettingsSchema,
  type Settings,
  type SiteSettings,
} from "@/lib/site-settings";

const input = "mt-2 w-full rounded-lg border border-input bg-surface px-3 py-2.5 text-sm";
const button =
  "rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50";
const panel = "rounded-2xl border border-border bg-card p-5 sm:p-6";
type History = {
  id: number;
  actor_id: string | null;
  before_value: Record<string, unknown>;
  created_at: string;
};

export function SettingsPanel({
  settings,
  topics,
  run,
  onDirty,
}: {
  settings: Settings;
  topics: string[];
  run: (action: () => Promise<void>, success: string) => Promise<void>;
  onDirty: (dirty: boolean) => void;
}) {
  const [draft, setDraft] = useState<SiteSettings>(() => siteSettingsSchema.parse(settings));
  const [history, setHistory] = useState<History[]>([]);
  const [notice, setNotice] = useState("");
  const [checkingConnections, setCheckingConnections] = useState(true);
  const [connections, setConnections] = useState<{
    resendConfigured: boolean;
    newsletterStorageConfigured: boolean;
    contactConfigured: boolean;
  } | null>(null);
  const dirty = JSON.stringify(draft) !== JSON.stringify(siteSettingsSchema.parse(settings));
  const ready = settings.settings_revision > 0;
  useEffect(() => {
    setDraft(siteSettingsSchema.parse(settings));
  }, [settings]);
  useEffect(() => {
    onDirty(dirty);
    return () => onDirty(false);
  }, [dirty, onDirty]);
  useEffect(() => {
    if (!dirty) return;
    const prevent = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", prevent);
    return () => window.removeEventListener("beforeunload", prevent);
  }, [dirty]);
  useEffect(() => {
    let active = true;
    void (async () => {
      const configuration = await getEmailConfiguration({ data: { token: await adminToken() } });
      if (active) setConnections(configuration);
    })()
      .catch((error) => {
        if (active) setNotice(messageFor(error));
      })
      .finally(() => {
        if (active) setCheckingConnections(false);
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (!ready) return;
    let active = true;
    void (async () => {
      const { data, error } = await (
        await browserClient()
      )
        .from("site_settings_history")
        .select("id,actor_id,before_value,created_at")
        .order("id", { ascending: false })
        .limit(10);
      if (error) throw error;
      if (active) setHistory(data ?? []);
    })().catch((error) => {
      if (active) setNotice(messageFor(error));
    });
    return () => {
      active = false;
    };
  }, [ready, settings.settings_revision]);
  function text(key: keyof SiteSettings, label: string, max: number, rows = 1, optional = false) {
    return (
      <label className="block text-sm font-medium" key={key}>
        {label}
        <textarea
          className={input}
          required={!optional}
          rows={rows}
          maxLength={max}
          value={String(draft[key] ?? "")}
          onChange={(event) => setDraft({ ...draft, [key]: event.target.value })}
        />
      </label>
    );
  }
  function toggle(
    key: "show_reading_path" | "show_house_ads" | "newsletter_enabled" | "contact_form_enabled",
    label: string,
  ) {
    return (
      <label className="flex items-center gap-3 text-sm" key={key}>
        <input
          type="checkbox"
          checked={draft[key]}
          onChange={(event) => setDraft({ ...draft, [key]: event.target.checked })}
        />
        {label}
      </label>
    );
  }
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Site settings</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Control the public site and defaults for new drafts. Saving applies changes immediately.
        </p>
      </div>
      {!ready && (
        <p role="status" className="rounded-lg border border-border bg-secondary p-4 text-sm">
          Apply the expanded site settings SQL migration to enable these controls.
        </p>
      )}
      {notice && (
        <p role="status" className="rounded-lg border border-border p-4 text-sm">
          {notice}
        </p>
      )}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void run(async () => {
            const parsed = siteSettingsSchema.safeParse(draft);
            if (!parsed.success)
              throw new Error(
                parsed.error.issues
                  .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
                  .join("; "),
              );
            const { data, error } = await (
              await browserClient()
            )
              .from("site_settings")
              .update(parsed.data)
              .eq("id", true)
              .eq("settings_revision", settings.settings_revision)
              .select("settings_revision")
              .maybeSingle();
            if (error) throw error;
            if (!data)
              throw new Error(
                "Settings changed in another tab. Copy your edits, then reload saved settings before trying again.",
              );
          }, "Site settings saved.");
        }}
        className="space-y-6"
      >
        <fieldset disabled={!ready} className="min-w-0 space-y-6">
          <section className={panel}>
            <h3 className="mb-5 text-lg font-semibold">Branding & navigation</h3>
            <div className="grid gap-5 sm:grid-cols-2">
              {text("name", "Site name", 80)}
              {text("brand_initials", "Logo initials", 3)}
              {text("tagline", "Tagline", 160)}
              {text("header_cta_label", "Header button label", 30)}
              <div className="sm:col-span-2">{text("description", "Site description", 500, 3)}</div>
              {text("footer_note", "Footer copyright note", 200)}
            </div>
          </section>
          <section className={panel}>
            <h3 className="mb-5 text-lg font-semibold">Homepage & search appearance</h3>
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="sm:col-span-2">{text("home_title", "Homepage heading", 120)}</div>
              {text("home_seo_title", "Homepage SEO title", 120)}
              {text("home_seo_description", "Homepage SEO description", 160, 3)}
              {(
                [
                  ["home_latest_count", "Latest homepage articles", 2, 24],
                  ["articles_per_page", "Articles per listing page", 6, 48],
                ] as const
              ).map(([key, label, min, max]) => (
                <label key={key} className="block text-sm font-medium">
                  {label}
                  <input
                    className={input}
                    type="number"
                    required
                    min={min}
                    max={max}
                    value={draft[key]}
                    onChange={(event) => setDraft({ ...draft, [key]: Number(event.target.value) })}
                  />
                </label>
              ))}
              {toggle("show_reading_path", "Show the guided reading path")}
              {toggle("show_house_ads", "Show promotional placements")}
            </div>
          </section>
          <section className={panel}>
            <h3 className="mb-5 text-lg font-semibold">Newsletter & contact</h3>
            <div className="grid gap-5 sm:grid-cols-2">
              {toggle("newsletter_enabled", "Accept newsletter subscriptions")}
              {toggle("contact_form_enabled", "Accept contact form messages")}
              {text("newsletter_title", "Newsletter heading", 120)}
              {text("newsletter_description", "Newsletter description", 400, 3)}
              {text("contact_email", "Public contact email", 254)}
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              Turning off a form pauses submissions on the server. The public contact email changes
              the Contact page link; message delivery recipients are configured on the server.
            </p>
          </section>
          <section className={panel}>
            <h3 className="mb-5 text-lg font-semibold">Publishing defaults</h3>
            <div className="grid gap-5 sm:grid-cols-2">
              {text("default_author", "Default author", 200)}
              <label className="block text-sm font-medium">
                Default category for emergency drafts
                <select
                  className={input}
                  value={draft.default_category ?? ""}
                  onChange={(event) =>
                    setDraft({ ...draft, default_category: event.target.value || null })
                  }
                >
                  <option value="">First available category</option>
                  {topics.map((topic) => (
                    <option key={topic}>{topic}</option>
                  ))}
                </select>
              </label>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              These defaults apply to new articles. Existing article authors and categories stay as
              saved.
            </p>
          </section>
          <section className={panel}>
            <h3 className="mb-5 text-lg font-semibold">Social links</h3>
            <div className="grid gap-5 sm:grid-cols-3">
              {text("linkedin_url", "LinkedIn URL", 500, 1, true)}
              {text("youtube_url", "YouTube URL", 500, 1, true)}
              {text("x_url", "X URL", 500, 1, true)}
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              Use HTTPS links. Leave a field blank to hide it from the footer.
            </p>
          </section>
          <div className="flex flex-wrap items-center gap-3">
            <button
              disabled={!dirty}
              className={`${button} bg-brand-gradient text-primary-foreground`}
            >
              Save settings
            </button>
            <button
              type="button"
              className={button}
              disabled={!dirty}
              onClick={() => {
                setDraft(siteSettingsSchema.parse(settings));
                setNotice("");
              }}
            >
              Discard edits
            </button>
            <button
              type="button"
              className={button}
              onClick={() => {
                setDraft({ ...defaultSiteSettings });
                setNotice("Default values loaded as unsaved edits. Review them and save to apply.");
              }}
            >
              Load defaults
            </button>
            <span className="text-xs text-muted-foreground">
              {dirty ? "Unsaved changes" : `Saved revision ${settings.settings_revision}`}
              {settings.settings_updated_at
                ? ` · ${new Date(settings.settings_updated_at).toLocaleString()}`
                : ""}
            </span>
          </div>
        </fieldset>
      </form>
      <section className={panel}>
        <h3 className="text-lg font-semibold">Email connections</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Connection credentials are managed on the website server.
        </p>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
          {connections ? (
            (
              [
                ["Resend API", connections.resendConfigured],
                ["Newsletter storage (Supabase)", connections.newsletterStorageConfigured],
                ["Contact delivery", connections.contactConfigured],
              ] as const
            ).map(([label, configured]) => (
              <div key={label}>
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="mt-1 font-medium">{configured ? "Configured" : "Not configured"}</dd>
              </div>
            ))
          ) : (
            <p>
              {checkingConnections ? "Checking connections…" : "Connection status unavailable."}
            </p>
          )}
        </dl>
      </section>
      <section className={panel}>
        <h3 className="text-lg font-semibold">Recent settings changes</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          The last ten saves. Restore loads the previous values as edits for review.
        </p>
        <ul className="mt-4 divide-y divide-border">
          {history.map((entry) => (
            <li key={entry.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div>
                <p className="text-sm">{new Date(entry.created_at).toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">
                  Admin {entry.actor_id ? `${entry.actor_id.slice(0, 8)}…` : "system"}
                </p>
              </div>
              <button
                type="button"
                className={button}
                onClick={() => {
                  if (dirty && !window.confirm("Replace unsaved settings with this revision?"))
                    return;
                  const restored = normalizeSettings(entry.before_value);
                  setDraft({
                    ...siteSettingsSchema.parse(restored),
                    default_category:
                      restored.default_category && topics.includes(restored.default_category)
                        ? restored.default_category
                        : null,
                  });
                  setNotice(
                    "Previous settings loaded as unsaved edits. Review and save to restore them.",
                  );
                }}
              >
                Restore previous values
              </button>
            </li>
          ))}
        </ul>
        {!history.length && (
          <p className="mt-4 text-sm text-muted-foreground">No settings changes recorded yet.</p>
        )}
      </section>
    </div>
  );
}
