-- ============================================================================
-- Migration: 20261122000002_fix_profiles_rls_and_columns.sql
-- Purpose:   1. Provision/normalize `public.profiles` and `public.quotes`
--            2. Eliminate RLS infinite recursion (`42P17`) via SECURITY DEFINER `public.is_admin()`
--            3. Grant authenticated users own-row SELECT/UPDATE on `public.profiles`
--               and full admin SELECT/INSERT/UPDATE/DELETE across `profiles`, `projects`, `quotes`
--            4. Ensure `salminmwenesi@gmail.com` is an active administrator
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  preferred_currency TEXT NOT NULL DEFAULT 'USD',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS full_name TEXT,
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user',
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS preferred_currency TEXT NOT NULL DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE TABLE IF NOT EXISTS public.quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  provider_id TEXT NOT NULL,
  provider_name TEXT NOT NULL,
  service_requested TEXT NOT NULL,
  estimated_budget_usd NUMERIC(15, 2) NOT NULL DEFAULT 0 CHECK (estimated_budget_usd >= 0),
  currency_code TEXT NOT NULL DEFAULT 'USD',
  scope_notes TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'SUBMITTED' CHECK (
    status IN ('pending', 'approved', 'rejected', 'SUBMITTED', 'QUOTED', 'CLOSED', 'FLAGGED', 'REJECTED')
  ),
  approved BOOLEAN NOT NULL DEFAULT FALSE,
  moderation_notes TEXT,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Non-recursive SECURITY DEFINER admin check (prevents 42P17 infinite recursion on public.profiles)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = (SELECT auth.uid())
      AND lower(trim(role)) = 'admin'
      AND lower(trim(COALESCE(status, 'active'))) <> 'suspended'
  ) OR EXISTS (
    SELECT 1
    FROM public.user_profiles
    WHERE id = (SELECT auth.uid())
      AND lower(trim(role)) = 'admin'
      AND lower(trim(COALESCE(status, 'active'))) <> 'suspended'
  );
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.is_active_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_admin();
$$;

REVOKE ALL ON FUNCTION public.is_active_admin() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_active_admin() TO authenticated, service_role;

-- Sync new Auth sign-ups into public.profiles as well as legacy public.user_profiles / public.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_full_name TEXT;
  v_currency TEXT;
BEGIN
  v_full_name := COALESCE(
    NULLIF(TRIM(NEW.raw_user_meta_data ->> 'full_name'), ''),
    NULLIF(TRIM(NEW.raw_user_meta_data ->> 'name'), ''),
    split_part(NEW.email, '@', 1)
  );

  v_currency := CASE
    WHEN (NEW.raw_user_meta_data ->> 'preferred_currency') IN (
      'USD', 'EUR', 'GBP', 'TZS', 'JPY', 'ZAR', 'AUD', 'CAD', 'CNY', 'AED'
    )
    THEN NEW.raw_user_meta_data ->> 'preferred_currency'
    ELSE 'USD'
  END;

  INSERT INTO public.profiles (id, email, full_name, role, status, preferred_currency)
  VALUES (NEW.id, NEW.email, v_full_name, 'user', 'active', v_currency)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_profiles (id, email, full_name, role, status, preferred_currency)
  VALUES (NEW.id, NEW.email, v_full_name, 'user', 'active', v_currency)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.users (id, email, full_name, role, status, preferred_currency)
  VALUES (NEW.id, NEW.email, v_full_name, 'user', 'active', v_currency)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_subscriptions (
    user_id, tier_name, status, billing_cycle, price_tzs, price_usd,
    payment_gateway, payment_rail, payment_provider, expires_at
  ) VALUES (
    NEW.id, 'Explorer', 'active', 'monthly', 0, 0,
    'FREE_TIER', 'FREE', 'FREE', NOW() + INTERVAL '3650 days'
  )
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Enable RLS and clear any legacy recursive policies on profiles, projects, quotes
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotes   ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('profiles', 'projects', 'quotes')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I;', pol.policyname, pol.schemaname, pol.tablename);
  END LOOP;
END;
$$;

-- Non-recursive RLS Policies for public.profiles
CREATE POLICY "profiles_select_own_or_admin"
  ON public.profiles FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = id OR (SELECT public.is_admin()));

CREATE POLICY "profiles_insert_admin_only"
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.is_admin()));

CREATE POLICY "profiles_update_own_or_admin"
  ON public.profiles FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = id OR (SELECT public.is_admin()))
  WITH CHECK ((SELECT auth.uid()) = id OR (SELECT public.is_admin()));

CREATE POLICY "profiles_delete_admin_only"
  ON public.profiles FOR DELETE TO authenticated
  USING ((SELECT public.is_admin()));

-- Non-recursive RLS Policies for public.projects
CREATE POLICY "projects_select_approved_own_or_admin"
  ON public.projects FOR SELECT TO anon, authenticated
  USING (
    approved = TRUE
    OR status IN ('approved', 'VERIFIED')
    OR (SELECT auth.uid()) = user_id
    OR (SELECT public.is_admin())
  );

CREATE POLICY "projects_insert_authenticated_pending"
  ON public.projects FOR INSERT TO authenticated
  WITH CHECK (
    ((SELECT auth.uid()) = user_id AND approved = FALSE AND status IN ('pending', 'PENDING_VERIFICATION'))
    OR (SELECT public.is_admin())
  );

CREATE POLICY "projects_update_own_pending_or_admin"
  ON public.projects FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id OR (SELECT public.is_admin()))
  WITH CHECK (
    ((SELECT auth.uid()) = user_id AND approved = FALSE AND status IN ('pending', 'PENDING_VERIFICATION'))
    OR (SELECT public.is_admin())
  );

CREATE POLICY "projects_delete_own_or_admin"
  ON public.projects FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id OR (SELECT public.is_admin()));

-- Non-recursive RLS Policies for public.quotes
CREATE POLICY "quotes_select_own_or_admin"
  ON public.quotes FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id OR (SELECT public.is_admin()));

CREATE POLICY "quotes_insert_authenticated_pending"
  ON public.quotes FOR INSERT TO authenticated
  WITH CHECK (
    ((SELECT auth.uid()) = user_id AND approved = FALSE AND status IN ('pending', 'SUBMITTED'))
    OR (SELECT public.is_admin())
  );

CREATE POLICY "quotes_update_own_pending_or_admin"
  ON public.quotes FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id OR (SELECT public.is_admin()))
  WITH CHECK (
    ((SELECT auth.uid()) = user_id AND approved = FALSE)
    OR (SELECT public.is_admin())
  );

CREATE POLICY "quotes_delete_own_or_admin"
  ON public.quotes FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id OR (SELECT public.is_admin()));

-- Backfill existing auth.users and ensure primary owner is an active admin
INSERT INTO public.profiles (id, email, full_name, role, status)
SELECT
  u.id,
  u.email,
  COALESCE(NULLIF(TRIM(u.raw_user_meta_data ->> 'full_name'), ''), split_part(u.email, '@', 1)),
  'user',
  'active'
FROM auth.users u
WHERE u.email IS NOT NULL
ON CONFLICT (id) DO NOTHING;

UPDATE public.profiles
SET role = 'admin', status = 'active', updated_at = NOW()
WHERE lower(email) = 'salminmwenesi@gmail.com';
