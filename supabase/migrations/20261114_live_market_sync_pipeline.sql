-- ============================================================================
-- Migration: 20261114_live_market_sync_pipeline.sql
-- Purpose:   Real-Time Market Data Aggregation Pipeline, Base USD Normalization,
--            and Statutory Tier Calculation for `public.mineral_prices`
-- ============================================================================

-- 1. Extend `public.mineral_prices` with live trading desk telemetry columns
ALTER TABLE IF EXISTS public.mineral_prices
  ADD COLUMN IF NOT EXISTS day_open_usd NUMERIC(14, 4),
  ADD COLUMN IF NOT EXISTS day_high_usd NUMERIC(14, 4),
  ADD COLUMN IF NOT EXISTS day_low_usd NUMERIC(14, 4),
  ADD COLUMN IF NOT EXISTS change_24h_usd NUMERIC(14, 4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS exchange_desk TEXT DEFAULT 'LBMA / LME / Tume ya Madini',
  ADD COLUMN IF NOT EXISTS feed_source TEXT DEFAULT 'STATUTORY_BASELINE',
  ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ DEFAULT NOW();

-- 2. Create `public.market_sync_logs` to track automated cron / API sync health
CREATE TABLE IF NOT EXISTS public.market_sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  sync_mode TEXT NOT NULL CHECK (sync_mode IN ('LIVE_API', 'HYBRID_LIVE', 'FALLBACK_CACHE')),
  commodities_synced INTEGER NOT NULL DEFAULT 0,
  latency_ms INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK (status IN ('SUCCESS', 'DEGRADED', 'FALLBACK')),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.market_sync_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Market sync logs are publicly readable" ON public.market_sync_logs;
CREATE POLICY "Market sync logs are publicly readable"
  ON public.market_sync_logs
  FOR SELECT
  USING (true);

-- 3. Stored procedure to normalize USD spot prices and auto-compute Tanzanian
--    statutory Soko la Madini (Tier 2) and Kituo cha Ununuzi (Tier 3) benchmarks
CREATE OR REPLACE FUNCTION public.upsert_live_mineral_spot(
  p_symbol TEXT,
  p_world_spot_usd NUMERIC,
  p_trend_pct NUMERIC,
  p_feed_source TEXT DEFAULT 'LIVE_API'
)
RETURNS public.mineral_prices
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_row public.mineral_prices;
  v_royalty_rate NUMERIC;
  v_inspection_rate NUMERIC;
  v_local_deduction NUMERIC;
  v_local_usd NUMERIC;
  v_buying_usd NUMERIC;
BEGIN
  SELECT * INTO v_row
  FROM public.mineral_prices
  WHERE symbol = UPPER(TRIM(p_symbol))
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Commodity symbol % not found in public.mineral_prices', p_symbol;
  END IF;

  v_royalty_rate := COALESCE(v_row.royalty_rate_pct, 6.0) / 100.0;
  v_inspection_rate := COALESCE(v_row.inspection_fee_pct, 1.0) / 100.0;
  v_local_deduction := 1.0 - (v_royalty_rate + v_inspection_rate);

  -- Statutory Soko la Madini benchmark (World Spot minus statutory Royalty & Inspection)
  v_local_usd := ROUND(p_world_spot_usd * v_local_deduction, 2);
  -- Statutory Buying Centre (Kituo cha Ununuzi) threshold (~95.5% of Soko la Madini)
  v_buying_usd := ROUND(v_local_usd * 0.9565, 2);

  UPDATE public.mineral_prices
  SET
    world_market_price_usd = ROUND(p_world_spot_usd, 2),
    local_market_price_usd = v_local_usd,
    buying_centre_price_usd = v_buying_usd,
    day_high_usd = GREATEST(COALESCE(day_high_usd, p_world_spot_usd), ROUND(p_world_spot_usd * 1.004, 2)),
    day_low_usd = LEAST(COALESCE(day_low_usd, p_world_spot_usd), ROUND(p_world_spot_usd * 0.994, 2)),
    change_24h_usd = ROUND(p_world_spot_usd * (p_trend_pct / 100.0), 2),
    trend_percentage = ROUND(p_trend_pct, 2),
    feed_source = p_feed_source,
    last_synced_at = NOW(),
    updated_at = NOW()
  WHERE id = v_row.id
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;
