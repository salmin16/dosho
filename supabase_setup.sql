-- ============================================================================
-- Mine Connect — Complete Production Supabase Setup (`supabase_setup.sql`)
-- Run in Supabase SQL Editor to provision & harden:
--   1. `public.profiles` (RBAC + User Identity Verification + Auth Trigger)
--   2. `public.services`, `public.opportunities`, `public.projects`, `public.quotes`
--   3. `public.admin_audit_logs` (Immutable Append-Only Activity Ledger)
--   4. Non-recursive SECURITY DEFINER `public.is_admin()` + Zero-Trust RLS + GRANTs
--   5. Backfill existing users & promote `salminmwenesi@gmail.com` to verified admin
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. public.profiles
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT,
  company_name TEXT,
  phone TEXT,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  verification_status TEXT NOT NULL DEFAULT 'unverified'
    CHECK (verification_status IN ('unverified', 'pending', 'verified', 'rejected')),
  verification_notes TEXT,
  verified_at TIMESTAMPTZ,
  verified_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  preferred_currency TEXT NOT NULL DEFAULT 'USD',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS full_name TEXT,
  ADD COLUMN IF NOT EXISTS company_name TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user',
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS verification_status TEXT NOT NULL DEFAULT 'unverified',
  ADD COLUMN IF NOT EXISTS verification_notes TEXT,
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS verified_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS preferred_currency TEXT NOT NULL DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- 2. public.services
CREATE TABLE IF NOT EXISTS public.services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  service_name TEXT NOT NULL,
  provider_organization TEXT NOT NULL,
  expertise_area TEXT NOT NULL,
  regional_coverage TEXT NOT NULL DEFAULT 'All Tanzania (31 Mikoa)',
  rate_or_pricing_model TEXT NOT NULL,
  estimated_rate_usd NUMERIC(18, 2) NOT NULL DEFAULT 0 CHECK (estimated_rate_usd >= 0),
  scope_description TEXT NOT NULL,
  portfolio_links TEXT NOT NULL DEFAULT '',
  certifications TEXT NOT NULL DEFAULT '',
  reference_code TEXT NOT NULL DEFAULT ('SRV-' || upper(substr(gen_random_uuid()::text, 1, 8))),
  status TEXT NOT NULL DEFAULT 'pending',
  approved BOOLEAN NOT NULL DEFAULT FALSE,
  is_featured BOOLEAN NOT NULL DEFAULT FALSE,
  rejection_reason TEXT,
  moderation_notes TEXT,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS approved BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_featured BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS moderation_notes TEXT,
  ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

ALTER TABLE public.services DROP CONSTRAINT IF EXISTS services_status_check;
ALTER TABLE public.services
  ADD CONSTRAINT services_status_check
  CHECK (status IN ('pending', 'approved', 'rejected', 'hidden', 'active', 'archived', 'flagged'));

-- 3. public.opportunities
CREATE TABLE IF NOT EXISTS public.opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  organization TEXT NOT NULL,
  category TEXT NOT NULL,
  location TEXT NOT NULL,
  deadline DATE NOT NULL DEFAULT (CURRENT_DATE + 30),
  compensation_usd NUMERIC(18, 2) NOT NULL DEFAULT 0 CHECK (compensation_usd >= 0),
  description TEXT NOT NULL,
  requirements TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
  reference_code TEXT NOT NULL DEFAULT ('OPP-' || upper(substr(gen_random_uuid()::text, 1, 8))),
  status TEXT NOT NULL DEFAULT 'pending',
  approved BOOLEAN NOT NULL DEFAULT FALSE,
  is_featured BOOLEAN NOT NULL DEFAULT FALSE,
  rejection_reason TEXT,
  moderation_notes TEXT,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.opportunities
  ADD COLUMN IF NOT EXISTS approved BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_featured BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS moderation_notes TEXT,
  ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

ALTER TABLE public.opportunities DROP CONSTRAINT IF EXISTS opportunities_status_check;
ALTER TABLE public.opportunities
  ADD CONSTRAINT opportunities_status_check
  CHECK (status IN ('pending', 'approved', 'rejected', 'hidden', 'active', 'archived', 'flagged'));

-- 4. public.projects
CREATE TABLE IF NOT EXISTS public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  mineral TEXT NOT NULL,
  region TEXT NOT NULL,
  licence_type TEXT NOT NULL,
  licence_reference TEXT NOT NULL,
  investment_usd NUMERIC(16, 2) NOT NULL DEFAULT 0 CHECK (investment_usd >= 0),
  submitted_currency TEXT NOT NULL DEFAULT 'USD',
  summary TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  approved BOOLEAN NOT NULL DEFAULT FALSE,
  is_featured BOOLEAN NOT NULL DEFAULT FALSE,
  rejection_reason TEXT,
  moderation_notes TEXT,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS approved BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_featured BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS moderation_notes TEXT,
  ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

ALTER TABLE public.projects DROP CONSTRAINT IF EXISTS projects_status_check;
ALTER TABLE public.projects
  ADD CONSTRAINT projects_status_check
  CHECK (status IN (
    'pending', 'approved', 'rejected', 'hidden',
    'PENDING_VERIFICATION', 'VERIFIED', 'ARCHIVED', 'FLAGGED', 'REJECTED'
  ));

-- 5. public.quotes
CREATE TABLE IF NOT EXISTS public.quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  provider_id TEXT NOT NULL,
  provider_name TEXT NOT NULL,
  service_requested TEXT NOT NULL,
  estimated_budget_usd NUMERIC(15, 2) NOT NULL DEFAULT 0 CHECK (estimated_budget_usd >= 0),
  currency_code TEXT NOT NULL DEFAULT 'USD',
  scope_notes TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  approved BOOLEAN NOT NULL DEFAULT FALSE,
  is_featured BOOLEAN NOT NULL DEFAULT FALSE,
  rejection_reason TEXT,
  moderation_notes TEXT,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS approved BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_featured BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS moderation_notes TEXT,
  ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

ALTER TABLE public.quotes DROP CONSTRAINT IF EXISTS quotes_status_check;
ALTER TABLE public.quotes
  ADD CONSTRAINT quotes_status_check
  CHECK (status IN (
    'pending', 'approved', 'rejected', 'hidden',
    'SUBMITTED', 'QUOTED', 'CLOSED', 'FLAGGED', 'REJECTED'
  ));

-- 6. public.admin_audit_logs (Immutable Activity & Governance Traceability)
CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_email TEXT,
  action_type TEXT NOT NULL,
  target_table TEXT NOT NULL,
  target_id TEXT,
  target_summary TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profiles_role_status ON public.profiles(role, status);
CREATE INDEX IF NOT EXISTS idx_profiles_verification_status ON public.profiles(verification_status);
CREATE INDEX IF NOT EXISTS idx_services_user_id ON public.services(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_services_approved ON public.services(approved, is_featured, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_opportunities_user_id ON public.opportunities(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_opportunities_approved ON public.opportunities(approved, is_featured, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON public.projects(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_projects_approved ON public.projects(approved, is_featured, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_quotes_user_id ON public.quotes(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_created_at ON public.admin_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_action_type ON public.admin_audit_logs(action_type);

-- 7. Non-Recursive SECURITY DEFINER Admin Helper & Triggers
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
      AND lower(trim(COALESCE(status, 'active'))) = 'active'
  );
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, status, verification_status)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data ->> 'full_name'), ''), split_part(NEW.email, '@', 1)),
    'user',
    'active',
    'unverified'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.prevent_profile_role_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_setting('role', true) = 'service_role' OR current_user IN ('postgres', 'supabase_admin') THEN
    RETURN NEW;
  END IF;
  IF NOT public.is_admin() THEN
    IF NEW.role IS DISTINCT FROM OLD.role OR NEW.status IS DISTINCT FROM OLD.status THEN
      RAISE EXCEPTION '403 Forbidden: Only active administrators may modify role or status.' USING ERRCODE = '42501';
    END IF;
    IF NEW.verification_status IS DISTINCT FROM OLD.verification_status AND NEW.verification_status <> 'pending' THEN
      RAISE EXCEPTION '403 Forbidden: Users may only request verification (pending).' USING ERRCODE = '42501';
    END IF;
    IF NEW.verified_by IS DISTINCT FROM OLD.verified_by OR NEW.verified_at IS DISTINCT FROM OLD.verified_at THEN
      RAISE EXCEPTION '403 Forbidden: Only active administrators may set verification stamps.' USING ERRCODE = '42501';
    END IF;
  END IF;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_prevent_escalation ON public.profiles;
CREATE TRIGGER trg_profiles_prevent_escalation
  BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.prevent_profile_role_escalation();

CREATE OR REPLACE FUNCTION public.prevent_admin_audit_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION '403 Forbidden: public.admin_audit_logs is append-only and immutable.' USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS trg_admin_audit_logs_immutable ON public.admin_audit_logs;
CREATE TRIGGER trg_admin_audit_logs_immutable
  BEFORE UPDATE OR DELETE ON public.admin_audit_logs
  FOR EACH ROW EXECUTE FUNCTION public.prevent_admin_audit_mutation();

CREATE OR REPLACE FUNCTION public.log_profile_signup_audit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.admin_audit_logs (
    actor_id, actor_email, action_type, target_table, target_id, target_summary, metadata
  ) VALUES (
    NEW.id, NEW.email, 'USER_SIGNUP', 'public.profiles', NEW.id::TEXT,
    COALESCE(NEW.full_name, NEW.email), jsonb_build_object('role', NEW.role)
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_log_signup_audit ON public.profiles;
CREATE TRIGGER trg_profiles_log_signup_audit
  AFTER INSERT ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.log_profile_signup_audit();

-- 8. Row Level Security & SQL Table Grants
ALTER TABLE public.profiles         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunities    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotes           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated, service_role;
GRANT SELECT ON public.services, public.opportunities, public.projects TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.services, public.opportunities, public.projects, public.quotes TO authenticated, service_role;
REVOKE UPDATE, DELETE ON public.admin_audit_logs FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.admin_audit_logs TO authenticated;
GRANT ALL ON public.admin_audit_logs TO service_role;

DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT schemaname, tablename, policyname FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('profiles', 'services', 'opportunities', 'projects', 'quotes', 'admin_audit_logs')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I;', pol.policyname, pol.schemaname, pol.tablename);
  END LOOP;
END;
$$;

-- profiles
CREATE POLICY "profiles_select_own_or_admin" ON public.profiles FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = id OR (SELECT public.is_admin()));
CREATE POLICY "profiles_insert_admin_only" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.is_admin()));
CREATE POLICY "profiles_update_own_or_admin" ON public.profiles FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = id OR (SELECT public.is_admin()))
  WITH CHECK ((SELECT auth.uid()) = id OR (SELECT public.is_admin()));
CREATE POLICY "profiles_delete_admin_only" ON public.profiles FOR DELETE TO authenticated
  USING ((SELECT public.is_admin()));

-- services
CREATE POLICY "services_select_approved_own_or_admin" ON public.services FOR SELECT TO anon, authenticated
  USING ((approved = TRUE AND status IN ('approved', 'active')) OR (SELECT auth.uid()) = user_id OR (SELECT public.is_admin()));
CREATE POLICY "services_insert_authenticated_pending" ON public.services FOR INSERT TO authenticated
  WITH CHECK (((SELECT auth.uid()) = user_id AND approved = FALSE AND status = 'pending') OR (SELECT public.is_admin()));
CREATE POLICY "services_update_own_pending_or_admin" ON public.services FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id OR (SELECT public.is_admin()))
  WITH CHECK (((SELECT auth.uid()) = user_id AND approved = FALSE AND status = 'pending') OR (SELECT public.is_admin()));
CREATE POLICY "services_delete_own_or_admin" ON public.services FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id OR (SELECT public.is_admin()));

-- opportunities
CREATE POLICY "opportunities_select_approved_own_or_admin" ON public.opportunities FOR SELECT TO anon, authenticated
  USING ((approved = TRUE AND status IN ('approved', 'active')) OR (SELECT auth.uid()) = user_id OR (SELECT public.is_admin()));
CREATE POLICY "opportunities_insert_authenticated_pending" ON public.opportunities FOR INSERT TO authenticated
  WITH CHECK (((SELECT auth.uid()) = user_id AND approved = FALSE AND status = 'pending') OR (SELECT public.is_admin()));
CREATE POLICY "opportunities_update_own_pending_or_admin" ON public.opportunities FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id OR (SELECT public.is_admin()))
  WITH CHECK (((SELECT auth.uid()) = user_id AND approved = FALSE AND status = 'pending') OR (SELECT public.is_admin()));
CREATE POLICY "opportunities_delete_own_or_admin" ON public.opportunities FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id OR (SELECT public.is_admin()));

-- projects
CREATE POLICY "projects_select_approved_own_or_admin" ON public.projects FOR SELECT TO anon, authenticated
  USING ((approved = TRUE AND status IN ('approved', 'VERIFIED')) OR (SELECT auth.uid()) = user_id OR (SELECT public.is_admin()));
CREATE POLICY "projects_insert_authenticated_pending" ON public.projects FOR INSERT TO authenticated
  WITH CHECK (((SELECT auth.uid()) = user_id AND approved = FALSE AND status IN ('pending', 'PENDING_VERIFICATION')) OR (SELECT public.is_admin()));
CREATE POLICY "projects_update_own_pending_or_admin" ON public.projects FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id OR (SELECT public.is_admin()))
  WITH CHECK (((SELECT auth.uid()) = user_id AND approved = FALSE AND status IN ('pending', 'PENDING_VERIFICATION')) OR (SELECT public.is_admin()));
CREATE POLICY "projects_delete_own_or_admin" ON public.projects FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id OR (SELECT public.is_admin()));

-- quotes
CREATE POLICY "quotes_select_own_or_admin" ON public.quotes FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id OR (SELECT public.is_admin()));
CREATE POLICY "quotes_insert_authenticated_pending" ON public.quotes FOR INSERT TO authenticated
  WITH CHECK (((SELECT auth.uid()) = user_id AND approved = FALSE AND status IN ('pending', 'SUBMITTED')) OR (SELECT public.is_admin()));
CREATE POLICY "quotes_update_own_pending_or_admin" ON public.quotes FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id OR (SELECT public.is_admin()))
  WITH CHECK (((SELECT auth.uid()) = user_id AND approved = FALSE) OR (SELECT public.is_admin()));
CREATE POLICY "quotes_delete_own_or_admin" ON public.quotes FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id OR (SELECT public.is_admin()));

-- admin_audit_logs
CREATE POLICY "admin_audit_logs_insert_authenticated" ON public.admin_audit_logs FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = actor_id OR (SELECT public.is_admin()));
CREATE POLICY "admin_audit_logs_select_admin_only" ON public.admin_audit_logs FOR SELECT TO authenticated
  USING ((SELECT public.is_admin()));

-- 9. Backfill Existing Users & Promote Primary Verified Admin
INSERT INTO public.profiles (id, email, full_name, role, status, verification_status)
SELECT
  u.id,
  u.email,
  COALESCE(NULLIF(TRIM(u.raw_user_meta_data ->> 'full_name'), ''), split_part(u.email, '@', 1)),
  CASE WHEN lower(trim(u.email)) = 'salminmwenesi@gmail.com' THEN 'admin' ELSE 'user' END,
  'active',
  CASE WHEN lower(trim(u.email)) = 'salminmwenesi@gmail.com' THEN 'verified' ELSE 'unverified' END
FROM auth.users u
WHERE u.email IS NOT NULL
ON CONFLICT (id) DO UPDATE SET
  role = CASE WHEN lower(trim(EXCLUDED.email)) = 'salminmwenesi@gmail.com' THEN 'admin' ELSE public.profiles.role END,
  status = CASE WHEN lower(trim(EXCLUDED.email)) = 'salminmwenesi@gmail.com' THEN 'active' ELSE public.profiles.status END,
  verification_status = CASE WHEN lower(trim(EXCLUDED.email)) = 'salminmwenesi@gmail.com' THEN 'verified' ELSE public.profiles.verification_status END,
  verified_at = CASE WHEN lower(trim(EXCLUDED.email)) = 'salminmwenesi@gmail.com' THEN COALESCE(public.profiles.verified_at, NOW()) ELSE public.profiles.verified_at END,
  updated_at = NOW();

NOTIFY pgrst, 'reload schema';

SELECT id, email, full_name, role, status, verification_status, created_at
FROM public.profiles
ORDER BY created_at DESC;
