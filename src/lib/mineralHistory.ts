import {
  GRAMS_PER_POUND,
  GRAMS_PER_TROY_OUNCE,
  KILOGRAMS_PER_TONNE,
} from '../data/mineralPrices'
import type { LanguageCode } from '../i18n'
import type { MineralPriceRecord } from '../types/database'

export type ChartTimeframe = '1H' | '1D' | '7D' | '30D' | '90D' | '1Y'

export type ChartPricingMode = 'metric_local' | 'standard'

export const CHART_TIMEFRAMES: readonly ChartTimeframe[] = [
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
  drift: Record<Exclude<ChartTimeframe, '1H' | '1D'>, number>
  /** Relative noise/oscillation amplitude for realistic commodity price discovery */
  volatility: Record<ChartTimeframe, number>
  /** Multi-cycle wave signature */
  cyclePhase: number
}

const MINERAL_PROFILES: Record<string, HistoricalProfile> = {
  XAU: {
    drift: { '7D': 0.026, '30D': 0.058, '90D': 0.118, '1Y': 0.285 },
    volatility: { '1H': 0.0014, '1D': 0.0042, '7D': 0.01, '30D': 0.018, '90D': 0.028, '1Y': 0.042 },
    cyclePhase: 0.4,
  },
  XAG: {
    drift: { '7D': 0.038, '30D': 0.074, '90D': 0.152, '1Y': 0.34 },
    volatility: { '1H': 0.0022, '1D': 0.0075, '7D': 0.017, '30D': 0.032, '90D': 0.048, '1Y': 0.068 },
    cyclePhase: 1.1,
  },
  HG: {
    drift: { '7D': 0.019, '30D': 0.034, '90D': 0.078, '1Y': 0.145 },
    volatility: { '1H': 0.0018, '1D': 0.0055, '7D': 0.014, '30D': 0.026, '90D': 0.04, '1Y': 0.058 },
    cyclePhase: 2.0,
  },
  TZN: {
    drift: { '7D': 0.024, '30D': 0.046, '90D': 0.088, '1Y': 0.165 },
    volatility: { '1H': 0.001, '1D': 0.0032, '7D': 0.0075, '30D': 0.014, '90D': 0.022, '1Y': 0.032 },
    cyclePhase: 0.85,
  },
  RBY: {
    drift: { '7D': 0.03, '30D': 0.054, '90D': 0.105, '1Y': 0.21 },
    volatility: { '1H': 0.0011, '1D': 0.0036, '7D': 0.0082, '30D': 0.016, '90D': 0.024, '1Y': 0.036 },
    cyclePhase: 1.55,
  },
  GRF: {
    drift: { '7D': 0.04, '30D': 0.068, '90D': 0.112, '1Y': 0.19 },
    volatility: { '1H': 0.0015, '1D': 0.005, '7D': 0.012, '30D': 0.024, '90D': 0.036, '1Y': 0.052 },
    cyclePhase: 2.6,
  },
  NI: {
    drift: { '7D': -0.013, '30D': -0.028, '90D': -0.045, '1Y': -0.065 },
    volatility: { '1H': 0.002, '1D': 0.0062, '7D': 0.016, '30D': 0.032, '90D': 0.05, '1Y': 0.074 },
    cyclePhase: 3.3,
  },
  LI: {
    drift: { '7D': 0.035, '30D': 0.062, '90D': 0.082, '1Y': 0.115 },
    volatility: { '1H': 0.0021, '1D': 0.0068, '7D': 0.018, '30D': 0.035, '90D': 0.056, '1Y': 0.082 },
    cyclePhase: 4.1,
  },
  CO: {
    drift: { '7D': 0.017, '30D': 0.029, '90D': -0.012, '1Y': -0.042 },
    volatility: { '1H': 0.0016, '1D': 0.0052, '7D': 0.013, '30D': 0.025, '90D': 0.042, '1Y': 0.064 },
    cyclePhase: 4.9,
  },
  SN: {
    drift: { '7D': -0.015, '30D': -0.021, '90D': 0.048, '1Y': 0.125 },
    volatility: { '1H': 0.0019, '1D': 0.0058, '7D': 0.015, '30D': 0.028, '90D': 0.044, '1Y': 0.062 },
    cyclePhase: 5.5,
  },
}

const DEFAULT_PROFILE: HistoricalProfile = {
  drift: { '7D': 0.018, '30D': 0.035, '90D': 0.072, '1Y': 0.14 },
  volatility: { '1H': 0.0015, '1D': 0.005, '7D': 0.012, '30D': 0.022, '90D': 0.035, '1Y': 0.05 },
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

const HOUR_MS = 3_600_000
const DAY_MS = 86_400_000

const TIMEFRAME_CONFIG: Record<ChartTimeframe, TimeframeConfig> = {
  // 5-minute intervals across the past 60 minutes (13 points: T-60m .. now)
  '1H': { count: 13, spanMs: HOUR_MS },
  // Hourly intervals across the past 24 hours (25 points: T-24h .. now)
  '1D': { count: 25, spanMs: 24 * HOUR_MS },
  '7D': { count: 56, spanMs: 7 * DAY_MS },
  '30D': { count: 31, spanMs: 30 * DAY_MS },
  '90D': { count: 46, spanMs: 90 * DAY_MS },
  '1Y': { count: 53, spanMs: 365 * DAY_MS },
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

/**
 * Generates a deterministic, realistic historical + live trend series for a mineral
 * anchored to its World Spot Parity benchmark (`world_market_price_usd`), supporting
 * intraday (`1H` 5-min intervals, `1D` hourly intervals) and multi-day (`7D`..`1Y`)
 * horizons scaled cleanly to the active `/markets` unit mode.
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

  const parsedUpdated = Date.parse(mineral.updated_at)
  const endMs =
    anchorNowMs ??
    (Number.isFinite(parsedUpdated) && Math.abs(Date.now() - parsedUpdated) < 30 * DAY_MS
      ? Math.max(parsedUpdated, Date.now())
      : Date.now())
  const startMs = endMs - spanMs

  let startUnitUsd: number
  if (timeframe === '1H') {
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

  // Deterministic seed per mineral + timeframe
  const rng = createPrng(hashSeed(`${mineral.symbol}:${timeframe}:mineconnect-v2`))
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
      timeframe === '1H'
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

    // Blend subtle sparkline contour on 1D / 7D
    if ((timeframe === '1D' || timeframe === '7D') && sparkConverted) {
      const sparkVal = sampleNormalizedArray(sparkConverted, t)
      const sparkSpan = sparkConverted[sparkConverted.length - 1] - sparkConverted[0]
      const expectedLinearSpark = sparkConverted[0] + sparkSpan * t
      const sparkResidual = sparkVal - expectedLinearSpark
      value += sparkResidual * (timeframe === '1D' ? 0.45 : 0.3) * envelope
    }

    // Respect intraday low/high guardrails on 1D
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

const LOCALE_BY_LANG: Record<LanguageCode, string> = {
  en: 'en-US',
  sw: 'sw-TZ',
  es: 'es-ES',
}

export function formatChartAxisDate(
  timestampMs: number,
  timeframe: ChartTimeframe,
  language: LanguageCode,
): string {
  const locale = LOCALE_BY_LANG[language] ?? 'en-US'
  const date = new Date(timestampMs)

  try {
    if (timeframe === '1H' || timeframe === '1D') {
      return new Intl.DateTimeFormat(locale, {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(date)
    }
    if (timeframe === '7D' || timeframe === '30D' || timeframe === '90D') {
      return new Intl.DateTimeFormat(locale, {
        month: 'short',
        day: 'numeric',
      }).format(date)
    }
    return new Intl.DateTimeFormat(locale, {
      month: 'short',
      year: '2-digit',
    }).format(date)
  } catch {
    return date.toISOString().slice(0, 10)
  }
}

export function formatChartTooltipDate(
  timestampMs: number,
  timeframe: ChartTimeframe,
  language: LanguageCode,
): string {
  const locale = LOCALE_BY_LANG[language] ?? 'en-US'
  const date = new Date(timestampMs)

  try {
    if (timeframe === '1H' || timeframe === '1D' || timeframe === '7D') {
      return new Intl.DateTimeFormat(locale, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(date)
    }
    return new Intl.DateTimeFormat(locale, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(date)
  } catch {
    return date.toISOString().slice(0, 10)
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
