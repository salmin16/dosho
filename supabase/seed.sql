-- ============================================================================
-- Mine Connect — Local & PR Preview Database Seed (supabase/seed.sql)
-- Idempotent statutory Tume ya Madini indicative mineral benchmark prices
-- ============================================================================

INSERT INTO public.mineral_prices (
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
  sparkline_points
) VALUES
  (
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
    '[2690, 2704, 2698, 2715, 2729, 2736, 2748.6]'::jsonb
  ),
  (
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
    '[32.4, 32.8, 32.6, 33.1, 33.4, 33.6, 33.85]'::jsonb
  ),
  (
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
    '[4.31, 4.34, 4.33, 4.37, 4.39, 4.40, 4.42]'::jsonb
  ),
  (
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
    '[1110, 1125, 1130, 1148, 1160, 1172, 1180]'::jsonb
  ),
  (
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
    '[465, 468, 472, 475, 479, 482, 485]'::jsonb
  )
ON CONFLICT (symbol) DO NOTHING;
