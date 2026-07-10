import { createClient as createBrowserSupabaseClient } from "@/utils/supabase/client";

export function getSupabaseClient() {
  return createBrowserSupabaseClient();
}

export function isSupabaseConfigured(): boolean {
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && key);
}
