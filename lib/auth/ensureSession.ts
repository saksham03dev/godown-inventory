"use client";

import { getSupabaseClient } from "@/lib/supabase/client";

/** Refresh the browser JWT and hit middleware so server cookies stay valid. */
export async function refreshSessionCookies(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return false;

    const res = await fetch("/api/auth/activity", {
      method: "POST",
      credentials: "include",
    });
    return res.ok;
  } catch {
    return false;
  }
}
