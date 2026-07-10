"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { hasPermission, type UserRole } from "@/lib/auth/roles";
import { useIdleTimeout } from "@/hooks/useIdleTimeout";

export interface UserProfile {
  id: string;
  username: string;
  full_name: string;
  role: UserRole;
}

interface AuthContextValue {
  profile: UserProfile | null;
  role: UserRole | null;
  loading: boolean;
  signIn: (
    userId: string,
    password: string,
    role: UserRole
  ) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
  can: (permission: Parameters<typeof hasPermission>[1]) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshSession = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/session");
      if (res.status === 401) {
        setProfile(null);
        return;
      }
      const data = await res.json();
      setProfile(data.user ?? null);
    } catch {
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshSession();
  }, [refreshSession]);

  const signIn = useCallback(
    async (userId: string, password: string, role: UserRole) => {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, password, role }),
      });
      const data = await res.json();
      if (!res.ok) {
        return { error: data.error ?? "Login failed." };
      }
      setProfile(data.user);
      return { error: null };
    },
    []
  );

  const signOut = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setProfile(null);
  }, []);

  const handleIdleLogout = useCallback(async () => {
    await signOut();
    window.location.href = "/login?timeout=1";
  }, [signOut]);

  useIdleTimeout({
    enabled: Boolean(profile),
    onIdle: handleIdleLogout,
  });

  const can = useCallback(
    (permission: Parameters<typeof hasPermission>[1]) =>
      hasPermission(profile?.role, permission),
    [profile?.role]
  );

  const value = useMemo(
    () => ({
      profile,
      role: profile?.role ?? null,
      loading,
      signIn,
      signOut,
      refreshSession,
      can,
    }),
    [profile, loading, signIn, signOut, refreshSession, can]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
