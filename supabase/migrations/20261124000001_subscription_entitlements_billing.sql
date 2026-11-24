-- ==============================================================================
-- Migration: 20261124000001_subscription_entitlements_billing.sql
-- Purpose:   Institutional-Grade Subscription Plans, Billing Payments,
--            Server-Enforced Entitlement Helpers, and Zero-Trust RLS Gates
-- Target:    Supabase PostgreSQL (MineConnect · project iapqpsxodlhvhdfsftqi)
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ------------------------------------------------------------------------------
-- 1. BILLING ADMIN HELPER (`public.is_billing_admin()`)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_billing_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email TEXT;
  v_is_adm BOOLEAN := FALSE;
BEGIN
  v_email := lower(coalesce(auth.jwt() ->> 'email', ''));
  IF v_email = 'salminmwenesi@gmail.com' THEN
    RETURN TRUE;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'admin'
      AND coalesce(p.status, 'active') = 'active'
  ) INTO v_is_adm;

  RETURN coalesce(v_is_adm, FALSE);
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_billing_admin() TO anon, authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 2. SUBSCRIPTION PLANS CATALOG (`public.subscription_plans`)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  tagline TEXT NOT NULL,
  price_tzs NUMERIC(14, 2) NOT NULL DEFAULT 0,
  price_usd NUMERIC(12, 2) NOT NULL DEFAULT 0,
  billing_cycle TEXT NOT NULL DEFAULT 'monthly'
    CHECK (billing_cycle IN ('monthly', 'yearly')),
  max_active_listings INTEGER NOT NULL DEFAULT 0, -- -1 = unlimited
  max_monthly_rfqs INTEGER NOT NULL DEFAULT 2,    -- -1 = unlimited
  can_access_data_room BOOLEAN NOT NULL DEFAULT FALSE,
  can_export_markets BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.subscription_plans (
  id, name, tagline, price_tzs, price_usd, billing_cycle,
  max_active_listings, max_monthly_rfqs,
  can_access_data_room, can_export_markets, is_active, sort_order
) VALUES
  (
    'free',
    'Explorer',
    'Standard market benchmarks, 31-Mikoa GIS map & discovery access',
    0,
    0,
    'monthly',
    0,
    2,
    FALSE,
    FALSE,
    TRUE,
    1
  ),
  (
    'pro',
    'Operator Pro',
    'Active project listings, verified tenement eligibility & full market analytics',
    120000,
    45,
    'monthly',
    3,
    25,
    FALSE,
    TRUE,
    TRUE,
    2
  ),
  (
    'enterprise',
    'Institutional / JV Desk',
    'Unlimited listings & RFQs, NDA Data Room access & statutory market exports',
    450000,
    170,
    'monthly',
    -1,
    -1,
    TRUE,
    TRUE,
    TRUE,
    3
  )
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  tagline = EXCLUDED.tagline,
  price_tzs = EXCLUDED.price_tzs,
  price_usd = EXCLUDED.price_usd,
  billing_cycle = EXCLUDED.billing_cycle,
  max_active_listings = EXCLUDED.max_active_listings,
  max_monthly_rfqs = EXCLUDED.max_monthly_rfqs,
  can_access_data_room = EXCLUDED.can_access_data_room,
  can_export_markets = EXCLUDED.can_export_markets,
  is_active = EXCLUDED.is_active,
  sort_order = EXCLUDED.sort_order,
  updated_at = NOW();

ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.subscription_plans TO anon, authenticated, service_role;
GRANT INSERT, UPDATE, DELETE ON public.subscription_plans TO authenticated, service_role;

DROP POLICY IF EXISTS "Anyone can read active subscription plans" ON public.subscription_plans;
CREATE POLICY "Anyone can read active subscription plans"
  ON public.subscription_plans
  FOR SELECT
  TO anon, authenticated
  USING (is_active = TRUE OR (SELECT public.is_billing_admin()));

DROP POLICY IF EXISTS "Admins manage subscription plans" ON public.subscription_plans;
CREATE POLICY "Admins manage subscription plans"
  ON public.subscription_plans
  FOR ALL
  TO authenticated
  USING ((SELECT public.is_billing_admin()))
  WITH CHECK ((SELECT public.is_billing_admin()));

-- ------------------------------------------------------------------------------
-- 3. UPGRADE `public.user_subscriptions` WITH PLAN_ID, STARTS_AT & STRICT RLS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id TEXT NOT NULL DEFAULT 'free' REFERENCES public.subscription_plans(id),
  tier_name TEXT NOT NULL DEFAULT 'Explorer',
  status TEXT NOT NULL DEFAULT 'active',
  billing_cycle TEXT NOT NULL DEFAULT 'monthly',
  price_tzs NUMERIC(14, 2) NOT NULL DEFAULT 0,
  price_usd NUMERIC(14, 2) NOT NULL DEFAULT 0,
  payment_gateway TEXT NOT NULL DEFAULT 'FREE_TIER',
  payment_method TEXT,
  payment_rail TEXT DEFAULT 'FREE',
  payment_provider TEXT,
  payment_reference TEXT,
  starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id)
);

ALTER TABLE public.user_subscriptions
  ADD COLUMN IF NOT EXISTS plan_id TEXT NOT NULL DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS payment_method TEXT,
  ADD COLUMN IF NOT EXISTS starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Ensure foreign key to subscription_plans exists cleanly
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_subscriptions_plan_id_fkey'
  ) THEN
    ALTER TABLE public.user_subscriptions
      ADD CONSTRAINT user_subscriptions_plan_id_fkey
      FOREIGN KEY (plan_id) REFERENCES public.subscription_plans(id);
  END IF;
END;
$$;

-- Allow canonical status & tier values while keeping legacy ClickPesa rows valid
ALTER TABLE public.user_subscriptions DROP CONSTRAINT IF EXISTS user_subscriptions_status_check;
ALTER TABLE public.user_subscriptions
  ADD CONSTRAINT user_subscriptions_status_check
  CHECK (status IN ('active', 'pending_verification', 'past_due', 'expired', 'cancelled', 'canceled'));

ALTER TABLE public.user_subscriptions DROP CONSTRAINT IF EXISTS user_subscriptions_tier_name_check;
ALTER TABLE public.user_subscriptions
  ADD CONSTRAINT user_subscriptions_tier_name_check
  CHECK (tier_name IN (
    'Explorer', 'Operator Pro', 'Institutional / JV Desk',
    'Miner', 'Professional', 'Investor', 'Corporate'
  ));

ALTER TABLE public.user_subscriptions DROP CONSTRAINT IF EXISTS user_subscriptions_payment_gateway_check;
ALTER TABLE public.user_subscriptions
  ADD CONSTRAINT user_subscriptions_payment_gateway_check
  CHECK (payment_gateway IN ('FREE_TIER', 'CLICKPESA', 'AZAMPAY', 'STRIPE', 'BANK_EFT', 'MOBILE_MONEY_MANUAL', 'ADMIN_GRANT'));

CREATE INDEX IF NOT EXISTS idx_user_subscriptions_plan_status
  ON public.user_subscriptions(plan_id, status, expires_at);

-- Zero-trust RLS on user_subscriptions:
-- Users may ONLY SELECT their own row; INSERT/UPDATE restricted strictly to service_role and billing admin.
ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;

REVOKE DELETE ON public.user_subscriptions FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.user_subscriptions TO authenticated;
GRANT ALL ON public.user_subscriptions TO service_role;

DROP POLICY IF EXISTS "Users can view own subscription" ON public.user_subscriptions;
CREATE POLICY "Users can view own subscription"
  ON public.user_subscriptions
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = user_id OR (SELECT public.is_billing_admin()));

DROP POLICY IF EXISTS "Admins can insert user subscriptions" ON public.user_subscriptions;
CREATE POLICY "Admins can insert user subscriptions"
  ON public.user_subscriptions
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT public.is_billing_admin()));

DROP POLICY IF EXISTS "Admins can update user subscriptions" ON public.user_subscriptions;
CREATE POLICY "Admins can update user subscriptions"
  ON public.user_subscriptions
  FOR UPDATE
  TO authenticated
  USING ((SELECT public.is_billing_admin()))
  WITH CHECK ((SELECT public.is_billing_admin()));

-- ------------------------------------------------------------------------------
-- 4. SUBSCRIPTION PAYMENTS LEDGER (`public.subscription_payments`)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.subscription_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id TEXT NOT NULL REFERENCES public.subscription_plans(id),
  amount NUMERIC(14, 2) NOT NULL CHECK (amount >= 0),
  currency TEXT NOT NULL DEFAULT 'TZS',
  payment_method TEXT NOT NULL,
  reference_code TEXT NOT NULL,
  receipt_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending_verification'
    CHECK (status IN ('pending_verification', 'approved', 'rejected', 'settled', 'failed')),
  notes TEXT,
  verified_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscription_payments_user_created
  ON public.subscription_payments(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_subscription_payments_status
  ON public.subscription_payments(status, created_at DESC);

ALTER TABLE public.subscription_payments ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON public.subscription_payments TO authenticated;
GRANT ALL ON public.subscription_payments TO service_role;

DROP POLICY IF EXISTS "Users view own subscription payments" ON public.subscription_payments;
CREATE POLICY "Users view own subscription payments"
  ON public.subscription_payments
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = user_id OR (SELECT public.is_billing_admin()));

DROP POLICY IF EXISTS "Users submit pending subscription payments" ON public.subscription_payments;
CREATE POLICY "Users submit pending subscription payments"
  ON public.subscription_payments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND status = 'pending_verification'
    AND verified_by IS NULL
    AND verified_at IS NULL
  );

DROP POLICY IF EXISTS "Admins review subscription payments" ON public.subscription_payments;
CREATE POLICY "Admins review subscription payments"
  ON public.subscription_payments
  FOR UPDATE
  TO authenticated
  USING ((SELECT public.is_billing_admin()))
  WITH CHECK ((SELECT public.is_billing_admin()));

-- ------------------------------------------------------------------------------
-- 5. ENTITLEMENT ENGINE FUNCTIONS (ENFORCE status = 'active' AND expires_at > NOW())
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
  v_effective_plan_id TEXT := 'free';
  v_effective_status TEXT := 'active';
  v_active_listings INTEGER := 0;
  v_monthly_rfqs INTEGER := 0;
BEGIN
  IF uid IS NULL THEN
    SELECT * INTO v_plan FROM public.subscription_plans WHERE id = 'free';
    RETURN jsonb_build_object(
      'plan_id', 'free',
      'plan_name', coalesce(v_plan.name, 'Explorer'),
      'status', 'active',
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

  -- Check if user is active platform administrator
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = uid
      AND (
        lower(coalesce(p.email, '')) = 'salminmwenesi@gmail.com'
        OR (p.role = 'admin' AND coalesce(p.status, 'active') = 'active')
      )
  ) INTO v_is_admin;

  -- Count active project listings & current calendar-month quote requests
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

  IF FOUND THEN
    v_effective_status := v_sub.status;
    IF v_sub.status = 'active' AND v_sub.expires_at > NOW() AND v_sub.plan_id <> 'free' THEN
      v_is_paid_active := TRUE;
      v_effective_plan_id := v_sub.plan_id;
    ELSIF v_sub.status = 'active' AND v_sub.expires_at <= NOW() AND v_sub.plan_id <> 'free' THEN
      v_effective_status := 'expired';
      v_effective_plan_id := 'free';
    ELSE
      v_effective_plan_id := 'free';
    END IF;
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
BEGIN
  IF uid IS NULL THEN
    RETURN FALSE;
  END IF;

  v_ent := public.get_user_entitlements(uid);
  v_max := coalesce((v_ent ->> 'max_monthly_rfqs')::INTEGER, 2);
  v_used := coalesce((v_ent ->> 'monthly_rfqs_count')::INTEGER, 0);

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
-- 6. ATOMIC ADMIN PAYMENT APPROVAL / REJECTION RPC
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_review_subscription_payment(
  p_payment_id UUID,
  p_decision TEXT,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pay public.subscription_payments%ROWTYPE;
  v_plan public.subscription_plans%ROWTYPE;
  v_now TIMESTAMPTZ := NOW();
  v_expires TIMESTAMPTZ;
  v_actor_email TEXT := lower(coalesce(auth.jwt() ->> 'email', ''));
BEGIN
  IF NOT public.is_billing_admin() THEN
    RAISE EXCEPTION '403 Forbidden: Administrative billing clearance required.'
      USING ERRCODE = '42501';
  END IF;

  IF p_decision NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'Invalid decision. Expected approved or rejected.';
  END IF;

  SELECT * INTO v_pay
  FROM public.subscription_payments
  WHERE id = p_payment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Subscription payment record not found.';
  END IF;

  SELECT * INTO v_plan
  FROM public.subscription_plans
  WHERE id = v_pay.plan_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Associated subscription plan not found.';
  END IF;

  UPDATE public.subscription_payments
  SET
    status = p_decision,
    notes = coalesce(p_notes, notes),
    verified_by = auth.uid(),
    verified_at = v_now
  WHERE id = v_pay.id;

  IF p_decision = 'approved' THEN
    v_expires := v_now + CASE
      WHEN v_plan.billing_cycle = 'yearly' THEN INTERVAL '365 days'
      ELSE INTERVAL '30 days'
    END;

    INSERT INTO public.user_subscriptions (
      user_id,
      plan_id,
      tier_name,
      status,
      billing_cycle,
      price_tzs,
      price_usd,
      payment_gateway,
      payment_method,
      payment_reference,
      starts_at,
      expires_at,
      updated_at
    ) VALUES (
      v_pay.user_id,
      v_plan.id,
      v_plan.name,
      'active',
      v_plan.billing_cycle,
      v_plan.price_tzs,
      v_plan.price_usd,
      'MOBILE_MONEY_MANUAL',
      v_pay.payment_method,
      v_pay.reference_code,
      v_now,
      v_expires,
      v_now
    )
    ON CONFLICT (user_id) DO UPDATE SET
      plan_id = EXCLUDED.plan_id,
      tier_name = EXCLUDED.tier_name,
      status = 'active',
      billing_cycle = EXCLUDED.billing_cycle,
      price_tzs = EXCLUDED.price_tzs,
      price_usd = EXCLUDED.price_usd,
      payment_gateway = EXCLUDED.payment_gateway,
      payment_method = EXCLUDED.payment_method,
      payment_reference = EXCLUDED.payment_reference,
      starts_at = EXCLUDED.starts_at,
      expires_at = EXCLUDED.expires_at,
      updated_at = EXCLUDED.updated_at;
  END IF;

  INSERT INTO public.admin_audit_logs (
    actor_id,
    actor_email,
    action_type,
    target_table,
    target_id,
    target_summary,
    metadata
  ) VALUES (
    auth.uid(),
    v_actor_email,
    CASE WHEN p_decision = 'approved' THEN 'ADMIN_APPROVE_SUBSCRIPTION' ELSE 'ADMIN_REJECT_SUBSCRIPTION' END,
    'subscription_payments',
    v_pay.id::TEXT,
    format('%s (%s %s · Ref %s)', v_plan.name, v_pay.currency, v_pay.amount, v_pay.reference_code),
    jsonb_build_object(
      'user_id', v_pay.user_id,
      'plan_id', v_plan.id,
      'decision', p_decision,
      'notes', p_notes,
      'expires_at', v_expires
    )
  );

  RETURN jsonb_build_object(
    'ok', TRUE,
    'decision', p_decision,
    'plan_id', v_plan.id,
    'plan_name', v_plan.name,
    'starts_at', v_now,
    'expires_at', v_expires
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_review_subscription_payment(UUID, TEXT, TEXT) TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 7. ENFORCE DATABASE-LEVEL ENTITLEMENT RLS POLICIES ON PROJECTS & QUOTES
-- ------------------------------------------------------------------------------
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
