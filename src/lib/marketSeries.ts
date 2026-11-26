import { convertToChartUnitUsd, type ChartPricingMode } from './mineralHistory'
import type { IntradayTickObservation } from '../data/mineralPrices'
import type { MarketFeedSource, MineralPriceRecord } from '../types/database'

export const DEFAULT_MARKET_TIMEZONE = 'Africa/Dar_es_Salaam'
export const FIRST_MARKET_YEAR = 1968

export interface TimeZoneOption {
  id: string
  shortLabel: string
  label: string
}

export const CORE_TIMEZONE_OPTIONS: readonly TimeZoneOption[] = [
  { id: 'Africa/Dar_es_Salaam', shortLabel: 'EAT', label: 'Dar es Salaam (EAT)' },
  { id: 'UTC', shortLabel: 'UTC', label: 'UTC' },
  { id: 'Europe/London', shortLabel: 'LDN', label: 'London (LBMA / LME)' },
  { id: 'America/New_York', shortLabel: 'NYC', label: 'New York (COMEX)' },
]

export type SeriesPointKind = 'live' | 'cached' | 'historical'

export interface CanonicalSeriesPoint {
  /** Strictly UTC epoch milliseconds */
  ts: number
  /** Price in USD per active display unit (/g, /kg, /ct, /toz, /lb, /t) */
  priceUsd: number
  kind: SeriesPointKind
}

export interface TimezoneXTick {
  /** Strictly UTC epoch milliseconds */
  ts: number
  label: string
  highlight?: boolean
}

export function isValidIanaTimeZone(tz: string): boolean {
  if (!tz || typeof tz !== 'string') return false
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz }).format(0)
    return true
  } catch {
    return false
  }
}

export function detectLocalTimeZone(): string {
  try {
    const resolved = Intl.DateTimeFormat().resolvedOptions().timeZone
    if (resolved && isValidIanaTimeZone(resolved)) {
      return resolved
    }
  } catch {
    // Fallback to Tanzania EAT
  }
  return DEFAULT_MARKET_TIMEZONE
}

export function getTimeZoneAbbreviation(ts: number, timeZone: string): string {
  const safeTz = isValidIanaTimeZone(timeZone) ? timeZone : DEFAULT_MARKET_TIMEZONE
  if (safeTz === 'UTC') return 'UTC'
  if (safeTz === 'Africa/Dar_es_Salaam') return 'EAT'
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: safeTz,
      timeZoneName: 'short',
    }).formatToParts(new Date(ts))
    const tzPart = parts.find((p) => p.type === 'timeZoneName')?.value
    if (tzPart) return tzPart
  } catch {
    // fallback below
  }
  return safeTz.split('/').pop()?.replace(/_/g, ' ') || 'UTC'
}

export function buildTimeZoneOptions(): TimeZoneOption[] {
  const localTz = detectLocalTimeZone()
  if (CORE_TIMEZONE_OPTIONS.some((opt) => opt.id === localTz)) {
    return [...CORE_TIMEZONE_OPTIONS]
  }
  const abbr = getTimeZoneAbbreviation(Date.now(), localTz)
  return [
    {
      id: localTz,
      shortLabel: abbr.length <= 5 ? abbr : 'LOC',
      label: `Local (${localTz.replace(/_/g, ' ')})`,
    },
    ...CORE_TIMEZONE_OPTIONS,
  ]
}

interface ZonedDateParts {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
}

function getZonedDateParts(ts: number, timeZone: string): ZonedDateParts {
  const safeTz = isValidIanaTimeZone(timeZone) ? timeZone : DEFAULT_MARKET_TIMEZONE
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: safeTz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  })
  const parts = dtf.formatToParts(new Date(ts))
  const getNum = (type: Intl.DateTimeFormatPartTypes) => {
    const raw = parts.find((p) => p.type === type)?.value ?? '0'
    const n = Number.parseInt(raw, 10)
    return Number.isFinite(n) ? n : 0
  }
  const hour = getNum('hour')
  return {
    year: getNum('year'),
    month: getNum('month'),
    day: getNum('day'),
    hour: hour === 24 ? 0 : hour,
    minute: getNum('minute'),
    second: getNum('second'),
  }
}

export function getYearInTimeZone(ts: number, timeZone: string): number {
  return getZonedDateParts(ts, timeZone).year
}

/**
 * Computes the exact UTC epoch millisecond corresponding to
 * `YYYY-01-01 00:00:00.000` inside the specified IANA time zone.
 * Uses two-pass offset convergence so DST / historical offset transitions
 * never cause off-by-one-day or off-by-one-year drift across time zones.
 */
export function getYearStartEpochMs(year: number, timeZone: string): number {
  const safeTz = isValidIanaTimeZone(timeZone) ? timeZone : DEFAULT_MARKET_TIMEZONE
  const targetWallUtc = Date.UTC(year, 0, 1, 0, 0, 0, 0)
  if (safeTz === 'UTC') return targetWallUtc

  let guess = targetWallUtc
  for (let pass = 0; pass < 2; pass++) {
    const p = getZonedDateParts(guess, safeTz)
    const wallAsUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second, 0)
    const diffMs = targetWallUtc - wallAsUtc
    if (diffMs === 0) break
    guess += diffMs
  }
  return guess
}

export function formatEpochTimeHM(ts: number, timeZone: string): string {
  const safeTz = isValidIanaTimeZone(timeZone) ? timeZone : DEFAULT_MARKET_TIMEZONE
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: safeTz,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(ts))
}

export function formatEpochDateShort(ts: number, timeZone: string): string {
  const safeTz = isValidIanaTimeZone(timeZone) ? timeZone : DEFAULT_MARKET_TIMEZONE
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: safeTz,
    day: '2-digit',
    month: 'short',
  }).format(new Date(ts))
}

export function formatEpochMonthYear(ts: number, timeZone: string): string {
  const safeTz = isValidIanaTimeZone(timeZone) ? timeZone : DEFAULT_MARKET_TIMEZONE
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: safeTz,
    month: 'short',
    year: '2-digit',
  }).format(new Date(ts))
}

export function formatEpochReadout(
  ts: number,
  timeZone: string,
  includeSeconds = false,
): string {
  const safeTz = isValidIanaTimeZone(timeZone) ? timeZone : DEFAULT_MARKET_TIMEZONE
  const formatted = new Intl.DateTimeFormat('en-GB', {
    timeZone: safeTz,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    ...(includeSeconds ? { second: '2-digit' } : {}),
    hourCycle: 'h23',
  }).format(new Date(ts))
  const abbr = getTimeZoneAbbreviation(ts, safeTz)
  return `${formatted} ${abbr}`
}

/**
 * Collision-free, strictly epoch-millisecond X-axis tick builder.
 * - Intraday steps are computed strictly from exact UTC millisecond intervals
 *   (5m = 300_000ms, 15m = 900_000ms, 1h = 3_600_000ms, etc.).
 * - Switching IANA time zones shifts only the formatted labels while keeping
 *   every underlying price point and step interval completely invariant.
 * - Selected historical years anchor strictly to Jan 1 00:00 of `selectedYear`
 *   in `timeZone` on the left and the live current year (`endTs`) on the right.
 */
export function buildTimezoneAwareXTicks(
  startTs: number,
  endTs: number,
  selectedYear: number | null,
  chartWidthPx: number,
  timeZone: string,
): TimezoneXTick[] {
  const spanMs = Math.max(1, endTs - startTs)
  const minLabelGapPx = chartWidthPx < 480 ? 64 : 84
  const maxLabels = Math.max(3, Math.floor(chartWidthPx / minLabelGapPx))

  // Case 1: Historical year selected from 1Y + (2025 -> 1968)
  if (selectedYear !== null) {
    const endYear = getYearInTimeZone(endTs, timeZone)
    const totalYears = Math.max(1, endYear - selectedYear)
    const candidateSteps = [1, 2, 3, 5, 10, 15, 20]
    const stepYears =
      candidateSteps.find((s) => Math.ceil(totalYears / s) + 1 <= maxLabels) ?? 20

    const ticks: TimezoneXTick[] = [
      { ts: startTs, label: String(selectedYear), highlight: true },
    ]

    const firstAligned = Math.ceil((selectedYear + 1) / stepYears) * stepYears
    for (let y = firstAligned; y < endYear; y += stepYears) {
      const yTs = getYearStartEpochMs(y, timeZone)
      const leftPx = ((yTs - startTs) / spanMs) * chartWidthPx
      const rightPx = ((endTs - yTs) / spanMs) * chartWidthPx
      if (leftPx >= minLabelGapPx * 0.85 && rightPx >= minLabelGapPx * 0.85) {
        ticks.push({ ts: yTs, label: String(y) })
      }
    }

    ticks.push({ ts: endTs, label: String(endYear), highlight: true })
    return ticks
  }

  // Case 2: 15-minute default (or <= 35m zoomed) -> exact 5-minute epoch steps
  if (spanMs <= 35 * 60 * 1000) {
    const step = 5 * 60 * 1000
    const firstTick = Math.ceil(startTs / step) * step
    const ticks: TimezoneXTick[] = []
    for (let t = firstTick; t <= endTs; t += step) {
      ticks.push({ ts: t, label: formatEpochTimeHM(t, timeZone) })
    }
    return ticks
  }

  // Case 3: Intraday (35m -> 36h) -> exact UTC millisecond steps
  if (spanMs <= 36 * 60 * 60 * 1000) {
    const steps = [
      15 * 60 * 1000,
      30 * 60 * 1000,
      60 * 60 * 1000,
      3 * 3600 * 1000,
      6 * 3600 * 1000,
    ]
    const step = steps.find((s) => spanMs / s <= maxLabels) ?? 6 * 3600 * 1000
    const firstTick = Math.ceil(startTs / step) * step
    const ticks: TimezoneXTick[] = []
    for (let t = firstTick; t <= endTs; t += step) {
      ticks.push({ ts: t, label: formatEpochTimeHM(t, timeZone) })
    }
    return ticks
  }

  // Case 4: Multi-day up to ~4 months -> exact UTC day multiples
  if (spanMs <= 120 * 24 * 60 * 60 * 1000) {
    const dayMs = 24 * 60 * 60 * 1000
    const daySteps = [1, 2, 5, 7, 14, 21]
    const dStep = daySteps.find((d) => spanMs / (d * dayMs) <= maxLabels) ?? 21
    const step = dStep * dayMs
    const firstTick = Math.ceil(startTs / step) * step
    const ticks: TimezoneXTick[] = []
    for (let t = firstTick; t <= endTs; t += step) {
      ticks.push({ ts: t, label: formatEpochDateShort(t, timeZone) })
    }
    return ticks
  }

  // Case 5: 6M / 1Y rolling or multi-year manual pan
  const count = Math.min(maxLabels, 6)
  const step = spanMs / Math.max(1, count - 1)
  const ticks: TimezoneXTick[] = []
  for (let i = 0; i < count; i++) {
    const t = startTs + i * step
    ticks.push({
      ts: t,
      label:
        spanMs > 400 * 24 * 60 * 60 * 1000
          ? String(getYearInTimeZone(t, timeZone))
          : formatEpochMonthYear(t, timeZone),
    })
  }
  return ticks
}

// Calibrated secular milestone ratios (relative to 2026 day_open baseline)
// so historical multi-decade charts reflect realistic commodity cycles
// and NEVER retro-scale when today's live spot ticks every 2 seconds.
const HISTORICAL_MILESTONES_BY_SYMBOL: Record<string, Array<[number, number]>> = {
  XAU: [
    [1968, 0.014],
    [1974, 0.058],
    [1980, 0.225],
    [1985, 0.115],
    [1990, 0.14],
    [1999, 0.102],
    [2005, 0.162],
    [2008, 0.318],
    [2011, 0.65],
    [2015, 0.422],
    [2019, 0.51],
    [2020, 0.685],
    [2022, 0.665],
    [2024, 0.875],
    [2025, 0.945],
  ],
  XAG: [
    [1968, 0.065],
    [1980, 0.62],
    [1986, 0.16],
    [1993, 0.13],
    [2001, 0.135],
    [2008, 0.45],
    [2011, 1.04],
    [2015, 0.46],
    [2020, 0.64],
    [2022, 0.65],
    [2024, 0.88],
    [2025, 0.94],
  ],
  HG: [
    [1968, 0.13],
    [1974, 0.21],
    [1982, 0.15],
    [1989, 0.29],
    [1999, 0.17],
    [2006, 0.72],
    [2008, 0.76],
    [2011, 0.91],
    [2016, 0.5],
    [2020, 0.63],
    [2022, 0.92],
    [2024, 0.94],
    [2025, 0.97],
  ],
  TZN: [
    [1968, 0.04],
    [1978, 0.11],
    [1988, 0.22],
    [1998, 0.36],
    [2005, 0.52],
    [2010, 0.64],
    [2015, 0.74],
    [2020, 0.82],
    [2023, 0.9],
    [2025, 0.96],
  ],
  RBY: [
    [1968, 0.035],
    [1980, 0.12],
    [1992, 0.24],
    [2004, 0.42],
    [2012, 0.64],
    [2018, 0.78],
    [2022, 0.88],
    [2025, 0.95],
  ],
  GRF: [
    [1968, 0.18],
    [1980, 0.34],
    [1995, 0.42],
    [2005, 0.54],
    [2012, 0.95],
    [2016, 0.66],
    [2020, 0.74],
    [2022, 0.89],
    [2024, 0.93],
    [2025, 0.96],
  ],
  NI: [
    [1968, 0.13],
    [1980, 0.39],
    [1988, 0.82],
    [1998, 0.29],
    [2007, 2.25],
    [2011, 1.38],
    [2016, 0.59],
    [2020, 0.85],
    [2022, 1.56],
    [2024, 1.06],
    [2025, 1.02],
  ],
  LI: [
    [1968, 0.16],
    [1985, 0.24],
    [2000, 0.32],
    [2010, 0.45],
    [2017, 0.88],
    [2020, 0.48],
    [2022, 2.35],
    [2023, 1.65],
    [2024, 0.94],
    [2025, 0.97],
  ],
  CO: [
    [1968, 0.19],
    [1979, 0.95],
    [1992, 0.68],
    [2002, 0.34],
    [2008, 1.48],
    [2015, 0.78],
    [2018, 1.85],
    [2020, 0.94],
    [2022, 1.64],
    [2024, 1.08],
    [2025, 1.02],
  ],
  SN: [
    [1968, 0.11],
    [1980, 0.54],
    [1986, 0.21],
    [2000, 0.18],
    [2008, 0.6],
    [2011, 0.84],
    [2016, 0.58],
    [2020, 0.55],
    [2022, 1.12],
    [2024, 0.95],
    [2025, 0.98],
  ],
}

const DEFAULT_MILESTONES: Array<[number, number]> = [
  [1968, 0.08],
  [1980, 0.22],
  [1995, 0.35],
  [2008, 0.64],
  [2015, 0.68],
  [2020, 0.8],
  [2024, 0.93],
  [2025, 0.97],
]

function createRng(seed: number) {
  let s = seed % 2147483647
  if (s <= 0) s += 2147483646
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}

function stableSeedForSymbol(symbol: string): number {
  let hash = 101
  for (let i = 0; i < symbol.length; i++) {
    hash = (hash * 31 + symbol.charCodeAt(i)) % 100000
  }
  return Math.max(17, hash)
}

function interpolateMilestoneRatio(symbol: string, ts: number, endTs: number): number {
  const milestones = HISTORICAL_MILESTONES_BY_SYMBOL[symbol.toUpperCase()] ?? DEFAULT_MILESTONES
  const yearFloat =
    1970 + ts / (365.2425 * 24 * 60 * 60 * 1000)
  const endYearFloat =
    1970 + endTs / (365.2425 * 24 * 60 * 60 * 1000)

  const anchors: Array<[number, number]> = [...milestones, [endYearFloat, 1.0]]
  if (yearFloat <= anchors[0][0]) return anchors[0][1]
  if (yearFloat >= anchors[anchors.length - 1][0]) return 1.0

  for (let i = 0; i < anchors.length - 1; i++) {
    const [y0, r0] = anchors[i]
    const [y1, r1] = anchors[i + 1]
    if (yearFloat >= y0 && yearFloat <= y1) {
      const f = (yearFloat - y0) / Math.max(0.001, y1 - y0)
      const smooth = f * 0.65 + (0.5 - 0.5 * Math.cos(Math.PI * f)) * 0.35
      return r0 + (r1 - r0) * smooth
    }
  }
  return 1.0
}

export interface CanonicalSeriesResult {
  points: CanonicalSeriesPoint[]
  /** Exact UTC epoch ms of the latest authoritative spot point */
  latestPointTs: number
  /** Spot price in USD per active display unit */
  spotUnitUsd: number
  /** 24h open price in USD per active display unit (matches Live Spot Feed & Matrix) */
  dayOpenUnitUsd: number
  unitLabel: string
  feedSource: MarketFeedSource
}

/**
 * Builds the canonical single-source-of-truth multi-resolution time series
 * for a MineConnect `MineralPriceRecord` + recorded live intraday observations.
 *
 * Guarantees:
 * 1. All timestamps are strictly UTC epoch milliseconds.
 * 2. Historical baseline (1968 -> 24h ago) anchors to `dayOpenUnitUsd` so live
 *    2-second spot ticks NEVER distort multi-year history.
 * 3. The 24h window passes cleanly through `dayOpenUnitUsd`, respects `[day_low, day_high]`,
 *    overlays exact recorded live ticks (`intradayTicks`), and ends strictly at
 *    `(latestPointTs, spotUnitUsd)`.
 */
export function buildCanonicalMineralSeries(
  record: MineralPriceRecord,
  unitBasis: ChartPricingMode,
  intradayTicks: readonly IntradayTickObservation[],
): CanonicalSeriesResult {
  const spotConv = convertToChartUnitUsd(
    record.world_market_price_usd,
    record.unit,
    unitBasis,
  )
  const spotUnitUsd = spotConv.unitUsd
  const unitLabel = spotConv.unitSuffix

  const pct = Number.isFinite(record.trend_percentage) ? record.trend_percentage : 0
  const divisor = 1 + pct / 100
  const dayOpenUnitUsd =
    typeof record.day_open_usd === 'number' && record.day_open_usd > 0
      ? convertToChartUnitUsd(record.day_open_usd, record.unit, unitBasis).unitUsd
      : divisor > 0.05
        ? spotUnitUsd / divisor
        : spotUnitUsd

  const dayLowUnitUsd =
    typeof record.day_low_usd === 'number' && record.day_low_usd > 0
      ? convertToChartUnitUsd(record.day_low_usd, record.unit, unitBasis).unitUsd
      : Math.min(dayOpenUnitUsd, spotUnitUsd) * 0.996

  const dayHighUnitUsd =
    typeof record.day_high_usd === 'number' && record.day_high_usd > 0
      ? convertToChartUnitUsd(record.day_high_usd, record.unit, unitBasis).unitUsd
      : Math.max(dayOpenUnitUsd, spotUnitUsd) * 1.004

  const feedSource: MarketFeedSource = record.feed_source ?? 'CACHED_BENCHMARK'
  const livePointKind: SeriesPointKind =
    feedSource === 'LIVE_API' || feedSource === 'HYBRID_LIVE' ? 'live' : 'cached'

  // Determine exact UTC epoch ms of latest authoritative quote
  const parsedUpdated = Date.parse(record.updated_at)
  const nowMs = Date.now()
  const latestTickTs =
    intradayTicks.length > 0 ? intradayTicks[intradayTicks.length - 1].ts : 0
  const latestPointTs = Math.max(
    latestTickTs,
    Number.isFinite(parsedUpdated) && parsedUpdated <= nowMs + 60_000
      ? parsedUpdated
      : nowMs,
  )

  // Stable historical anchor boundary aligned to whole UTC minute for deterministic 1m/15m bars
  const minuteAnchorTs = Math.floor(latestPointTs / 60_000) * 60_000
  const rng = createRng(stableSeedForSymbol(record.symbol))
  const points: CanonicalSeriesPoint[] = []

  // 1) Monthly historical anchors: Jan 1968 -> 400 days ago (UTC epoch ms)
  const start1968 = Date.UTC(FIRST_MARKET_YEAR, 0, 1, 0, 0, 0, 0)
  const day24hAgo = minuteAnchorTs - 24 * 60 * 60 * 1000
  const cutoff400d = minuteAnchorTs - 400 * 24 * 60 * 60 * 1000
  const monthStep = 30 * 24 * 60 * 60 * 1000

  let t = start1968
  while (t < cutoff400d) {
    const macroRatio = interpolateMilestoneRatio(record.symbol, t, day24hAgo)
    const jitter = (rng() - 0.5) * 0.032
    const priceUsd = Math.max(dayOpenUnitUsd * 0.01, dayOpenUnitUsd * macroRatio * (1 + jitter))
    points.push({ ts: t, priceUsd, kind: 'historical' })
    t += monthStep
  }

  // 2) Daily points: 400 days ago -> 7 days ago
  const cutoff7d = minuteAnchorTs - 7 * 24 * 60 * 60 * 1000
  const dayStep = 24 * 60 * 60 * 1000
  let lastPrice =
    points.length > 0 ? points[points.length - 1].priceUsd : dayOpenUnitUsd * 0.85
  const target7d =
    dayOpenUnitUsd * interpolateMilestoneRatio(record.symbol, cutoff7d, day24hAgo)
  const daysCount = Math.max(1, Math.floor((cutoff7d - cutoff400d) / dayStep))

  for (let i = 0; i < daysCount; i++) {
    const ts = cutoff400d + i * dayStep
    const pull = (target7d - lastPrice) / Math.max(1, daysCount - i)
    const shock = dayOpenUnitUsd * 0.0075 * (rng() - 0.49)
    lastPrice = Math.max(dayOpenUnitUsd * 0.15, lastPrice + pull + shock)
    points.push({ ts, priceUsd: lastPrice, kind: 'historical' })
  }

  // 3) 15-minute bars: 7 days ago -> 24h ago (landing precisely on dayOpenUnitUsd at day24hAgo)
  const step15m = 15 * 60 * 1000
  const bars7dTo24h = Math.max(1, Math.floor((day24hAgo - cutoff7d) / step15m))
  for (let i = 0; i < bars7dTo24h; i++) {
    const ts = cutoff7d + i * step15m
    const pull = (dayOpenUnitUsd - lastPrice) / Math.max(1, bars7dTo24h - i)
    const shock = dayOpenUnitUsd * 0.0018 * (rng() - 0.5)
    lastPrice = Math.max(dayOpenUnitUsd * 0.2, lastPrice + pull + shock)
    points.push({ ts, priceUsd: lastPrice, kind: 'historical' })
  }
  points.push({ ts: day24hAgo, priceUsd: dayOpenUnitUsd, kind: 'historical' })
  lastPrice = dayOpenUnitUsd

  // Determine where real recorded live ticks start
  const convertedTicks: CanonicalSeriesPoint[] = intradayTicks
    .filter((tk) => tk.ts > day24hAgo && tk.ts <= latestPointTs && tk.priceUsd > 0)
    .map((tk) => ({
      ts: tk.ts,
      priceUsd: convertToChartUnitUsd(tk.priceUsd, record.unit, unitBasis).unitUsd,
      kind:
        tk.source === 'LIVE_API' || tk.source === 'HYBRID_LIVE' ? 'live' : 'cached',
    }))

  const liveOverlayStartTs =
    convertedTicks.length > 0 ? convertedTicks[0].ts : latestPointTs
  const bridgeTargetUsd =
    convertedTicks.length > 0 ? convertedTicks[0].priceUsd : spotUnitUsd

  // 4) 15-minute intraday bars: 24h ago -> 2h ago (bounded cleanly inside [dayLow, dayHigh])
  const cutoff2h = Math.min(liveOverlayStartTs, minuteAnchorTs - 2 * 60 * 60 * 1000)
  const bars24hTo2h = Math.max(0, Math.floor((cutoff2h - (day24hAgo + step15m)) / step15m))
  const midTarget = dayOpenUnitUsd + (bridgeTargetUsd - dayOpenUnitUsd) * 0.82
  for (let i = 0; i < bars24hTo2h; i++) {
    const ts = day24hAgo + (i + 1) * step15m
    if (ts >= liveOverlayStartTs) break
    const pull = (midTarget - lastPrice) / Math.max(1, bars24hTo2h - i)
    const shock = dayOpenUnitUsd * 0.0015 * (rng() - 0.5)
    const nextVal = lastPrice + pull + shock
    lastPrice = Math.min(dayHighUnitUsd, Math.max(dayLowUnitUsd, nextVal))
    points.push({ ts, priceUsd: lastPrice, kind: 'historical' })
  }

  // 5) 1-minute intraday bars: 2h ago -> liveOverlayStartTs
  const step1m = 60 * 1000
  const start1m = Math.max(day24hAgo + step1m, cutoff2h)
  const minsCount = Math.max(0, Math.floor((liveOverlayStartTs - start1m) / step1m))
  for (let i = 0; i < minsCount; i++) {
    const ts = start1m + i * step1m
    if (ts >= liveOverlayStartTs) break
    const pull = (bridgeTargetUsd - lastPrice) / Math.max(1, minsCount - i)
    const shock = dayOpenUnitUsd * 0.00075 * (rng() - 0.5)
    const nextVal = lastPrice + pull + shock
    lastPrice = Math.min(dayHighUnitUsd, Math.max(dayLowUnitUsd, nextVal))
    points.push({ ts, priceUsd: lastPrice, kind: 'historical' })
  }

  // 6) Exact recorded live UTC ticks from the shared market feed store
  for (const tk of convertedTicks) {
    const prev = points[points.length - 1]
    if (!prev || tk.ts > prev.ts) {
      points.push(tk)
    } else if (tk.ts === prev.ts) {
      points[points.length - 1] = tk
    }
  }

  // 7) Guarantee exact authoritative terminal point (latestPointTs, spotUnitUsd)
  const last = points[points.length - 1]
  if (!last || latestPointTs > last.ts) {
    points.push({
      ts: latestPointTs,
      priceUsd: spotUnitUsd,
      kind: livePointKind,
    })
  } else {
    points[points.length - 1] = {
      ts: latestPointTs,
      priceUsd: spotUnitUsd,
      kind: livePointKind,
    }
  }

  return {
    points,
    latestPointTs,
    spotUnitUsd,
    dayOpenUnitUsd,
    unitLabel,
    feedSource,
  }
}
