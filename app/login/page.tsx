"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Lock, Package, User } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { getDefaultRouteForRole } from "@/lib/auth/roles";
import { INACTIVITY_TIMEOUT_MINUTES } from "@/lib/auth/idle-timeout";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-surface">
          <Loader2 className="h-8 w-8 animate-spin text-accent" />
        </div>
      }
    >
      <LoginPageContent />
    </Suspense>
  );
}

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const timedOut = searchParams.get("timeout") === "1";
  const { signIn, loading: authLoading } = useAuth();

  const [needsBootstrap, setNeedsBootstrap] = useState(false);
  const [checkingBootstrap, setCheckingBootstrap] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("System Administrator");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const checkBootstrap = useCallback(async () => {
    setCheckingBootstrap(true);
    try {
      const res = await fetch("/api/auth/bootstrap", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      setNeedsBootstrap(Boolean(data.needsBootstrap));
    } catch {
      setNeedsBootstrap(false);
    } finally {
      setCheckingBootstrap(false);
    }
  }, []);

  useEffect(() => {
    void checkBootstrap();
  }, [checkBootstrap]);

  const handleBootstrap = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/bootstrap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          password,
          full_name: fullName,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to create admin.");
        setSubmitting(false);
        return;
      }
      setNeedsBootstrap(false);
      const { error: signInError } = await signIn(username, password);
      if (signInError) {
        setError(signInError);
        setSubmitting(false);
        return;
      }
      router.push(getDefaultRouteForRole("admin"));
      router.refresh();
    } catch {
      setError("Failed to create admin account.");
      setSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const { error: signInError, redirectTo } = await signIn(username, password);

    if (signInError) {
      setError(signInError);
      setSubmitting(false);
      return;
    }

    router.push(redirectTo ?? "/");
    router.refresh();
  };

  if (authLoading || checkingBootstrap) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-surface px-4 py-10">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/20">
          <Package className="h-7 w-7 text-accent" />
        </div>
        <h1 className="text-2xl font-bold text-zinc-100">Store IMS</h1>
        <p className="mt-1 text-sm text-zinc-500">
          {needsBootstrap
            ? "Create the first admin account"
            : "Sign in with your username and password"}
        </p>
      </div>

      <div className="w-full max-w-md space-y-5">
        {timedOut && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            You were signed out after {INACTIVITY_TIMEOUT_MINUTES} minutes of
            inactivity. Please sign in again.
          </div>
        )}

        <form
          onSubmit={needsBootstrap ? handleBootstrap : handleSubmit}
          className="rounded-2xl border border-surface-border bg-surface-raised p-6"
        >
          {error && (
            <div className="mb-4 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
              {error}
            </div>
          )}

          {needsBootstrap && (
            <div className="mb-4">
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-zinc-500">
                Full name
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full rounded-xl border border-surface-border bg-surface-overlay px-4 py-3 text-sm text-zinc-100 outline-none focus:border-accent"
              />
            </div>
          )}

          <div>
            <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-zinc-500">
              <User className="h-3.5 w-3.5" />
              Username
            </label>
            <input
              type="text"
              required
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded-xl border border-surface-border bg-surface-overlay px-4 py-3 text-sm text-zinc-100 outline-none focus:border-accent"
              placeholder="e.g. admin"
            />
          </div>

          <div className="mt-4">
            <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-zinc-500">
              <Lock className="h-3.5 w-3.5" />
              Password
            </label>
            <input
              type="password"
              required
              autoComplete={
                needsBootstrap ? "new-password" : "current-password"
              }
              minLength={needsBootstrap ? 8 : 1}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-surface-border bg-surface-overlay px-4 py-3 text-sm text-zinc-100 outline-none focus:border-accent"
              placeholder={
                needsBootstrap ? "At least 8 characters" : "Enter your password"
              }
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-accent py-3 text-sm font-medium text-white transition hover:bg-accent-muted disabled:opacity-50"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {needsBootstrap ? "Creating…" : "Signing in…"}
              </>
            ) : needsBootstrap ? (
              "Create admin & sign in"
            ) : (
              "Sign in"
            )}
          </button>
        </form>

        <p className="text-center text-xs text-zinc-600">
          Passwords are stored in Supabase Auth — not in application tables.
        </p>
      </div>
    </div>
  );
}
