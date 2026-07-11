"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Crown,
  Loader2,
  Lock,
  Package,
  Shield,
  Users,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { getDefaultRouteForRole, ROLE_LABELS, type UserRole } from "@/lib/auth/roles";
import { INACTIVITY_TIMEOUT_MINUTES } from "@/lib/auth/idle-timeout";
import type { PortalUserPublic } from "@/lib/types/database";

const ROLE_TABS: {
  role: UserRole;
  icon: typeof Crown;
  accent: string;
}[] = [
  { role: "admin", icon: Crown, accent: "text-amber-400" },
  { role: "manager", icon: Shield, accent: "text-sky-400" },
  { role: "employee", icon: Users, accent: "text-emerald-400" },
];

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
  const [selectedRole, setSelectedRole] = useState<UserRole>("admin");
  const [users, setUsers] = useState<PortalUserPublic[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    console.log(
      "Supabase URL Connected:",
      !!process.env.NEXT_PUBLIC_SUPABASE_URL
    );
  }, []);

  const loadUsers = useCallback(async (role: UserRole) => {
    setLoadingUsers(true);
    setSelectedUserId(null);
    setError(null);
    try {
      const res = await fetch(`/api/auth/users?role=${encodeURIComponent(role)}`, {
        method: "GET",
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          typeof data.error === "string"
            ? data.error
            : `Failed to load users (${res.status})`
        );
      }
      const nextUsers = Array.isArray(data.users) ? data.users : [];
      setUsers(nextUsers);
      if (nextUsers.length === 0) {
        console.warn("No portal users returned for role:", role, data.meta);
      }
    } catch (err) {
      setUsers([]);
      setError(err instanceof Error ? err.message : "Failed to load users");
      console.error("Login user load failed:", err);
    } finally {
      setLoadingUsers(false);
    }
  }, []);

  useEffect(() => {
    loadUsers(selectedRole);
  }, [selectedRole, loadUsers]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId) {
      setError("Select your account from the table.");
      return;
    }

    setError(null);
    setSubmitting(true);

    const { error: signInError } = await signIn(
      selectedUserId,
      password,
      selectedRole
    );

    if (signInError) {
      setError(signInError);
      setSubmitting(false);
      return;
    }

    router.push(getDefaultRouteForRole(selectedRole));
    router.refresh();
  };

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    );
  }

  const selectedUser = users.find((u) => u.id === selectedUserId);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-surface px-4 py-10">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/20">
          <Package className="h-7 w-7 text-accent" />
        </div>
        <h1 className="text-2xl font-bold text-zinc-100">Store IMS</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Choose your role, select your account, and sign in
        </p>
      </div>

      <div className="w-full max-w-3xl space-y-5">
        {timedOut && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            You were signed out after {INACTIVITY_TIMEOUT_MINUTES} minutes of
            inactivity. Please sign in again.
          </div>
        )}

        <div className="flex gap-1 rounded-xl border border-surface-border bg-surface-raised p-1">
          {ROLE_TABS.map(({ role, icon: Icon, accent }) => (
            <button
              key={role}
              type="button"
              onClick={() => setSelectedRole(role)}
              className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                selectedRole === role
                  ? "bg-accent/15 text-accent"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              <Icon className={`h-4 w-4 ${selectedRole === role ? "" : accent}`} />
              {ROLE_LABELS[role]}
            </button>
          ))}
        </div>

        <div className="overflow-hidden rounded-2xl border border-surface-border bg-surface-raised">
          <div className="border-b border-surface-border px-5 py-4">
            <h2 className="text-sm font-semibold text-zinc-200">
              {ROLE_LABELS[selectedRole]} accounts
            </h2>
            <p className="text-xs text-zinc-500">
              Click your name to select, then enter your password below
            </p>
          </div>

          {loadingUsers ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-accent" />
            </div>
          ) : users.length === 0 ? (
            <div className="px-5 py-12 text-center text-sm text-zinc-500">
              No active {ROLE_LABELS[selectedRole].toLowerCase()} accounts.
              Ask an admin to create one.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-surface-border bg-surface-overlay/50">
                    <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
                      Name
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
                      Username
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
                      Role
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-border">
                  {users.map((user) => {
                    const active = selectedUserId === user.id;
                    return (
                      <tr
                        key={user.id}
                        onClick={() => setSelectedUserId(user.id)}
                        className={`cursor-pointer transition ${
                          active
                            ? "bg-accent/10"
                            : "hover:bg-white/[0.03]"
                        }`}
                      >
                        <td className="px-5 py-3.5 font-medium text-zinc-200">
                          {user.full_name}
                          {active && (
                            <span className="ml-2 text-xs text-accent">
                              selected
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 font-mono text-xs text-zinc-400">
                          {user.username}
                        </td>
                        <td className="px-5 py-3.5 text-zinc-500">
                          {ROLE_LABELS[user.role]}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-surface-border bg-surface-raised p-6"
        >
          {error && (
            <div className="mb-4 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
              {error}
            </div>
          )}

          {selectedUser && (
            <p className="mb-4 text-sm text-zinc-400">
              Signing in as{" "}
              <span className="font-medium text-zinc-200">
                {selectedUser.full_name}
              </span>{" "}
              <span className="text-zinc-600">(@{selectedUser.username})</span>
            </p>
          )}

          <div>
            <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-zinc-500">
              <Lock className="h-3.5 w-3.5" />
              Password
            </label>
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={!selectedUserId}
              className="w-full rounded-xl border border-surface-border bg-surface-overlay px-4 py-3 text-sm text-zinc-100 outline-none transition focus:border-accent disabled:opacity-50"
              placeholder={
                selectedUserId ? "Enter your password" : "Select an account first"
              }
            />
          </div>

          <button
            type="submit"
            disabled={submitting || !selectedUserId}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-accent py-3 text-sm font-medium text-white transition hover:bg-accent-muted disabled:opacity-50"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Signing in…
              </>
            ) : (
              `Sign in to ${ROLE_LABELS[selectedRole]} Portal`
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
