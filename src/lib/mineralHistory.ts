import {
  GRAMS_PER_POUND,
  GRAMS_PER_TROY_OUNCE,
  KILOGRAMS_PER_TONNE,
} from '../data/mineralPrices'
import type { LanguageCode } from '../i18n'
import type { MineralPriceRecord } from '../types/database'

export type ChartTimeframe = '1M' | '1H' | '1D' | '7D' | '30D' | '90D' | '1Y'

export type ChartPricingMode = 'metric_local' | 'standard'

export type TimelineScale = 'min' | 'hours' | 'days' | 'months' | 'years'

export const CHART_TIMEFRAMES: readonly ChartTimeframe[] = [
  '1M',
  '1H',
  '1D',
  '7D',
  '30D',
  '90D',
  '1Y',
] as const

export type LocalUnitSuffix = '/g' | '/kg' | '/ct'
export type GlobalUnitSuffix = '/toz' | '/lb' | '/t' | '/carat'
export type ChartUnitSuffix = LocalUnitSuffix | GlobalUnitSuffix

export interface UnitPriceConversion {
  unitUsd: number
  unitSuffix: ChartUnitSuffix
  unitSingular: string
}

export interface MineralTrendPoint {
  timestampMs: number
  unitUsd: number
}

export interface YearlyAssessmentSummary {
  year: number
  isYtd: boolean
  openUnitUsd: number
  highUnitUsd: number
  lowUnitUsd: number
  closeUnitUsd: number
  yoyChangeUsd: number
  yoyChangePct: number
}

export interface MineralTrendSeries {
  mode: ChartPricingMode
  timeframe: ChartTimeframe
  points: MineralTrendPoint[]
  unitSuffix: ChartUnitSuffix
  unitSingular: string
  startUnitUsd: number
  currentUnitUsd: number
  minUnitUsd: number
  maxUnitUsd: number
  changeUnitUsd: number
  changePct: number
  yearSummary?: YearlyAssessmentSummary
}

/**
 * Converts a World Spot Parity or statutory USD benchmark into the active
 * `/markets` master unit mode:
 * - `metric_local`: Tanzania local metric units (/g, /kg, /ct)
 * - `standard`: Global Spot international units (/toz, /lb, /t, /carat)
 */
export function convertToChartUnitUsd(
  usdAmount: number,
  rawUnit: string,
  mode: ChartPricingMode = 'metric_local',
): UnitPriceConversion {
  const safeUsd = Number.isFinite(usdAmount) && usdAmount > 0 ? usdAmount : 0
  const baseUnit = rawUnit.replace(/^USD\//i, '').trim().toLowerCase()

  if (mode === 'standard') {
    if (baseUnit === 'toz' || baseUnit === 'oz') {
      return { unitUsd: safeUsd, unitSuffix: '/toz', unitSingular: 'troy oz' }
    }
    if (baseUnit === 'lb' || baseUnit === 'lbs') {
      return { unitUsd: safeUsd, unitSuffix: '/lb', unitSingular: 'lb' }
    }
    if (baseUnit === 'carat' || baseUnit === 'ct') {
      return { unitUsd: safeUsd, unitSuffix: '/carat', unitSingular: 'carat' }
    }
    if (baseUnit === 'g' || baseUnit === 'gram') {
      return { unitUsd: safeUsd, unitSuffix: '/g', unitSingular: 'gram' }
    }
    if (baseUnit === 'kg') {
      return { unitUsd: safeUsd, unitSuffix: '/kg', unitSingular: 'kg' }
    }
    return { unitUsd: safeUsd, unitSuffix: '/t', unitSingular: 'tonne' }
  }

  if (baseUnit === 'toz' || baseUnit === 'oz') {
    return {
      unitUsd: safeUsd / GRAMS_PER_TROY_OUNCE,
      unitSuffix: '/g',
      unitSingular: 'gram',
    }
  }

  if (baseUnit === 'lb' || baseUnit === 'lbs') {
    return {
      unitUsd: (safeUsd / GRAMS_PER_POUND) * 1000,
      unitSuffix: '/kg',
      unitSingular: 'kg',
    }
  }

  if (baseUnit === 'carat' || baseUnit === 'ct') {
    return {
      unitUsd: safeUsd,
      unitSuffix: '/ct',
      unitSingular: 'carat',
    }
  }

  if (baseUnit === 'g' || baseUnit === 'gram') {
    return {
      unitUsd: safeUsd,
      unitSuffix: '/g',
      unitSingular: 'gram',
    }
  }

  if (baseUnit === 'kg') {
    return {
      unitUsd: safeUsd,
      unitSuffix: '/kg',
      unitSingular: 'kg',
    }
  }

  return {
    unitUsd: safeUsd / KILOGRAMS_PER_TONNE,
    unitSuffix: '/kg',
    unitSingular: 'kg',
  }
}

interface HistoricalProfile {
  /** Net fractional change over multi-day horizons */
  drift: Record<Exclude<ChartTimeframe, '1M' | '1H' | '1D'>, number>
  /** Annual returns for multi-year assessment (year offset 0 = YTD, 1 = prev year, 2 = -2y, 3 = -3y) */
  annualReturns: [number, number, number, number]
  /** Relative noise/oscillation amplitude for realistic commodity price discovery */
  volatility: Record<ChartTimeframe, number>
  /** Multi-cycle wave signature */
  cyclePhase: number
}

const MINERAL_PROFILES: Record<string, HistoricalProfile> = {
  XAU: {
    drift: { '7D': 0.026, '30D': 0.058, '90D': 0.118, '1Y': 0.285 },
    annualReturns: [0.245, 0.272, 0.131, 0.048],
    volatility: { '1M': 0.00042, '1H': 0.0014, '1D': 0.0042, '7D': 0.01, '30D': 0.018, '90D': 0.028, '1Y': 0.042 },
    cyclePhase: 0.4,
  },
  XAG: {
    drift: { '7D': 0.038, '30D': 0.074, '90D': 0.152, '1Y': 0.34 },
    annualReturns: [0.294, 0.215, 0.082, -0.034],
    volatility: { '1M': 0.00068, '1H': 0.0022, '1D': 0.0075, '7D': 0.017, '30D': 0.032, '90D': 0.048, '1Y': 0.068 },
    cyclePhase: 1.1,
  },
  HG: {
    drift: { '7D': 0.019, '30D': 0.034, '90D': 0.078, '1Y': 0.145 },
    annualReturns: [0.128, 0.104, 0.052, -0.068],
    volatility: { '1M': 0.00055, '1H': 0.0018, '1D': 0.0055, '7D': 0.014, '30D': 0.026, '90D': 0.04, '1Y': 0.058 },
    cyclePhase: 2.0,
  },
  TZN: {
    drift: { '7D': 0.024, '30D': 0.046, '90D': 0.088, '1Y': 0.165 },
    annualReturns: [0.148, 0.118, 0.095, 0.072],
    volatility: { '1M': 0.00032, '1H': 0.001, '1D': 0.0032, '7D': 0.0075, '30D': 0.014, '90D': 0.022, '1Y': 0.032 },
    cyclePhase: 0.85,
  },
  RBY: {
    drift: { '7D': 0.03, '30D': 0.054, '90D': 0.105, '1Y': 0.21 },
    annualReturns: [0.186, 0.142, 0.114, 0.088],
    volatility: { '1M': 0.00036, '1H': 0.0011, '1D': 0.0036, '7D': 0.0082, '30D': 0.016, '90D': 0.024, '1Y': 0.036 },
    cyclePhase: 1.55,
  },
  GRF: {
    drift: { '7D': 0.04, '30D': 0.068, '90D': 0.112, '1Y': 0.19 },
    annualReturns: [0.162, 0.084, -0.052, 0.118],
    volatility: { '1M': 0.00046, '1H': 0.0015, '1D': 0.005, '7D': 0.012, '30D': 0.024, '90D': 0.036, '1Y': 0.052 },
    cyclePhase: 2.6,
  },
  NI: {
    drift: { '7D': -0.013, '30D': -0.028, '90D': -0.045, '1Y': -0.065 },
    annualReturns: [-0.054, -0.082, -0.185, 0.224],
    volatility: { '1M': 0.0006, '1H': 0.002, '1D': 0.0062, '7D': 0.016, '30D': 0.032, '90D': 0.05, '1Y': 0.074 },
    cyclePhase: 3.3,
  },
  LI: {
    drift: { '7D': 0.035, '30D': 0.062, '90D': 0.082, '1Y': 0.115 },
    annualReturns: [0.098, -0.164, -0.285, 0.41],
    volatility: { '1M': 0.00065, '1H': 0.0021, '1D': 0.0068, '7D': 0.018, '30D': 0.035, '90D': 0.056, '1Y': 0.082 },
    cyclePhase: 4.1,
  },
  CO: {
    drift: { '7D': 0.017, '30D': 0.029, '90D': -0.012, '1Y': -0.042 },
    annualReturns: [-0.036, -0.112, -0.145, 0.092],
    volatility: { '1M': 0.00048, '1H': 0.0016, '1D': 0.0052, '7D': 0.013, '30D': 0.025, '90D': 0.042, '1Y': 0.064 },
    cyclePhase: 4.9,
  },
  SN: {
    drift: { '7D': -0.015, '30D': -0.021, '90D': 0.048, '1Y': 0.125 },
    annualReturns: [0.112, 0.168, 0.064, -0.125],
    volatility: { '1M': 0.00058, '1H': 0.0019, '1D': 0.0058, '7D': 0.015, '30D': 0.028, '90D': 0.044, '1Y': 0.062 },
    cyclePhase: 5.5,
  },
}

const DEFAULT_PROFILE: HistoricalProfile = {
  drift: { '7D': 0.018, '30D': 0.035, '90D': 0.072, '1Y': 0.14 },
  annualReturns: [0.12, 0.09, 0.06, 0.04],
  volatility: { '1M': 0.00045, '1H': 0.0015, '1D': 0.005, '7D': 0.012, '30D': 0.022, '90D': 0.035, '1Y': 0.05 },
  cyclePhase: 1.7,
}

function hashSeed(input: string): number {
  let h = 2166136261 >>> 0
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function createPrng(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

interface TimeframeConfig {
  count: number
  spanMs: number
}

const MINUTE_MS = 60_000
const HOUR_MS = 3_600_000
const DAY_MS = 86_400_000

// Rich point density across all windows so deep zooming stays smooth and triggers finer scales
const TIMEFRAME_CONFIG: Record<ChartTimeframe, TimeframeConfig> = {
  '1M': { count: 61, spanMs: MINUTE_MS }, // 1-second ticks over 60 seconds
  '1H': { count: 61, spanMs: HOUR_MS }, // 1-minute ticks over 60 minutes
  '1D': { count: 49, spanMs: 24 * HOUR_MS }, // 30-minute ticks over 24 hours
  '7D': { count: 57, spanMs: 7 * DAY_MS }, // 3-hour ticks over 7 days
  '30D': { count: 61, spanMs: 30 * DAY_MS }, // 12-hour ticks over 30 days
  '90D': { count: 91, spanMs: 90 * DAY_MS }, // Daily ticks over 90 days
  '1Y': { count: 105, spanMs: 365 * DAY_MS }, // ~3.5-day ticks over 1 year
}

function sampleNormalizedArray(values: number[], t: number): number {
  if (values.length === 0) return 0
  if (values.length === 1) return values[0]
  const scaled = Math.max(0, Math.min(1, t)) * (values.length - 1)
  const idx = Math.floor(scaled)
  const frac = scaled - idx
  const next = Math.min(values.length - 1, idx + 1)
  return values[idx] + (values[next] - values[idx]) * frac
}

function resolveAnchorEndMs(mineral: MineralPriceRecord, anchorNowMs?: number): number {
  if (anchorNowMs !== undefined) return anchorNowMs
  const parsedUpdated = Date.parse(mineral.updated_at)
  if (Number.isFinite(parsedUpdated) && Math.abs(Date.now() - parsedUpdated) < 30 * DAY_MS) {
    return Math.max(parsedUpdated, Date.now())
  }
  return Date.now()
}

export function getSelectableYears(anchorNowMs?: number): number[] {
  const currentYear = new Date(anchorNowMs ?? Date.now()).getUTCFullYear()
  return [currentYear, currentYear - 1, currentYear - 2, currentYear - 3]
}

/**
 * Automatically detects the most readable timeline granularity (`min`, `hours`,
 * `days`, `months`, `years`) from any visible time span (e.g. after zoom/pan).
 */
export function detectTimelineScale(visibleSpanMs: number): TimelineScale {
  const span = Math.max(0, visibleSpanMs)
  if (span <= 90 * MINUTE_MS) return 'min'
  if (span <= 48 * HOUR_MS) return 'hours'
  if (span <= 45 * DAY_MS) return 'days'
  if (span <= 420 * DAY_MS) return 'months'
  return 'years'
}

/**
 * Generates a deterministic, realistic historical + live trend series for a mineral
 * anchored to its World Spot Parity benchmark (`world_market_price_usd`).
 */
export function buildMineralTrendSeries(
  mineral: MineralPriceRecord,
  timeframe: ChartTimeframe,
  mode: ChartPricingMode = 'metric_local',
  anchorNowMs?: number,
): MineralTrendSeries {
  const { unitUsd: currentUnitUsd, unitSuffix, unitSingular } =
    convertToChartUnitUsd(mineral.world_market_price_usd, mineral.unit, mode)

  const profile = MINERAL_PROFILES[mineral.symbol.toUpperCase()] ?? DEFAULT_PROFILE
  const { count, spanMs } = TIMEFRAME_CONFIG[timeframe]

  const endMs = resolveAnchorEndMs(mineral, anchorNowMs)
  const startMs = endMs - spanMs

  let startUnitUsd: number
  if (timeframe === '1M') {
    const minuteDrift = ((mineral.trend_percentage || 0) / 100) * 0.025
    const denom = 1 + minuteDrift
    startUnitUsd = denom > 0.5 ? currentUnitUsd / denom : currentUnitUsd
  } else if (timeframe === '1H') {
    const hourlyDrift = ((mineral.trend_percentage || 0) / 100) * 0.16
    const denom = 1 + hourlyDrift
    startUnitUsd = denom > 0.5 ? currentUnitUsd / denom : currentUnitUsd
  } else if (timeframe === '1D') {
    if (mineral.day_open_usd && mineral.day_open_usd > 0) {
      startUnitUsd = convertToChartUnitUsd(
        mineral.day_open_usd,
        mineral.unit,
        mode,
      ).unitUsd
    } else {
      const denom = 1 + (mineral.trend_percentage || 0) / 100
      startUnitUsd = denom > 0.2 ? currentUnitUsd / denom : currentUnitUsd
    }
  } else {
    const horizonDrift = profile.drift[timeframe]
    const liveTilt =
      timeframe === '7D'
        ? ((mineral.trend_percentage || 0) / 100) * 0.45
        : timeframe === '30D'
          ? ((mineral.trend_percentage || 0) / 100) * 0.2
          : 0
    const effectiveDrift = Math.max(-0.55, Math.min(2.2, horizonDrift + liveTilt))
    startUnitUsd = currentUnitUsd / (1 + effectiveDrift)
  }

  const rng = createPrng(hashSeed(`${mineral.symbol}:${timeframe}:mineconnect-v3`))
  const vol = profile.volatility[timeframe]

  const walk: number[] = [0]
  for (let i = 1; i < count; i++) {
    const z = (rng() + rng() + rng() - 1.5) * 1.15
    walk.push(walk[i - 1] + z)
  }

  const walkEnd = walk[count - 1]
  const bridge = walk.map((v, i) => {
    const t = i / (count - 1)
    return v - t * walkEnd
  })
  const maxAbsBridge = Math.max(0.0001, ...bridge.map((v) => Math.abs(v)))

  const sparkConverted =
    mineral.sparkline_points && mineral.sparkline_points.length >= 2
      ? mineral.sparkline_points.map(
          (p) => convertToChartUnitUsd(p, mineral.unit, mode).unitUsd,
        )
      : null

  const dayLowUnit =
    mineral.day_low_usd && mineral.day_low_usd > 0
      ? convertToChartUnitUsd(mineral.day_low_usd, mineral.unit, mode).unitUsd
      : null
  const dayHighUnit =
    mineral.day_high_usd && mineral.day_high_usd > 0
      ? convertToChartUnitUsd(mineral.day_high_usd, mineral.unit, mode).unitUsd
      : null

  const points: MineralTrendPoint[] = []
  const meanLevel = (startUnitUsd + currentUnitUsd) / 2

  for (let i = 0; i < count; i++) {
    const t = i / (count - 1)
    const timestampMs = Math.round(startMs + t * spanMs)

    if (i === 0) {
      points.push({ timestampMs, unitUsd: startUnitUsd })
      continue
    }
    if (i === count - 1) {
      points.push({ timestampMs, unitUsd: currentUnitUsd })
      continue
    }

    const linear = startUnitUsd + (currentUnitUsd - startUnitUsd) * t
    const envelope = Math.sin(Math.PI * t)

    const macroWave =
      timeframe === '1M'
        ? Math.sin(t * Math.PI * 3.2 + profile.cyclePhase) * 0.18
        : timeframe === '1H'
          ? Math.sin(t * Math.PI * 2.2 + profile.cyclePhase) * 0.22
          : timeframe === '1D'
            ? Math.sin(t * Math.PI * 2.5 + profile.cyclePhase) * 0.25
            : timeframe === '7D'
              ? Math.sin(t * Math.PI * 3.0 + profile.cyclePhase) * 0.3
              : Math.sin(t * Math.PI * 2.4 + profile.cyclePhase) * 0.45 +
                Math.cos(t * Math.PI * 5.2 + profile.cyclePhase * 1.4) * 0.2

    const bridgeNorm = bridge[i] / maxAbsBridge
    let value =
      linear + meanLevel * vol * (bridgeNorm * 0.72 + macroWave * envelope * 0.55)

    if ((timeframe === '1D' || timeframe === '7D') && sparkConverted) {
      const sparkVal = sampleNormalizedArray(sparkConverted, t)
      const sparkSpan = sparkConverted[sparkConverted.length - 1] - sparkConverted[0]
      const expectedLinearSpark = sparkConverted[0] + sparkSpan * t
      const sparkResidual = sparkVal - expectedLinearSpark
      value += sparkResidual * (timeframe === '1D' ? 0.45 : 0.3) * envelope
    }

    if (timeframe === '1D' && dayLowUnit !== null && dayHighUnit !== null) {
      const lowGuard = Math.min(dayLowUnit, startUnitUsd, currentUnitUsd)
      const highGuard = Math.max(dayHighUnit, startUnitUsd, currentUnitUsd)
      value = Math.max(lowGuard, Math.min(highGuard, value))
    }

    const positiveFloor = Math.max(0.0001, Math.min(startUnitUsd, currentUnitUsd) * 0.35)
    points.push({
      timestampMs,
      unitUsd: Math.max(positiveFloor, value),
    })
  }

  let minUnitUsd = points[0].unitUsd
  let maxUnitUsd = points[0].unitUsd
  for (const pt of points) {
    if (pt.unitUsd < minUnitUsd) minUnitUsd = pt.unitUsd
    if (pt.unitUsd > maxUnitUsd) maxUnitUsd = pt.unitUsd
  }

  const changeUnitUsd = currentUnitUsd - startUnitUsd
  const changePct =
    startUnitUsd > 0 ? (changeUnitUsd / startUnitUsd) * 100 : 0

  return {
    mode,
    timeframe,
    points,
    unitSuffix,
    unitSingular,
    startUnitUsd,
    currentUnitUsd,
    minUnitUsd,
    maxUnitUsd,
    changeUnitUsd,
    changePct,
  }
}

/**
 * Generates a complete, continuous calendar-year series (e.g., 2026 YTD, 2025, 2024, 2023)
 * for per-year assessment and breakdown inspection, anchored smoothly to the live price.
 */
export function buildMineralYearSeries(
  mineral: MineralPriceRecord,
  year: number,
  mode: ChartPricingMode = 'metric_local',
  anchorNowMs?: number,
): MineralTrendSeries {
  const { unitUsd: liveUnitUsd, unitSuffix, unitSingular } =
    convertToChartUnitUsd(mineral.world_market_price_usd, mineral.unit, mode)

  const profile = MINERAL_PROFILES[mineral.symbol.toUpperCase()] ?? DEFAULT_PROFILE
  const nowMs = resolveAnchorEndMs(mineral, anchorNowMs)
  const currentYear = new Date(nowMs).getUTCFullYear()
  const yearOffset = Math.max(0, Math.min(3, currentYear - year))
  const isYtd = year >= currentYear

  // Walk backwards continuously from liveUnitUsd so each calendar year's close matches the next year's open
  let endUnitUsd = liveUnitUsd
  for (let o = 0; o < yearOffset; o++) {
    const r = profile.annualReturns[o] ?? 0.08
    endUnitUsd = endUnitUsd / (1 + r)
  }
  const annualReturn = profile.annualReturns[yearOffset] ?? 0.08
  const startUnitUsd = endUnitUsd / (1 + annualReturn)

  const startMs = Date.UTC(year, 0, 1, 0, 0, 0)
  const endMs = isYtd ? nowMs : Date.UTC(year, 11, 31, 20, 59, 0)
  const spanMs = Math.max(DAY_MS, endMs - startMs)
  const count = 97 // ~3.8-day resolution for smooth zooming inside any calendar year

  const rng = createPrng(hashSeed(`${mineral.symbol}:YEAR:${year}:mineconnect-v3`))
  const vol = profile.volatility['1Y'] * 1.05

  const walk: number[] = [0]
  for (let i = 1; i < count; i++) {
    const z = (rng() + rng() + rng() - 1.5) * 1.15
    walk.push(walk[i - 1] + z)
  }
  const walkEnd = walk[count - 1]
  const bridge = walk.map((v, i) => v - (i / (count - 1)) * walkEnd)
  const maxAbsBridge = Math.max(0.0001, ...bridge.map((v) => Math.abs(v)))

  const points: MineralTrendPoint[] = []
  const meanLevel = (startUnitUsd + endUnitUsd) / 2
  const phase = profile.cyclePhase + yearOffset * 1.35

  for (let i = 0; i < count; i++) {
    const t = i / (count - 1)
    const timestampMs = Math.round(startMs + t * spanMs)

    if (i === 0) {
      points.push({ timestampMs, unitUsd: startUnitUsd })
      continue
    }
    if (i === count - 1) {
      points.push({ timestampMs, unitUsd: endUnitUsd })
      continue
    }

    const linear = startUnitUsd + (endUnitUsd - startUnitUsd) * t
    const envelope = Math.sin(Math.PI * t)
    const macroWave =
      Math.sin(t * Math.PI * 2.3 + phase) * 0.45 +
      Math.cos(t * Math.PI * 4.8 + phase * 1.2) * 0.22
    const bridgeNorm = bridge[i] / maxAbsBridge

    const value =
      linear + meanLevel * vol * (bridgeNorm * 0.72 + macroWave * envelope * 0.55)
    const positiveFloor = Math.max(0.0001, Math.min(startUnitUsd, endUnitUsd) * 0.35)
    points.push({
      timestampMs,
      unitUsd: Math.max(positiveFloor, value),
    })
  }

  let minUnitUsd = points[0].unitUsd
  let maxUnitUsd = points[0].unitUsd
  for (const pt of points) {
    if (pt.unitUsd < minUnitUsd) minUnitUsd = pt.unitUsd
    if (pt.unitUsd > maxUnitUsd) maxUnitUsd = pt.unitUsd
  }

  const changeUnitUsd = endUnitUsd - startUnitUsd
  const changePct = startUnitUsd > 0 ? (changeUnitUsd / startUnitUsd) * 100 : 0

  return {
    mode,
    timeframe: '1Y',
    points,
    unitSuffix,
    unitSingular,
    startUnitUsd,
    currentUnitUsd: endUnitUsd,
    minUnitUsd,
    maxUnitUsd,
    changeUnitUsd,
    changePct,
    yearSummary: {
      year,
      isYtd,
      openUnitUsd: startUnitUsd,
      highUnitUsd: maxUnitUsd,
      lowUnitUsd: minUnitUsd,
      closeUnitUsd: endUnitUsd,
      yoyChangeUsd: changeUnitUsd,
      yoyChangePct: changePct,
    },
  }
}

const LOCALE_BY_LANG: Record<LanguageCode, string> = {
  en: 'en-GB',
  sw: 'sw-TZ',
  es: 'es-ES',
}

const EAT_TZ = 'Africa/Dar_es_Salaam'

function getEatDayKey(timestampMs: number): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: EAT_TZ,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(timestampMs))
  } catch {
    return new Date(timestampMs).toISOString().slice(0, 10)
  }
}

export function formatChartAxisDateByScale(
  timestampMs: number,
  scale: TimelineScale,
  visibleSpanMs: number,
  language: LanguageCode,
): string {
  const locale = LOCALE_BY_LANG[language] ?? 'en-GB'
  const date = new Date(timestampMs)

  try {
    if (scale === 'min') {
      if (visibleSpanMs <= 3 * MINUTE_MS) {
        return new Intl.DateTimeFormat(locale, {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
          timeZone: EAT_TZ,
        }).format(date)
      }
      return new Intl.DateTimeFormat(locale, {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: EAT_TZ,
      }).format(date)
    }

    if (scale === 'hours') {
      return new Intl.DateTimeFormat(locale, {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: EAT_TZ,
      }).format(date)
    }

    if (scale === 'days') {
      return new Intl.DateTimeFormat(locale, {
        day: 'numeric',
        month: 'short',
        timeZone: EAT_TZ,
      }).format(date)
    }

    if (scale === 'months') {
      return new Intl.DateTimeFormat(locale, {
        month: 'short',
        year: '2-digit',
        timeZone: EAT_TZ,
      }).format(date)
    }

    return new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      timeZone: EAT_TZ,
    }).format(date)
  } catch {
    return date.toISOString().slice(0, 10)
  }
}

export function formatChartTooltipDateByScale(
  timestampMs: number,
  scale: TimelineScale,
  visibleSpanMs: number,
  language: LanguageCode,
): string {
  const locale = LOCALE_BY_LANG[language] ?? 'en-GB'
  const date = new Date(timestampMs)

  try {
    const datePart = new Intl.DateTimeFormat(locale, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: EAT_TZ,
    }).format(date)

    if (scale === 'min' && visibleSpanMs <= 3 * MINUTE_MS) {
      const timePart = new Intl.DateTimeFormat(locale, {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
        timeZone: EAT_TZ,
      }).format(date)
      return `${datePart} · ${timePart} EAT`
    }

    if (scale === 'min' || scale === 'hours') {
      const timePart = new Intl.DateTimeFormat(locale, {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: EAT_TZ,
      }).format(date)
      return `${datePart} · ${timePart} EAT`
    }

    return datePart
  } catch {
    return date.toISOString().slice(0, 10)
  }
}

/**
 * Formats an explicit human-readable calendar date (and EAT time window for intraday views)
 * e.g. `24 Nov 2026 · 07:20–08:20 EAT` or `25 Oct 2026 – 24 Nov 2026`.
 */
export function formatVisibleDateWindow(
  startMs: number,
  endMs: number,
  scale: TimelineScale,
  language: LanguageCode,
): string {
  const locale = LOCALE_BY_LANG[language] ?? 'en-GB'
  const startDate = new Date(startMs)
  const endDate = new Date(endMs)
  const spanMs = Math.max(0, endMs - startMs)

  try {
    const fmtDate = (d: Date) =>
      new Intl.DateTimeFormat(locale, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        timeZone: EAT_TZ,
      }).format(d)

    const fmtShortDay = (d: Date) =>
      new Intl.DateTimeFormat(locale, {
        day: 'numeric',
        month: 'short',
        timeZone: EAT_TZ,
      }).format(d)

    const fmtTime = (d: Date, withSeconds: boolean) =>
      new Intl.DateTimeFormat(locale, {
        hour: '2-digit',
        minute: '2-digit',
        ...(withSeconds ? { second: '2-digit' } : {}),
        hour12: false,
        timeZone: EAT_TZ,
      }).format(d)

    if (scale === 'min' || scale === 'hours') {
      const withSeconds = spanMs <= 3 * MINUTE_MS
      const sameDay = getEatDayKey(startMs) === getEatDayKey(endMs)
      if (sameDay) {
        return `${fmtDate(endDate)} · ${fmtTime(startDate, withSeconds)}–${fmtTime(endDate, withSeconds)} EAT`
      }
      return `${fmtShortDay(startDate)} ${fmtTime(startDate, false)} – ${fmtDate(endDate)} · ${fmtTime(endDate, false)} EAT`
    }

    return `${fmtDate(startDate)} – ${fmtDate(endDate)}`
  } catch {
    return `${startDate.toISOString().slice(0, 10)} – ${endDate.toISOString().slice(0, 10)}`
  }
}

/**
 * Computes institutional, nicely rounded Y-axis ticks directly in the active display currency.
 */
export function computeNiceAxisTicks(
  minVal: number,
  maxVal: number,
  targetTicks = 5,
): { min: number; max: number; step: number; ticks: number[] } {
  if (!Number.isFinite(minVal) || !Number.isFinite(maxVal)) {
    return { min: 0, max: 1, step: 0.25, ticks: [0, 0.25, 0.5, 0.75, 1] }
  }

  let lo = minVal
  let hi = maxVal
  if (hi <= lo) {
    const pad = Math.abs(lo) * 0.05 || 1
    lo = Math.max(0, lo - pad)
    hi = hi + pad
  } else {
    const span = hi - lo
    lo = Math.max(0, lo - span * 0.08)
    hi = hi + span * 0.08
  }

  const rawStep = (hi - lo) / Math.max(2, targetTicks - 1)
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)))
  const residual = rawStep / magnitude

  let niceFraction: number
  if (residual <= 1.2) niceFraction = 1
  else if (residual <= 2.2) niceFraction = 2
  else if (residual <= 3.5) niceFraction = 2.5
  else if (residual <= 6.5) niceFraction = 5
  else niceFraction = 10

  const step = niceFraction * magnitude
  const niceMin = Math.max(0, Math.floor(lo / step) * step)
  const niceMax = Math.ceil(hi / step) * step

  const ticks: number[] = []
  const maxSteps = 10
  for (let i = 0; i <= maxSteps; i++) {
    const val = niceMin + i * step
    if (val > niceMax + step * 0.001) break
    ticks.push(Number(val.toPrecision(10)))
  }

  return {
    min: niceMin,
    max: ticks.length > 0 ? ticks[ticks.length - 1] : niceMax,
    step,
    ticks,
  }
}
