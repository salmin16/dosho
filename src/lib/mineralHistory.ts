import {
  GRAMS_PER_POUND,
  GRAMS_PER_TROY_OUNCE,
  KILOGRAMS_PER_TONNE,
} from '../data/mineralPrices'
import type { LanguageCode } from '../i18n'
import type { MineralPriceRecord } from '../types/database'

export type ChartPricingMode = 'metric_local' | 'standard'

export type TimelineScale = 'min' | 'hours' | 'days' | 'months' | 'years'

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

export interface InspectedYearSummary {
  year: number
  isYtd: boolean
  openUnitUsd: number
  highUnitUsd: number
  lowUnitUsd: number
  closeUnitUsd: number
  changeUsd: number
  changePct: number
}

export interface ContinuousMineralModel {
  symbol: string
  mode: ChartPricingMode
  unitSuffix: ChartUnitSuffix
  unitSingular: string
  liveUnitUsd: number
  startYear: number
  endYear: number
  historyStartMs: number
  historyEndMs: number
  minSpanMs: number
  maxSpanMs: number
  defaultSpanMs: number
  sampleWindow: (
    viewStartMs: number,
    viewEndMs: number,
    sampleCount: number,
  ) => MineralTrendPoint[]
  getYearSummary: (year: number) => InspectedYearSummary
}

export interface TimeAxisTick {
  timestampMs: number
  x: number
  label: string
}

export const HISTORICAL_START_YEAR = 2000
export const MINUTE_MS = 60_000
export const HOUR_MS = 3_600_000
export const DAY_MS = 86_400_000
export const TAPE_TOTAL_SLOTS = 1000

const EAT_TZ = 'Africa/Dar_es_Salaam'
/** Tanzania (EAT) is fixed UTC+3 year-round with no DST */
export const EAT_OFFSET_MS = 3 * HOUR_MS

const LOCALE_BY_LANG: Record<LanguageCode, string> = {
  en: 'en-GB',
  sw: 'sw-TZ',
  es: 'es-ES',
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

interface MineralMarketProfile {
  /** Recent annual returns going backward from current year: [YTD, -1y, -2y, -3y, -4y, -5y] */
  recentReturns: readonly number[]
  /** Secular long-run annual drift from 2000 -> recent decade */
  secularDrift: number
  /** Characteristic relative swing volatility */
  baseVolatility: number
  /** Multi-year commodity supercycle amplitude */
  cycleAmp: number
  /** Macro wave phase offset */
  cyclePhase: number
}

const MINERAL_PROFILES: Record<string, MineralMarketProfile> = {
  XAU: {
    recentReturns: [0.245, 0.272, 0.131, -0.004, -0.036, 0.246],
    secularDrift: 0.088,
    baseVolatility: 0.036,
    cycleAmp: 0.16,
    cyclePhase: 0.4,
  },
  XAG: {
    recentReturns: [0.294, 0.215, 0.082, 0.028, -0.115, 0.474],
    secularDrift: 0.068,
    baseVolatility: 0.056,
    cycleAmp: 0.24,
    cyclePhase: 1.1,
  },
  HG: {
    recentReturns: [0.128, 0.104, 0.052, -0.138, 0.254, 0.26],
    secularDrift: 0.062,
    baseVolatility: 0.046,
    cycleAmp: 0.22,
    cyclePhase: 2.0,
  },
  TZN: {
    recentReturns: [0.148, 0.118, 0.095, 0.072, 0.058, 0.064],
    secularDrift: 0.064,
    baseVolatility: 0.026,
    cycleAmp: 0.11,
    cyclePhase: 0.85,
  },
  RBY: {
    recentReturns: [0.186, 0.142, 0.114, 0.088, 0.062, 0.07],
    secularDrift: 0.072,
    baseVolatility: 0.03,
    cycleAmp: 0.12,
    cyclePhase: 1.55,
  },
  GRF: {
    recentReturns: [0.162, 0.084, -0.052, 0.118, 0.145, 0.082],
    secularDrift: 0.048,
    baseVolatility: 0.042,
    cycleAmp: 0.18,
    cyclePhase: 2.6,
  },
  NI: {
    recentReturns: [-0.054, -0.082, -0.185, 0.224, 0.248, 0.182],
    secularDrift: 0.036,
    baseVolatility: 0.058,
    cycleAmp: 0.26,
    cyclePhase: 3.3,
  },
  LI: {
    recentReturns: [0.098, -0.164, -0.285, 0.41, 0.62, 0.18],
    secularDrift: 0.074,
    baseVolatility: 0.064,
    cycleAmp: 0.28,
    cyclePhase: 4.1,
  },
  CO: {
    recentReturns: [-0.036, -0.112, -0.145, 0.092, 0.48, 0.09],
    secularDrift: 0.034,
    baseVolatility: 0.048,
    cycleAmp: 0.24,
    cyclePhase: 4.9,
  },
  SN: {
    recentReturns: [0.112, 0.168, 0.064, -0.125, 0.42, 0.18],
    secularDrift: 0.064,
    baseVolatility: 0.05,
    cycleAmp: 0.2,
    cyclePhase: 5.5,
  },
}

const DEFAULT_PROFILE: MineralMarketProfile = {
  recentReturns: [0.12, 0.09, 0.06, 0.04, 0.05, 0.07],
  secularDrift: 0.055,
  baseVolatility: 0.04,
  cycleAmp: 0.16,
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

/**
 * Deterministic O(1) hash mapping (seed, octave, integer grid index) -> [-1, 1].
 * Enables uncapped multi-decade continuous LOD sampling from 2000 to present
 * down to sub-minute resolution with zero memory bloat.
 */
function gridNoiseValue(seed: number, octave: number, index: number): number {
  let h = (seed ^ Math.imul(octave + 1, 0x9e3779b1)) >>> 0
  const low = index | 0
  const high = Math.floor(index / 4294967296) | 0
  h ^= Math.imul(low, 0x85ebca6b) >>> 0
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0
  h ^= Math.imul(high, 0x27d4eb2d) >>> 0
  h = (h ^ (h >>> 16)) >>> 0
  return (h / 4294967295) * 2 - 1
}

/** Smooth C1-continuous 1D value noise via cubic Hermite interpolation */
function smoothNoise1D(seed: number, octave: number, coord: number): number {
  const i0 = Math.floor(coord)
  const f = coord - i0
  const u = f * f * (3 - 2 * f)
  const v0 = gridNoiseValue(seed, octave, i0)
  const v1 = gridNoiseValue(seed, octave, i0 + 1)
  return v0 + (v1 - v0) * u
}

interface NoiseOctave {
  strideMs: number
  relAmp: number
}

/**
 * 9-octave fractal time-series spectrum spanning multi-year commodity cycles
 * down to 15-second micro-ticks. Higher-frequency octaves blend in smoothly as
 * the user zooms deeper (zero aliasing during fast multi-decade drags).
 */
const MULTI_SCALE_OCTAVES: readonly NoiseOctave[] = [
  { strideMs: 220 * DAY_MS, relAmp: 1.45 }, // Multi-year supercycle swing
  { strideMs: 48 * DAY_MS, relAmp: 1.05 }, // Seasonal / quarterly swing
  { strideMs: 11 * DAY_MS, relAmp: 0.64 }, // Multi-week swing
  { strideMs: 3 * DAY_MS, relAmp: 0.36 }, // Multi-day swing
  { strideMs: 12 * HOUR_MS, relAmp: 0.19 }, // Session swing
  { strideMs: 2 * HOUR_MS, relAmp: 0.095 }, // Intraday wave
  { strideMs: 20 * MINUTE_MS, relAmp: 0.046 }, // Sub-hour wave
  { strideMs: 3 * MINUTE_MS, relAmp: 0.021 }, // Minute wave
  { strideMs: 15_000, relAmp: 0.0085 }, // Micro-tick detail
]

function resolveAnchorNowMs(
  mineral: MineralPriceRecord,
  anchorNowMs?: number,
): number {
  if (anchorNowMs !== undefined) return anchorNowMs
  const parsedUpdated = Date.parse(mineral.updated_at)
  if (
    Number.isFinite(parsedUpdated) &&
    Math.abs(Date.now() - parsedUpdated) < 30 * DAY_MS
  ) {
    return Math.max(parsedUpdated, Date.now())
  }
  return Date.now()
}

interface AnchorNode {
  t: number
  logPrice: number
}

function evaluateAnchorLogPrice(nodes: readonly AnchorNode[], t: number): number {
  if (nodes.length === 0) return 0
  if (t <= nodes[0].t) return nodes[0].logPrice
  const last = nodes[nodes.length - 1]
  if (t >= last.t) return last.logPrice

  let lo = 0
  let hi = nodes.length - 1
  while (lo + 1 < hi) {
    const mid = (lo + hi) >> 1
    if (nodes[mid].t <= t) lo = mid
    else hi = mid
  }

  const a = nodes[lo]
  const b = nodes[hi]
  const frac = (t - a.t) / Math.max(1, b.t - a.t)
  const eased = frac * 0.72 + (0.5 - 0.5 * Math.cos(Math.PI * frac)) * 0.28
  return a.logPrice + (b.logPrice - a.logPrice) * eased
}

/**
 * Computes a historically grounded annual return for any calendar year from
 * 2000 onward (capturing the 2000s commodity supercycle, 2008 GFC dip,
 * 2011–2012 peak, 2013–2015 consolidation, 2020 rally, and recent regimes).
 */
function resolveHistoricalAnnualReturn(
  profile: MineralMarketProfile,
  seed: number,
  year: number,
  currentYear: number,
): number {
  const offset = currentYear - year
  if (offset >= 0 && offset < profile.recentReturns.length) {
    return profile.recentReturns[offset]
  }

  // Broad global commodity regime bias by historical era
  let regimeBias = 0
  if (year >= 2001 && year <= 2007) regimeBias = 0.08 // Early-2000s supercycle expansion
  else if (year === 2008) regimeBias = -0.14 // Global financial crisis shock
  else if (year >= 2009 && year <= 2011) regimeBias = 0.14 // Post-GFC reflation rally
  else if (year >= 2013 && year <= 2015) regimeBias = -0.1 // Mid-2010s commodity bear market
  else if (year >= 2016 && year <= 2019) regimeBias = 0.035 // Gradual recovery

  const yearNoise = gridNoiseValue(seed, 99, year) * profile.cycleAmp
  const macroWave =
    Math.sin((year - 2000) * 0.65 + profile.cyclePhase) *
    profile.cycleAmp *
    0.55

  // Keep every annual move within realistic commodity bounds (-32% to +48%)
  return Math.max(
    -0.32,
    Math.min(0.48, profile.secularDrift + regimeBias + yearNoise + macroWave),
  )
}

/**
 * Builds an uncapped multi-year continuous mineral model (2000 -> live spot)
 * with dynamic LOD viewport sampling and per-year inspection summaries.
 */
export function createContinuousMineralModel(
  mineral: MineralPriceRecord,
  mode: ChartPricingMode = 'metric_local',
  anchorNowMs?: number,
): ContinuousMineralModel {
  const { unitUsd: liveUnitUsd, unitSuffix, unitSingular } =
    convertToChartUnitUsd(mineral.world_market_price_usd, mineral.unit, mode)

  const safeLiveUsd = Math.max(0.0001, liveUnitUsd)
  const profile =
    MINERAL_PROFILES[mineral.symbol.toUpperCase()] ?? DEFAULT_PROFILE
  const historyEndMs = resolveAnchorNowMs(mineral, anchorNowMs)
  const endYear = new Date(historyEndMs).getUTCFullYear()
  const startYear = Math.min(HISTORICAL_START_YEAR, endYear - 20)
  const historyStartMs = Date.UTC(startYear, 0, 1, 0, 0, 0)

  const seed = hashSeed(`${mineral.symbol.toUpperCase()}:continuous:v6`)

  // Use a stable historical anchor (day_open_usd when available) for the multi-decade chain
  // so 2-second live ticks smoothly move the live trailing tip without wobbling historical years!
  const dayAgoMs = historyEndMs - DAY_MS
  let dayOpenUsd: number | null = null
  if (mineral.day_open_usd && mineral.day_open_usd > 0) {
    dayOpenUsd = convertToChartUnitUsd(
      mineral.day_open_usd,
      mineral.unit,
      mode,
    ).unitUsd
  } else if (
    Number.isFinite(mineral.trend_percentage) &&
    Math.abs(mineral.trend_percentage) > 0.001
  ) {
    const denom = 1 + mineral.trend_percentage / 100
    if (denom > 0.4) dayOpenUsd = safeLiveUsd / denom
  }

  const stableBaseUsd = Math.max(0.0001, dayOpenUsd ?? safeLiveUsd)

  // Chain continuous yearly anchors backward from stableBaseUsd all the way to Jan 1, 2000
  const yearAnchors: Array<{ t: number; price: number }> = [
    { t: historyEndMs, price: safeLiveUsd },
  ]
  let cursorPrice = stableBaseUsd

  for (let yr = endYear; yr >= startYear; yr--) {
    const ret = resolveHistoricalAnnualReturn(profile, seed, yr, endYear)
    cursorPrice = Math.max(0.0001, cursorPrice / (1 + ret))
    yearAnchors.push({
      t: Date.UTC(yr, 0, 1, 0, 0, 0),
      price: cursorPrice,
    })
  }

  yearAnchors.sort((a, b) => a.t - b.t)

  const nodes: AnchorNode[] = yearAnchors.map((a) => ({
    t: a.t,
    logPrice: Math.log(Math.max(0.0001, a.price)),
  }))

  if (dayOpenUsd && dayOpenUsd > 0 && dayAgoMs > nodes[nodes.length - 2].t) {
    nodes.splice(nodes.length - 1, 0, {
      t: dayAgoMs,
      logPrice: Math.log(dayOpenUsd),
    })
  }

  // Fixed stable reference timestamp for noise octaves so historical curves stay 100% rock-steady
  // across 2-second live ticks while a smooth tail envelope converges strictly to safeLiveUsd at historyEndMs!
  const stableNoiseRefMs = Date.UTC(endYear, 0, 1, 0, 0, 0)
  const refOctaves = MULTI_SCALE_OCTAVES.map((oct, idx) =>
    smoothNoise1D(seed, idx, stableNoiseRefMs / oct.strideMs),
  )

  const maxSpanMs = Math.max(DAY_MS, historyEndMs - historyStartMs)
  const minSpanMs = 2 * MINUTE_MS
  // Open on the latest 5 years so dragging left immediately explores 2020 -> 2000,
  // while pinching out expands all the way to 2000–2026 and pinching in dives to minutes.
  const defaultSpanMs = Math.min(maxSpanMs, Math.round(5 * 365.25 * DAY_MS))

  const sampleWindow = (
    rawViewStartMs: number,
    rawViewEndMs: number,
    sampleCount: number,
  ): MineralTrendPoint[] => {
    const count = Math.max(24, Math.min(320, Math.round(sampleCount)))
    const span = Math.max(
      minSpanMs,
      Math.min(maxSpanMs, rawViewEndMs - rawViewStartMs),
    )
    let endMs = Math.min(
      historyEndMs,
      Math.max(historyStartMs + span, rawViewEndMs),
    )
    let startMs = endMs - span
    if (startMs < historyStartMs) {
      startMs = historyStartMs
      endMs = Math.min(historyEndMs, startMs + span)
    }

    const stepMs = (endMs - startMs) / (count - 1)
    const octaveWeights = MULTI_SCALE_OCTAVES.map((oct) => {
      const ratio = oct.strideMs / Math.max(1, stepMs)
      return Math.max(0, Math.min(1, (ratio - 0.35) / 1.2))
    })

    // Smoothly taper synthetic noise to 0 over the trailing 8% of the live edge so the live tip
    // lands identically on liveUnitUsd with zero jump or historical wobble!
    const liveTailTaperMs = Math.max(30_000, Math.min(6 * HOUR_MS, span * 0.08))

    const points: MineralTrendPoint[] = new Array(count)
    for (let i = 0; i < count; i++) {
      const t = i === count - 1 ? endMs : startMs + i * stepMs
      if (Math.abs(t - historyEndMs) < 1) {
        points[i] = { timestampMs: historyEndMs, unitUsd: safeLiveUsd }
        continue
      }

      const baseLog = evaluateAnchorLogPrice(nodes, t)
      let logDelta = 0

      for (let o = 0; o < MULTI_SCALE_OCTAVES.length; o++) {
        const w = octaveWeights[o]
        if (w <= 0) continue
        const oct = MULTI_SCALE_OCTAVES[o]
        const n = smoothNoise1D(seed, o, t / oct.strideMs) - refOctaves[o]
        logDelta += n * profile.baseVolatility * oct.relAmp * w
      }

      const yearsFromRef = (t - stableNoiseRefMs) / (365.25 * DAY_MS)
      const macroWave =
        (Math.sin(yearsFromRef * Math.PI * 1.45 + profile.cyclePhase) -
          Math.sin(profile.cyclePhase)) *
        profile.baseVolatility *
        0.5

      const distFromLive = Math.max(0, historyEndMs - t)
      const liveEdgeBlend =
        distFromLive < liveTailTaperMs
          ? distFromLive / liveTailTaperMs
          : 1

      const unitUsd = Math.max(
        0.0001,
        Math.exp(baseLog + (logDelta + macroWave) * liveEdgeBlend),
      )
      points[i] = { timestampMs: Math.round(t), unitUsd }
    }

    return points
  }

  // Memoize per-year summaries on demand so dragging through 2000–2026 stays 60fps
  const yearSummaryCache = new Map<number, InspectedYearSummary>()

  const getYearSummary = (rawYear: number): InspectedYearSummary => {
    const year = Math.max(startYear, Math.min(endYear, Math.round(rawYear)))
    const cached = yearSummaryCache.get(year)
    if (cached) return cached

    const isYtd = year >= endYear
    const yrStartMs = Math.max(historyStartMs, Date.UTC(year, 0, 1, 0, 0, 0))
    const yrEndMs = isYtd
      ? historyEndMs
      : Math.min(historyEndMs, Date.UTC(year, 11, 31, 23, 59, 0))

    const pts = sampleWindow(yrStartMs, yrEndMs, 64)
    const openUnitUsd = pts[0]?.unitUsd ?? safeLiveUsd
    const closeUnitUsd = pts[pts.length - 1]?.unitUsd ?? safeLiveUsd
    let highUnitUsd = openUnitUsd
    let lowUnitUsd = openUnitUsd
    for (const pt of pts) {
      if (pt.unitUsd > highUnitUsd) highUnitUsd = pt.unitUsd
      if (pt.unitUsd < lowUnitUsd) lowUnitUsd = pt.unitUsd
    }
    const changeUsd = closeUnitUsd - openUnitUsd
    const changePct = openUnitUsd > 0 ? (changeUsd / openUnitUsd) * 100 : 0

    const summary: InspectedYearSummary = {
      year,
      isYtd,
      openUnitUsd,
      highUnitUsd,
      lowUnitUsd,
      closeUnitUsd,
      changeUsd,
      changePct,
    }
    yearSummaryCache.set(year, summary)
    return summary
  }

  return {
    symbol: mineral.symbol.toUpperCase(),
    mode,
    unitSuffix,
    unitSingular,
    liveUnitUsd: safeLiveUsd,
    startYear,
    endYear,
    historyStartMs,
    historyEndMs,
    minSpanMs,
    maxSpanMs,
    defaultSpanMs,
    sampleWindow,
    getYearSummary,
  }
}

export function getEatYear(timestampMs: number): number {
  return new Date(timestampMs + EAT_OFFSET_MS).getUTCFullYear()
}

/**
 * Automatically detects timeline granularity (`min`, `hours`, `days`, `months`, `years`)
 * directly from the currently visible time span.
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
 * Formats a concise human-readable duration token for the visible viewport
 * (e.g. `4m`, `12H`, `30D`, `6M`, `5Y`, `26Y`).
 */
export function formatSpanCompact(visibleSpanMs: number): string {
  const span = Math.max(MINUTE_MS, visibleSpanMs)
  if (span < 90 * MINUTE_MS) {
    return `${Math.max(1, Math.round(span / MINUTE_MS))}m`
  }
  if (span < 48 * HOUR_MS) {
    return `${Math.max(1, Math.round(span / HOUR_MS))}H`
  }
  if (span < 60 * DAY_MS) {
    return `${Math.max(1, Math.round(span / DAY_MS))}D`
  }
  if (span < 365 * DAY_MS) {
    return `${Math.max(1, Math.round(span / (30.4375 * DAY_MS)))}M`
  }
  const years = span / (365.25 * DAY_MS)
  if (years >= 10) return `${Math.round(years)}Y`
  return years >= 1.05 ? `${years.toFixed(1).replace(/\.0$/, '')}Y` : '1Y'
}

/**
 * Computes a compact 1..1000 timeline tape position counter (e.g. `412/1000`)
 * reflecting where the active window / inspected cursor sits along the
 * continuous multi-decade history.
 */
export function computeTapeCounter(
  activeTimestampMs: number,
  historyStartMs: number,
  historyEndMs: number,
  totalSlots = TAPE_TOTAL_SLOTS,
): { current: number; total: number; label: string } {
  const totalSpan = Math.max(1, historyEndMs - historyStartMs)
  const frac = Math.max(
    0,
    Math.min(1, (activeTimestampMs - historyStartMs) / totalSpan),
  )
  const current = Math.max(
    1,
    Math.min(totalSlots, Math.round(frac * (totalSlots - 1)) + 1),
  )
  return { current, total: totalSlots, label: `${current}/${totalSlots}` }
}

function getEatDayKey(timestampMs: number): string {
  const d = new Date(timestampMs + EAT_OFFSET_MS)
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
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
      if (visibleSpanMs <= 4 * MINUTE_MS) {
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
      const eatDate = new Date(timestampMs + EAT_OFFSET_MS)
      if (eatDate.getUTCHours() === 0 && eatDate.getUTCMinutes() === 0) {
        return new Intl.DateTimeFormat(locale, {
          day: 'numeric',
          month: 'short',
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

    return String(getEatYear(timestampMs))
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

    if (scale === 'min' && visibleSpanMs <= 4 * MINUTE_MS) {
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
 * Formats an explicit calendar date + EAT intraday time window
 * (e.g. `24 Nov 2026 · 07:51–08:51 EAT` or `1 Jan 2012 – 31 Dec 2016`).
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
      const withSeconds = spanMs <= 4 * MINUTE_MS
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

const FIXED_TIME_STEPS_MS: readonly number[] = [
  15_000,
  30_000,
  MINUTE_MS,
  2 * MINUTE_MS,
  5 * MINUTE_MS,
  10 * MINUTE_MS,
  15 * MINUTE_MS,
  30 * MINUTE_MS,
  HOUR_MS,
  2 * HOUR_MS,
  4 * HOUR_MS,
  6 * HOUR_MS,
  12 * HOUR_MS,
  DAY_MS,
  2 * DAY_MS,
  5 * DAY_MS,
  7 * DAY_MS,
  14 * DAY_MS,
]

/**
 * Generates clean, calendar- & clock-aligned X-axis ticks (supporting anything
 * from 2 minutes up to 26+ years) with guaranteed non-overlapping horizontal spacing.
 */
export function computeNiceTimeTicks(params: {
  viewStartMs: number
  viewEndMs: number
  scale: TimelineScale
  padLeft: number
  plotWidth: number
  isCompact: boolean
  language: LanguageCode
}): TimeAxisTick[] {
  const { viewStartMs, viewEndMs, scale, padLeft, plotWidth, isCompact, language } =
    params
  const spanMs = Math.max(1, viewEndMs - viewStartMs)
  const minSpacingPx =
    scale === 'years' ? (isCompact ? 48 : 68) : isCompact ? 62 : 86
  const targetTicks = Math.max(
    3,
    Math.min(isCompact ? 5 : 8, Math.floor(plotWidth / minSpacingPx)),
  )

  const candidates: number[] = []

  if (scale === 'years') {
    const startYr = getEatYear(viewStartMs)
    const endYr = getEatYear(viewEndMs)
    const totalYears = Math.max(1, endYr - startYr)
    const rawYearStep = totalYears / Math.max(2, targetTicks)
    const yearStep =
      rawYearStep <= 1
        ? 1
        : rawYearStep <= 2
          ? 2
          : rawYearStep <= 5
            ? 5
            : 10

    const firstAligned = Math.ceil(startYr / yearStep) * yearStep
    for (let yr = firstAligned; yr <= endYr; yr += yearStep) {
      const jan1Ms = Date.UTC(yr, 0, 1, 0, 0, 0) - EAT_OFFSET_MS
      const clampedTs = Math.max(viewStartMs, jan1Ms)
      if (clampedTs <= viewEndMs) {
        candidates.push(clampedTs)
      }
    }
  } else if (spanMs > 55 * DAY_MS) {
    const approxMonths = spanMs / (30.4375 * DAY_MS)
    const rawMonthStep = approxMonths / targetTicks
    const monthStep =
      rawMonthStep <= 1
        ? 1
        : rawMonthStep <= 2
          ? 2
          : rawMonthStep <= 3
            ? 3
            : rawMonthStep <= 6
              ? 6
              : 12

    const startEat = new Date(viewStartMs + EAT_OFFSET_MS)
    let yr = startEat.getUTCFullYear()
    let mo = Math.floor(startEat.getUTCMonth() / monthStep) * monthStep

    for (let guard = 0; guard < 120; guard++) {
      const tickMs = Date.UTC(yr, mo, 1, 0, 0, 0) - EAT_OFFSET_MS
      if (tickMs > viewEndMs) break
      if (tickMs >= viewStartMs) {
        candidates.push(tickMs)
      }
      mo += monthStep
      while (mo >= 12) {
        mo -= 12
        yr += 1
      }
    }
  } else {
    const rawStep = spanMs / targetTicks
    let chosenStep = FIXED_TIME_STEPS_MS[FIXED_TIME_STEPS_MS.length - 1]
    for (const s of FIXED_TIME_STEPS_MS) {
      if (s >= rawStep) {
        chosenStep = s
        break
      }
    }

    const firstEat =
      Math.ceil((viewStartMs + EAT_OFFSET_MS) / chosenStep) * chosenStep
    for (let t = firstEat - EAT_OFFSET_MS; t <= viewEndMs; t += chosenStep) {
      if (t >= viewStartMs) {
        candidates.push(t)
      }
      if (candidates.length > 40) break
    }
  }

  const edgeMargin =
    scale === 'years' ? (isCompact ? 14 : 20) : isCompact ? 24 : 32
  const ticks: TimeAxisTick[] = []
  let lastX = -Infinity

  for (const ts of candidates) {
    const rawX = padLeft + ((ts - viewStartMs) / spanMs) * plotWidth
    const x =
      scale === 'years'
        ? Math.max(
            padLeft + edgeMargin,
            Math.min(padLeft + plotWidth - edgeMargin, rawX),
          )
        : rawX
    if (
      scale !== 'years' &&
      (x < padLeft + edgeMargin || x > padLeft + plotWidth - edgeMargin)
    ) {
      continue
    }
    if (x - lastX < minSpacingPx) continue
    ticks.push({
      timestampMs: ts,
      x,
      label:
        scale === 'years'
          ? String(getEatYear(ts))
          : formatChartAxisDateByScale(ts, scale, spanMs, language),
    })
    lastX = x
  }

  if (ticks.length < 2) {
    const fallbackCount = isCompact ? 3 : 4
    const fallback: TimeAxisTick[] = []
    for (let i = 0; i < fallbackCount; i++) {
      const frac = 0.12 + (i / (fallbackCount - 1)) * 0.76
      const ts = Math.round(viewStartMs + frac * spanMs)
      fallback.push({
        timestampMs: ts,
        x: padLeft + frac * plotWidth,
        label: formatChartAxisDateByScale(ts, scale, spanMs, language),
      })
    }
    return fallback
  }

  return ticks
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
    lo = Math.max(0, lo - span * 0.1)
    hi = hi + span * 0.1
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
    max: niceMax,
    step,
    ticks,
  }
}
