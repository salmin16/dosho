-- ============================================================================
-- Migration: 20261117_dual_rail_checkout_and_nmb_settlement.sql
-- Purpose:   Direct Merchant Payout Settlement & Bank Routing Integration
--            Bank: NMB Bank (National Microfinance Bank, Tanzania)
--            Account Number: 60510047212
--            Account Name: Salmin Ally Mwenesi
-- ============================================================================

-- 1. Extend `public.payment_transactions` with NMB Bank settlement columns
ALTER TABLE IF EXISTS public.payment_transactions
  ADD COLUMN IF NOT EXISTS settlement_bank_name TEXT NOT NULL DEFAULT 'NMB Bank (National Microfinance Bank, Tanzania)',
  ADD COLUMN IF NOT EXISTS settlement_account_number TEXT NOT NULL DEFAULT '60510047212',
  ADD COLUMN IF NOT EXISTS settlement_beneficiary_name TEXT NOT NULL DEFAULT 'Salmin Ally Mwenesi',
  ADD COLUMN IF NOT EXISTS settlement_swift_bic TEXT NOT NULL DEFAULT 'NMIBTZTZ',
  ADD COLUMN IF NOT EXISTS settlement_status TEXT NOT NULL DEFAULT 'settled'
    CHECK (settlement_status IN ('settled', 'pending_payout')),
  ADD COLUMN IF NOT EXISTS settlement_batch_id TEXT,
  ADD COLUMN IF NOT EXISTS settled_at TIMESTAMPTZ DEFAULT NOW();

-- 2. Create `public.merchant_settlement_ledger` for automated NMB 60510047212 payouts
CREATE TABLE IF NOT EXISTS public.merchant_settlement_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id TEXT NOT NULL,
  transaction_reference TEXT NOT NULL UNIQUE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tier_name TEXT NOT NULL
    CHECK (tier_name IN ('Explorer', 'Miner', 'Professional', 'Investor', 'Corporate')),
  billing_cycle TEXT NOT NULL CHECK (billing_cycle IN ('monthly', 'yearly')),
  gateway TEXT NOT NULL,
  payment_channel TEXT NOT NULL,
  gross_amount_tzs NUMERIC(14, 2) NOT NULL CHECK (gross_amount_tzs >= 0),
  gross_amount_usd NUMERIC(14, 2) NOT NULL CHECK (gross_amount_usd >= 0),
  destination_bank_name TEXT NOT NULL DEFAULT 'NMB Bank (National Microfinance Bank, Tanzania)',
  destination_account_number TEXT NOT NULL DEFAULT '60510047212'
    CHECK (destination_account_number = '60510047212'),
  destination_beneficiary_name TEXT NOT NULL DEFAULT 'Salmin Ally Mwenesi'
    CHECK (destination_beneficiary_name = 'Salmin Ally Mwenesi'),
  destination_swift_bic TEXT NOT NULL DEFAULT 'NMIBTZTZ',
  aggregator_routing_code TEXT NOT NULL,
  settlement_status TEXT NOT NULL DEFAULT 'settled'
    CHECK (settlement_status IN ('settled', 'pending_payout')),
  settled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_merchant_settlement_batch ON public.merchant_settlement_ledger(batch_id);
CREATE INDEX IF NOT EXISTS idx_merchant_settlement_user ON public.merchant_settlement_ledger(user_id);

-- 3. Enable & Force Mandatory Row Level Security (RLS)
ALTER TABLE public.merchant_settlement_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchant_settlement_ledger FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own settlement receipts or admin views all" ON public.merchant_settlement_ledger;
CREATE POLICY "Users view own settlement receipts or admin views all"
  ON public.merchant_settlement_ledger
  FOR SELECT
  USING (auth.uid() = user_id OR public.is_active_admin());

DROP POLICY IF EXISTS "Only active admins write settlement ledger directly" ON public.merchant_settlement_ledger;
CREATE POLICY "Only active admins write settlement ledger directly"
  ON public.merchant_settlement_ledger
  FOR ALL
  USING (public.is_active_admin())
  WITH CHECK (public.is_active_admin());

-- 4. Upgrade `public.activate_verified_subscription` to route all settlements to NMB 60510047212
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
  v_batch_id TEXT;
  v_settlement_status TEXT;
  v_routing_code TEXT;
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

  IF p_billing_cycle = 'yearly' THEN
    v_verified_tzs := v_monthly_tzs * 10;
    v_expires_at := NOW() + INTERVAL '365 days';
  ELSE
    v_verified_tzs := v_monthly_tzs;
    v_expires_at := NOW() + INTERVAL '30 days';
  END IF;

  v_verified_usd := ROUND(v_verified_tzs / 2685.0, 2);
  v_batch_id := 'BATCH-NMB-' || TO_CHAR(NOW(), 'YYYYMMDD');

  IF p_gateway = 'STRIPE_GLOBAL' THEN
    v_settlement_status := 'pending_payout';
    v_routing_code := 'acct_nmb_tz_60510047212';
  ELSE
    v_settlement_status := 'settled';
    v_routing_code := 'AZAM-NMB-60510047212';
  END IF;

  -- 2. Record payment transaction with NMB 60510047212 beneficiary routing
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
    webhook_status,
    settlement_bank_name,
    settlement_account_number,
    settlement_beneficiary_name,
    settlement_swift_bic,
    settlement_status,
    settlement_batch_id,
    settled_at
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
    'VERIFIED',
    'NMB Bank (National Microfinance Bank, Tanzania)',
    '60510047212',
    'Salmin Ally Mwenesi',
    'NMIBTZTZ',
    v_settlement_status,
    v_batch_id,
    NOW()
  );

  -- 3. Record entry in `public.merchant_settlement_ledger`
  INSERT INTO public.merchant_settlement_ledger (
    batch_id,
    transaction_reference,
    user_id,
    tier_name,
    billing_cycle,
    gateway,
    payment_channel,
    gross_amount_tzs,
    gross_amount_usd,
    destination_bank_name,
    destination_account_number,
    destination_beneficiary_name,
    destination_swift_bic,
    aggregator_routing_code,
    settlement_status,
    settled_at
  ) VALUES (
    v_batch_id,
    p_external_reference,
    p_user_id,
    p_tier_name,
    p_billing_cycle,
    p_gateway,
    p_payment_method_label,
    v_verified_tzs,
    v_verified_usd,
    'NMB Bank (National Microfinance Bank, Tanzania)',
    '60510047212',
    'Salmin Ally Mwenesi',
    'NMIBTZTZ',
    v_routing_code,
    v_settlement_status,
    NOW()
  );

  -- 4. Upsert `public.user_subscriptions`
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

  -- 5. Append immutable audit log entry with NMB Bank settlement verification
  INSERT INTO public.audit_logs (
    user_id,
    action,
    ip_address,
    user_agent,
    metadata
  ) VALUES (
    p_user_id,
    'SUBSCRIPTION_SETTLED_NMB',
    '0.0.0.0',
    'NMB-Settlement-Router',
    jsonb_build_object(
      'tierName', p_tier_name,
      'billingCycle', p_billing_cycle,
      'gateway', p_gateway,
      'paymentChannel', p_payment_method_label,
      'verifiedTzs', v_verified_tzs,
      'verifiedUsd', v_verified_usd,
      'reference', p_external_reference,
      'settlementBank', 'NMB Bank (National Microfinance Bank, Tanzania)',
      'settlementAccountNumber', '60510047212',
      'settlementBeneficiary', 'Salmin Ally Mwenesi',
      'settlementStatus', v_settlement_status,
      'batchId', v_batch_id
    )
  );

  RETURN v_sub;
END;
$$;
