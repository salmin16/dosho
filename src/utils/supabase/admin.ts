import 'server-only';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

/**
 * Privileged Server-Only Supabase Admin Client (`service_role`).
 * Bypasses RLS strictly for verified server-side operations such as:
 * - ClickPesa webhook reconciliation (`reconcile_clickpesa_payment`)
 * - Automated live market spot price sync (`upsert_live_mineral_spot`)
 *
 * NEVER import this module in Client Components or expose SUPABASE_SERVICE_ROLE_KEY.
 */
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or server-only SUPABASE_SERVICE_ROLE_KEY environment variables.'
    );
  }

  return createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
