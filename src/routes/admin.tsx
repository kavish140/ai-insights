import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { browserClient } from "@/lib/supabase-client";
import { AdminWorkspace } from "@/components/AdminWorkspace";
import type { Session } from "@supabase/supabase-js";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [{ title: "Admin — AI Insights" }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: AdminPage,
});

const inputClass = "mt-2 w-full rounded-lg border border-input bg-surface px-3.5 py-2.5 text-sm";

function AdminPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Sign-in failed.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <p className="mx-auto max-w-md px-4 py-16">Loading admin…</p>;
  if (!session)
    return (
      <div className="mx-auto max-w-md px-4 py-16">
        <h1 className="text-2xl font-bold">Admin sign-in</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Sign in with your designated Supabase editor account.
        </p>
        <form onSubmit={signIn} className="mt-6 space-y-4">
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
            <input
              className={inputClass}
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <button
            disabled={busy}
            className="rounded-lg bg-brand-gradient px-5 py-2.5 text-primary-foreground"
          >
            {busy ? "Signing in…" : "Sign in"}
          </button>
          {message && (
            <p role="status" className="text-sm">
              {message}
            </p>
          )}
        </form>
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
