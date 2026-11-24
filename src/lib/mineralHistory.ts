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

export interface ContinuousMineralModel {
  symbol: string
  mode: ChartPricingMode
  unitSuffix: ChartUnitSuffix
  unitSingular: string
  liveUnitUsd: number
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
}

export interface TimeAxisTick {
  timestampMs: number
  x: number
  label: string
}

export const MINUTE_MS = 60_000
export const HOUR_MS = 3_600_000
export const DAY_MS = 86_400_000
export const TAPE_TOTAL_SLOTS = 1000

const EAT_TZ = 'Africa/Dar_es_Salaam'
/** Tanzania (EAT) is fixed UTC+3 year-round with no DST */
const EAT_OFFSET_MS = 3 * HOUR_MS

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
  /** Annual returns going backward from current year: [YTD, -1y, -2y, -3y] */
  annualReturns: [number, number, number, number]
  /** Characteristic relative swing volatility */
  baseVolatility: number
  /** Macro wave phase offset */
  cyclePhase: number
}

const MINERAL_PROFILES: Record<string, MineralMarketProfile> = {
  XAU: {
    annualReturns: [0.245, 0.272, 0.131, 0.048],
    baseVolatility: 0.036,
    cyclePhase: 0.4,
  },
  XAG: {
    annualReturns: [0.294, 0.215, 0.082, -0.034],
    baseVolatility: 0.056,
    cyclePhase: 1.1,
  },
  HG: {
    annualReturns: [0.128, 0.104, 0.052, -0.068],
    baseVolatility: 0.046,
    cyclePhase: 2.0,
  },
  TZN: {
    annualReturns: [0.148, 0.118, 0.095, 0.072],
    baseVolatility: 0.026,
    cyclePhase: 0.85,
  },
  RBY: {
    annualReturns: [0.186, 0.142, 0.114, 0.088],
    baseVolatility: 0.03,
    cyclePhase: 1.55,
  },
  GRF: {
    annualReturns: [0.162, 0.084, -0.052, 0.118],
    baseVolatility: 0.042,
    cyclePhase: 2.6,
  },
  NI: {
    annualReturns: [-0.054, -0.082, -0.185, 0.224],
    baseVolatility: 0.058,
    cyclePhase: 3.3,
  },
  LI: {
    annualReturns: [0.098, -0.164, -0.285, 0.41],
    baseVolatility: 0.064,
    cyclePhase: 4.1,
  },
  CO: {
    annualReturns: [-0.036, -0.112, -0.145, 0.092],
    baseVolatility: 0.048,
    cyclePhase: 4.9,
  },
  SN: {
    annualReturns: [0.112, 0.168, 0.064, -0.125],
    baseVolatility: 0.05,
    cyclePhase: 5.5,
  },
}

const DEFAULT_PROFILE: MineralMarketProfile = {
  annualReturns: [0.12, 0.09, 0.06, 0.04],
  baseVolatility: 0.04,
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
 * Enables continuous, seamless multi-resolution sampling from 4 years down to seconds
 * without storing millions of array points in memory.
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
 * 8-octave fractal time-series spectrum covering quarterly swings down to
 * 10-second micro-ticks. Higher-frequency octaves fade in smoothly as the
 * user pinches or scrolls deeper into shorter windows (zero aliasing on pan).
 */
const MULTI_SCALE_OCTAVES: readonly NoiseOctave[] = [
  { strideMs: 42 * DAY_MS, relAmp: 1.15 }, // Macro quarterly cycle
  { strideMs: 11 * DAY_MS, relAmp: 0.68 }, // Multi-week swing
  { strideMs: 3 * DAY_MS, relAmp: 0.38 }, // Multi-day swing
  { strideMs: 12 * HOUR_MS, relAmp: 0.2 }, // Daily / session swing
  { strideMs: 2 * HOUR_MS, relAmp: 0.1 }, // Intraday waves
  { strideMs: 20 * MINUTE_MS, relAmp: 0.048 }, // Sub-hour waves
  { strideMs: 3 * MINUTE_MS, relAmp: 0.022 }, // Minute waves
  { strideMs: 15_000, relAmp: 0.009 }, // Micro-tick detail
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
  // Gentle cosine blend avoids sharp kinks at calendar year boundaries
  const eased = frac * 0.72 + (0.5 - 0.5 * Math.cos(Math.PI * frac)) * 0.28
  return a.logPrice + (b.logPrice - a.logPrice) * eased
}

/**
 * Builds a single continuous multi-timeline model (2023 -> present live spot)
 * for direct-manipulation pan and pinch/wheel zoom without rigid timeframe reloads.
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
  const currentYear = new Date(historyEndMs).getUTCFullYear()
  const startYear = currentYear - 3 // 4-year continuous span (e.g. 2023–2026)
  const historyStartMs = Date.UTC(startYear, 0, 1, 0, 0, 0)

  // Construct continuous yearly anchor nodes chaining backward from liveUnitUsd
  const yearAnchors: Array<{ t: number; price: number }> = []
  let cursorPrice = safeLiveUsd
  yearAnchors.push({ t: historyEndMs, price: cursorPrice })

  for (let offset = 0; offset < 4; offset++) {
    const yr = currentYear - offset
    const ret = profile.annualReturns[offset] ?? 0.08
    cursorPrice = Math.max(0.0001, cursorPrice / (1 + ret))
    yearAnchors.push({
      t: Date.UTC(yr, 0, 1, 0, 0, 0),
      price: cursorPrice,
    })
  }

  // Sort chronologically (2023-01-01 -> ... -> historyEndMs)
  yearAnchors.sort((a, b) => a.t - b.t)

  // Anchor the latest 24h drift to live day_open_usd / trend_percentage when available
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

  const seed = hashSeed(`${mineral.symbol.toUpperCase()}:continuous:v5`)
  const endRefOctaves = MULTI_SCALE_OCTAVES.map((oct, idx) =>
    smoothNoise1D(seed, idx, historyEndMs / oct.strideMs),
  )

  const maxSpanMs = Math.max(DAY_MS, historyEndMs - historyStartMs)
  const minSpanMs = 2 * MINUTE_MS
  // Default to the full continuous multi-year range (2023 -> present) so all years are visible immediately
  const defaultSpanMs = maxSpanMs

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
    let endMs = Math.min(historyEndMs, Math.max(historyStartMs + span, rawViewEndMs))
    let startMs = endMs - span
    if (startMs < historyStartMs) {
      startMs = historyStartMs
      endMs = Math.min(historyEndMs, startMs + span)
    }

    const stepMs = (endMs - startMs) / (count - 1)
    const octaveWeights = MULTI_SCALE_OCTAVES.map((oct) => {
      const ratio = oct.strideMs / Math.max(1, stepMs)
      // Smooth low-pass fade-in so finer detail organically emerges as user zooms in
      return Math.max(0, Math.min(1, (ratio - 0.35) / 1.2))
    })

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
        // Subtracting endRefOctaves[o] guarantees exact liveUnitUsd convergence at historyEndMs
        const n = smoothNoise1D(seed, o, t / oct.strideMs) - endRefOctaves[o]
        logDelta += n * profile.baseVolatility * oct.relAmp * w
      }

      // Subtle harmonic macro wave (also zeroed at historyEndMs for exact live convergence)
      const yearsFromEnd = (t - historyEndMs) / (365.25 * DAY_MS)
      const macroWave =
        (Math.sin(yearsFromEnd * Math.PI * 2.4 + profile.cyclePhase) -
          Math.sin(profile.cyclePhase)) *
        profile.baseVolatility *
        0.55

      const unitUsd = Math.max(0.0001, Math.exp(baseLog + logDelta + macroWave))
      points[i] = { timestampMs: Math.round(t), unitUsd }
    }

    return points
  }

  return {
    symbol: mineral.symbol.toUpperCase(),
    mode,
    unitSuffix,
    unitSingular,
    liveUnitUsd: safeLiveUsd,
    historyStartMs,
    historyEndMs,
    minSpanMs,
    maxSpanMs,
    defaultSpanMs,
    sampleWindow,
  }
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
 * (e.g. `4m`, `12H`, `30D`, `6M`, `3.9Y`).
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
  return years >= 1.05 ? `${years.toFixed(1).replace(/\.0$/, '')}Y` : '1Y'
}

/**
 * Computes a compact 1..1000 timeline tape position counter (e.g. `158/1000`)
 * reflecting where the active window / inspected cursor sits along the
 * continuous multi-year history.
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
      // Highlight midnight transitions with date + month so multi-day intraday scrolls stay crystal clear
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

    const eatDate = new Date(timestampMs + EAT_OFFSET_MS)
    if (eatDate.getUTCMonth() === 0) {
      return String(eatDate.getUTCFullYear())
    }
    return new Intl.DateTimeFormat(locale, {
      month: 'short',
      year: '2-digit',
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
 * (e.g. `24 Nov 2026 · 07:51–08:51 EAT` or `25 Oct 2026 – 24 Nov 2026`).
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
 * Generates clean, calendar- & clock-aligned X-axis ticks that glide naturally
 * as the user pans and zooms, with guaranteed non-overlapping horizontal spacing.
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
  const minSpacingPx = scale === 'years' ? (isCompact ? 50 : 72) : isCompact ? 62 : 86
  const targetTicks = Math.max(
    3,
    Math.min(isCompact ? 4 : 7, Math.floor(plotWidth / minSpacingPx)),
  )

  const candidates: number[] = []

  if (scale === 'years') {
    // Anchor cleanly on Jan 1 of each whole calendar year (2023, 2024, 2025, 2026)
    const startYear = new Date(viewStartMs + EAT_OFFSET_MS).getUTCFullYear()
    const endYear = new Date(viewEndMs + EAT_OFFSET_MS).getUTCFullYear()
    for (let yr = startYear; yr <= endYear; yr++) {
      const jan1Ms = Date.UTC(yr, 0, 1, 0, 0, 0) - EAT_OFFSET_MS
      const clampedTs = Math.max(viewStartMs, jan1Ms)
      if (clampedTs <= viewEndMs) {
        candidates.push(clampedTs)
      }
    }
  } else if (spanMs > 55 * DAY_MS) {
    // Calendar month / quarter / year boundaries in EAT (UTC+3)
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
    // Fixed clock/day interval aligned to EAT midnight
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
    for (
      let t = firstEat - EAT_OFFSET_MS;
      t <= viewEndMs;
      t += chosenStep
    ) {
      if (t >= viewStartMs) {
        candidates.push(t)
      }
      if (candidates.length > 40) break
    }
  }

  // Filter for clean edge margins & non-overlapping labels
  const edgeMargin = scale === 'years' ? (isCompact ? 12 : 18) : isCompact ? 24 : 32
  const ticks: TimeAxisTick[] = []
  let lastX = -Infinity

  for (const ts of candidates) {
    const rawX = padLeft + ((ts - viewStartMs) / spanMs) * plotWidth
    const x =
      scale === 'years'
        ? Math.max(padLeft + edgeMargin, Math.min(padLeft + plotWidth - edgeMargin, rawX))
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
          ? String(new Date(ts + EAT_OFFSET_MS).getUTCFullYear())
          : formatChartAxisDateByScale(ts, scale, spanMs, language),
    })
    lastX = x
  }

  // Fallback if tight edge constraints filtered everything
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
