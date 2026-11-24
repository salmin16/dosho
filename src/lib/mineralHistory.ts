import {
  GRAMS_PER_POUND,
  GRAMS_PER_TROY_OUNCE,
  KILOGRAMS_PER_TONNE,
} from '../data/mineralPrices'
import type { LanguageCode } from '../i18n'
import type { MineralPriceRecord } from '../types/database'

export type ChartTimeframe = '1M' | '1H' | '1D' | '1Mo' | '1Y'

export type ChartPricingMode = 'metric_local' | 'standard'

export type TimelineScale = 'min' | 'hours' | 'days' | 'months' | 'years'

export const CHART_TIMEFRAMES: readonly ChartTimeframe[] = [
  '1M',
  '1H',
  '1D',
  '1Mo',
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
  selectedYear: number
  points: MineralTrendPoint[]
  unitSuffix: ChartUnitSuffix
  unitSingular: string
  startUnitUsd: number
  currentUnitUsd: number
  minUnitUsd: number
  maxUnitUsd: number
  changeUnitUsd: number
  changePct: number
  yearSummary: YearlyAssessmentSummary
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
  /** Annual returns for multi-year assessment (offset 0 = current YTD, 1 = -1y, 2 = -2y, 3 = -3y) */
  annualReturns: [number, number, number, number]
  /** Monthly drift signature */
  monthlyDrift: number
  /** Relative noise/oscillation amplitude per granularity */
  volatility: Record<ChartTimeframe, number>
  /** Multi-cycle wave signature */
  cyclePhase: number
}

const MINERAL_PROFILES: Record<string, HistoricalProfile> = {
  XAU: {
    annualReturns: [0.245, 0.272, 0.131, 0.048],
    monthlyDrift: 0.058,
    volatility: { '1M': 0.00042, '1H': 0.0014, '1D': 0.0042, '1Mo': 0.018, '1Y': 0.044 },
    cyclePhase: 0.4,
  },
  XAG: {
    annualReturns: [0.294, 0.215, 0.082, -0.034],
    monthlyDrift: 0.074,
    volatility: { '1M': 0.00068, '1H': 0.0022, '1D': 0.0075, '1Mo': 0.032, '1Y': 0.07 },
    cyclePhase: 1.1,
  },
  HG: {
    annualReturns: [0.128, 0.104, 0.052, -0.068],
    monthlyDrift: 0.034,
    volatility: { '1M': 0.00055, '1H': 0.0018, '1D': 0.0055, '1Mo': 0.026, '1Y': 0.06 },
    cyclePhase: 2.0,
  },
  TZN: {
    annualReturns: [0.148, 0.118, 0.095, 0.072],
    monthlyDrift: 0.046,
    volatility: { '1M': 0.00032, '1H': 0.001, '1D': 0.0032, '1Mo': 0.014, '1Y': 0.034 },
    cyclePhase: 0.85,
  },
  RBY: {
    annualReturns: [0.186, 0.142, 0.114, 0.088],
    monthlyDrift: 0.054,
    volatility: { '1M': 0.00036, '1H': 0.0011, '1D': 0.0036, '1Mo': 0.016, '1Y': 0.038 },
    cyclePhase: 1.55,
  },
  GRF: {
    annualReturns: [0.162, 0.084, -0.052, 0.118],
    monthlyDrift: 0.068,
    volatility: { '1M': 0.00046, '1H': 0.0015, '1D': 0.005, '1Mo': 0.024, '1Y': 0.054 },
    cyclePhase: 2.6,
  },
  NI: {
    annualReturns: [-0.054, -0.082, -0.185, 0.224],
    monthlyDrift: -0.028,
    volatility: { '1M': 0.0006, '1H': 0.002, '1D': 0.0062, '1Mo': 0.032, '1Y': 0.076 },
    cyclePhase: 3.3,
  },
  LI: {
    annualReturns: [0.098, -0.164, -0.285, 0.41],
    monthlyDrift: 0.062,
    volatility: { '1M': 0.00065, '1H': 0.0021, '1D': 0.0068, '1Mo': 0.035, '1Y': 0.084 },
    cyclePhase: 4.1,
  },
  CO: {
    annualReturns: [-0.036, -0.112, -0.145, 0.092],
    monthlyDrift: 0.029,
    volatility: { '1M': 0.00048, '1H': 0.0016, '1D': 0.0052, '1Mo': 0.025, '1Y': 0.066 },
    cyclePhase: 4.9,
  },
  SN: {
    annualReturns: [0.112, 0.168, 0.064, -0.125],
    monthlyDrift: -0.021,
    volatility: { '1M': 0.00058, '1H': 0.0019, '1D': 0.0058, '1Mo': 0.028, '1Y': 0.064 },
    cyclePhase: 5.5,
  },
}

const DEFAULT_PROFILE: HistoricalProfile = {
  annualReturns: [0.12, 0.09, 0.06, 0.04],
  monthlyDrift: 0.035,
  volatility: { '1M': 0.00045, '1H': 0.0015, '1D': 0.005, '1Mo': 0.022, '1Y': 0.052 },
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

const MINUTE_MS = 60_000
const HOUR_MS = 3_600_000
const DAY_MS = 86_400_000

const SUB_YEAR_CONFIG: Record<
  Exclude<ChartTimeframe, '1Y'>,
  { count: number; spanMs: number }
> = {
  '1M': { count: 61, spanMs: MINUTE_MS }, // 1-second ticks over 60 seconds
  '1H': { count: 61, spanMs: HOUR_MS }, // 1-minute ticks over 60 minutes
  '1D': { count: 49, spanMs: 24 * HOUR_MS }, // 30-minute ticks over 24 hours
  '1Mo': { count: 61, spanMs: 30 * DAY_MS }, // 12-hour ticks over 30 days
}

function resolveAnchorNowMs(mineral: MineralPriceRecord, anchorNowMs?: number): number {
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

function sampleSeriesAtTimestamp(points: MineralTrendPoint[], targetMs: number): number {
  if (points.length === 0) return 0
  if (targetMs <= points[0].timestampMs) return points[0].unitUsd
  const last = points[points.length - 1]
  if (targetMs >= last.timestampMs) return last.unitUsd

  let lo = 0
  let hi = points.length - 1
  while (lo + 1 < hi) {
    const mid = (lo + hi) >> 1
    if (points[mid].timestampMs <= targetMs) lo = mid
    else hi = mid
  }
  const a = points[lo]
  const b = points[hi]
  const span = Math.max(1, b.timestampMs - a.timestampMs)
  const frac = (targetMs - a.timestampMs) / span
  return a.unitUsd + (b.unitUsd - a.unitUsd) * frac
}

function generateBridgeSeries(params: {
  seedKey: string
  count: number
  startMs: number
  endMs: number
  startUsd: number
  endUsd: number
  vol: number
  phase: number
  waveCount: number
  guardLow?: number | null
  guardHigh?: number | null
}): MineralTrendPoint[] {
  const {
    seedKey,
    count,
    startMs,
    endMs,
    startUsd,
    endUsd,
    vol,
    phase,
    waveCount,
    guardLow,
    guardHigh,
  } = params

  const rng = createPrng(hashSeed(seedKey))
  const walk: number[] = [0]
  for (let i = 1; i < count; i++) {
    const z = (rng() + rng() + rng() - 1.5) * 1.15
    walk.push(walk[i - 1] + z)
  }
  const walkEnd = walk[count - 1]
  const bridge = walk.map((v, i) => v - (i / (count - 1)) * walkEnd)
  const maxAbsBridge = Math.max(0.0001, ...bridge.map((v) => Math.abs(v)))

  const meanLevel = (startUsd + endUsd) / 2
  const spanMs = Math.max(1, endMs - startMs)
  const points: MineralTrendPoint[] = []

  for (let i = 0; i < count; i++) {
    const t = i / (count - 1)
    const timestampMs = Math.round(startMs + t * spanMs)

    if (i === 0) {
      points.push({ timestampMs, unitUsd: startUsd })
      continue
    }
    if (i === count - 1) {
      points.push({ timestampMs, unitUsd: endUsd })
      continue
    }

    const linear = startUsd + (endUsd - startUsd) * t
    const envelope = Math.sin(Math.PI * t)
    const macroWave =
      Math.sin(t * Math.PI * waveCount + phase) * 0.42 +
      Math.cos(t * Math.PI * (waveCount * 2.1) + phase * 1.2) * 0.18
    const bridgeNorm = bridge[i] / maxAbsBridge

    let value = linear + meanLevel * vol * (bridgeNorm * 0.72 + macroWave * envelope * 0.52)

    if (guardLow != null && guardHigh != null) {
      const loGuard = Math.min(guardLow, startUsd, endUsd)
      const hiGuard = Math.max(guardHigh, startUsd, endUsd)
      value = Math.max(loGuard, Math.min(hiGuard, value))
    }

    const positiveFloor = Math.max(0.0001, Math.min(startUsd, endUsd) * 0.35)
    points.push({
      timestampMs,
      unitUsd: Math.max(positiveFloor, value),
    })
  }

  return points
}

/**
 * Unified Year + Granularity Drill-Down engine:
 * Always computes the authoritative full-year baseline for `selectedYear` (continuous
 * across 2023 -> 2024 -> 2025 -> 2026 live spot) and slices cleanly into `1Y`, `1Mo`,
 * `1D`, `1H`, or `1M` anchored inside that chosen year.
 */
export function buildMineralYearDrilldownSeries(
  mineral: MineralPriceRecord,
  selectedYear: number,
  timeframe: ChartTimeframe,
  mode: ChartPricingMode = 'metric_local',
  focusTimestampMs?: number | null,
  anchorNowMs?: number,
): MineralTrendSeries {
  const { unitUsd: liveUnitUsd, unitSuffix, unitSingular } =
    convertToChartUnitUsd(mineral.world_market_price_usd, mineral.unit, mode)

  const profile = MINERAL_PROFILES[mineral.symbol.toUpperCase()] ?? DEFAULT_PROFILE
  const nowMs = resolveAnchorNowMs(mineral, anchorNowMs)
  const currentYear = new Date(nowMs).getUTCFullYear()
  const yearOffset = Math.max(0, Math.min(3, currentYear - selectedYear))
  const isYtd = selectedYear >= currentYear

  // Walk backwards continuously from liveUnitUsd so 2023 -> 2024 -> 2025 -> 2026 seamlessly chain
  let yearEndUnitUsd = liveUnitUsd
  for (let o = 0; o < yearOffset; o++) {
    const r = profile.annualReturns[o] ?? 0.08
    yearEndUnitUsd = yearEndUnitUsd / (1 + r)
  }
  const annualReturn = profile.annualReturns[yearOffset] ?? 0.08
  const yearStartUnitUsd = yearEndUnitUsd / (1 + annualReturn)

  const yearStartMs = Date.UTC(selectedYear, 0, 1, 0, 0, 0)
  // Historical years close on Dec 31 17:00 EAT (14:00 UTC)
  const yearEndMs = isYtd ? nowMs : Date.UTC(selectedYear, 11, 31, 14, 0, 0)

  // Always compute full-year trajectory first so Year Evaluation stats remain consistent across drill-downs
  const yearPoints = generateBridgeSeries({
    seedKey: `${mineral.symbol}:YEAR:${selectedYear}:mineconnect-v4`,
    count: 105,
    startMs: yearStartMs,
    endMs: yearEndMs,
    startUsd: yearStartUnitUsd,
    endUsd: yearEndUnitUsd,
    vol: profile.volatility['1Y'],
    phase: profile.cyclePhase + yearOffset * 1.35,
    waveCount: 2.3,
  })

  let yearLowUsd = yearPoints[0].unitUsd
  let yearHighUsd = yearPoints[0].unitUsd
  for (const pt of yearPoints) {
    if (pt.unitUsd < yearLowUsd) yearLowUsd = pt.unitUsd
    if (pt.unitUsd > yearHighUsd) yearHighUsd = pt.unitUsd
  }

  const yoyChangeUsd = yearEndUnitUsd - yearStartUnitUsd
  const yoyChangePct =
    yearStartUnitUsd > 0 ? (yoyChangeUsd / yearStartUnitUsd) * 100 : 0

  const yearSummary: YearlyAssessmentSummary = {
    year: selectedYear,
    isYtd,
    openUnitUsd: yearStartUnitUsd,
    highUnitUsd: yearHighUsd,
    lowUnitUsd: yearLowUsd,
    closeUnitUsd: yearEndUnitUsd,
    yoyChangeUsd,
    yoyChangePct,
  }

  if (timeframe === '1Y') {
    return {
      mode,
      timeframe,
      selectedYear,
      points: yearPoints,
      unitSuffix,
      unitSingular,
      startUnitUsd: yearStartUnitUsd,
      currentUnitUsd: yearEndUnitUsd,
      minUnitUsd: yearLowUsd,
      maxUnitUsd: yearHighUsd,
      changeUnitUsd: yoyChangeUsd,
      changePct: yoyChangePct,
      yearSummary,
    }
  }

  // Drill down into `1Mo`, `1D`, `1H`, or `1M` strictly inside `selectedYear`
  const { count, spanMs } = SUB_YEAR_CONFIG[timeframe]
  const rawSliceEnd =
    focusTimestampMs != null &&
    focusTimestampMs >= yearStartMs &&
    focusTimestampMs <= yearEndMs
      ? focusTimestampMs
      : yearEndMs

  const sliceEndMs = Math.max(
    Math.min(yearEndMs, yearStartMs + spanMs),
    Math.min(yearEndMs, rawSliceEnd),
  )
  const sliceStartMs = Math.max(yearStartMs, sliceEndMs - spanMs)

  // Anchor endpoints seamlessly onto the chosen year's trajectory (or live 1D open/low/high for current YTD latest)
  const isLiveTail = isYtd && Math.abs(yearEndMs - sliceEndMs) < HOUR_MS
  const sliceEndUsd = isLiveTail
    ? liveUnitUsd
    : sampleSeriesAtTimestamp(yearPoints, sliceEndMs)

  let sliceStartUsd: number
  let guardLow: number | null = null
  let guardHigh: number | null = null

  if (isLiveTail && timeframe === '1D') {
    if (mineral.day_open_usd && mineral.day_open_usd > 0) {
      sliceStartUsd = convertToChartUnitUsd(
        mineral.day_open_usd,
        mineral.unit,
        mode,
      ).unitUsd
    } else {
      const denom = 1 + (mineral.trend_percentage || 0) / 100
      sliceStartUsd = denom > 0.2 ? sliceEndUsd / denom : sliceEndUsd
    }
    if (mineral.day_low_usd && mineral.day_low_usd > 0) {
      guardLow = convertToChartUnitUsd(mineral.day_low_usd, mineral.unit, mode).unitUsd
    }
    if (mineral.day_high_usd && mineral.day_high_usd > 0) {
      guardHigh = convertToChartUnitUsd(mineral.day_high_usd, mineral.unit, mode).unitUsd
    }
  } else if (timeframe === '1Mo') {
    sliceStartUsd = sampleSeriesAtTimestamp(yearPoints, sliceStartMs)
  } else {
    // Sub-day / intraday slice inside the chosen year
    const driftScale =
      timeframe === '1M' ? 0.025 : timeframe === '1H' ? 0.16 : 0.85
    const baseTrendPct = isLiveTail
      ? mineral.trend_percentage || 0
      : Math.max(-2.5, Math.min(2.5, yoyChangePct / 12))
    const denom = 1 + (baseTrendPct / 100) * driftScale
    sliceStartUsd = denom > 0.5 ? sliceEndUsd / denom : sliceEndUsd
  }

  const points = generateBridgeSeries({
    seedKey: `${mineral.symbol}:YEAR:${selectedYear}:${timeframe}:${Math.round(sliceEndMs / DAY_MS)}:v4`,
    count,
    startMs: sliceStartMs,
    endMs: sliceEndMs,
    startUsd: sliceStartUsd,
    endUsd: sliceEndUsd,
    vol: profile.volatility[timeframe],
    phase: profile.cyclePhase + yearOffset * 0.9,
    waveCount: timeframe === '1M' ? 3.1 : timeframe === '1H' ? 2.4 : 2.6,
    guardLow,
    guardHigh,
  })

  let minUsd = points[0].unitUsd
  let maxUsd = points[0].unitUsd
  for (const pt of points) {
    if (pt.unitUsd < minUsd) minUsd = pt.unitUsd
    if (pt.unitUsd > maxUsd) maxUsd = pt.unitUsd
  }

  const changeUsd = sliceEndUsd - sliceStartUsd
  const changePct = sliceStartUsd > 0 ? (changeUsd / sliceStartUsd) * 100 : 0

  return {
    mode,
    timeframe,
    selectedYear,
    points,
    unitSuffix,
    unitSingular,
    startUnitUsd: sliceStartUsd,
    currentUnitUsd: sliceEndUsd,
    minUnitUsd: minUsd,
    maxUnitUsd: maxUsd,
    changeUnitUsd: changeUsd,
    changePct,
    yearSummary,
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
 * e.g. `24 Nov 2026 · 07:35–08:35 EAT` or `1 Jan 2024 – 31 Dec 2024`.
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
