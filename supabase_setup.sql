-- ============================================================================
-- Mine Connect — Companion Production Supabase Setup (`supabase_setup.sql`)
-- Run once in Supabase SQL Editor (or via `supabase db push`) to provision:
--   1. `public.profiles` (RBAC + Auth Trigger, strictly defaults role = 'user')
--   2. `public.projects` (Project Listings + Moderation Approval Queue)
--   3. `public.quotes`   (Service Quote Requests + Moderation Approval Queue)
--   4. Zero-Trust Row Level Security (RLS) policies + Admin RBAC (`is_admin()`)
--   5. Idempotent promotion of `salminmwenesi@gmail.com` to active admin
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ----------------------------------------------------------------------------
-- 1. TABLES (`public.profiles`, `public.projects`, `public.quotes`)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  preferred_currency TEXT NOT NULL DEFAULT 'USD' CHECK (
    preferred_currency IN ('USD', 'EUR', 'GBP', 'TZS', 'JPY', 'ZAR', 'AUD', 'CAD', 'CNY', 'AED')
  ),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure optional columns exist even if public.profiles was created earlier
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS full_name TEXT,
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user',
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS preferred_currency TEXT NOT NULL DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE TABLE IF NOT EXISTS public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (char_length(trim(title)) > 0 AND char_length(title) <= 200),
  mineral TEXT NOT NULL,
  region TEXT NOT NULL,
  licence_type TEXT NOT NULL,
  licence_reference TEXT NOT NULL,
  investment_usd NUMERIC(16, 2) NOT NULL DEFAULT 0 CHECK (investment_usd >= 0),
  submitted_currency TEXT NOT NULL DEFAULT 'USD',
  summary TEXT NOT NULL CHECK (char_length(summary) <= 10000),
  status TEXT NOT NULL DEFAULT 'PENDING_VERIFICATION' CHECK (
    status IN ('pending', 'approved', 'rejected', 'PENDING_VERIFICATION', 'VERIFIED', 'ARCHIVED', 'FLAGGED', 'REJECTED')
  ),
  approved BOOLEAN NOT NULL DEFAULT FALSE,
  moderation_notes TEXT,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  provider_id TEXT NOT NULL,
  provider_name TEXT NOT NULL,
  service_requested TEXT NOT NULL,
  estimated_budget_usd NUMERIC(15, 2) NOT NULL DEFAULT 0 CHECK (estimated_budget_usd >= 0),
  currency_code TEXT NOT NULL DEFAULT 'USD',
  scope_notes TEXT NOT NULL CHECK (char_length(scope_notes) <= 5000),
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

-- Performance indexes for RLS predicates & approval queue filtering
CREATE INDEX IF NOT EXISTS idx_profiles_role_status ON public.profiles(role, status);
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON public.projects(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_projects_status_approved ON public.projects(status, approved);
CREATE INDEX IF NOT EXISTS idx_quotes_user_id ON public.quotes(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_quotes_status_approved ON public.quotes(status, approved);

-- ----------------------------------------------------------------------------
-- 2. HELPER FUNCTIONS & TRIGGERS
-- ----------------------------------------------------------------------------

-- Non-recursive admin check (SECURITY DEFINER avoids infinite RLS recursion)
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
      AND role = 'admin'
      AND status = 'active'
  );
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, service_role;

-- Generic updated_at timestamp trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_projects_updated_at ON public.projects;
CREATE TRIGGER trg_projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_quotes_updated_at ON public.quotes;
CREATE TRIGGER trg_quotes_updated_at
  BEFORE UPDATE ON public.quotes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Automatically provision `public.profiles` on every Supabase Auth signup
-- Strictly hardcodes role = 'user' (client payloads can NEVER self-assign admin)
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

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Block non-admin privilege escalation on `public.profiles`
CREATE OR REPLACE FUNCTION public.prevent_profile_role_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_setting('role', true) = 'service_role'
     OR current_user IN ('postgres', 'supabase_admin') THEN
    RETURN NEW;
  END IF;

  IF (NEW.role IS DISTINCT FROM OLD.role OR NEW.status IS DISTINCT FROM OLD.status) THEN
    IF NOT public.is_admin() THEN
      RAISE EXCEPTION '403 Forbidden: Only active administrators may modify role or status.'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_prevent_escalation ON public.profiles;
CREATE TRIGGER trg_profiles_prevent_escalation
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_profile_role_escalation();

-- ----------------------------------------------------------------------------
-- 3. ROW LEVEL SECURITY (RLS) POLICIES — NON-RECURSIVE SECURITY DEFINER
-- ----------------------------------------------------------------------------

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotes   ENABLE ROW LEVEL SECURITY;

-- Grant table-level SQL privileges to PostgREST roles so RLS governs row access (fixes 42501 permission denied)
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated, service_role;
GRANT SELECT ON public.projects TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.projects TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quotes TO authenticated, service_role;

-- Drop any legacy / potentially recursive (42P17) policies before recreating cleanly
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

-- 3.1 public.profiles
DROP POLICY IF EXISTS "profiles_select_own_or_admin" ON public.profiles;
CREATE POLICY "profiles_select_own_or_admin"
  ON public.profiles FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = id OR (SELECT public.is_admin()));

DROP POLICY IF EXISTS "profiles_insert_admin_only" ON public.profiles;
CREATE POLICY "profiles_insert_admin_only"
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.is_admin()));

DROP POLICY IF EXISTS "profiles_update_own_or_admin" ON public.profiles;
CREATE POLICY "profiles_update_own_or_admin"
  ON public.profiles FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = id OR (SELECT public.is_admin()))
  WITH CHECK ((SELECT auth.uid()) = id OR (SELECT public.is_admin()));

DROP POLICY IF EXISTS "profiles_delete_admin_only" ON public.profiles;
CREATE POLICY "profiles_delete_admin_only"
  ON public.profiles FOR DELETE TO authenticated
  USING ((SELECT public.is_admin()));

-- 3.2 public.projects
DROP POLICY IF EXISTS "projects_select_approved_own_or_admin" ON public.projects;
CREATE POLICY "projects_select_approved_own_or_admin"
  ON public.projects FOR SELECT TO anon, authenticated
  USING (
    approved = TRUE
    OR status IN ('approved', 'VERIFIED')
    OR (SELECT auth.uid()) = user_id
    OR (SELECT public.is_admin())
  );

DROP POLICY IF EXISTS "projects_insert_authenticated_pending" ON public.projects;
CREATE POLICY "projects_insert_authenticated_pending"
  ON public.projects FOR INSERT TO authenticated
  WITH CHECK (
    ((SELECT auth.uid()) = user_id AND approved = FALSE AND status IN ('pending', 'PENDING_VERIFICATION'))
    OR (SELECT public.is_admin())
  );

DROP POLICY IF EXISTS "projects_update_own_pending_or_admin" ON public.projects;
CREATE POLICY "projects_update_own_pending_or_admin"
  ON public.projects FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id OR (SELECT public.is_admin()))
  WITH CHECK (
    ((SELECT auth.uid()) = user_id AND approved = FALSE AND status IN ('pending', 'PENDING_VERIFICATION'))
    OR (SELECT public.is_admin())
  );

DROP POLICY IF EXISTS "projects_delete_own_or_admin" ON public.projects;
CREATE POLICY "projects_delete_own_or_admin"
  ON public.projects FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id OR (SELECT public.is_admin()));

-- 3.3 public.quotes
DROP POLICY IF EXISTS "quotes_select_own_or_admin" ON public.quotes;
CREATE POLICY "quotes_select_own_or_admin"
  ON public.quotes FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id OR (SELECT public.is_admin()));

DROP POLICY IF EXISTS "quotes_insert_authenticated_pending" ON public.quotes;
CREATE POLICY "quotes_insert_authenticated_pending"
  ON public.quotes FOR INSERT TO authenticated
  WITH CHECK (
    ((SELECT auth.uid()) = user_id AND approved = FALSE AND status IN ('pending', 'SUBMITTED'))
    OR (SELECT public.is_admin())
  );

DROP POLICY IF EXISTS "quotes_update_admin_or_own_pending" ON public.quotes;
CREATE POLICY "quotes_update_admin_or_own_pending"
  ON public.quotes FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id OR (SELECT public.is_admin()))
  WITH CHECK (
    ((SELECT auth.uid()) = user_id AND approved = FALSE)
    OR (SELECT public.is_admin())
  );

DROP POLICY IF EXISTS "quotes_delete_own_or_admin" ON public.quotes;
CREATE POLICY "quotes_delete_own_or_admin"
  ON public.quotes FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id OR (SELECT public.is_admin()));

-- ----------------------------------------------------------------------------
-- 4. BACKFILL EXISTING AUTH USERS & PROMOTE PRIMARY ADMIN
-- ----------------------------------------------------------------------------

-- Backfill any existing auth.users rows missing from public.profiles
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

-- Promote primary administrator (`salminmwenesi@gmail.com`) purely in PostgreSQL
UPDATE public.profiles
SET role = 'admin', status = 'active', updated_at = NOW()
WHERE lower(email) = 'salminmwenesi@gmail.com';
