-- ==============================================================================
-- Migration: 20261125000001_azampay_checkout_and_callbacks.sql
-- Purpose:   Extend `public.payment_transactions` for end-to-end AzamPay Mobile
--            Money & Bank Checkout + Webhook Auto-Activation while preserving
--            100% RLS, zero schema drift, and existing ClickPesa history.
-- Target:    Supabase PostgreSQL (MineConnect · project iapqpsxodlhvhdfsftqi)
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Ensure `public.payment_transactions` exists and add all AzamPay columns
CREATE TABLE IF NOT EXISTS public.payment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  external_id TEXT UNIQUE,
  provider TEXT,
  phone_number TEXT,
  amount_tzs NUMERIC(14, 2) NOT NULL DEFAULT 0,
  tier TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  azampay_transaction_id TEXT,
  raw_callback JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.payment_transactions
  ADD COLUMN IF NOT EXISTS external_id TEXT,
  ADD COLUMN IF NOT EXISTS provider TEXT,
  ADD COLUMN IF NOT EXISTS phone_number TEXT,
  ADD COLUMN IF NOT EXISTS amount_tzs NUMERIC(14, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tier TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS azampay_transaction_id TEXT,
  ADD COLUMN IF NOT EXISTS raw_callback JSONB;

-- 2. Relax legacy ClickPesa-only NOT NULL constraints so AzamPay rows insert cleanly
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'payment_transactions' AND column_name = 'idempotency_key'
  ) THEN
    ALTER TABLE public.payment_transactions ALTER COLUMN idempotency_key DROP NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'payment_transactions' AND column_name = 'clickpesa_order_id'
  ) THEN
    ALTER TABLE public.payment_transactions ALTER COLUMN clickpesa_order_id DROP NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'payment_transactions' AND column_name = 'tier_name'
  ) THEN
    ALTER TABLE public.payment_transactions ALTER COLUMN tier_name DROP NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'payment_transactions' AND column_name = 'billing_cycle'
  ) THEN
    ALTER TABLE public.payment_transactions ALTER COLUMN billing_cycle SET DEFAULT 'monthly';
    ALTER TABLE public.payment_transactions ALTER COLUMN billing_cycle DROP NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'payment_transactions' AND column_name = 'rail'
  ) THEN
    ALTER TABLE public.payment_transactions ALTER COLUMN rail SET DEFAULT 'MOBILE_MONEY';
    ALTER TABLE public.payment_transactions ALTER COLUMN rail DROP NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'payment_transactions' AND column_name = 'provider_code'
  ) THEN
    ALTER TABLE public.payment_transactions ALTER COLUMN provider_code DROP NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'payment_transactions' AND column_name = 'payment_method_label'
  ) THEN
    ALTER TABLE public.payment_transactions ALTER COLUMN payment_method_label DROP NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'payment_transactions' AND column_name = 'verified_amount_tzs'
  ) THEN
    ALTER TABLE public.payment_transactions ALTER COLUMN verified_amount_tzs SET DEFAULT 0;
    ALTER TABLE public.payment_transactions ALTER COLUMN verified_amount_tzs DROP NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'payment_transactions' AND column_name = 'verified_amount_usd'
  ) THEN
    ALTER TABLE public.payment_transactions ALTER COLUMN verified_amount_usd SET DEFAULT 0;
    ALTER TABLE public.payment_transactions ALTER COLUMN verified_amount_usd DROP NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'payment_transactions' AND column_name = 'charged_amount'
  ) THEN
    ALTER TABLE public.payment_transactions ALTER COLUMN charged_amount SET DEFAULT 0;
    ALTER TABLE public.payment_transactions ALTER COLUMN charged_amount DROP NOT NULL;
  END IF;
END;
$$;

-- 3. Apply authoritative CHECK & UNIQUE constraints for AzamPay + legacy compatibility
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'payment_transactions_external_id_key'
      AND conrelid = 'public.payment_transactions'::regclass
  ) THEN
    ALTER TABLE public.payment_transactions
      ADD CONSTRAINT payment_transactions_external_id_key UNIQUE (external_id);
  END IF;
END;
$$;

ALTER TABLE public.payment_transactions
  DROP CONSTRAINT IF EXISTS payment_transactions_provider_check;
ALTER TABLE public.payment_transactions
  ADD CONSTRAINT payment_transactions_provider_check
  CHECK (
    provider IS NULL OR provider IN (
      'Mpesa', 'Tigo', 'Airtel', 'Halopesa', 'Azampesa', 'CRDB', 'NMB', 'NBC'
    )
  );

ALTER TABLE public.payment_transactions
  DROP CONSTRAINT IF EXISTS payment_transactions_tier_check;
ALTER TABLE public.payment_transactions
  ADD CONSTRAINT payment_transactions_tier_check
  CHECK (tier IS NULL OR tier IN ('operator_pro', 'institutional_jv'));

ALTER TABLE public.payment_transactions
  DROP CONSTRAINT IF EXISTS payment_transactions_status_check;
ALTER TABLE public.payment_transactions
  ADD CONSTRAINT payment_transactions_status_check
  CHECK (status IN ('pending', 'completed', 'failed'));

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'payment_transactions' AND column_name = 'gateway'
  ) THEN
    ALTER TABLE public.payment_transactions
      DROP CONSTRAINT IF EXISTS payment_transactions_gateway_check;
    ALTER TABLE public.payment_transactions
      ADD CONSTRAINT payment_transactions_gateway_check
      CHECK (gateway IN ('FREE_TIER', 'CLICKPESA', 'AZAMPAY', 'STRIPE'));
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'payment_transactions' AND column_name = 'tier_name'
  ) THEN
    ALTER TABLE public.payment_transactions
      DROP CONSTRAINT IF EXISTS payment_transactions_tier_name_check;
    ALTER TABLE public.payment_transactions
      ADD CONSTRAINT payment_transactions_tier_name_check
      CHECK (
        tier_name IS NULL OR tier_name IN (
          'Explorer', 'Operator Pro', 'Institutional / JV Desk',
          'Miner', 'Professional', 'Investor', 'Corporate'
        )
      );
  END IF;
END;
$$;

-- 4. Indexes & updated_at trigger
CREATE INDEX IF NOT EXISTS idx_payment_transactions_external_id
  ON public.payment_transactions(external_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_user_status
  ON public.payment_transactions(user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_azampay_tx_id
  ON public.payment_transactions(azampay_transaction_id);

DROP TRIGGER IF EXISTS trg_payment_transactions_updated_at ON public.payment_transactions;
CREATE TRIGGER trg_payment_transactions_updated_at
  BEFORE UPDATE ON public.payment_transactions
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 5. Enforce 100% Row-Level Security (Users SELECT own rows; Edge Functions write via service_role)
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_transactions FORCE ROW LEVEL SECURITY;

REVOKE INSERT, UPDATE, DELETE ON public.payment_transactions FROM anon, authenticated;
GRANT SELECT ON public.payment_transactions TO authenticated;
GRANT ALL ON public.payment_transactions TO service_role;

DROP POLICY IF EXISTS "Users can view own payment transactions" ON public.payment_transactions;
CREATE POLICY "Users can view own payment transactions"
  ON public.payment_transactions
  FOR SELECT
  TO authenticated
  USING (
    (SELECT auth.uid()) = user_id
    OR (SELECT public.is_billing_admin())
  );

-- 6. Enable Realtime updates on `public.payment_transactions` so checkout unlocks immediately on webhook
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.payment_transactions;
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END;
  END IF;
END;
$$;
