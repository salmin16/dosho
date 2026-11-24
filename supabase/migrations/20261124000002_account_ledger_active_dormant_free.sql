-- ==============================================================================
-- Migration: 20261124000002_account_ledger_active_dormant_free.sql
-- Purpose:   Classify every user cleanly into Active / Dormant / Free states
--            and expose an admin-only Accounts Billing Ledger RPC while
--            dropping dormant accounts back to free entitlements automatically.
-- Target:    Supabase PostgreSQL (MineConnect · project iapqpsxodlhvhdfsftqi)
-- ==============================================================================

-- 1. Upgrade `get_user_entitlements(uid)` to return `account_state` ('active' | 'dormant' | 'free')
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
BEGIN
  IF uid IS NULL THEN
    SELECT * INTO v_plan FROM public.subscription_plans WHERE id = 'free';
    RETURN jsonb_build_object(
      'plan_id', 'free',
      'plan_name', coalesce(v_plan.name, 'Explorer'),
      'status', 'active',
      'account_state', 'free',
      'is_paid_active', FALSE,
      'starts_at', NULL,
      'expires_at', NULL,
      'max_active_listings', coalesce(v_plan.max_active_listings, 0),
      'max_monthly_rfqs', coalesce(v_plan.max_monthly_rfqs, 2),
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

  SELECT count(*)::INTEGER INTO v_active_listings
  FROM public.projects pr
  WHERE pr.user_id = uid
    AND lower(coalesce(pr.status, 'pending')) NOT IN ('rejected', 'hidden', 'archived');

  SELECT count(*)::INTEGER INTO v_monthly_rfqs
  FROM public.quotes q
  WHERE q.user_id = uid
    AND q.created_at >= date_trunc('month', NOW());

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
      -- Paid plan expired or inactive -> Dormant (drops back to free limits, preserves history)
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
    'max_active_listings', coalesce(v_plan.max_active_listings, 0),
    'max_monthly_rfqs', coalesce(v_plan.max_monthly_rfqs, 2),
    'active_listings_count', v_active_listings,
    'monthly_rfqs_count', v_monthly_rfqs,
    'can_access_data_room', coalesce(v_plan.can_access_data_room, FALSE) AND v_is_paid_active,
    'can_export_markets', coalesce(v_plan.can_export_markets, FALSE) AND v_is_paid_active
  );
END;
$$;

-- 2. Admin-Only Accounts Billing Ledger RPC (`Active` | `Dormant` | `Free`)
CREATE OR REPLACE FUNCTION public.get_accounts_billing_ledger()
RETURNS TABLE (
  user_id UUID,
  email TEXT,
  full_name TEXT,
  account_state TEXT,
  plan_id TEXT,
  plan_name TEXT,
  payment_method TEXT,
  payment_reference TEXT,
  starts_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  total_payments BIGINT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_billing_admin() THEN
    RAISE EXCEPTION '403 Forbidden: Administrative billing clearance required.'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH pay_stats AS (
    SELECT
      sp.user_id,
      count(*) FILTER (WHERE sp.status IN ('approved', 'settled')) AS paid_count,
      (array_agg(sp.plan_id ORDER BY sp.created_at DESC) FILTER (WHERE sp.status IN ('approved', 'settled')))[1] AS last_paid_plan,
      (array_agg(sp.payment_method ORDER BY sp.created_at DESC))[1] AS last_pay_method,
      (array_agg(sp.reference_code ORDER BY sp.created_at DESC))[1] AS last_pay_ref
    FROM public.subscription_payments sp
    GROUP BY sp.user_id
  )
  SELECT
    pr.id AS user_id,
    pr.email,
    pr.full_name,
    CASE
      WHEN us.user_id IS NOT NULL
        AND us.plan_id <> 'free'
        AND us.status = 'active'
        AND us.expires_at > NOW()
      THEN 'active'
      WHEN (us.user_id IS NOT NULL AND us.plan_id <> 'free')
        OR coalesce(ps.paid_count, 0) > 0
      THEN 'dormant'
      ELSE 'free'
    END AS account_state,
    coalesce(us.plan_id, ps.last_paid_plan, 'free') AS plan_id,
    coalesce(pl.name, us.tier_name, 'Explorer') AS plan_name,
    coalesce(us.payment_method, ps.last_pay_method, 'Free Tier') AS payment_method,
    coalesce(us.payment_reference, ps.last_pay_ref) AS payment_reference,
    us.starts_at,
    us.expires_at,
    coalesce(ps.paid_count, 0) AS total_payments
  FROM public.profiles pr
  LEFT JOIN public.user_subscriptions us ON us.user_id = pr.id
  LEFT JOIN pay_stats ps ON ps.user_id = pr.id
  LEFT JOIN public.subscription_plans pl ON pl.id = coalesce(us.plan_id, ps.last_paid_plan, 'free')
  ORDER BY
    CASE
      WHEN us.user_id IS NOT NULL AND us.plan_id <> 'free' AND us.status = 'active' AND us.expires_at > NOW() THEN 1
      WHEN (us.user_id IS NOT NULL AND us.plan_id <> 'free') OR coalesce(ps.paid_count, 0) > 0 THEN 2
      ELSE 3
    END,
    coalesce(us.expires_at, pr.created_at) DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_accounts_billing_ledger() TO authenticated, service_role;
