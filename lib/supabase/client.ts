/**
 * Supabase client untuk Browser (Client Components).
 * Singleton + autoRefreshToken off — refresh session ditangani proxy (server).
 * Menghindari loop Set-Cookie ↔ reload di Next.js App Router.
 */
import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase/env";

let client: SupabaseClient | undefined;

export function createClient() {
  if (!client) {
    client = createBrowserClient(getSupabaseUrl(), getSupabaseAnonKey(), {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
  }
  return client;
}
