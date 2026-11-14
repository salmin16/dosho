-- =============================================================================
-- MIGRATION: 20261114_localization_and_statutory_mineral_prices.sql
-- PURPOSE:   1. User Localization Preferences (`public.user_localization_preferences`)
--            2. Statutory Tanzania Mining Commission (Tume ya Madini) columns &
--               10 commodity seeds on `public.mineral_prices`
-- =============================================================================

-- 1. User Localization Preferences Table (Currency & Language persistence)
CREATE TABLE IF NOT EXISTS public.user_localization_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  preferred_currency TEXT NOT NULL DEFAULT 'USD'
    CHECK (preferred_currency IN ('USD', 'TZS', 'EUR', 'GBP', 'JPY', 'ZAR', 'AUD', 'CAD', 'CNY', 'AED', 'KES')),
  preferred_language TEXT NOT NULL DEFAULT 'en'
    CHECK (preferred_language IN ('en', 'sw', 'es')),
  unit_basis TEXT NOT NULL DEFAULT 'metric_local'
    CHECK (unit_basis IN ('standard', 'metric_local')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.user_localization_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_localization_preferences FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "localization_prefs_select_own" ON public.user_localization_preferences;
CREATE POLICY "localization_prefs_select_own"
  ON public.user_localization_preferences
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "localization_prefs_upsert_own" ON public.user_localization_preferences;
CREATE POLICY "localization_prefs_upsert_own"
  ON public.user_localization_preferences
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 2. Enhance `public.mineral_prices` with Tanzania Mining Commission statutory local unit columns
ALTER TABLE public.mineral_prices
  ADD COLUMN IF NOT EXISTS local_statutory_unit TEXT NOT NULL DEFAULT 'g',
  ADD COLUMN IF NOT EXISTS inspection_fee_pct NUMERIC(5, 2) NOT NULL DEFAULT 1.00,
  ADD COLUMN IF NOT EXISTS producing_regions TEXT NOT NULL DEFAULT 'Geita, Mwanza, Shinyanga';

-- 3. Upsert Official Mining Commission of Tanzania (Tume ya Madini) Benchmark Commodities
INSERT INTO public.mineral_prices (
  id,
  mineral_name,
  symbol,
  category,
  unit,
  local_statutory_unit,
  purity_note,
  producing_regions,
  world_market_price_usd,
  local_market_price_usd,
  buying_centre_price_usd,
  royalty_rate_pct,
  inspection_fee_pct,
  trend_percentage,
  updated_at
)
VALUES
  (
    'min-xau-001',
    'Gold Bullion (Dhahabu)',
    'XAU',
    'Precious Metals',
    'USD/toz',
    'g',
    'LBMA 99.99% Fine (1 toz = 31.1035 g)',
    'Geita, Mwanza, Shinyanga, Mara, Chunya',
    2748.60,
    2556.20,
    2446.25,
    6.00,
    1.00,
    1.42,
    NOW()
  ),
  (
    'min-xag-002',
    'Silver Bullion (Fedha)',
    'XAG',
    'Precious Metals',
    'USD/toz',
    'g',
    'LBMA 99.9% Fine (1 toz = 31.1035 g)',
    'Geita, Kahama, Chunya, Singida',
    33.85,
    31.48,
    30.13,
    6.00,
    1.00,
    2.18,
    NOW()
  ),
  (
    'min-hg-003',
    'Copper Cathode (Shaba)',
    'HG',
    'Base & Industrial Metals',
    'USD/lb',
    'kg',
    'LME Grade A Electrolytic 99.99% (1 lb = 0.4536 kg)',
    'Mpanda (Katavi), Mpwapwa, Kigoma',
    4.42,
    4.11,
    3.93,
    6.00,
    1.00,
    0.85,
    NOW()
  ),
  (
    'min-tzn-008',
    'Tanzanite (AAA Blue-Violet Zoisite)',
    'TZN',
    'Gemstones',
    'USD/carat',
    'ct',
    'Mererani Controlled Area Block C Faceted AAA',
    'Simanjiro (Manyara - Mererani)',
    485.00,
    451.05,
    426.80,
    6.00,
    1.00,
    1.95,
    NOW()
  ),
  (
    'min-rby-009',
    'Ruby & Red Spinel (Yakuti)',
    'RBY',
    'Gemstones',
    'USD/carat',
    'ct',
    'Unheated Facet-Grade Pigeon Blood / Mahenge Spinel',
    'Ulanga (Morogoro - Mahenge), Winza, Tunduru',
    620.00,
    576.60,
    545.60,
    6.00,
    1.00,
    2.45,
    NOW()
  ),
  (
    'min-grf-006',
    'Flake Graphite (Kinywe 97% TGC)',
    'GRF',
    'Critical & Battery Minerals',
    'USD/tonne',
    'kg',
    'Large Flake +80 Mesh FOB Dar es Salaam',
    'Ruangwa (Lindi), Mahenge (Morogoro), Nachu',
    1180.00,
    1132.80,
    1073.80,
    3.00,
    1.00,
    3.12,
    NOW()
  ),
  (
    'min-ni-007',
    'Nickel Class 1 (Nikeli)',
    'NI',
    'Critical & Battery Minerals',
    'USD/tonne',
    'kg',
    'LME Primary Briquettes (Kabanga Benchmark)',
    'Ngara (Kagera - Kabanga), Nachingwea',
    16280.00,
    15140.40,
    14489.20,
    6.00,
    1.00,
    -0.38,
    NOW()
  ),
  (
    'min-li-010',
    'Lithium Spodumene (SC6 6% Li2O)',
    'LI',
    'Critical & Battery Minerals',
    'USD/tonne',
    'kg',
    'Battery-Grade 6.0% Li2O Concentrate CIF Benchmark',
    'Dodoma (Hombolo), Singida, Njombe',
    1095.00,
    1018.35,
    974.55,
    6.00,
    1.00,
    2.74,
    NOW()
  ),
  (
    'min-co-005',
    'Cobalt Metal (Kobalti)',
    'CO',
    'Critical & Battery Minerals',
    'USD/tonne',
    'kg',
    '99.8% Min Battery-Grade Sulphate/Metal',
    'Ngara (Kagera), Kigoma, Katavi',
    24300.00,
    22842.00,
    21870.00,
    6.00,
    1.00,
    1.15,
    NOW()
  ),
  (
    'min-sn-004',
    'Tin Ingot (Bati / Cassiterite)',
    'SN',
    'Base & Industrial Metals',
    'USD/tonne',
    'kg',
    'LME 99.85% Refined Tin (Kyerwa Benchmark)',
    'Kyerwa & Karagwe (Kagera)',
    31450.00,
    29248.50,
    27990.50,
    6.00,
    1.00,
    -0.64,
    NOW()
  )
ON CONFLICT (id) DO UPDATE SET
  mineral_name = EXCLUDED.mineral_name,
  local_statutory_unit = EXCLUDED.local_statutory_unit,
  purity_note = EXCLUDED.purity_note,
  producing_regions = EXCLUDED.producing_regions,
  world_market_price_usd = EXCLUDED.world_market_price_usd,
  local_market_price_usd = EXCLUDED.local_market_price_usd,
  buying_centre_price_usd = EXCLUDED.buying_centre_price_usd,
  royalty_rate_pct = EXCLUDED.royalty_rate_pct,
  inspection_fee_pct = EXCLUDED.inspection_fee_pct,
  trend_percentage = EXCLUDED.trend_percentage,
  updated_at = NOW();
