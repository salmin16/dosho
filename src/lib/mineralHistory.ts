import {
  GRAMS_PER_POUND,
  GRAMS_PER_TROY_OUNCE,
  KILOGRAMS_PER_TONNE,
} from '../data/mineralPrices'
import type { LanguageCode } from '../i18n'
import type { MineralPriceRecord } from '../types/database'

export type ChartTimeframe = '1D' | '5D' | '1M' | '1Y' | '5Y' | 'Max'

export type ChartPricingMode = 'metric_local' | 'standard'

export const CHART_TIMEFRAMES: readonly ChartTimeframe[] = [
  '1D',
  '5D',
  '1M',
  '1Y',
  '5Y',
  'Max',
] as const

export type LocalUnitSuffix = '/g' | '/kg' | '/ct'
export type ChartUnitSuffix = LocalUnitSuffix

export interface UnitPriceConversion {
  unitUsd: number
  unitSuffix: LocalUnitSuffix
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
  unitSuffix: LocalUnitSuffix
  unitSingular: string
  startUnitUsd: number
  currentUnitUsd: number
  minUnitUsd: number
  maxUnitUsd: number
  changeUnitUsd: number
  changePct: number
}

/**
 * Strictly converts any USD benchmark value into Tanzania local metric units
 * (/g, /kg, or /ct) across both Statutory Local and Global Spot chart modes.
 * Never returns troy ounces (/toz), pounds (/lb), or tonnes (/t).
 */
export function convertToChartUnitUsd(
  usdAmount: number,
  rawUnit: string,
): UnitPriceConversion {
  const safeUsd = Number.isFinite(usdAmount) && usdAmount > 0 ? usdAmount : 0
  const baseUnit = rawUnit.replace(/^USD\//i, '').trim().toLowerCase()

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
  /** Net fractional change over each horizon (e.g. 0.28 means +28% over the window) */
  drift: Record<Exclude<ChartTimeframe, '1D'>, number>
  /** Relative noise/oscillation amplitude for realistic commodity price discovery */
  volatility: Record<ChartTimeframe, number>
  /** Multi-cycle wave signature for longer horizons */
  cyclePhase: number
}

const MINERAL_PROFILES: Record<string, HistoricalProfile> = {
  XAU: {
    drift: { '5D': 0.024, '1M': 0.058, '1Y': 0.285, '5Y': 0.56, Max: 0.94 },
    volatility: { '1D': 0.0042, '5D': 0.0095, '1M': 0.018, '1Y': 0.042, '5Y': 0.075, Max: 0.095 },
    cyclePhase: 0.4,
  },
  XAG: {
    drift: { '5D': 0.036, '1M': 0.074, '1Y': 0.34, '5Y': 0.48, Max: 0.88 },
    volatility: { '1D': 0.0075, '5D': 0.016, '1M': 0.032, '1Y': 0.068, '5Y': 0.11, Max: 0.13 },
    cyclePhase: 1.1,
  },
  HG: {
    drift: { '5D': 0.018, '1M': 0.034, '1Y': 0.145, '5Y': 0.38, Max: 0.62 },
    volatility: { '1D': 0.0055, '5D': 0.013, '1M': 0.026, '1Y': 0.058, '5Y': 0.095, Max: 0.115 },
    cyclePhase: 2.0,
  },
  TZN: {
    drift: { '5D': 0.022, '1M': 0.046, '1Y': 0.165, '5Y': 0.44, Max: 0.78 },
    volatility: { '1D': 0.0032, '5D': 0.007, '1M': 0.014, '1Y': 0.032, '5Y': 0.052, Max: 0.068 },
    cyclePhase: 0.85,
  },
  RBY: {
    drift: { '5D': 0.028, '1M': 0.054, '1Y': 0.21, '5Y': 0.52, Max: 0.86 },
    volatility: { '1D': 0.0036, '5D': 0.0078, '1M': 0.016, '1Y': 0.036, '5Y': 0.058, Max: 0.072 },
    cyclePhase: 1.55,
  },
  GRF: {
    drift: { '5D': 0.038, '1M': 0.068, '1Y': 0.19, '5Y': 0.36, Max: 0.54 },
    volatility: { '1D': 0.005, '5D': 0.011, '1M': 0.024, '1Y': 0.052, '5Y': 0.088, Max: 0.105 },
    cyclePhase: 2.6,
  },
  NI: {
    drift: { '5D': -0.011, '1M': -0.028, '1Y': -0.065, '5Y': 0.14, Max: 0.32 },
    volatility: { '1D': 0.0062, '5D': 0.015, '1M': 0.032, '1Y': 0.074, '5Y': 0.125, Max: 0.14 },
    cyclePhase: 3.3,
  },
  LI: {
    drift: { '5D': 0.032, '1M': 0.062, '1Y': 0.115, '5Y': 0.28, Max: 0.64 },
    volatility: { '1D': 0.0068, '5D': 0.017, '1M': 0.035, '1Y': 0.082, '5Y': 0.145, Max: 0.16 },
    cyclePhase: 4.1,
  },
  CO: {
    drift: { '5D': 0.016, '1M': 0.029, '1Y': -0.042, '5Y': -0.085, Max: 0.18 },
    volatility: { '1D': 0.0052, '5D': 0.012, '1M': 0.025, '1Y': 0.064, '5Y': 0.11, Max: 0.13 },
    cyclePhase: 4.9,
  },
  SN: {
    drift: { '5D': -0.014, '1M': -0.021, '1Y': 0.125, '5Y': 0.42, Max: 0.68 },
    volatility: { '1D': 0.0058, '5D': 0.014, '1M': 0.028, '1Y': 0.062, '5Y': 0.105, Max: 0.12 },
    cyclePhase: 5.5,
  },
}

const DEFAULT_PROFILE: HistoricalProfile = {
  drift: { '5D': 0.015, '1M': 0.035, '1Y': 0.14, '5Y': 0.34, Max: 0.58 },
  volatility: { '1D': 0.005, '5D': 0.012, '1M': 0.022, '1Y': 0.05, '5Y': 0.085, Max: 0.105 },
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
  '1D': { count: 48, spanMs: 24 * HOUR_MS },
  '5D': { count: 60, spanMs: 5 * DAY_MS },
  '1M': { count: 31, spanMs: 30 * DAY_MS },
  '1Y': { count: 53, spanMs: 365 * DAY_MS },
  '5Y': { count: 61, spanMs: 5 * 365 * DAY_MS },
  Max: { count: 85, spanMs: 7 * 365 * DAY_MS },
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
 * anchored to its World Spot Parity benchmark (`world_market_price_usd`), ALWAYS
 * expressed in local metric units (/g, /kg, or /ct) at every point including the
 * live terminal marker.
 */
export function buildMineralTrendSeries(
  mineral: MineralPriceRecord,
  timeframe: ChartTimeframe,
  mode: ChartPricingMode = 'metric_local',
  anchorNowMs?: number,
): MineralTrendSeries {
  const { unitUsd: currentUnitUsd, unitSuffix, unitSingular } =
    convertToChartUnitUsd(mineral.world_market_price_usd, mineral.unit)

  const profile = MINERAL_PROFILES[mineral.symbol.toUpperCase()] ?? DEFAULT_PROFILE
  const { count, spanMs } = TIMEFRAME_CONFIG[timeframe]

  const parsedUpdated = Date.parse(mineral.updated_at)
  const endMs =
    anchorNowMs ??
    (Number.isFinite(parsedUpdated) && Math.abs(Date.now() - parsedUpdated) < 30 * DAY_MS
      ? Math.max(parsedUpdated, Date.now())
      : Date.now())
  const startMs = endMs - spanMs

  // Determine the anchored opening value for this timeframe
  let startUnitUsd: number
  if (timeframe === '1D') {
    if (mineral.day_open_usd && mineral.day_open_usd > 0) {
      startUnitUsd = convertToChartUnitUsd(
        mineral.day_open_usd,
        mineral.unit,
      ).unitUsd
    } else {
      const denom = 1 + (mineral.trend_percentage || 0) / 100
      startUnitUsd = denom > 0.2 ? currentUnitUsd / denom : currentUnitUsd
    }
  } else {
    const horizonDrift = profile.drift[timeframe]
    const liveTilt =
      timeframe === '5D'
        ? ((mineral.trend_percentage || 0) / 100) * 0.45
        : timeframe === '1M'
          ? ((mineral.trend_percentage || 0) / 100) * 0.2
          : 0
    const effectiveDrift = Math.max(-0.55, Math.min(2.2, horizonDrift + liveTilt))
    startUnitUsd = currentUnitUsd / (1 + effectiveDrift)
  }

  // Deterministic seed per mineral + timeframe
  const rng = createPrng(hashSeed(`${mineral.symbol}:${timeframe}:mineconnect-v1`))
  const vol = profile.volatility[timeframe]

  // Generate raw Brownian increments
  const walk: number[] = [0]
  for (let i = 1; i < count; i++) {
    const z = (rng() + rng() + rng() - 1.5) * 1.15
    walk.push(walk[i - 1] + z)
  }

  // Convert raw walk into a Brownian bridge pinned to 0 at both endpoints (t=0 and t=1)
  const walkEnd = walk[count - 1]
  const bridge = walk.map((v, i) => {
    const t = i / (count - 1)
    return v - t * walkEnd
  })
  const maxAbsBridge = Math.max(0.0001, ...bridge.map((v) => Math.abs(v)))

  // Optional shape influence from stored sparkline_points on 1D
  const sparkConverted =
    mineral.sparkline_points && mineral.sparkline_points.length >= 2
      ? mineral.sparkline_points.map(
          (p) => convertToChartUnitUsd(p, mineral.unit).unitUsd,
        )
      : null

  const dayLowUnit =
    mineral.day_low_usd && mineral.day_low_usd > 0
      ? convertToChartUnitUsd(mineral.day_low_usd, mineral.unit).unitUsd
      : null
  const dayHighUnit =
    mineral.day_high_usd && mineral.day_high_usd > 0
      ? convertToChartUnitUsd(mineral.day_high_usd, mineral.unit).unitUsd
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
      timeframe === '1D'
        ? Math.sin(t * Math.PI * 2.5 + profile.cyclePhase) * 0.25
        : timeframe === '5D'
          ? Math.sin(t * Math.PI * 3.0 + profile.cyclePhase) * 0.3
          : Math.sin(t * Math.PI * 2.4 + profile.cyclePhase) * 0.45 +
            Math.cos(t * Math.PI * 5.2 + profile.cyclePhase * 1.4) * 0.2

    const bridgeNorm = bridge[i] / maxAbsBridge
    let value =
      linear + meanLevel * vol * (bridgeNorm * 0.72 + macroWave * envelope * 0.55)

    if (timeframe === '1D' && sparkConverted) {
      const sparkVal = sampleNormalizedArray(sparkConverted, t)
      const sparkSpan = sparkConverted[sparkConverted.length - 1] - sparkConverted[0]
      const expectedLinearSpark = sparkConverted[0] + sparkSpan * t
      const sparkResidual = sparkVal - expectedLinearSpark
      value += sparkResidual * 0.45 * envelope
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
    if (timeframe === '1D') {
      return new Intl.DateTimeFormat(locale, {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(date)
    }
    if (timeframe === '5D' || timeframe === '1M') {
      return new Intl.DateTimeFormat(locale, {
        month: 'short',
        day: 'numeric',
      }).format(date)
    }
    if (timeframe === '1Y') {
      return new Intl.DateTimeFormat(locale, {
        month: 'short',
        year: '2-digit',
      }).format(date)
    }
    return new Intl.DateTimeFormat(locale, {
      year: 'numeric',
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
    if (timeframe === '1D' || timeframe === '5D') {
      return new Intl.DateTimeFormat(locale, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(date)
    }
    if (timeframe === '1M' || timeframe === '1Y') {
      return new Intl.DateTimeFormat(locale, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }).format(date)
    }
    return new Intl.DateTimeFormat(locale, {
      month: 'short',
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
): { min: number; max: number; ticks: number[] } {
  if (!Number.isFinite(minVal) || !Number.isFinite(maxVal)) {
    return { min: 0, max: 1, ticks: [0, 0.25, 0.5, 0.75, 1] }
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
    ticks,
  }
}
