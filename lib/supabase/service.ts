import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Server-only Supabase client.
 * Stock mutations require SUPABASE_SERVICE_ROLE_KEY (bypasses RLS, can EXECUTE RPCs).
 */
export function createServiceClient(options?: {
  requireServiceRole?: boolean;
}): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const publishable =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (options?.requireServiceRole) {
    if (!url || !serviceKey) {
      throw new Error(
        "SUPABASE_SERVICE_ROLE_KEY is required for stock mutations. Locally: add it to .env.local (Supabase → Project Settings → API → service_role), then restart `npm run dev`. On Netlify: Site settings → Environment variables."
      );
    }
    return createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  const key = serviceKey ?? publishable;
  if (!url || !key) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or SUPABASE_SERVICE_ROLE_KEY) in the environment."
    );
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
