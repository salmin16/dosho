-- ============================================================================
-- MIGRATION: Indicative Mineral Prices Module (public.mineral_prices)
-- Mirrors global LME/LBMA benchmarks & Tanzania Mining Commission indicative tiers
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.mineral_prices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mineral_name TEXT NOT NULL UNIQUE,
    symbol TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'Precious Metals' CHECK (
        category IN (
            'Precious Metals',
            'Base & Industrial Metals',
            'Critical & Battery Minerals',
            'Gemstones'
        )
    ),
    unit TEXT NOT NULL DEFAULT 'USD/toz',
    purity_note TEXT NOT NULL DEFAULT '99.9% Fine Benchmark',
    world_market_price_usd NUMERIC(15, 4) NOT NULL CHECK (world_market_price_usd >= 0),
    local_market_price_usd NUMERIC(15, 4) NOT NULL CHECK (local_market_price_usd >= 0),
    buying_centre_price_usd NUMERIC(15, 4) NOT NULL CHECK (buying_centre_price_usd >= 0),
    royalty_rate_pct NUMERIC(5, 2) NOT NULL DEFAULT 6.00,
    trend_percentage NUMERIC(6, 2) NOT NULL DEFAULT 0.00,
    sparkline_points JSONB NOT NULL DEFAULT '[]'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mineral_prices_category ON public.mineral_prices(category);
CREATE INDEX IF NOT EXISTS idx_mineral_prices_symbol ON public.mineral_prices(symbol);

-- Auto-update updated_at timestamp on row modification
DROP TRIGGER IF EXISTS trg_mineral_prices_updated_at ON public.mineral_prices;
CREATE TRIGGER trg_mineral_prices_updated_at
    BEFORE UPDATE ON public.mineral_prices
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- Enable & Force Row-Level Security (RLS)
ALTER TABLE public.mineral_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mineral_prices FORCE ROW LEVEL SECURITY;

-- Public & authenticated visitors can read indicative mineral prices
DROP POLICY IF EXISTS "Anyone can view indicative mineral prices" ON public.mineral_prices;
CREATE POLICY "Anyone can view indicative mineral prices"
    ON public.mineral_prices
    FOR SELECT
    TO anon, authenticated
    USING (TRUE);

-- Only verified administrators (`public.is_admin()`) can insert, update, or delete prices
DROP POLICY IF EXISTS "Admins can insert mineral prices" ON public.mineral_prices;
CREATE POLICY "Admins can insert mineral prices"
    ON public.mineral_prices
    FOR INSERT
    TO authenticated
    WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can update mineral prices" ON public.mineral_prices;
CREATE POLICY "Admins can update mineral prices"
    ON public.mineral_prices
    FOR UPDATE
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can delete mineral prices" ON public.mineral_prices;
CREATE POLICY "Admins can delete mineral prices"
    ON public.mineral_prices
    FOR DELETE
    TO authenticated
    USING (public.is_admin());

-- Seed Initial Commodity Benchmark Prices (Gold, Silver, Copper, Tin, Cobalt, Graphite, Tanzanite, Lithium)
INSERT INTO public.mineral_prices (
    mineral_name,
    symbol,
    category,
    unit,
    purity_note,
    world_market_price_usd,
    local_market_price_usd,
    buying_centre_price_usd,
    royalty_rate_pct,
    trend_percentage,
    sparkline_points
) VALUES
    (
        'Gold Bullion',
        'XAU',
        'Precious Metals',
        'USD/toz',
        'LBMA 99.99% Fine (31.1035g/toz)',
        2748.60,
        2556.20,
        2446.25,
        6.00,
        1.42,
        '[2690, 2704, 2698, 2715, 2729, 2736, 2748.6]'::jsonb
    ),
    (
        'Silver Bullion',
        'XAG',
        'Precious Metals',
        'USD/toz',
        'LBMA 99.9% Fine (31.1035g/toz)',
        33.85,
        31.48,
        30.13,
        6.00,
        2.18,
        '[32.4, 32.8, 32.6, 33.1, 33.4, 33.6, 33.85]'::jsonb
    ),
    (
        'Copper Cathode',
        'HG',
        'Base & Industrial Metals',
        'USD/lb',
        'LME Grade A Electrolytic (99.99%)',
        4.42,
        4.11,
        3.93,
        6.00,
        0.85,
        '[4.31, 4.34, 4.33, 4.37, 4.39, 4.40, 4.42]'::jsonb
    ),
    (
        'Tin Ingot',
        'SN',
        'Base & Industrial Metals',
        'USD/tonne',
        'LME 99.85% Refined Tin (Kyerwa Benchmark)',
        31450.00,
        29248.50,
        27990.50,
        6.00,
        -0.64,
        '[31900, 31750, 31820, 31600, 31580, 31500, 31450]'::jsonb
    ),
    (
        'Cobalt Metal',
        'CO',
        'Critical & Battery Minerals',
        'USD/tonne',
        '99.8% Min Battery-Grade Sulphate/Metal',
        24300.00,
        22842.00,
        21870.00,
        6.00,
        1.15,
        '[23800, 23950, 23900, 24050, 24120, 24210, 24300]'::jsonb
    ),
    (
        'Flake Graphite (97% TGC)',
        'GRF',
        'Critical & Battery Minerals',
        'USD/tonne',
        'Large Flake +80 Mesh FOB Dar es Salaam',
        1180.00,
        1109.20,
        1050.20,
        3.00,
        3.12,
        '[1110, 1125, 1130, 1148, 1160, 1172, 1180]'::jsonb
    ),
    (
        'Nickel Class 1',
        'NI',
        'Critical & Battery Minerals',
        'USD/tonne',
        'LME Primary Briquettes (Kabanga Benchmark)',
        16280.00,
        15140.40,
        14489.20,
        6.00,
        -0.38,
        '[16420, 16390, 16350, 16310, 16340, 16295, 16280]'::jsonb
    ),
    (
        'Tanzanite (AAA Zoisite)',
        'TZN',
        'Gemstones',
        'USD/carat',
        'Mererani Controlled Area Faceted Grade AAA',
        485.00,
        451.05,
        426.80,
        6.00,
        1.95,
        '[465, 468, 472, 475, 479, 482, 485]'::jsonb
    )
ON CONFLICT (mineral_name) DO NOTHING;
