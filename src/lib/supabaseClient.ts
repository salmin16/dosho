import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';

/**
 * Production Vite Browser Supabase Client (`src/lib/supabaseClient.ts`)
 * - Strictly uses hosted Supabase credentials injected via Vite/Vercel env vars
 *   (`VITE_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_URL` & `VITE_SUPABASE_ANON_KEY` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`).
 * - Never falls back to localhost or fake browser `localStorage` databases.
 */

function readPublicSupabaseEnv(): { url: string; anonKey: string } | null {
  const metaEnv =
    (import.meta as unknown as { env?: Record<string, string | undefined> })
      .env ?? {};

  const rawUrl = (
    metaEnv.VITE_SUPABASE_URL ||
    metaEnv.NEXT_PUBLIC_SUPABASE_URL ||
    ''
  ).trim();

  const rawAnonKey = (
    metaEnv.VITE_SUPABASE_ANON_KEY ||
    metaEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    ''
  ).trim();

  if (
    !rawUrl ||
    !rawAnonKey ||
    rawUrl.includes('your-project-id') ||
    rawUrl.includes('your-project-ref') ||
    rawAnonKey.includes('your-public-anon-key')
  ) {
    return null;
  }

  return {
    url: rawUrl.replace(/\/$/, ''),
    anonKey: rawAnonKey,
  };
}

let cachedClient: SupabaseClient<Database> | null = null;
let initialized = false;

export function isSupabaseConfigured(): boolean {
  return readPublicSupabaseEnv() !== null;
}

export function getSupabaseClient(): SupabaseClient<Database> | null {
  if (initialized) {
    return cachedClient;
  }
  initialized = true;

  const config = readPublicSupabaseEnv();
  if (!config) {
    cachedClient = null;
    return null;
  }

  cachedClient = createClient<Database>(config.url, config.anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });

  return cachedClient;
}

export function requireSupabaseClient(): SupabaseClient<Database> {
  const client = getSupabaseClient();
  if (!client) {
    throw new Error(
      'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (or NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY) in Vercel Environment Variables.'
    );
  }
  return client;
}
