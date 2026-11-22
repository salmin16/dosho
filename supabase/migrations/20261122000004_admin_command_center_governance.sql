-- ============================================================================
-- Migration: 20261122000004_admin_command_center_governance.sql
-- Purpose:   Mine Connect Admin Governance Command Center
--            1. Profile identity verification columns & escalation guard
--            2. Moderation, visibility & featured columns on services,
--               opportunities, projects, and quotes
--            3. Immutable append-only `public.admin_audit_logs` ledger
--            4. Zero-trust non-recursive RLS (`public.is_admin()`) & GRANTs
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ----------------------------------------------------------------------------
-- 1. EXTEND `public.profiles` WITH USER GOVERNANCE & VERIFICATION FIELDS
-- ----------------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS company_name TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS verification_status TEXT NOT NULL DEFAULT 'unverified',
  ADD COLUMN IF NOT EXISTS verification_notes TEXT,
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS verified_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_verification_status_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_verification_status_check
  CHECK (verification_status IN ('unverified', 'pending', 'verified', 'rejected'));

CREATE INDEX IF NOT EXISTS idx_profiles_verification_status
  ON public.profiles(verification_status);

-- Keep legacy user_profiles compatible if present
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_profiles') THEN
    ALTER TABLE public.user_profiles
      ADD COLUMN IF NOT EXISTS company_name TEXT,
      ADD COLUMN IF NOT EXISTS phone TEXT,
      ADD COLUMN IF NOT EXISTS verification_status TEXT NOT NULL DEFAULT 'unverified',
      ADD COLUMN IF NOT EXISTS verification_notes TEXT,
      ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS verified_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END;
$$;

-- ----------------------------------------------------------------------------
-- 2. MODERATION, REJECTION REASON & FEATURED COLUMNS ON CONTENT TABLES
-- ----------------------------------------------------------------------------

-- 2.1 public.services
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

CREATE INDEX IF NOT EXISTS idx_services_approved_featured
  ON public.services(approved, is_featured, created_at DESC);

-- 2.2 public.opportunities
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

CREATE INDEX IF NOT EXISTS idx_opportunities_approved_featured
  ON public.opportunities(approved, is_featured, created_at DESC);

-- 2.3 public.projects
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

CREATE INDEX IF NOT EXISTS idx_projects_approved_featured
  ON public.projects(approved, is_featured, created_at DESC);

-- 2.4 public.quotes
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

-- ----------------------------------------------------------------------------
-- 3. IMMUTABLE AUDIT LOG TABLE (`public.admin_audit_logs`)
-- ----------------------------------------------------------------------------
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

CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_created_at
  ON public.admin_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_action_type
  ON public.admin_audit_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_actor_id
  ON public.admin_audit_logs(actor_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.prevent_admin_audit_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION '403 Forbidden: public.admin_audit_logs is an append-only immutable security ledger.'
    USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS trg_admin_audit_logs_immutable ON public.admin_audit_logs;
CREATE TRIGGER trg_admin_audit_logs_immutable
  BEFORE UPDATE OR DELETE ON public.admin_audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_admin_audit_mutation();

-- Automatically record new user sign-ups into public.admin_audit_logs
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
    NEW.id,
    NEW.email,
    'USER_SIGNUP',
    'public.profiles',
    NEW.id::TEXT,
    COALESCE(NEW.full_name, NEW.email),
    jsonb_build_object('role', NEW.role, 'status', NEW.status)
  );
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_log_signup_audit ON public.profiles;
CREATE TRIGGER trg_profiles_log_signup_audit
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.log_profile_signup_audit();

-- ----------------------------------------------------------------------------
-- 4. HARDENED PROFILE ESCALATION GUARD (Protects role, status & verified state)
-- ----------------------------------------------------------------------------
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

  IF NOT public.is_admin() THEN
    IF NEW.role IS DISTINCT FROM OLD.role OR NEW.status IS DISTINCT FROM OLD.status THEN
      RAISE EXCEPTION '403 Forbidden: Only active administrators may modify role or account status.'
        USING ERRCODE = '42501';
    END IF;
    IF NEW.verification_status IS DISTINCT FROM OLD.verification_status
       AND NEW.verification_status NOT IN ('pending') THEN
      RAISE EXCEPTION '403 Forbidden: Users may only request verification (pending), never self-verify.'
        USING ERRCODE = '42501';
    END IF;
    IF NEW.verified_by IS DISTINCT FROM OLD.verified_by
       OR NEW.verified_at IS DISTINCT FROM OLD.verified_at THEN
      RAISE EXCEPTION '403 Forbidden: Only active administrators may set verification stamps.'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_prevent_escalation ON public.profiles;
CREATE TRIGGER trg_profiles_prevent_escalation
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_profile_role_escalation();

-- ----------------------------------------------------------------------------
-- 5. ZERO-TRUST RLS POLICIES & TABLE GRANTS
-- ----------------------------------------------------------------------------
ALTER TABLE public.profiles         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunities    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotes           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated, service_role;
GRANT SELECT ON public.services TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.services TO authenticated, service_role;
GRANT SELECT ON public.opportunities TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.opportunities TO authenticated, service_role;
GRANT SELECT ON public.projects TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.projects TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quotes TO authenticated, service_role;

REVOKE UPDATE, DELETE ON public.admin_audit_logs FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.admin_audit_logs TO authenticated;
GRANT ALL ON public.admin_audit_logs TO service_role;

-- Clear and recreate strict public visibility isolation on services & opportunities
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('services', 'opportunities', 'admin_audit_logs')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I;', pol.policyname, pol.schemaname, pol.tablename);
  END LOOP;
END;
$$;

-- public.services
CREATE POLICY "services_select_approved_own_or_admin"
  ON public.services FOR SELECT TO anon, authenticated
  USING (
    (approved = TRUE AND status IN ('approved', 'active'))
    OR (SELECT auth.uid()) = user_id
    OR (SELECT public.is_admin())
  );

CREATE POLICY "services_insert_authenticated_pending"
  ON public.services FOR INSERT TO authenticated
  WITH CHECK (
    ((SELECT auth.uid()) = user_id AND approved = FALSE AND status = 'pending')
    OR (SELECT public.is_admin())
  );

CREATE POLICY "services_update_own_pending_or_admin"
  ON public.services FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id OR (SELECT public.is_admin()))
  WITH CHECK (
    ((SELECT auth.uid()) = user_id AND approved = FALSE AND status = 'pending')
    OR (SELECT public.is_admin())
  );

CREATE POLICY "services_delete_own_or_admin"
  ON public.services FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id OR (SELECT public.is_admin()));

-- public.opportunities
CREATE POLICY "opportunities_select_approved_own_or_admin"
  ON public.opportunities FOR SELECT TO anon, authenticated
  USING (
    (approved = TRUE AND status IN ('approved', 'active'))
    OR (SELECT auth.uid()) = user_id
    OR (SELECT public.is_admin())
  );

CREATE POLICY "opportunities_insert_authenticated_pending"
  ON public.opportunities FOR INSERT TO authenticated
  WITH CHECK (
    ((SELECT auth.uid()) = user_id AND approved = FALSE AND status = 'pending')
    OR (SELECT public.is_admin())
  );

CREATE POLICY "opportunities_update_own_pending_or_admin"
  ON public.opportunities FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id OR (SELECT public.is_admin()))
  WITH CHECK (
    ((SELECT auth.uid()) = user_id AND approved = FALSE AND status = 'pending')
    OR (SELECT public.is_admin())
  );

CREATE POLICY "opportunities_delete_own_or_admin"
  ON public.opportunities FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id OR (SELECT public.is_admin()));

-- public.admin_audit_logs (Authenticated INSERT; Admin-only SELECT; Immutable)
CREATE POLICY "admin_audit_logs_insert_authenticated"
  ON public.admin_audit_logs FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = actor_id OR (SELECT public.is_admin()));

CREATE POLICY "admin_audit_logs_select_admin_only"
  ON public.admin_audit_logs FOR SELECT TO authenticated
  USING ((SELECT public.is_admin()));

-- Ensure primary owner is verified active admin
UPDATE public.profiles
SET
  role = 'admin',
  status = 'active',
  verification_status = 'verified',
  verified_at = COALESCE(verified_at, NOW()),
  updated_at = NOW()
WHERE lower(trim(email)) = 'salminmwenesi@gmail.com';
