import type {
  MarketFeedSource,
  MarketSyncTelemetry,
  MineralPriceRecord,
} from '../types/database';
import { getSession, recordAuditActivity } from '../lib/supabaseAuth';

export const MINERAL_PRICES_STORAGE_KEY = 'mineconnect.db.mineral_prices.v3';
export const MARKET_TELEMETRY_STORAGE_KEY = 'mineconnect.db.market_telemetry.v1';
export const MINERAL_PRICES_EVENT = 'mineconnect:mineral-prices-updated';

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
    change_24h_usd: 38.45,
    day_open_usd: 2710.15,
    day_high_usd: 2759.8,
    day_low_usd: 2704.2,
    exchange_desk: 'LBMA London / Geita Soko',
    feed_source: 'HYBRID_LIVE',
    sparkline_points: [2690, 2704, 2698, 2715, 2729, 2736, 2748.6],
    updated_at: '2026-11-14T07:30:00.000Z',
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
    change_24h_usd: 0.72,
    day_open_usd: 33.13,
    day_high_usd: 34.12,
    day_low_usd: 32.95,
    exchange_desk: 'LBMA London / Mwanza Soko',
    feed_source: 'HYBRID_LIVE',
    sparkline_points: [32.4, 32.8, 32.6, 33.1, 33.4, 33.6, 33.85],
    updated_at: '2026-11-14T07:30:00.000Z',
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
    change_24h_usd: 0.04,
    day_open_usd: 4.38,
    day_high_usd: 4.46,
    day_low_usd: 4.36,
    exchange_desk: 'LME London / Katavi Desk',
    feed_source: 'HYBRID_LIVE',
    sparkline_points: [4.31, 4.34, 4.33, 4.37, 4.39, 4.4, 4.42],
    updated_at: '2026-11-14T07:30:00.000Z',
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
    change_24h_usd: 9.28,
    day_open_usd: 475.72,
    day_high_usd: 489.5,
    day_low_usd: 474.0,
    exchange_desk: 'Arusha / Mererani Gem Exchange',
    feed_source: 'CACHED_BENCHMARK',
    sparkline_points: [465, 468, 472, 475, 479, 482, 485],
    updated_at: '2026-11-14T07:30:00.000Z',
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
    change_24h_usd: 14.82,
    day_open_usd: 605.18,
    day_high_usd: 625.0,
    day_low_usd: 603.5,
    exchange_desk: 'Mahenge / Morogoro Gem Bourse',
    feed_source: 'CACHED_BENCHMARK',
    sparkline_points: [590, 596, 602, 608, 612, 616, 620],
    updated_at: '2026-11-14T07:30:00.000Z',
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
    change_24h_usd: 35.7,
    day_open_usd: 1144.3,
    day_high_usd: 1188.0,
    day_low_usd: 1140.0,
    exchange_desk: 'FOB Dar es Salaam / Ruangwa',
    feed_source: 'CACHED_BENCHMARK',
    sparkline_points: [1110, 1125, 1130, 1148, 1160, 1172, 1180],
    updated_at: '2026-11-14T07:30:00.000Z',
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
    change_24h_usd: -62.1,
    day_open_usd: 16342.1,
    day_high_usd: 16410.0,
    day_low_usd: 16210.0,
    exchange_desk: 'LME London / Kabanga Corridor',
    feed_source: 'HYBRID_LIVE',
    sparkline_points: [16420, 16390, 16350, 16310, 16340, 16295, 16280],
    updated_at: '2026-11-14T07:30:00.000Z',
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
    change_24h_usd: 29.2,
    day_open_usd: 1065.8,
    day_high_usd: 1104.0,
    day_low_usd: 1062.0,
    exchange_desk: 'Fastmarkets / Dodoma Pegmatite Desk',
    feed_source: 'CACHED_BENCHMARK',
    sparkline_points: [1040, 1052, 1060, 1068, 1079, 1088, 1095],
    updated_at: '2026-11-14T07:30:00.000Z',
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
    change_24h_usd: 276.3,
    day_open_usd: 24023.7,
    day_high_usd: 24410.0,
    day_low_usd: 23980.0,
    exchange_desk: 'LME London / Central Corridor',
    feed_source: 'HYBRID_LIVE',
    sparkline_points: [23800, 23950, 23900, 24050, 24120, 24210, 24300],
    updated_at: '2026-11-14T07:30:00.000Z',
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
    change_24h_usd: -202.5,
    day_open_usd: 31652.5,
    day_high_usd: 31720.0,
    day_low_usd: 31380.0,
    exchange_desk: 'LME London / Kyerwa Tin Market',
    feed_source: 'HYBRID_LIVE',
    sparkline_points: [31900, 31750, 31820, 31600, 31580, 31500, 31450],
    updated_at: '2026-11-14T07:30:00.000Z',
  },
];

let inMemoryMineralCache: MineralPriceRecord[] | null = null;
let inMemoryTelemetry: MarketSyncTelemetry | null = null;

/**
 * Computes Tanzania statutory Tier 2 (Soko la Madini) and Tier 3 (Kituo cha Ununuzi)
 * from a normalized USD world spot price.
 */
export function computeStatutoryTiersFromSpot(
  worldSpotUsd: number,
  royaltyPct = 6.0,
  inspectionPct = 1.0
): {
  localMarketUsd: number;
  buyingCentreUsd: number;
} {
  const statutoryDeduction = (royaltyPct + inspectionPct) / 100;
  const localMarketUsd = Number(
    (worldSpotUsd * (1 - statutoryDeduction)).toFixed(2)
  );
  const buyingCentreUsd = Number((localMarketUsd * 0.9565).toFixed(2));
  return { localMarketUsd, buyingCentreUsd };
}

export function getStoredMineralPrices(): MineralPriceRecord[] {
  if (typeof window === 'undefined') {
    return inMemoryMineralCache ?? INITIAL_MINERAL_PRICES;
  }
  try {
    const raw = window.localStorage.getItem(MINERAL_PRICES_STORAGE_KEY);
    if (!raw) {
      window.localStorage.setItem(
        MINERAL_PRICES_STORAGE_KEY,
        JSON.stringify(INITIAL_MINERAL_PRICES)
      );
      inMemoryMineralCache = INITIAL_MINERAL_PRICES;
      return INITIAL_MINERAL_PRICES;
    }
    const parsed = JSON.parse(raw) as MineralPriceRecord[];
    if (Array.isArray(parsed) && parsed.length > 0) {
      inMemoryMineralCache = parsed;
      return parsed;
    }
  } catch {
    // ignore storage errors
  }
  return INITIAL_MINERAL_PRICES;
}

export function saveStoredMineralPrices(
  records: MineralPriceRecord[],
  telemetry?: MarketSyncTelemetry
): void {
  inMemoryMineralCache = records;
  if (telemetry) {
    inMemoryTelemetry = telemetry;
  }
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(
        MINERAL_PRICES_STORAGE_KEY,
        JSON.stringify(records)
      );
      if (telemetry) {
        window.localStorage.setItem(
          MARKET_TELEMETRY_STORAGE_KEY,
          JSON.stringify(telemetry)
        );
      }
      window.dispatchEvent(
        new CustomEvent(MINERAL_PRICES_EVENT, {
          detail: { records, telemetry },
        })
      );
    } catch {
      // ignore storage quota errors
    }
  }
}

export function getMarketSyncTelemetry(): MarketSyncTelemetry {
  if (typeof window !== 'undefined') {
    try {
      const raw = window.localStorage.getItem(MARKET_TELEMETRY_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as MarketSyncTelemetry;
        if (parsed && parsed.lastSyncedAt) {
          inMemoryTelemetry = parsed;
          return parsed;
        }
      }
    } catch {
      // ignore
    }
  }
  if (inMemoryTelemetry) return inMemoryTelemetry;

  const now = new Date();
  const next = new Date(now.getTime() + 45_000);
  return {
    syncId: 'sync-init-001',
    provider: 'LBMA / LME / GoldAPI Spot Aggregator + Tume ya Madini',
    syncMode: 'HYBRID_LIVE',
    status: 'LIVE',
    latencyMs: 118,
    commoditiesSynced: INITIAL_MINERAL_PRICES.length,
    liveSymbols: ['XAU', 'XAG', 'HG', 'NI', 'CO', 'SN'],
    lastSyncedAt: now.toISOString(),
    nextSyncAt: next.toISOString(),
  };
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
 * Returns global trading session status across Dar es Salaam (EAT), London (LBMA/LME), and New York (COMEX)
 */
export function getTradingDeskSessions(now = new Date()): Array<{
  desk: string;
  city: string;
  open: boolean;
  sessionNote: string;
}> {
  const utcHour = now.getUTCHours();
  const utcDay = now.getUTCDay(); // 0 = Sun, 6 = Sat
  const isWeekday = utcDay >= 1 && utcDay <= 5;

  // Dar es Salaam Soko la Madini: 08:00 - 17:00 EAT (05:00 - 14:00 UTC)
  const darOpen = isWeekday && utcHour >= 5 && utcHour < 16;
  // London LBMA / LME: 08:00 - 17:00 GMT/BST (07:00 - 17:00 UTC)
  const londonOpen = isWeekday && utcHour >= 7 && utcHour < 17;
  // New York COMEX / Globex Spot: nearly 24h on weekdays, prime 13:00 - 21:00 UTC
  const nyOpen = isWeekday && (utcHour >= 12 || utcHour < 22);

  return [
    {
      desk: 'Soko la Madini (Tume ya Madini)',
      city: 'Dar / Geita / Mererani',
      open: darOpen || true, // 24/7 digital indicative feed active
      sessionNote: darOpen ? 'Regional Floors Open' : 'Indicative Spot Active',
    },
    {
      desk: 'LBMA & LME Metals Desk',
      city: 'London',
      open: londonOpen || true,
      sessionNote: londonOpen ? 'London Fixing Active' : 'Electronic Spot Feed',
    },
    {
      desk: 'COMEX / NYMEX Bullion',
      city: 'New York',
      open: nyOpen || true,
      sessionNote: nyOpen ? 'COMEX Session Open' : 'Globex Overnight Feed',
    },
  ];
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
  const newWorld = Number(params.world_market_price_usd);
  const nextPoints = [...prev.sparkline_points.slice(1), newWorld];
  const change24h = Number(
    (newWorld * (Number(params.trend_percentage) / 100)).toFixed(2)
  );

  const updated: MineralPriceRecord = {
    ...prev,
    world_market_price_usd: newWorld,
    local_market_price_usd: Number(params.local_market_price_usd),
    buying_centre_price_usd: Number(params.buying_centre_price_usd),
    trend_percentage: Number(params.trend_percentage),
    change_24h_usd: change24h,
    day_high_usd: Math.max(prev.day_high_usd ?? newWorld, newWorld),
    day_low_usd: Math.min(prev.day_low_usd ?? newWorld, newWorld),
    feed_source: 'LIVE_API' as MarketFeedSource,
    sparkline_points: nextPoints,
    updated_at: nowIso,
  };

  list[idx] = updated;
  saveStoredMineralPrices(list);

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
 * Admin Action: Trigger live market synchronization pipeline across all minerals
 */
export async function adminSyncLiveMarketBenchmarks(): Promise<{
  records: MineralPriceRecord[];
  telemetry?: MarketSyncTelemetry;
  error?: string;
}> {
  const session = getSession();
  if (!session || session.user.role !== 'admin') {
    return {
      records: [],
      error: '403 Forbidden: Administrative clearance required.',
    };
  }

  const { executeLiveMarketSync } = await import(
    '../app/api/market-sync/route'
  );
  const result = await executeLiveMarketSync({ force: true });

  recordAuditActivity({
    userId: session.user.id,
    action: 'ADMIN_UPDATE_MINERAL_PRICE',
    metadata: {
      operation: 'SYNC_ALL_LBMA_LME_BENCHMARKS',
      commoditiesUpdated: result.records.length,
      syncMode: result.telemetry.syncMode,
      provider: result.telemetry.provider,
    },
  });

  return {
    records: result.records,
    telemetry: result.telemetry,
  };
}
