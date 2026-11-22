-- ============================================================================
-- Migration: 20261122000001_zero_trust_rls_sync_and_hardening.sql
-- Purpose:   1. Unified Auth-to-Public User Sync (user_profiles + users + Explorer tier)
--            2. 100% RLS Verification + Auto-RLS Event Trigger for future tables
--            3. Optimized (SELECT auth.uid()) RLS policies & least-privilege RPC grants
--            4. Private Supabase Storage bucket & owner-isolated RLS for Vault documents
-- ============================================================================

-- 1. Harden Admin Helper Functions with InitPlan-friendly (SELECT auth.uid())
CREATE OR REPLACE FUNCTION public.is_active_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_profiles
    WHERE id = (SELECT auth.uid())
      AND role = 'admin'
      AND status = 'active'
  ) OR EXISTS (
    SELECT 1
    FROM public.users
    WHERE id = (SELECT auth.uid())
      AND role = 'admin'
      AND status = 'active'
  );
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.is_active_admin() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_active_admin() TO authenticated, service_role;

-- 2. Lock Down Privileged SECURITY DEFINER RPCs Exclusively to service_role
--    (Supabase default privileges grant EXECUTE directly to anon & authenticated, not just PUBLIC)
REVOKE ALL ON FUNCTION public.reconcile_clickpesa_payment(TEXT, BOOLEAN, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reconcile_clickpesa_payment(TEXT, BOOLEAN, TEXT) TO service_role;

REVOKE ALL ON FUNCTION public.upsert_live_mineral_spot(TEXT, NUMERIC, NUMERIC, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_live_mineral_spot(TEXT, NUMERIC, NUMERIC, TEXT) TO service_role;

-- 3. Unified Auth Trigger: Strictly Default New Sign-Ups to role = 'user'
--    Syncs public.user_profiles, public.users, and default Explorer subscription
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

  -- HARDCODED role = 'user': client signup payloads can NEVER elevate privileges
  INSERT INTO public.user_profiles (id, email, full_name, role, status, preferred_currency)
  VALUES (NEW.id, NEW.email, v_full_name, 'user', 'active', v_currency)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.users (id, email, full_name, role, status, preferred_currency)
  VALUES (NEW.id, NEW.email, v_full_name, 'user', 'active', v_currency)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_subscriptions (
    user_id,
    tier_name,
    status,
    billing_cycle,
    price_tzs,
    price_usd,
    payment_gateway,
    payment_rail,
    payment_provider,
    expires_at
  ) VALUES (
    NEW.id,
    'Explorer',
    'active',
    'monthly',
    0,
    0,
    'FREE_TIER',
    'FREE',
    'FREE',
    NOW() + INTERVAL '3650 days'
  )
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 4. Guarantee RLS Enabled Across 100% of Public Tables
DO $$
DECLARE
  tbl RECORD;
BEGIN
  FOR tbl IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND rowsecurity = false
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', tbl.tablename);
  END LOOP;
END;
$$;

-- 5. PostgreSQL Event Trigger: Auto-Enable RLS on Any Newly Created Public Table
--    (Installed where superuser is available; CI pipeline enforces 100% RLS on Cloud)
CREATE OR REPLACE FUNCTION public.auto_enable_rls_on_new_public_tables()
RETURNS event_trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  obj RECORD;
BEGIN
  FOR obj IN
    SELECT * FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND schema_name = 'public'
  LOOP
    EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY;', obj.object_identity);
  END LOOP;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_event_trigger WHERE evtname = 'trg_auto_enable_rls') THEN
    CREATE EVENT TRIGGER trg_auto_enable_rls
      ON ddl_command_end
      WHEN TAG IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      EXECUTE FUNCTION public.auto_enable_rls_on_new_public_tables();
  END IF;
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'Event trigger skipped on managed non-superuser role; GitHub Actions RLS audit gate enforces 100%% RLS coverage.';
END;
$$;

-- 6. Least-Privilege Grants on Server-Managed Tables
REVOKE INSERT, DELETE ON public.users FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.user_subscriptions FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.payment_transactions FROM anon, authenticated;
REVOKE UPDATE, DELETE ON public.audit_logs FROM anon, authenticated;

-- 7. Optimized (SELECT auth.uid()) RLS Policies for High-Traffic Tables
DROP POLICY IF EXISTS "Users select own record or admin selects all" ON public.users;
CREATE POLICY "Users select own record or admin selects all"
  ON public.users FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = id OR (SELECT public.is_active_admin()));

DROP POLICY IF EXISTS "Users update own profile fields" ON public.users;
CREATE POLICY "Users update own profile fields"
  ON public.users FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = id OR (SELECT public.is_active_admin()))
  WITH CHECK ((SELECT auth.uid()) = id OR (SELECT public.is_active_admin()));

DROP POLICY IF EXISTS "Users select own profile or admin selects all" ON public.user_profiles;
CREATE POLICY "Users select own profile or admin selects all"
  ON public.user_profiles FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = id OR (SELECT public.is_active_admin()));

DROP POLICY IF EXISTS "Users update own profile or admin updates all" ON public.user_profiles;
CREATE POLICY "Users update own profile or admin updates all"
  ON public.user_profiles FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = id OR (SELECT public.is_active_admin()))
  WITH CHECK ((SELECT auth.uid()) = id OR (SELECT public.is_active_admin()));

DROP POLICY IF EXISTS "Projects read policy" ON public.projects;
CREATE POLICY "Projects read policy"
  ON public.projects FOR SELECT TO anon, authenticated
  USING (
    (status = 'VERIFIED' AND approved = true)
    OR (SELECT auth.uid()) = user_id
    OR (SELECT public.is_active_admin())
  );

DROP POLICY IF EXISTS "Projects insert policy" ON public.projects;
CREATE POLICY "Projects insert policy"
  ON public.projects FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND status = 'PENDING_VERIFICATION'
    AND approved = false
  );

DROP POLICY IF EXISTS "Projects update policy" ON public.projects;
CREATE POLICY "Projects update policy"
  ON public.projects FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id OR (SELECT public.is_active_admin()))
  WITH CHECK (
    ((SELECT auth.uid()) = user_id AND approved = false AND status = 'PENDING_VERIFICATION')
    OR (SELECT public.is_active_admin())
  );

DROP POLICY IF EXISTS "Projects delete policy" ON public.projects;
CREATE POLICY "Projects delete policy"
  ON public.projects FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id OR (SELECT public.is_active_admin()));

-- Full admin oversight + owner isolation on user_profiles, user_projects, quote_requests
DROP POLICY IF EXISTS "Admins can delete user profiles" ON public.user_profiles;
CREATE POLICY "Admins can delete user profiles"
  ON public.user_profiles FOR DELETE TO authenticated
  USING ((SELECT public.is_active_admin()));

DROP POLICY IF EXISTS "Admins can delete users" ON public.users;
CREATE POLICY "Admins can delete users"
  ON public.users FOR DELETE TO authenticated
  USING ((SELECT public.is_active_admin()));

DROP POLICY IF EXISTS "Users can view strictly their own listed projects" ON public.user_projects;
CREATE POLICY "Users can view strictly their own listed projects"
  ON public.user_projects FOR SELECT TO anon, authenticated
  USING (
    (status = 'VERIFIED' AND approved = true)
    OR (SELECT auth.uid()) = user_id
    OR (SELECT public.is_active_admin())
  );

DROP POLICY IF EXISTS "Authenticated members can list strictly their own projects" ON public.user_projects;
CREATE POLICY "Authenticated members can list strictly their own projects"
  ON public.user_projects FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND status = 'PENDING_VERIFICATION'
    AND approved = false
  );

DROP POLICY IF EXISTS "Users can update strictly their own listed projects" ON public.user_projects;
CREATE POLICY "Users can update strictly their own listed projects"
  ON public.user_projects FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id OR (SELECT public.is_active_admin()))
  WITH CHECK (
    ((SELECT auth.uid()) = user_id AND approved = false AND status = 'PENDING_VERIFICATION')
    OR (SELECT public.is_active_admin())
  );

DROP POLICY IF EXISTS "Admins can delete any listed project" ON public.user_projects;
CREATE POLICY "Admins can delete any listed project"
  ON public.user_projects FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id OR (SELECT public.is_active_admin()));

DROP POLICY IF EXISTS "Users can view strictly their own quote requests" ON public.quote_requests;
CREATE POLICY "Users can view strictly their own quote requests"
  ON public.quote_requests FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id OR (SELECT public.is_active_admin()));

DROP POLICY IF EXISTS "Authenticated members can submit strictly their own quote requests" ON public.quote_requests;
CREATE POLICY "Authenticated members can submit strictly their own quote requests"
  ON public.quote_requests FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id AND status = 'SUBMITTED' AND approved = false);

DROP POLICY IF EXISTS "Admins can update any quote request" ON public.quote_requests;
CREATE POLICY "Admins can update any quote request"
  ON public.quote_requests FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id OR (SELECT public.is_active_admin()))
  WITH CHECK (
    ((SELECT auth.uid()) = user_id AND approved = false)
    OR (SELECT public.is_active_admin())
  );

DROP POLICY IF EXISTS "Admins can delete any quote request" ON public.quote_requests;
CREATE POLICY "Admins can delete any quote request"
  ON public.quote_requests FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id OR (SELECT public.is_active_admin()));

-- 8. Private Supabase Storage Bucket & Owner-Isolated RLS for Technical Vault Documents
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'storage' AND table_name = 'buckets'
  ) THEN
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES (
      'vault-documents',
      'vault-documents',
      false,
      52428800,
      ARRAY[
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/csv',
        'image/png',
        'image/jpeg'
      ]
    )
    ON CONFLICT (id) DO NOTHING;
  END IF;
END;
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'storage' AND table_name = 'objects'
  ) THEN
    DROP POLICY IF EXISTS "vault_objects_select_own_or_admin" ON storage.objects;
    CREATE POLICY "vault_objects_select_own_or_admin"
      ON storage.objects FOR SELECT TO authenticated
      USING (
        bucket_id = 'vault-documents'
        AND (
          (storage.foldername(name))[1] = (SELECT auth.uid())::text
          OR (SELECT public.is_active_admin())
        )
      );

    DROP POLICY IF EXISTS "vault_objects_insert_own" ON storage.objects;
    CREATE POLICY "vault_objects_insert_own"
      ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (
        bucket_id = 'vault-documents'
        AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
      );

    DROP POLICY IF EXISTS "vault_objects_update_own" ON storage.objects;
    CREATE POLICY "vault_objects_update_own"
      ON storage.objects FOR UPDATE TO authenticated
      USING (
        bucket_id = 'vault-documents'
        AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
      )
      WITH CHECK (
        bucket_id = 'vault-documents'
        AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
      );

    DROP POLICY IF EXISTS "vault_objects_delete_own_or_admin" ON storage.objects;
    CREATE POLICY "vault_objects_delete_own_or_admin"
      ON storage.objects FOR DELETE TO authenticated
      USING (
        bucket_id = 'vault-documents'
        AND (
          (storage.foldername(name))[1] = (SELECT auth.uid())::text
          OR (SELECT public.is_active_admin())
        )
      );
  END IF;
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'Storage RLS policy creation skipped (requires storage schema ownership in local/cloud).';
END;
$$;
