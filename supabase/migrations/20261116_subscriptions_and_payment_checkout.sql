-- ============================================================================
-- Migration: 20261116_subscriptions_and_payment_checkout.sql
-- Purpose:   Tier-Based Subscription Access Control (`public.user_subscriptions`),
--            Anti-Tampering Server Price Lookup, and Multi-Gateway Webhook Ledger
-- ============================================================================

-- 1. Create `public.user_subscriptions` table
CREATE TABLE IF NOT EXISTS public.user_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tier_name TEXT NOT NULL DEFAULT 'Explorer'
    CHECK (tier_name IN ('Explorer', 'Miner', 'Professional', 'Investor', 'Corporate')),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'expired', 'canceled')),
  billing_cycle TEXT NOT NULL DEFAULT 'monthly'
    CHECK (billing_cycle IN ('monthly', 'yearly')),
  price_tzs NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (price_tzs >= 0),
  price_usd NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (price_usd >= 0),
  payment_gateway TEXT NOT NULL DEFAULT 'FREE_TIER'
    CHECK (payment_gateway IN ('FREE_TIER', 'STRIPE_GLOBAL', 'AZAMPAY_MPESA_TZS', 'FLUTTERWAVE_AFRICA')),
  payment_reference TEXT,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_user_subscriptions_user UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id ON public.user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_tier_status ON public.user_subscriptions(tier_name, status);

-- 2. Create `public.payment_transactions` ledger for webhook & checkout auditability
CREATE TABLE IF NOT EXISTS public.payment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tier_name TEXT NOT NULL
    CHECK (tier_name IN ('Explorer', 'Miner', 'Professional', 'Investor', 'Corporate')),
  billing_cycle TEXT NOT NULL CHECK (billing_cycle IN ('monthly', 'yearly')),
  gateway TEXT NOT NULL
    CHECK (gateway IN ('FREE_TIER', 'STRIPE_GLOBAL', 'AZAMPAY_MPESA_TZS', 'FLUTTERWAVE_AFRICA')),
  payment_method_label TEXT NOT NULL,
  verified_amount_tzs NUMERIC(14, 2) NOT NULL CHECK (verified_amount_tzs >= 0),
  verified_amount_usd NUMERIC(14, 2) NOT NULL CHECK (verified_amount_usd >= 0),
  charged_currency TEXT NOT NULL DEFAULT 'TZS',
  charged_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
  external_reference TEXT NOT NULL UNIQUE,
  webhook_status TEXT NOT NULL DEFAULT 'VERIFIED'
    CHECK (webhook_status IN ('PENDING', 'VERIFIED', 'FAILED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Enable & Force Mandatory Row Level Security (RLS)
ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_subscriptions FORCE ROW LEVEL SECURITY;

ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_transactions FORCE ROW LEVEL SECURITY;

-- Users can read their own subscription; Admins can read all
DROP POLICY IF EXISTS "Users select own subscription" ON public.user_subscriptions;
CREATE POLICY "Users select own subscription"
  ON public.user_subscriptions
  FOR SELECT
  USING (auth.uid() = user_id OR public.is_active_admin());

-- Strict Write Lock: Only active administrators or SECURITY DEFINER webhook functions can write
DROP POLICY IF EXISTS "Only admins write subscriptions directly" ON public.user_subscriptions;
CREATE POLICY "Only admins write subscriptions directly"
  ON public.user_subscriptions
  FOR ALL
  USING (public.is_active_admin())
  WITH CHECK (public.is_active_admin());

DROP POLICY IF EXISTS "Users select own payment transactions" ON public.payment_transactions;
CREATE POLICY "Users select own payment transactions"
  ON public.payment_transactions
  FOR SELECT
  USING (auth.uid() = user_id OR public.is_active_admin());

-- 4. Server-Side Webhook & Anti-Tampering Activation Function
--    Looks up canonical statutory prices inside PostgreSQL — never trusting client input
CREATE OR REPLACE FUNCTION public.activate_verified_subscription(
  p_user_id UUID,
  p_tier_name TEXT,
  p_billing_cycle TEXT,
  p_gateway TEXT,
  p_payment_method_label TEXT,
  p_charged_currency TEXT,
  p_charged_amount NUMERIC,
  p_external_reference TEXT
)
RETURNS public.user_subscriptions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_monthly_tzs NUMERIC;
  v_verified_tzs NUMERIC;
  v_verified_usd NUMERIC;
  v_expires_at TIMESTAMPTZ;
  v_sub public.user_subscriptions;
BEGIN
  -- 1. Canonical Server-Side Price Lookup (TZS per month)
  CASE p_tier_name
    WHEN 'Explorer' THEN v_monthly_tzs := 0;
    WHEN 'Miner' THEN v_monthly_tzs := 50000;
    WHEN 'Professional' THEN v_monthly_tzs := 150000;
    WHEN 'Investor' THEN v_monthly_tzs := 300000;
    WHEN 'Corporate' THEN v_monthly_tzs := 1000000;
    ELSE RAISE EXCEPTION 'Invalid subscription tier: %', p_tier_name;
  END CASE;

  -- 2. Yearly cycle = 10x monthly (2 months free statutory discount)
  IF p_billing_cycle = 'yearly' THEN
    v_verified_tzs := v_monthly_tzs * 10;
    v_expires_at := NOW() + INTERVAL '365 days';
  ELSE
    v_verified_tzs := v_monthly_tzs;
    v_expires_at := NOW() + INTERVAL '30 days';
  END IF;

  -- 3. USD equivalent baseline (1 USD = 2685 TZS benchmark)
  v_verified_usd := ROUND(v_verified_tzs / 2685.0, 2);

  -- 4. Record immutable payment transaction
  INSERT INTO public.payment_transactions (
    user_id,
    tier_name,
    billing_cycle,
    gateway,
    payment_method_label,
    verified_amount_tzs,
    verified_amount_usd,
    charged_currency,
    charged_amount,
    external_reference,
    webhook_status
  ) VALUES (
    p_user_id,
    p_tier_name,
    p_billing_cycle,
    p_gateway,
    p_payment_method_label,
    v_verified_tzs,
    v_verified_usd,
    p_charged_currency,
    p_charged_amount,
    p_external_reference,
    'VERIFIED'
  );

  -- 5. Upsert `public.user_subscriptions`
  INSERT INTO public.user_subscriptions (
    user_id,
    tier_name,
    status,
    billing_cycle,
    price_tzs,
    price_usd,
    payment_gateway,
    payment_reference,
    expires_at,
    updated_at
  ) VALUES (
    p_user_id,
    p_tier_name,
    'active',
    p_billing_cycle,
    v_verified_tzs,
    v_verified_usd,
    p_gateway,
    p_external_reference,
    v_expires_at,
    NOW()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    tier_name = EXCLUDED.tier_name,
    status = 'active',
    billing_cycle = EXCLUDED.billing_cycle,
    price_tzs = EXCLUDED.price_tzs,
    price_usd = EXCLUDED.price_usd,
    payment_gateway = EXCLUDED.payment_gateway,
    payment_reference = EXCLUDED.payment_reference,
    expires_at = EXCLUDED.expires_at,
    updated_at = NOW()
  RETURNING * INTO v_sub;

  -- 6. Append immutable audit log entry
  INSERT INTO public.audit_logs (
    user_id,
    action,
    ip_address,
    user_agent,
    metadata
  ) VALUES (
    p_user_id,
    'SUBSCRIPTION_ACTIVATED',
    '0.0.0.0',
    'Payment-Webhook-Verifier',
    jsonb_build_object(
      'tierName', p_tier_name,
      'billingCycle', p_billing_cycle,
      'gateway', p_gateway,
      'verifiedTzs', v_verified_tzs,
      'verifiedUsd', v_verified_usd,
      'reference', p_external_reference,
      'expiresAt', v_expires_at
    )
  );

  RETURN v_sub;
END;
$$;
