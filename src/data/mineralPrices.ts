import type { MineralPriceRecord } from '../types/database';
import { getSession, recordAuditActivity } from '../lib/supabaseAuth';

const MINERAL_PRICES_STORAGE_KEY = 'mineconnect.db.mineral_prices.v2';
const MINERAL_PRICES_EVENT = 'mineconnect:mineral-prices-updated';

/**
 * Troy Ounce to Gram conversion constant (1 troy oz = 31.1034768 grams)
 * Used by Tanzania Mining Commission indicative boards to display per-gram local & buying centre rates.
 */
export const GRAMS_PER_TROY_OUNCE = 31.1035;
export const GRAMS_PER_POUND = 453.592;
export const KILOGRAMS_PER_TONNE = 1000;

export const INITIAL_MINERAL_PRICES: MineralPriceRecord[] = [
  {
    id: 'min-xau-001',
    mineral_name: 'Gold Bullion (Dhahabu)',
    symbol: 'XAU',
    category: 'Precious Metals',
    unit: 'USD/toz',
    local_statutory_unit: 'g',
    purity_note: 'LBMA 99.99% Fine (31.1035g/toz)',
    producing_regions: 'Geita, Mwanza, Shinyanga, Mara, Chunya',
    world_market_price_usd: 2748.6,
    local_market_price_usd: 2556.2,
    buying_centre_price_usd: 2446.25,
    royalty_rate_pct: 6.0,
    inspection_fee_pct: 1.0,
    trend_percentage: 1.42,
    sparkline_points: [2690, 2704, 2698, 2715, 2729, 2736, 2748.6],
    updated_at: '2026-11-14T06:00:00.000Z',
  },
  {
    id: 'min-xag-002',
    mineral_name: 'Silver Bullion (Fedha)',
    symbol: 'XAG',
    category: 'Precious Metals',
    unit: 'USD/toz',
    local_statutory_unit: 'g',
    purity_note: 'LBMA 99.9% Fine (31.1035g/toz)',
    producing_regions: 'Geita, Kahama, Chunya, Singida',
    world_market_price_usd: 33.85,
    local_market_price_usd: 31.48,
    buying_centre_price_usd: 30.13,
    royalty_rate_pct: 6.0,
    inspection_fee_pct: 1.0,
    trend_percentage: 2.18,
    sparkline_points: [32.4, 32.8, 32.6, 33.1, 33.4, 33.6, 33.85],
    updated_at: '2026-11-14T06:00:00.000Z',
  },
  {
    id: 'min-hg-003',
    mineral_name: 'Copper Cathode (Shaba)',
    symbol: 'HG',
    category: 'Base & Industrial Metals',
    unit: 'USD/lb',
    local_statutory_unit: 'kg',
    purity_note: 'LME Grade A Electrolytic (99.99%)',
    producing_regions: 'Mpanda (Katavi), Mpwapwa, Kigoma',
    world_market_price_usd: 4.42,
    local_market_price_usd: 4.11,
    buying_centre_price_usd: 3.93,
    royalty_rate_pct: 6.0,
    inspection_fee_pct: 1.0,
    trend_percentage: 0.85,
    sparkline_points: [4.31, 4.34, 4.33, 4.37, 4.39, 4.4, 4.42],
    updated_at: '2026-11-14T06:00:00.000Z',
  },
  {
    id: 'min-tzn-008',
    mineral_name: 'Tanzanite (AAA Zoisite)',
    symbol: 'TZN',
    category: 'Gemstones',
    unit: 'USD/carat',
    local_statutory_unit: 'ct',
    purity_note: 'Mererani Controlled Area Block C Faceted AAA',
    producing_regions: 'Simanjiro (Manyara - Mererani)',
    world_market_price_usd: 485.0,
    local_market_price_usd: 451.05,
    buying_centre_price_usd: 426.8,
    royalty_rate_pct: 6.0,
    inspection_fee_pct: 1.0,
    trend_percentage: 1.95,
    sparkline_points: [465, 468, 472, 475, 479, 482, 485],
    updated_at: '2026-11-14T06:00:00.000Z',
  },
  {
    id: 'min-rby-009',
    mineral_name: 'Ruby & Red Spinel (Yakuti)',
    symbol: 'RBY',
    category: 'Gemstones',
    unit: 'USD/carat',
    local_statutory_unit: 'ct',
    purity_note: 'Unheated Facet-Grade Pigeon Blood / Mahenge Spinel',
    producing_regions: 'Ulanga (Morogoro - Mahenge), Winza, Tunduru',
    world_market_price_usd: 620.0,
    local_market_price_usd: 576.6,
    buying_centre_price_usd: 545.6,
    royalty_rate_pct: 6.0,
    inspection_fee_pct: 1.0,
    trend_percentage: 2.45,
    sparkline_points: [590, 596, 602, 608, 612, 616, 620],
    updated_at: '2026-11-14T06:00:00.000Z',
  },
  {
    id: 'min-grf-006',
    mineral_name: 'Flake Graphite (97% TGC)',
    symbol: 'GRF',
    category: 'Critical & Battery Minerals',
    unit: 'USD/tonne',
    local_statutory_unit: 'kg',
    purity_note: 'Large Flake +80 Mesh FOB Dar es Salaam',
    producing_regions: 'Ruangwa (Lindi), Mahenge (Morogoro)',
    world_market_price_usd: 1180.0,
    local_market_price_usd: 1132.8,
    buying_centre_price_usd: 1073.8,
    royalty_rate_pct: 3.0,
    inspection_fee_pct: 1.0,
    trend_percentage: 3.12,
    sparkline_points: [1110, 1125, 1130, 1148, 1160, 1172, 1180],
    updated_at: '2026-11-14T06:00:00.000Z',
  },
  {
    id: 'min-ni-007',
    mineral_name: 'Nickel Class 1 (Kabanga)',
    symbol: 'NI',
    category: 'Critical & Battery Minerals',
    unit: 'USD/tonne',
    local_statutory_unit: 'kg',
    purity_note: 'LME Primary Briquettes (Kabanga Benchmark)',
    producing_regions: 'Ngara (Kagera - Kabanga), Nachingwea',
    world_market_price_usd: 16280.0,
    local_market_price_usd: 15140.4,
    buying_centre_price_usd: 14489.2,
    royalty_rate_pct: 6.0,
    inspection_fee_pct: 1.0,
    trend_percentage: -0.38,
    sparkline_points: [16420, 16390, 16350, 16310, 16340, 16295, 16280],
    updated_at: '2026-11-14T06:00:00.000Z',
  },
  {
    id: 'min-li-010',
    mineral_name: 'Lithium Spodumene (SC6 6% Li2O)',
    symbol: 'LI',
    category: 'Critical & Battery Minerals',
    unit: 'USD/tonne',
    local_statutory_unit: 'kg',
    purity_note: 'Battery-Grade 6.0% Li2O Concentrate CIF Benchmark',
    producing_regions: 'Dodoma (Hombolo), Singida, Njombe',
    world_market_price_usd: 1095.0,
    local_market_price_usd: 1018.35,
    buying_centre_price_usd: 974.55,
    royalty_rate_pct: 6.0,
    inspection_fee_pct: 1.0,
    trend_percentage: 2.74,
    sparkline_points: [1040, 1052, 1060, 1068, 1079, 1088, 1095],
    updated_at: '2026-11-14T06:00:00.000Z',
  },
  {
    id: 'min-co-005',
    mineral_name: 'Cobalt Metal (Battery Grade)',
    symbol: 'CO',
    category: 'Critical & Battery Minerals',
    unit: 'USD/tonne',
    local_statutory_unit: 'kg',
    purity_note: '99.8% Min Battery-Grade Sulphate/Metal',
    producing_regions: 'Ngara (Kagera), Kigoma, Katavi',
    world_market_price_usd: 24300.0,
    local_market_price_usd: 22842.0,
    buying_centre_price_usd: 21870.0,
    royalty_rate_pct: 6.0,
    inspection_fee_pct: 1.0,
    trend_percentage: 1.15,
    sparkline_points: [23800, 23950, 23900, 24050, 24120, 24210, 24300],
    updated_at: '2026-11-14T06:00:00.000Z',
  },
  {
    id: 'min-sn-004',
    mineral_name: 'Tin Ingot (Cassiterite Refined)',
    symbol: 'SN',
    category: 'Base & Industrial Metals',
    unit: 'USD/tonne',
    local_statutory_unit: 'kg',
    purity_note: 'LME 99.85% Refined Tin (Kyerwa Benchmark)',
    producing_regions: 'Kyerwa & Karagwe (Kagera)',
    world_market_price_usd: 31450.0,
    local_market_price_usd: 29248.5,
    buying_centre_price_usd: 27990.5,
    royalty_rate_pct: 6.0,
    inspection_fee_pct: 1.0,
    trend_percentage: -0.64,
    sparkline_points: [31900, 31750, 31820, 31600, 31580, 31500, 31450],
    updated_at: '2026-11-14T06:00:00.000Z',
  },
];

export function getStoredMineralPrices(): MineralPriceRecord[] {
  if (typeof window === 'undefined') {
    return INITIAL_MINERAL_PRICES;
  }
  try {
    const raw = window.localStorage.getItem(MINERAL_PRICES_STORAGE_KEY);
    if (!raw) {
      window.localStorage.setItem(
        MINERAL_PRICES_STORAGE_KEY,
        JSON.stringify(INITIAL_MINERAL_PRICES)
      );
      return INITIAL_MINERAL_PRICES;
    }
    const parsed = JSON.parse(raw) as MineralPriceRecord[];
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
  } catch {
    // ignore storage errors
  }
  return INITIAL_MINERAL_PRICES;
}

export function subscribeMineralPrices(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(MINERAL_PRICES_EVENT, callback);
  window.addEventListener('storage', callback);
  return () => {
    window.removeEventListener(MINERAL_PRICES_EVENT, callback);
    window.removeEventListener('storage', callback);
  };
}

/**
 * Admin Action: Update benchmark prices for a specific mineral and record audit log.
 */
export async function adminUpdateMineralPrice(params: {
  id: string;
  world_market_price_usd: number;
  local_market_price_usd: number;
  buying_centre_price_usd: number;
  trend_percentage: number;
}): Promise<{ record?: MineralPriceRecord; error?: string }> {
  const session = getSession();
  if (!session || session.user.role !== 'admin') {
    return { error: '403 Forbidden: Administrative clearance required.' };
  }

  const list = getStoredMineralPrices();
  const idx = list.findIndex((m) => m.id === params.id);
  if (idx === -1) {
    return { error: 'Mineral benchmark record not found.' };
  }

  const nowIso = new Date().toISOString();
  const prev = list[idx];
  const nextPoints = [
    ...prev.sparkline_points.slice(1),
    Number(params.world_market_price_usd),
  ];

  const updated: MineralPriceRecord = {
    ...prev,
    world_market_price_usd: Number(params.world_market_price_usd),
    local_market_price_usd: Number(params.local_market_price_usd),
    buying_centre_price_usd: Number(params.buying_centre_price_usd),
    trend_percentage: Number(params.trend_percentage),
    sparkline_points: nextPoints,
    updated_at: nowIso,
  };

  list[idx] = updated;
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(
      MINERAL_PRICES_STORAGE_KEY,
      JSON.stringify(list)
    );
    window.dispatchEvent(new CustomEvent(MINERAL_PRICES_EVENT));
  }

  recordAuditActivity({
    userId: session.user.id,
    action: 'ADMIN_UPDATE_MINERAL_PRICE',
    metadata: {
      mineral: updated.mineral_name,
      symbol: updated.symbol,
      worldMarketUsd: updated.world_market_price_usd,
      localMarketUsd: updated.local_market_price_usd,
      buyingCentreUsd: updated.buying_centre_price_usd,
      trendPct: updated.trend_percentage,
    },
  });

  return { record: updated };
}

/**
 * Admin Action: Simulate / Sync live London Bullion & LME market tick across all minerals
 */
export async function adminSyncLiveMarketBenchmarks(): Promise<{
  records: MineralPriceRecord[];
  error?: string;
}> {
  const session = getSession();
  if (!session || session.user.role !== 'admin') {
    return {
      records: [],
      error: '403 Forbidden: Administrative clearance required.',
    };
  }

  const nowIso = new Date().toISOString();
  const current = getStoredMineralPrices();
  const synced = current.map((item) => {
    const deltaPct = (Math.random() * 1.6 - 0.5) / 100; // -0.5% to +1.1%
    const newWorld = Number(
      (item.world_market_price_usd * (1 + deltaPct)).toFixed(2)
    );
    const newLocal = Number((newWorld * 0.93).toFixed(2));
    const newBuying = Number((newWorld * 0.89).toFixed(2));
    const newTrend = Number(
      (item.trend_percentage + deltaPct * 100).toFixed(2)
    );
    return {
      ...item,
      world_market_price_usd: newWorld,
      local_market_price_usd: newLocal,
      buying_centre_price_usd: newBuying,
      trend_percentage: newTrend,
      sparkline_points: [...item.sparkline_points.slice(1), newWorld],
      updated_at: nowIso,
    };
  });

  if (typeof window !== 'undefined') {
    window.localStorage.setItem(
      MINERAL_PRICES_STORAGE_KEY,
      JSON.stringify(synced)
    );
    window.dispatchEvent(new CustomEvent(MINERAL_PRICES_EVENT));
  }

  recordAuditActivity({
    userId: session.user.id,
    action: 'ADMIN_UPDATE_MINERAL_PRICE',
    metadata: {
      operation: 'SYNC_ALL_LBMA_LME_BENCHMARKS',
      commoditiesUpdated: synced.length,
    },
  });

  return { records: synced };
}
