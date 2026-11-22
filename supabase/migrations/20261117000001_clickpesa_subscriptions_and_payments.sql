-- ==============================================================================
-- MODULE 6: TIER-BASED SUBSCRIPTION GATING & CLICKPESA FINTECH GATEWAY
-- Target: Supabase PostgreSQL (MineConnect Enterprise Platform)
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. User Subscriptions Table (`public.user_subscriptions`)
CREATE TABLE IF NOT EXISTS public.user_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tier_name TEXT NOT NULL DEFAULT 'Explorer'
    CHECK (tier_name IN ('Explorer', 'Miner', 'Professional', 'Investor', 'Corporate')),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'expired', 'canceled')),
  billing_cycle TEXT NOT NULL DEFAULT 'monthly'
    CHECK (billing_cycle IN ('monthly', 'yearly')),
  price_tzs NUMERIC(14, 2) NOT NULL DEFAULT 0,
  price_usd NUMERIC(14, 2) NOT NULL DEFAULT 0,
  payment_gateway TEXT NOT NULL DEFAULT 'CLICKPESA'
    CHECK (payment_gateway IN ('FREE_TIER', 'CLICKPESA')),
  payment_rail TEXT NOT NULL DEFAULT 'MOBILE_MONEY'
    CHECK (payment_rail IN ('FREE', 'MOBILE_MONEY', 'BANK_TRANSFER', 'INTERNATIONAL_CARD')),
  payment_provider TEXT,
  payment_reference TEXT,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT ( NOW() + INTERVAL '30 days' ),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id
  ON public.user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_tier_status
  ON public.user_subscriptions(tier_name, status);

-- 2. ClickPesa Payment Transactions & State Machine Table (`public.payment_transactions`)
CREATE TABLE IF NOT EXISTS public.payment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key TEXT NOT NULL UNIQUE,
  clickpesa_order_id TEXT NOT NULL UNIQUE,
  clickpesa_control_number TEXT,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tier_name TEXT NOT NULL
    CHECK (tier_name IN ('Explorer', 'Miner', 'Professional', 'Investor', 'Corporate')),
  billing_cycle TEXT NOT NULL
    CHECK (billing_cycle IN ('monthly', 'yearly')),
  gateway TEXT NOT NULL DEFAULT 'CLICKPESA'
    CHECK (gateway IN ('FREE_TIER', 'CLICKPESA')),
  rail TEXT NOT NULL
    CHECK (rail IN ('FREE', 'MOBILE_MONEY', 'BANK_TRANSFER', 'INTERNATIONAL_CARD')),
  provider_code TEXT NOT NULL,
  payment_method_label TEXT NOT NULL,
  account_or_phone_masked TEXT,
  verified_amount_tzs NUMERIC(14, 2) NOT NULL,
  verified_amount_usd NUMERIC(14, 2) NOT NULL,
  charged_currency TEXT NOT NULL DEFAULT 'TZS',
  charged_amount NUMERIC(14, 2) NOT NULL,
  state TEXT NOT NULL DEFAULT 'INITIATED'
    CHECK (state IN ('INITIATED', 'PROCESSING', 'SETTLED', 'FAILED')),
  webhook_signature_verified BOOLEAN NOT NULL DEFAULT FALSE,
  reconciled_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_tx_user_id
  ON public.payment_transactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_tx_idempotency
  ON public.payment_transactions(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_payment_tx_order_id
  ON public.payment_transactions(clickpesa_order_id);

-- 3. Row-Level Security (RLS) Enforcement (Server-Side service_role Writes Only)
ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;

REVOKE INSERT, UPDATE, DELETE ON public.user_subscriptions FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.payment_transactions FROM anon, authenticated;

DROP POLICY IF EXISTS "Users can view own subscription" ON public.user_subscriptions;
CREATE POLICY "Users can view own subscription"
  ON public.user_subscriptions
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = user_id OR (SELECT public.is_active_admin()));

DROP POLICY IF EXISTS "Admins can manage all subscriptions" ON public.user_subscriptions;

DROP POLICY IF EXISTS "Users can view own payment transactions" ON public.payment_transactions;
CREATE POLICY "Users can view own payment transactions"
  ON public.payment_transactions
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = user_id OR (SELECT public.is_active_admin()));

-- 4. Atomic ClickPesa Webhook Reconciliation Function
CREATE OR REPLACE FUNCTION public.reconcile_clickpesa_payment(
  p_clickpesa_order_id TEXT,
  p_signature_verified BOOLEAN,
  p_new_state TEXT DEFAULT 'SETTLED'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tx public.payment_transactions%ROWTYPE;
  v_duration INTERVAL;
  v_expires TIMESTAMPTZ;
BEGIN
  SELECT * INTO v_tx
  FROM public.payment_transactions
  WHERE clickpesa_order_id = p_clickpesa_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ClickPesa transaction order % not found', p_clickpesa_order_id;
  END IF;

  -- Idempotent guard: if already SETTLED, return existing record
  IF v_tx.state = 'SETTLED' THEN
    RETURN jsonb_build_object(
      'status', 'already_settled',
      'order_id', v_tx.clickpesa_order_id,
      'tier_name', v_tx.tier_name
    );
  END IF;

  UPDATE public.payment_transactions
  SET
    state = p_new_state,
    webhook_signature_verified = p_signature_verified,
    reconciled_at = CASE WHEN p_new_state = 'SETTLED' THEN NOW() ELSE reconciled_at END,
    updated_at = NOW()
  WHERE id = v_tx.id;

  IF p_new_state = 'SETTLED' AND p_signature_verified = TRUE THEN
    v_duration := CASE WHEN v_tx.billing_cycle = 'yearly' THEN INTERVAL '365 days' ELSE INTERVAL '30 days' END;
    v_expires := NOW() + v_duration;

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
      payment_reference,
      expires_at,
      updated_at
    ) VALUES (
      v_tx.user_id,
      v_tx.tier_name,
      'active',
      v_tx.billing_cycle,
      v_tx.verified_amount_tzs,
      v_tx.verified_amount_usd,
      'CLICKPESA',
      v_tx.rail,
      v_tx.provider_code,
      v_tx.clickpesa_order_id,
      v_expires,
      NOW()
    )
    ON CONFLICT (user_id) DO UPDATE SET
      tier_name = EXCLUDED.tier_name,
      status = 'active',
      billing_cycle = EXCLUDED.billing_cycle,
      price_tzs = EXCLUDED.price_tzs,
      price_usd = EXCLUDED.price_usd,
      payment_gateway = 'CLICKPESA',
      payment_rail = EXCLUDED.payment_rail,
      payment_provider = EXCLUDED.payment_provider,
      payment_reference = EXCLUDED.payment_reference,
      expires_at = EXCLUDED.expires_at,
      updated_at = NOW();
  END IF;

  RETURN jsonb_build_object(
    'status', p_new_state,
    'order_id', v_tx.clickpesa_order_id,
    'tier_name', v_tx.tier_name,
    'user_id', v_tx.user_id
  );
END;
$$;
