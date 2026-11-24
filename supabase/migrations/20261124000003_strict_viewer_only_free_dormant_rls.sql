-- ==============================================================================
-- Migration: 20261124000003_strict_viewer_only_free_dormant_rls.sql
-- Purpose:   Lock Explorer (Free) and Dormant accounts to strictly view-only mode.
--            Zero active listings, zero monthly quote/information requests, zero
--            dossier/data-room access, and zero CSV exports unless the account holds
--            an active paid subscription with expires_at > NOW() (or active admin).
--            Enforces can_submit_rfq(auth.uid()) and can_create_listing(auth.uid())
--            directly in PostgreSQL RLS INSERT policies across all write tables.
-- Target:    Supabase PostgreSQL (MineConnect · project iapqpsxodlhvhdfsftqi)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. UPDATE `free` (Explorer) PLAN IN `public.subscription_plans` TO VIEW-ONLY
-- ------------------------------------------------------------------------------
UPDATE public.subscription_plans
SET
  name = 'Explorer',
  tagline = 'View-only market benchmarks, 31-Mikoa GIS map & public listing previews',
  price_tzs = 0,
  price_usd = 0,
  max_active_listings = 0,
  max_monthly_rfqs = 0,
  can_access_data_room = FALSE,
  can_export_markets = FALSE,
  is_active = TRUE,
  updated_at = NOW()
WHERE id = 'free';

INSERT INTO public.subscription_plans (
  id, name, tagline, price_tzs, price_usd, billing_cycle,
  max_active_listings, max_monthly_rfqs,
  can_access_data_room, can_export_markets, is_active, sort_order
) VALUES (
  'free',
  'Explorer',
  'View-only market benchmarks, 31-Mikoa GIS map & public listing previews',
  0,
  0,
  'monthly',
  0,
  0,
  FALSE,
  FALSE,
  TRUE,
  1
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  tagline = EXCLUDED.tagline,
  max_active_listings = 0,
  max_monthly_rfqs = 0,
  can_access_data_room = FALSE,
  can_export_markets = FALSE,
  is_active = TRUE,
  updated_at = NOW();

-- Keep paid tiers synchronized with audited deliverables
UPDATE public.subscription_plans
SET
  tagline = 'Up to 3 active listings, 25 RFQs/mo, full tenement dossiers & CSV valuation exports',
  updated_at = NOW()
WHERE id = 'pro';

UPDATE public.subscription_plans
SET
  tagline = 'Unlimited listings & RFQs, full NDA Data Room documents & valuation CSV exports',
  updated_at = NOW()
WHERE id = 'enterprise';

-- ------------------------------------------------------------------------------
-- 2. HARDEN `get_user_entitlements(uid)`, `can_create_listing(uid)`, `can_submit_rfq(uid)`
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_user_entitlements(uid UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sub public.user_subscriptions%ROWTYPE;
  v_plan public.subscription_plans%ROWTYPE;
  v_is_admin BOOLEAN := FALSE;
  v_is_paid_active BOOLEAN := FALSE;
  v_has_paid_history BOOLEAN := FALSE;
  v_effective_plan_id TEXT := 'free';
  v_effective_status TEXT := 'active';
  v_account_state TEXT := 'free';
  v_active_listings INTEGER := 0;
  v_monthly_rfqs INTEGER := 0;
  v_tmp_count INTEGER := 0;
BEGIN
  IF uid IS NULL THEN
    RETURN jsonb_build_object(
      'plan_id', 'free',
      'plan_name', 'Explorer',
      'status', 'active',
      'account_state', 'free',
      'is_paid_active', FALSE,
      'starts_at', NULL,
      'expires_at', NULL,
      'max_active_listings', 0,
      'max_monthly_rfqs', 0,
      'active_listings_count', 0,
      'monthly_rfqs_count', 0,
      'can_access_data_room', FALSE,
      'can_export_markets', FALSE
    );
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = uid
      AND (
        lower(coalesce(p.email, '')) = 'salminmwenesi@gmail.com'
        OR (p.role = 'admin' AND coalesce(p.status, 'active') = 'active')
      )
  ) INTO v_is_admin;

  -- Count active project listings cleanly across primary projects table
  IF to_regclass('public.projects') IS NOT NULL THEN
    SELECT count(*)::INTEGER INTO v_active_listings
    FROM public.projects pr
    WHERE pr.user_id = uid
      AND lower(coalesce(pr.status, 'pending')) NOT IN ('rejected', 'hidden', 'archived');
  ELSIF to_regclass('public.user_projects') IS NOT NULL THEN
    SELECT count(*)::INTEGER INTO v_active_listings
    FROM public.user_projects pr
    WHERE pr.user_id = uid
      AND lower(coalesce(pr.status, 'pending')) NOT IN ('rejected', 'hidden', 'archived');
  END IF;

  -- Count current calendar-month quote requests across quotes / quote_requests
  IF to_regclass('public.quotes') IS NOT NULL THEN
    SELECT count(*)::INTEGER INTO v_tmp_count
    FROM public.quotes q
    WHERE q.user_id = uid
      AND q.created_at >= date_trunc('month', NOW());
    v_monthly_rfqs := v_monthly_rfqs + coalesce(v_tmp_count, 0);
  END IF;

  IF to_regclass('public.quote_requests') IS NOT NULL THEN
    SELECT count(*)::INTEGER INTO v_tmp_count
    FROM public.quote_requests qr
    WHERE qr.user_id = uid
      AND qr.created_at >= date_trunc('month', NOW());
    v_monthly_rfqs := GREATEST(v_monthly_rfqs, coalesce(v_tmp_count, 0));
  END IF;

  IF v_is_admin THEN
    SELECT * INTO v_plan FROM public.subscription_plans WHERE id = 'enterprise';
    RETURN jsonb_build_object(
      'plan_id', 'enterprise',
      'plan_name', coalesce(v_plan.name, 'Institutional / JV Desk'),
      'status', 'active',
      'account_state', 'active',
      'is_paid_active', TRUE,
      'starts_at', NOW(),
      'expires_at', NOW() + INTERVAL '365 days',
      'max_active_listings', -1,
      'max_monthly_rfqs', -1,
      'active_listings_count', v_active_listings,
      'monthly_rfqs_count', v_monthly_rfqs,
      'can_access_data_room', TRUE,
      'can_export_markets', TRUE
    );
  END IF;

  SELECT * INTO v_sub
  FROM public.user_subscriptions us
  WHERE us.user_id = uid
  LIMIT 1;

  SELECT EXISTS (
    SELECT 1 FROM public.subscription_payments sp
    WHERE sp.user_id = uid
      AND sp.plan_id <> 'free'
      AND sp.status IN ('approved', 'settled')
  ) INTO v_has_paid_history;

  IF FOUND THEN
    v_effective_status := v_sub.status;
    IF v_sub.status = 'active' AND v_sub.expires_at > NOW() AND v_sub.plan_id <> 'free' THEN
      v_is_paid_active := TRUE;
      v_effective_plan_id := v_sub.plan_id;
      v_account_state := 'active';
    ELSIF v_sub.plan_id <> 'free' OR v_has_paid_history THEN
      -- Paid plan expired or inactive -> Dormant (view-only, 0 listings & 0 RFQs)
      v_effective_status := CASE WHEN v_sub.expires_at <= NOW() THEN 'expired' ELSE v_sub.status END;
      v_effective_plan_id := 'free';
      v_account_state := 'dormant';
    ELSE
      v_effective_plan_id := 'free';
      v_account_state := 'free';
    END IF;
  ELSIF v_has_paid_history THEN
    v_effective_status := 'expired';
    v_effective_plan_id := 'free';
    v_account_state := 'dormant';
  END IF;

  SELECT * INTO v_plan
  FROM public.subscription_plans sp
  WHERE sp.id = v_effective_plan_id;

  IF NOT FOUND THEN
    SELECT * INTO v_plan FROM public.subscription_plans WHERE id = 'free';
  END IF;

  RETURN jsonb_build_object(
    'plan_id', coalesce(v_plan.id, 'free'),
    'plan_name', coalesce(v_plan.name, 'Explorer'),
    'status', v_effective_status,
    'account_state', v_account_state,
    'is_paid_active', v_is_paid_active,
    'starts_at', v_sub.starts_at,
    'expires_at', v_sub.expires_at,
    'max_active_listings', CASE WHEN v_is_paid_active THEN coalesce(v_plan.max_active_listings, 0) ELSE 0 END,
    'max_monthly_rfqs', CASE WHEN v_is_paid_active THEN coalesce(v_plan.max_monthly_rfqs, 0) ELSE 0 END,
    'active_listings_count', v_active_listings,
    'monthly_rfqs_count', v_monthly_rfqs,
    'can_access_data_room', coalesce(v_plan.can_access_data_room, FALSE) AND v_is_paid_active,
    'can_export_markets', coalesce(v_plan.can_export_markets, FALSE) AND v_is_paid_active
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.can_create_listing(uid UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ent JSONB;
  v_max INTEGER;
  v_used INTEGER;
  v_paid BOOLEAN;
BEGIN
  IF uid IS NULL THEN
    RETURN FALSE;
  END IF;

  v_ent := public.get_user_entitlements(uid);
  v_paid := coalesce((v_ent ->> 'is_paid_active')::BOOLEAN, FALSE);
  v_max := coalesce((v_ent ->> 'max_active_listings')::INTEGER, 0);
  v_used := coalesce((v_ent ->> 'active_listings_count')::INTEGER, 0);

  -- Strictly block Free (Explorer) and Dormant accounts
  IF NOT v_paid THEN
    RETURN FALSE;
  END IF;

  IF v_max < 0 THEN
    RETURN TRUE;
  END IF;

  RETURN v_used < v_max;
END;
$$;

CREATE OR REPLACE FUNCTION public.can_submit_rfq(uid UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ent JSONB;
  v_max INTEGER;
  v_used INTEGER;
  v_paid BOOLEAN;
BEGIN
  IF uid IS NULL THEN
    RETURN FALSE;
  END IF;

  v_ent := public.get_user_entitlements(uid);
  v_paid := coalesce((v_ent ->> 'is_paid_active')::BOOLEAN, FALSE);
  v_max := coalesce((v_ent ->> 'max_monthly_rfqs')::INTEGER, 0);
  v_used := coalesce((v_ent ->> 'monthly_rfqs_count')::INTEGER, 0);

  -- Strictly block Free (Explorer) and Dormant accounts (zero RFQ/inquiry allowance)
  IF NOT v_paid THEN
    RETURN FALSE;
  END IF;

  IF v_max < 0 THEN
    RETURN TRUE;
  END IF;

  RETURN v_used < v_max;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_entitlements(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_create_listing(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_submit_rfq(UUID) TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 3. ENFORCE STRICT PAID-ONLY RLS INSERT POLICIES ACROSS ALL ACTION TABLES
--    (quotes, quote_requests, projects, user_projects, opportunities, services)
-- ------------------------------------------------------------------------------
DO $$
BEGIN
  -- A. public.quotes
  IF to_regclass('public.quotes') IS NOT NULL THEN
    DROP POLICY IF EXISTS "quotes_insert_own" ON public.quotes;
    DROP POLICY IF EXISTS "Users can insert own quotes" ON public.quotes;
    DROP POLICY IF EXISTS "Entitled users can insert own quotes" ON public.quotes;
    CREATE POLICY "Entitled users can insert own quotes"
      ON public.quotes
      FOR INSERT
      TO authenticated
      WITH CHECK (
        (SELECT auth.uid()) = user_id
        AND (SELECT public.can_submit_rfq(auth.uid()))
      );
  END IF;

  -- B. public.quote_requests
  IF to_regclass('public.quote_requests') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Authenticated members can submit strictly their own quote requests" ON public.quote_requests;
    DROP POLICY IF EXISTS "Users can insert own quote requests" ON public.quote_requests;
    DROP POLICY IF EXISTS "Entitled users can insert own quote requests" ON public.quote_requests;
    CREATE POLICY "Entitled users can insert own quote requests"
      ON public.quote_requests
      FOR INSERT
      TO authenticated
      WITH CHECK (
        (SELECT auth.uid()) = user_id
        AND (SELECT public.can_submit_rfq(auth.uid()))
      );
  END IF;

  -- C. public.projects
  IF to_regclass('public.projects') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Projects insert policy" ON public.projects;
    DROP POLICY IF EXISTS "projects_insert_own" ON public.projects;
    DROP POLICY IF EXISTS "Users can insert own projects" ON public.projects;
    DROP POLICY IF EXISTS "Entitled users can insert own projects" ON public.projects;
    CREATE POLICY "Entitled users can insert own projects"
      ON public.projects
      FOR INSERT
      TO authenticated
      WITH CHECK (
        (SELECT auth.uid()) = user_id
        AND (SELECT public.can_create_listing(auth.uid()))
      );
  END IF;

  -- D. public.user_projects
  IF to_regclass('public.user_projects') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Authenticated members can list strictly their own projects" ON public.user_projects;
    DROP POLICY IF EXISTS "Entitled users can insert own user_projects" ON public.user_projects;
    CREATE POLICY "Entitled users can insert own user_projects"
      ON public.user_projects
      FOR INSERT
      TO authenticated
      WITH CHECK (
        (SELECT auth.uid()) = user_id
        AND (SELECT public.can_create_listing(auth.uid()))
      );
  END IF;

  -- E. public.opportunities
  IF to_regclass('public.opportunities') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Users can insert own opportunities" ON public.opportunities;
    DROP POLICY IF EXISTS "Entitled users can insert own opportunities" ON public.opportunities;
    CREATE POLICY "Entitled users can insert own opportunities"
      ON public.opportunities
      FOR INSERT
      TO authenticated
      WITH CHECK (
        (SELECT auth.uid()) = user_id
        AND (SELECT public.can_create_listing(auth.uid()))
      );
  END IF;

  -- F. public.services
  IF to_regclass('public.services') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Users can insert own services" ON public.services;
    DROP POLICY IF EXISTS "Entitled users can insert own services" ON public.services;
    CREATE POLICY "Entitled users can insert own services"
      ON public.services
      FOR INSERT
      TO authenticated
      WITH CHECK (
        (SELECT auth.uid()) = user_id
        AND (SELECT public.can_create_listing(auth.uid()))
      );
  END IF;
END;
$$;
