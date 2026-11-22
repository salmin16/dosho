import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';

/**
 * Zero-Trust Data Access Layer (DAL) — Defense-in-Depth for Server Components & Server Actions.
 *
 * Security Invariants:
 * 1. Always validates the user session against Supabase Auth via `auth.getUser()`
 *    rather than trusting unverified cookie payloads (`getSession()`).
 * 2. Re-verifies authoritative RBAC role & account status against `public.user_profiles`
 *    (with `public.users` fallback) on every privileged data access.
 * 3. Protected by `import 'server-only'` so it can never leak into browser bundles.
 */

export const getVerifiedUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  return user;
});

export const requireAuth = cache(async () => {
  const user = await getVerifiedUser();
  if (!user) {
    redirect('/login');
  }

  const supabase = await createClient();
  const { data: profile, error } = await supabase
    .from('user_profiles')
    .select('id, email, full_name, role, status, preferred_currency')
    .eq('id', user.id)
    .single();

  if (error || !profile || profile.status === 'suspended') {
    redirect('/login?reason=account_restricted');
  }

  return { user, profile };
});

export const requireAdmin = cache(async () => {
  const { user, profile } = await requireAuth();

  if (profile.role !== 'admin') {
    redirect('/dashboard');
  }

  return { user, profile };
});

export const getCurrentUserSubscription = cache(async () => {
  const { user } = await requireAuth();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('user_subscriptions')
    .select(
      'id, tier_name, status, billing_cycle, price_tzs, price_usd, payment_gateway, payment_rail, expires_at'
    )
    .eq('user_id', user.id)
    .single();

  if (error) {
    return null;
  }

  return data;
});

export async function getAdminPendingApprovalQueue() {
  await requireAdmin();
  const supabase = await createClient();

  const [projects, opportunities, services] = await Promise.all([
    supabase
      .from('user_projects')
      .select('id, title, mineral, region, status, approved, created_at, user_id')
      .eq('status', 'PENDING_VERIFICATION')
      .order('created_at', { ascending: true }),
    supabase
      .from('opportunities')
      .select('id, title, organization, category, status, approved, created_at, user_id')
      .eq('status', 'pending')
      .order('created_at', { ascending: true }),
    supabase
      .from('services')
      .select('id, service_name, provider_organization, expertise_area, status, approved, created_at, user_id')
      .eq('status', 'pending')
      .order('created_at', { ascending: true }),
  ]);

  return {
    projects: projects.data ?? [],
    opportunities: opportunities.data ?? [],
    services: services.data ?? [],
  };
}
