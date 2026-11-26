-- ============================================================================
-- Migration: 20261126000001_verification_levels_l0_l4_and_pipeline.sql
-- Purpose:   1. 5-Tier Custom Verification Architecture (`L0`–`L4`) decoupled
--               from subscription tiers on `public.profiles` & `public.projects`
--            2. Fast, low-lag `public.verification_submissions` table with
--               composite indexes (`status`, `created_at`, `user_id`) and
--               lazy-loaded document preview storage path
--            3. Storage bucket (`verification-documents`) + 100% zero-trust RLS
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ----------------------------------------------------------------------------
-- 1. ADD `verification_level` (L0–L4) TO `public.profiles` & `public.projects`
-- ----------------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS verification_level TEXT NOT NULL DEFAULT 'L0';

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_verification_level_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_verification_level_check
  CHECK (verification_level IN ('L0', 'L1', 'L2', 'L3', 'L4'));

-- Backfill existing verified accounts cleanly to L1 (and primary admin to L4)
UPDATE public.profiles
SET verification_level = 'L1'
WHERE verification_status = 'verified' AND verification_level = 'L0';

UPDATE public.profiles
SET verification_level = 'L4'
WHERE lower(trim(email)) = 'salminmwenesi@gmail.com';

-- Composite index for fast Admin Users & Verification queue filtering
CREATE INDEX IF NOT EXISTS idx_profiles_verif_status_level_created
  ON public.profiles (verification_status, verification_level, created_at DESC);

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS verification_level TEXT NOT NULL DEFAULT 'L0';

ALTER TABLE public.projects DROP CONSTRAINT IF EXISTS projects_verification_level_check;
ALTER TABLE public.projects
  ADD CONSTRAINT projects_verification_level_check
  CHECK (verification_level IN ('L0', 'L1', 'L2', 'L3', 'L4'));

CREATE INDEX IF NOT EXISTS idx_projects_verification_level_created
  ON public.projects (verification_level, created_at DESC);

-- Harden profile escalation trigger to protect `verification_level` as well
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
    IF NEW.verification_level IS DISTINCT FROM OLD.verification_level THEN
      RAISE EXCEPTION '403 Forbidden: Only active administrators may change verification_level (L0–L4).'
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

-- ----------------------------------------------------------------------------
-- 2. FAST VERIFICATION SUBMISSIONS QUEUE (`public.verification_submissions`)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.verification_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  requested_level TEXT NOT NULL DEFAULT 'L1'
    CHECK (requested_level IN ('L1', 'L2', 'L3', 'L4')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  company_name TEXT NOT NULL,
  phone TEXT,
  licence_reference TEXT,
  notes TEXT,
  reviewer_notes TEXT,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  document_name TEXT,
  document_mime TEXT,
  document_size_bytes BIGINT,
  document_storage_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Optimized indexes for low-lag queue reads by status, creation date, and user
CREATE INDEX IF NOT EXISTS idx_verification_submissions_status_created
  ON public.verification_submissions (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_verification_submissions_user_created
  ON public.verification_submissions (user_id, created_at DESC);

ALTER TABLE public.verification_submissions ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.verification_submissions TO authenticated, service_role;

DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'verification_submissions'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I;', pol.policyname, pol.schemaname, pol.tablename);
  END LOOP;
END;
$$;

CREATE POLICY "verification_submissions_select_own_or_admin"
  ON public.verification_submissions FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id OR (SELECT public.is_admin()));

CREATE POLICY "verification_submissions_insert_own_pending"
  ON public.verification_submissions FOR INSERT TO authenticated
  WITH CHECK (
    ((SELECT auth.uid()) = user_id AND status = 'pending')
    OR (SELECT public.is_admin())
  );

CREATE POLICY "verification_submissions_update_admin_only"
  ON public.verification_submissions FOR UPDATE TO authenticated
  USING ((SELECT public.is_admin()))
  WITH CHECK ((SELECT public.is_admin()));

CREATE POLICY "verification_submissions_delete_own_pending_or_admin"
  ON public.verification_submissions FOR DELETE TO authenticated
  USING (
    ((SELECT auth.uid()) = user_id AND status = 'pending')
    OR (SELECT public.is_admin())
  );

-- ----------------------------------------------------------------------------
-- 3. PRIVATE STORAGE BUCKET FOR VERIFICATION DOCUMENTS (LAZY SIGNED PREVIEWS)
-- ----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'verification-documents',
  'verification-documents',
  FALSE,
  4194304,
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET
  public = FALSE,
  file_size_limit = 4194304,
  allowed_mime_types = ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

DO $$
BEGIN
  DROP POLICY IF EXISTS "verif_docs_insert_own" ON storage.objects;
  CREATE POLICY "verif_docs_insert_own"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (
      bucket_id = 'verification-documents'
      AND (storage.foldername(name))[1] = (SELECT auth.uid())::TEXT
    );

  DROP POLICY IF EXISTS "verif_docs_select_own_or_admin" ON storage.objects;
  CREATE POLICY "verif_docs_select_own_or_admin"
    ON storage.objects FOR SELECT TO authenticated
    USING (
      bucket_id = 'verification-documents'
      AND (
        (storage.foldername(name))[1] = (SELECT auth.uid())::TEXT
        OR (SELECT public.is_admin())
      )
    );

  DROP POLICY IF EXISTS "verif_docs_delete_own_or_admin" ON storage.objects;
  CREATE POLICY "verif_docs_delete_own_or_admin"
    ON storage.objects FOR DELETE TO authenticated
    USING (
      bucket_id = 'verification-documents'
      AND (
        (storage.foldername(name))[1] = (SELECT auth.uid())::TEXT
        OR (SELECT public.is_admin())
      )
    );
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'Skipping storage.objects policies due to privilege scope.';
END;
$$;
