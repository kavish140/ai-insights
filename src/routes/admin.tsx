import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { browserClient } from "@/lib/supabase-client";
import { AdminWorkspace } from "@/components/AdminWorkspace";
import { AdminThemeToggle } from "@/components/admin/AdminFrame";
import {
  ArrowRight,
  ArrowUpRight,
  ShieldCheck,
  Eye,
  EyeOff,
  FileText,
  BarChart3,
  Sparkles,
  LockKeyhole,
} from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import adminCss from "../admin.css?url";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [{ title: "Admin — AI Insights" }, { name: "robots", content: "noindex, nofollow" }],
    links: [{ rel: "stylesheet", href: adminCss }],
  }),
  component: AdminPage,
});

const inputClass = "mt-2 w-full rounded-lg border border-input bg-surface px-3.5 py-2.5 text-sm";

function AdminPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | undefined;
    void browserClient()
      .then(async (client) => {
        const { data } = client.auth.onAuthStateChange((_event, nextSession) => {
          if (active) setSession(nextSession);
        });
        unsubscribe = () => data.subscription.unsubscribe();
        if (!active) {
          unsubscribe();
          return;
        }
        const { data: auth, error } = await client.auth.getSession();
        if (error) throw error;
        if (active) {
          setSession(auth.session);
          setLoading(false);
        }
      })
      .catch((error) => {
        if (active) {
          setMessage(error.message);
          setLoading(false);
        }
      });
    return () => {
      active = false;
      unsubscribe?.();
    };
  }, []);

  async function signIn(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const { error } = await (await browserClient()).auth.signInWithPassword({ email, password });
      if (error) throw error;
      setPassword("");
      setShowPassword(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Sign-in failed.");
    } finally {
      setBusy(false);
    }
  }

  if (loading)
    return (
      <div className="admin-auth-loading" role="status">
        <span className="admin-brand-mark">AI</span>
        <p>Opening your workspace…</p>
      </div>
    );
  if (!session)
    return (
      <div className="admin-auth">
        <header className="admin-auth-header">
          <a href="/" className="admin-brand">
            <span>AI</span>
            <div>
              <strong>AI Insights</strong>
              <small>EDITORIAL WORKSPACE</small>
            </div>
          </a>
          <AdminThemeToggle />
        </header>
        <div className="admin-auth-layout">
          <section className="admin-auth-intro">
            <p className="admin-eyebrow">A SPACE FOR GOOD IDEAS</p>
            <h2>
              Your next great story <br />
              starts here.
            </h2>
            <p>
              A considered workspace for your content, your audience, and everything you’re
              building.
            </p>
            <div className="admin-auth-capabilities">
              <span>
                <FileText size={17} /> Shape your publication
              </span>
              <span>
                <BarChart3 size={17} /> Understand your readers
              </span>
              <span>
                <Sparkles size={17} /> Keep your best work in focus
              </span>
            </div>
            <a href="/">
              Back to the publication <ArrowUpRight size={16} />
            </a>
          </section>
          <section className="admin-auth-card">
            <span className="admin-auth-lock">
              <LockKeyhole size={23} />
            </span>
            <p className="admin-eyebrow">ADMIN SIGN-IN</p>
            <h1>Welcome back.</h1>
            <p className="admin-auth-description">
              Sign in with your designated editor account to open your workspace.
            </p>
            <form onSubmit={signIn} className="admin-auth-form">
              <label className="block">
                Email
                <input
                  className={inputClass}
                  type="email"
                  required
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
              <label className="block">
                Password
                <div className="admin-password-field">
                  <input
                    aria-label="Password"
                    className={inputClass}
                    type={showPassword ? "text" : "password"}
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    aria-pressed={showPassword}
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </label>
              <button
                disabled={busy}
                className="admin-auth-submit bg-brand-gradient text-primary-foreground"
              >
                {busy ? "Signing in…" : "Open workspace"}
                <ArrowRight size={16} />
              </button>
              {message && (
                <p role="alert" className="admin-auth-error">
                  {message}
                </p>
              )}
            </form>
            <p className="admin-auth-footnote">
              <ShieldCheck size={14} /> Restricted to designated editors.
            </p>
          </section>
        </div>
        <p className="admin-auth-copyright">AI Insights · A SiteNova publication</p>
      </div>
    );

  return (
    <AdminWorkspace
      key={session.user.id}
      signOut={async () => {
        const { error } = await (await browserClient()).auth.signOut();
        if (error) throw error;
        setMessage("");
      }}
    />
  );
}
