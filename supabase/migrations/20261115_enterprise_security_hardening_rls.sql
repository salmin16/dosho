-- ============================================================================
-- Migration: 20261115_enterprise_security_hardening_rls.sql
-- Purpose:   Defense-in-Depth Enterprise Security Hardening
--            1. Mandatory Row Level Security (RLS) across all tables
--            2. Privilege Escalation Prevention Triggers
--            3. Immutable Append-Only Audit Ledger Enforcement
--            4. Automated PostgreSQL Security Audit Triggers
-- ============================================================================

-- 0. Ensure `public.users` view/table compatibility alongside `public.user_profiles`
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  preferred_currency TEXT DEFAULT 'USD',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  mineral TEXT NOT NULL,
  region TEXT NOT NULL,
  licence_type TEXT NOT NULL,
  licence_reference TEXT NOT NULL,
  investment_usd NUMERIC(16, 2) NOT NULL DEFAULT 0 CHECK (investment_usd >= 0),
  submitted_currency TEXT NOT NULL DEFAULT 'USD',
  summary TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING_VERIFICATION'
    CHECK (status IN ('PENDING_VERIFICATION', 'VERIFIED', 'ARCHIVED', 'FLAGGED', 'REJECTED')),
  approved BOOLEAN NOT NULL DEFAULT false,
  moderation_notes TEXT,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 1. Enable & Force Mandatory Row Level Security on EVERY Table
-- ============================================================================
ALTER TABLE IF EXISTS public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.users FORCE ROW LEVEL SECURITY;

ALTER TABLE IF EXISTS public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_profiles FORCE ROW LEVEL SECURITY;

ALTER TABLE IF EXISTS public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.audit_logs FORCE ROW LEVEL SECURITY;

ALTER TABLE IF EXISTS public.mineral_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.mineral_prices FORCE ROW LEVEL SECURITY;

ALTER TABLE IF EXISTS public.market_sync_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.market_sync_logs FORCE ROW LEVEL SECURITY;

ALTER TABLE IF EXISTS public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.projects FORCE ROW LEVEL SECURITY;

ALTER TABLE IF EXISTS public.user_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_projects FORCE ROW LEVEL SECURITY;

ALTER TABLE IF EXISTS public.opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.opportunities FORCE ROW LEVEL SECURITY;

ALTER TABLE IF EXISTS public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.services FORCE ROW LEVEL SECURITY;

ALTER TABLE IF EXISTS public.user_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_documents FORCE ROW LEVEL SECURITY;

ALTER TABLE IF EXISTS public.quote_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.quote_requests FORCE ROW LEVEL SECURITY;

-- ============================================================================
-- 2. Hardened Admin Verification Function (Prevents RLS Recursion)
-- ============================================================================
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
    WHERE id = auth.uid()
      AND role = 'admin'
      AND status = 'active'
  ) OR EXISTS (
    SELECT 1
    FROM public.users
    WHERE id = auth.uid()
      AND role = 'admin'
      AND status = 'active'
  );
$$;

-- ============================================================================
-- 3. Anti-Privilege-Escalation Guard Trigger
--    Blocks non-admin users from altering their own `role` or `status`
-- ============================================================================
CREATE OR REPLACE FUNCTION public.prevent_self_role_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (NEW.role IS DISTINCT FROM OLD.role OR NEW.status IS DISTINCT FROM OLD.status) THEN
    IF NOT public.is_active_admin() THEN
      RAISE EXCEPTION '403 Forbidden: Privilege escalation blocked. Only active administrators may modify role or account status.';
    END IF;
  END IF;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_role_escalation_profiles ON public.user_profiles;
CREATE TRIGGER trg_prevent_role_escalation_profiles
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_self_role_escalation();

DROP TRIGGER IF EXISTS trg_prevent_role_escalation_users ON public.users;
CREATE TRIGGER trg_prevent_role_escalation_users
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_self_role_escalation();

-- ============================================================================
-- 4. Immutable Audit Ledger Guard Trigger
--    Prevents tampering or deletion of existing rows in `public.audit_logs`
-- ============================================================================
CREATE OR REPLACE FUNCTION public.prevent_audit_log_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'Security Violation: public.audit_logs is an append-only immutable security ledger. UPDATE and DELETE operations are prohibited.';
END;
$$;

DROP TRIGGER IF EXISTS trg_immutable_audit_logs ON public.audit_logs;
CREATE TRIGGER trg_immutable_audit_logs
  BEFORE UPDATE OR DELETE ON public.audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_audit_log_mutation();

-- ============================================================================
-- 5. Granular Row Level Security Policies
-- ============================================================================

-- 5A. `public.users` & `public.user_profiles`
DROP POLICY IF EXISTS "Users select own record or admin selects all" ON public.users;
CREATE POLICY "Users select own record or admin selects all"
  ON public.users FOR SELECT
  USING (auth.uid() = id OR public.is_active_admin());

DROP POLICY IF EXISTS "Users update own profile fields" ON public.users;
CREATE POLICY "Users update own profile fields"
  ON public.users FOR UPDATE
  USING (auth.uid() = id OR public.is_active_admin())
  WITH CHECK (auth.uid() = id OR public.is_active_admin());

DROP POLICY IF EXISTS "Users select own profile or admin selects all" ON public.user_profiles;
CREATE POLICY "Users select own profile or admin selects all"
  ON public.user_profiles FOR SELECT
  USING (auth.uid() = id OR public.is_active_admin());

DROP POLICY IF EXISTS "Users update own profile or admin updates all" ON public.user_profiles;
CREATE POLICY "Users update own profile or admin updates all"
  ON public.user_profiles FOR UPDATE
  USING (auth.uid() = id OR public.is_active_admin())
  WITH CHECK (auth.uid() = id OR public.is_active_admin());

-- 5B. `public.audit_logs` (Admins read all; Users read own; Authenticated insert)
DROP POLICY IF EXISTS "Admins read all audit logs; users read own" ON public.audit_logs;
CREATE POLICY "Admins read all audit logs; users read own"
  ON public.audit_logs FOR SELECT
  USING (public.is_active_admin() OR auth.uid() = user_id);

DROP POLICY IF EXISTS "Authenticated users insert own audit telemetry" ON public.audit_logs;
CREATE POLICY "Authenticated users insert own audit telemetry"
  ON public.audit_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL OR public.is_active_admin());

-- 5C. `public.mineral_prices` (Public read; Admin-only write)
DROP POLICY IF EXISTS "Public read access for mineral_prices" ON public.mineral_prices;
CREATE POLICY "Public read access for mineral_prices"
  ON public.mineral_prices FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Strict admin write access for mineral_prices" ON public.mineral_prices;
CREATE POLICY "Strict admin write access for mineral_prices"
  ON public.mineral_prices FOR ALL
  USING (public.is_active_admin())
  WITH CHECK (public.is_active_admin());

-- 5D. `public.projects` & `public.user_projects`
DROP POLICY IF EXISTS "Projects read policy" ON public.projects;
CREATE POLICY "Projects read policy"
  ON public.projects FOR SELECT
  USING (
    (status = 'VERIFIED' AND approved = true)
    OR auth.uid() = user_id
    OR public.is_active_admin()
  );

DROP POLICY IF EXISTS "Projects insert policy" ON public.projects;
CREATE POLICY "Projects insert policy"
  ON public.projects FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND status = 'PENDING_VERIFICATION'
    AND approved = false
  );

DROP POLICY IF EXISTS "Projects update policy" ON public.projects;
CREATE POLICY "Projects update policy"
  ON public.projects FOR UPDATE
  USING (auth.uid() = user_id OR public.is_active_admin())
  WITH CHECK (auth.uid() = user_id OR public.is_active_admin());

DROP POLICY IF EXISTS "Projects delete policy" ON public.projects;
CREATE POLICY "Projects delete policy"
  ON public.projects FOR DELETE
  USING (auth.uid() = user_id OR public.is_active_admin());

-- 5E. `public.opportunities`
DROP POLICY IF EXISTS "Opportunities strict RLS select" ON public.opportunities;
CREATE POLICY "Opportunities strict RLS select"
  ON public.opportunities FOR SELECT
  USING (
    (status = 'active' AND approved = true)
    OR auth.uid() = user_id
    OR public.is_active_admin()
  );

DROP POLICY IF EXISTS "Opportunities strict RLS insert" ON public.opportunities;
CREATE POLICY "Opportunities strict RLS insert"
  ON public.opportunities FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND status = 'pending'
    AND approved = false
  );

DROP POLICY IF EXISTS "Opportunities strict RLS update" ON public.opportunities;
CREATE POLICY "Opportunities strict RLS update"
  ON public.opportunities FOR UPDATE
  USING (
    (auth.uid() = user_id AND status = 'pending')
    OR public.is_active_admin()
  )
  WITH CHECK (
    (auth.uid() = user_id AND status = 'pending')
    OR public.is_active_admin()
  );

-- 5F. `public.services`
DROP POLICY IF EXISTS "Services strict RLS select" ON public.services;
CREATE POLICY "Services strict RLS select"
  ON public.services FOR SELECT
  USING (
    (status = 'active' AND approved = true)
    OR auth.uid() = user_id
    OR public.is_active_admin()
  );

DROP POLICY IF EXISTS "Services strict RLS insert" ON public.services;
CREATE POLICY "Services strict RLS insert"
  ON public.services FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND status = 'pending'
    AND approved = false
  );

DROP POLICY IF EXISTS "Services strict RLS update" ON public.services;
CREATE POLICY "Services strict RLS update"
  ON public.services FOR UPDATE
  USING (
    (auth.uid() = user_id AND status = 'pending')
    OR public.is_active_admin()
  )
  WITH CHECK (
    (auth.uid() = user_id AND status = 'pending')
    OR public.is_active_admin()
  );

-- ============================================================================
-- 6. Automated Database Security Audit Trigger
--    Records sensitive table mutations directly into `public.audit_logs`
-- ============================================================================
CREATE OR REPLACE FUNCTION public.trigger_record_security_audit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_action TEXT;
  v_record_id TEXT;
BEGIN
  v_action := 'DB_' || TG_OP || '_' || UPPER(TG_TABLE_NAME);
  IF TG_OP = 'DELETE' THEN
    v_record_id := OLD.id::TEXT;
  ELSE
    v_record_id := NEW.id::TEXT;
  END IF;

  INSERT INTO public.audit_logs (
    user_id,
    action,
    ip_address,
    user_agent,
    metadata
  ) VALUES (
    auth.uid(),
    v_action,
     COALESCE(current_setting('request.headers', true)::json->>'x-forwarded-for', '0.0.0.0'),
    'PostgreSQL-Security-Trigger',
    jsonb_build_object(
      'table', TG_TABLE_NAME,
      'operation', TG_OP,
      'recordId', v_record_id,
      'timestamp', NOW()
    )
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Never fail the primary transaction if audit insert encounters an issue
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_mineral_prices ON public.mineral_prices;
CREATE TRIGGER trg_audit_mineral_prices
  AFTER INSERT OR UPDATE OR DELETE ON public.mineral_prices
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_record_security_audit();

DROP TRIGGER IF EXISTS trg_audit_opportunities ON public.opportunities;
CREATE TRIGGER trg_audit_opportunities
  AFTER INSERT OR UPDATE OR DELETE ON public.opportunities
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_record_security_audit();

DROP TRIGGER IF EXISTS trg_audit_services ON public.services;
CREATE TRIGGER trg_audit_services
  AFTER INSERT OR UPDATE OR DELETE ON public.services
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_record_security_audit();
