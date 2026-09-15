import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cachedClient: SupabaseClient | null = null;

/**
 * Server-only Supabase client using the service_role key — bypasses Row Level Security, which
 * is correct here since this app has no per-user auth model; every server route is already a
 * trusted backend. Never import this from a client component.
 */
export function getSupabase(): SupabaseClient {
  if (cachedClient) return cachedClient;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY가 .env.local에 설정되어 있지 않습니다.");
  }

  cachedClient = createClient(url, key, { auth: { persistSession: false } });
  return cachedClient;
}
