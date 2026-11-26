'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  acquireLiveMarketStream,
  getMarketFeedFreshness,
  getMineralIntradayTicks,
  getStoredMineralPrices,
  subscribeMineralPrices,
} from '../data/mineralPrices'
import {
  FALLBACK_RATES_PER_USD,
  type FxRatesSource,
} from '../lib/currency'
import {
  FIRST_MARKET_YEAR,
  buildCanonicalMineralSeries,
  buildTimeZoneOptions,
  buildTimezoneAwareXTicks,
  detectLocalTimeZone,
  formatEpochReadout,
  getTimeZoneAbbreviation,
  getYearInTimeZone,
  getYearStartEpochMs,
  isValidIanaTimeZone,
  type CanonicalSeriesPoint,
  type SeriesPointKind,
} from '../lib/marketSeries'
import type { ChartPricingMode } from '../lib/mineralHistory'
import type {
  MarketFeedSource,
  MarketSyncTelemetry,
  MineralPriceRecord,
} from '../types/database'

export type CurrencyCode = 'TZS' | 'USD' | 'EUR'
export type PresetRangeKey = '15m' | '1D' | '5D' | '1M' | '3M' | '6M' | '1Y'

export interface MineralAssetConfig {
  id: string
  symbol: string
  name: string
  unitLabel: string
  spotUsd: number
  prevCloseUsd: number
  seed: number
}

export interface CustomDisplayCurrency {
  code: string
  symbol: string
  rateFromUsd: number
  zeroDecimal?: boolean
}

export interface FxFreshnessMetadata {
  source: FxRatesSource
  provider: string
  fetchedAtMs: number | null
}

export interface MarketTrendChartProps {
  /** Authoritative live MineralPriceRecord list from MineConnect / Supabase store */
  records?: MineralPriceRecord[]
  /** Master pricing unit basis ('metric_local' /g,/kg,/ct vs 'standard' /toz,/lb,/t) */
  unitBasis?: ChartPricingMode
  /** Optional live sync telemetry from MineralPricesBoard / market-sync */
  telemetry?: MarketSyncTelemetry | null
  /** Optional custom asset overrides (only used when records are not provided) */
  minerals?: MineralAssetConfig[]
  initialMineralId?: string
  selectedMineralId?: string
  onMineralChange?: (mineralId: string) => void
  currency?: CurrencyCode
  fxRatesFromUsd?: Record<CurrencyCode, number>
  fxFreshness?: FxFreshnessMetadata | null
  onCurrencyChange?: (currency: CurrencyCode) => void
  /** Optional non-TZS/USD/EUR currency synchronized from global app localization */
  customCurrency?: CustomDisplayCurrency | null
  /** Optional controlled IANA time zone (e.g. 'Africa/Dar_es_Salaam', 'UTC', 'Europe/London', 'America/New_York') */
  timeZone?: string
  onTimeZoneChange?: (timeZone: string) => void
  /** When embedded inside an existing page container (e.g. /markets), omits outer section padding */
  embedded?: boolean
}

const MIN_SPAN_MS = 5 * 60 * 1000 // 5 minutes minimum zoom span

const PRESET_DURATIONS_MS: Record<PresetRangeKey, number> = {
  '15m': 15 * 60 * 1000,
  '1D': 24 * 60 * 60 * 1000,
  '5D': 5 * 24 * 60 * 60 * 1000,
  '1M': 30 * 24 * 60 * 60 * 1000,
  '3M': 90 * 24 * 60 * 60 * 1000,
  '6M': 180 * 24 * 60 * 60 * 1000,
  '1Y': 365 * 24 * 60 * 60 * 1000,
}

const DEFAULT_FX_FALLBACK: Record<CurrencyCode, number> = {
  TZS: FALLBACK_RATES_PER_USD.TZS,
  USD: 1,
  EUR: FALLBACK_RATES_PER_USD.EUR,
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, width, height, radius)
    return
  }
  const r = Math.min(radius, width / 2, height / 2)
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + width, y, x + width, y + height, r)
  ctx.arcTo(x + width, y + height, x, y + height, r)
  ctx.arcTo(x, y + height, x, y, r)
  ctx.arcTo(x, y, x + width, y, r)
  ctx.closePath()
}

function computeNiceYScale(minVal: number, maxVal: number, targetTicks = 6) {
  let rawMin = minVal
  let rawMax = maxVal
  if (!Number.isFinite(rawMin) || !Number.isFinite(rawMax)) {
    rawMin = 0
    rawMax = 100
  }
  if (Math.abs(rawMax - rawMin) < 1e-9) {
    const pad = Math.max(Math.abs(rawMax) * 0.01, 1)
    rawMin -= pad
    rawMax += pad
  }

  const span = rawMax - rawMin
  const paddedMin = Math.max(0, rawMin - span * 0.08)
  const paddedMax = rawMax + span * 0.08
  const roughStep = (paddedMax - paddedMin) / Math.max(2, targetTicks - 1)

  const mag = Math.pow(10, Math.floor(Math.log10(roughStep)))
  const norm = roughStep / mag
  let niceNorm = 1
  if (norm <= 1) niceNorm = 1
  else if (norm <= 2) niceNorm = 2
  else if (norm <= 2.5) niceNorm = 2.5
  else if (norm <= 5) niceNorm = 5
  else niceNorm = 10

  const step = niceNorm * mag
  const niceMin = Math.floor(paddedMin / step) * step
  const niceMax = Math.ceil(paddedMax / step) * step

  const ticks: number[] = []
  for (let v = niceMin; v <= niceMax + step * 0.25; v += step) {
    ticks.push(Number(v.toFixed(6)))
  }

  return { min: niceMin, max: niceMax, ticks }
}

function formatPrice(
  val: number,
  currency: CurrencyCode,
  compactAxis = false,
  customCurrency?: CustomDisplayCurrency | null,
): string {
  if (customCurrency) {
    if (customCurrency.zeroDecimal) {
      if (compactAxis && val >= 1_000_000) {
        return `${(val / 1_000_000).toFixed(2)}M`
      }
      const rounded = val >= 100 ? Math.round(val) : Number(val.toFixed(2))
      return `${compactAxis ? '' : customCurrency.symbol}${rounded.toLocaleString('en-US')}`
    }
    const decimals = val >= 100 ? 2 : val >= 10 ? 3 : 4
    return `${compactAxis ? '' : customCurrency.symbol}${val.toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })}`
  }

  const prefix = currency === 'TZS' ? 'TSh ' : currency === 'USD' ? '$' : '€'
  if (currency === 'TZS') {
    if (compactAxis && val >= 1_000_000) {
      return `${(val / 1_000_000).toFixed(2)}M`
    }
    const rounded = val >= 100 ? Math.round(val) : Number(val.toFixed(2))
    return `${compactAxis ? '' : prefix}${rounded.toLocaleString('en-US')}`
  }
  const decimals = val >= 100 ? 2 : val >= 10 ? 3 : 4
  return `${compactAxis ? '' : prefix}${val.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`
}

/** Binary-search exact interpolated price at an arbitrary UTC epoch timestamp */
function samplePriceAtEpoch(
  series: readonly CanonicalSeriesPoint[],
  targetTs: number,
): CanonicalSeriesPoint {
  if (series.length === 0) {
    return { ts: targetTs, priceUsd: 0, kind: 'historical' }
  }
  if (targetTs <= series[0].ts) return series[0]
  const last = series[series.length - 1]
  if (targetTs >= last.ts) return last

  let lo = 0
  let hi = series.length - 1
  while (lo + 1 < hi) {
    const mid = (lo + hi) >> 1
    if (series[mid].ts <= targetTs) lo = mid
    else hi = mid
  }

  const a = series[lo]
  const b = series[hi]
  if (a.ts === targetTs) return a
  if (b.ts === targetTs) return b

  const frac = (targetTs - a.ts) / Math.max(1, b.ts - a.ts)
  return {
    ts: targetTs,
    priceUsd: a.priceUsd + (b.priceUsd - a.priceUsd) * frac,
    kind: b.kind === 'live' && a.kind === 'live' ? 'live' : a.kind,
  }
}

/** Slices series cleanly to [startTs, endTs] with exact boundary interpolation */
function sliceSeriesWithBoundaries(
  series: readonly CanonicalSeriesPoint[],
  startTs: number,
  endTs: number,
): CanonicalSeriesPoint[] {
  if (series.length === 0) return []
  const inside = series.filter((p) => p.ts > startTs && p.ts < endTs)
  const leftPt = samplePriceAtEpoch(series, startTs)
  const rightPt = samplePriceAtEpoch(series, endTs)

  const result: CanonicalSeriesPoint[] = [{ ...leftPt, ts: startTs }]
  for (const pt of inside) {
    result.push(pt)
  }
  if (endTs > startTs) {
    result.push({ ...rightPt, ts: endTs })
  }
  return result
}

function adaptAssetConfigToRecord(asset: MineralAssetConfig): MineralPriceRecord {
  const pct =
    asset.prevCloseUsd > 0
      ? Number((((asset.spotUsd - asset.prevCloseUsd) / asset.prevCloseUsd) * 100).toFixed(2))
      : 0
  const cleanUnit = asset.unitLabel.replace(/^\//, '').trim() || 'g'
  return {
    id: asset.id,
    mineral_name: asset.name,
    symbol: asset.symbol,
    category: 'Precious Metals',
    unit: `USD/${cleanUnit}`,
    purity_note: '',
    world_market_price_usd: asset.spotUsd,
    local_market_price_usd: asset.spotUsd * 0.93,
    buying_centre_price_usd: asset.spotUsd * 0.89,
    royalty_rate_pct: 6,
    trend_percentage: pct,
    day_open_usd: asset.prevCloseUsd,
    feed_source: 'CACHED_BENCHMARK',
    sparkline_points: [asset.prevCloseUsd, asset.spotUsd],
    updated_at: new Date().toISOString(),
  }
}

function describePointKind(kind: SeriesPointKind): string {
  if (kind === 'live') return 'Live point'
  if (kind === 'cached') return 'Cached quote'
  return 'Historical series'
}

export const MarketTrendChart: React.FC<MarketTrendChartProps> = ({
  records: controlledRecords,
  unitBasis = 'metric_local',
  telemetry: controlledTelemetry,
  minerals: customAssets,
  initialMineralId,
  selectedMineralId: controlledMineralId,
  onMineralChange,
  currency: controlledCurrency,
  fxRatesFromUsd = DEFAULT_FX_FALLBACK,
  fxFreshness = null,
  onCurrencyChange,
  customCurrency = null,
  timeZone: controlledTimeZone,
  onTimeZoneChange,
  embedded = false,
}) => {
  // Single-source store subscription so standalone & embedded instances share the exact live feed
  const [storeRecords, setStoreRecords] = useState<MineralPriceRecord[]>(() =>
    controlledRecords && controlledRecords.length > 0
      ? controlledRecords
      : getStoredMineralPrices(),
  )
  const [storeFreshness, setStoreFreshness] = useState(() =>
    getMarketFeedFreshness(),
  )
  const [tickRevision, setTickRevision] = useState(0)

  useEffect(() => {
    const release = acquireLiveMarketStream()
    const syncFromStore = () => {
      if (!controlledRecords || controlledRecords.length === 0) {
        setStoreRecords(getStoredMineralPrices())
      }
      setStoreFreshness(getMarketFeedFreshness())
      setTickRevision((n) => n + 1)
    }
    const unsub = subscribeMineralPrices(syncFromStore)
    return () => {
      unsub()
      release()
    }
  }, [controlledRecords])

  const activeRecords = useMemo<MineralPriceRecord[]>(() => {
    if (controlledRecords && controlledRecords.length > 0) return controlledRecords
    if (customAssets && customAssets.length > 0) {
      return customAssets.map(adaptAssetConfigToRecord)
    }
    return storeRecords.length > 0 ? storeRecords : getStoredMineralPrices()
  }, [controlledRecords, customAssets, storeRecords])

  const effectiveUnitBasis: ChartPricingMode =
    !controlledRecords && customAssets && customAssets.length > 0
      ? 'standard'
      : unitBasis

  const activeTelemetry = controlledTelemetry ?? storeFreshness.telemetry

  // Mineral selection state
  const [internalMineralId, setInternalMineralId] = useState<string>(
    () =>
      controlledMineralId ??
      initialMineralId ??
      activeRecords[0]?.symbol ??
      'XAU',
  )
  const selectedMineralId = controlledMineralId ?? internalMineralId

  // Currency state
  const [internalCurrency, setInternalCurrency] = useState<CurrencyCode>('TZS')
  const currency = controlledCurrency ?? internalCurrency

  // Timezone state (defaults to browser local IANA timezone or Africa/Dar_es_Salaam)
  const timeZoneOptions = useMemo(() => buildTimeZoneOptions(), [])
  const [internalTimeZone, setInternalTimeZone] = useState<string>(() =>
    detectLocalTimeZone(),
  )
  const timeZone =
    controlledTimeZone && isValidIanaTimeZone(controlledTimeZone)
      ? controlledTimeZone
      : internalTimeZone

  const activeRecord = useMemo(
    () =>
      activeRecords.find(
        (r) =>
          r.symbol.toUpperCase() === selectedMineralId.toUpperCase() ||
          r.id === selectedMineralId,
      ) ?? activeRecords[0],
    [activeRecords, selectedMineralId],
  )

  // Canonical single-source multi-resolution series (strictly UTC epoch ms internally)
  const canonicalSeries = useMemo(() => {
    const ticks = activeRecord ? getMineralIntradayTicks(activeRecord.symbol) : []
    return buildCanonicalMineralSeries(activeRecord, effectiveUnitBasis, ticks)
    // tickRevision ensures newly recorded live ticks trigger immediate redraw
  }, [activeRecord, effectiveUnitBasis, tickRevision])

  const {
    points: series,
    latestPointTs,
    spotUnitUsd,
    dayOpenUnitUsd,
    unitLabel,
    feedSource,
  } = canonicalSeries

  const earliestTs = series[0]?.ts ?? Date.UTC(FIRST_MARKET_YEAR, 0, 1)
  const currentYearInTz = useMemo(
    () => getYearInTimeZone(latestPointTs, timeZone),
    [latestPointTs, timeZone],
  )

  const [activePreset, setActivePreset] = useState<PresetRangeKey | null>('15m')
  const [selectedStartYear, setSelectedStartYear] = useState<number | null>(null)
  const [yearMenuOpen, setYearMenuOpen] = useState(false)
  const [isFullChart, setIsFullChart] = useState(false)

  // Active viewport [start, end] stored strictly in UTC epoch milliseconds
  const [viewRange, setViewRange] = useState<{ start: number; end: number }>(() => ({
    start: latestPointTs - PRESET_DURATIONS_MS['15m'],
    end: latestPointTs,
  }))

  // Keep live right-edge tracking smooth when new quotes arrive or time zone changes on a selected year
  useEffect(() => {
    if (selectedStartYear !== null) {
      const yrStart = Math.max(
        earliestTs,
        getYearStartEpochMs(selectedStartYear, timeZone),
      )
      setViewRange({ start: yrStart, end: latestPointTs })
    } else if (activePreset !== null) {
      const span = PRESET_DURATIONS_MS[activePreset]
      setViewRange({
        start: Math.max(earliestTs, latestPointTs - span),
        end: latestPointTs,
      })
    }
  }, [latestPointTs, activePreset, selectedStartYear, timeZone, earliestTs])

  const [hoverIndex, setHoverIndex] = useState<number | null>(null)
  const [canvasSize, setCanvasSize] = useState({ width: 720, height: 420 })

  const containerRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const yearPopoverRef = useRef<HTMLDivElement | null>(null)

  const dragStateRef = useRef<{
    isDragging: boolean
    startX: number
    origStart: number
    origEnd: number
  }>({ isDragging: false, startX: 0, origStart: 0, origEnd: 0 })

  const pinchStateRef = useRef<{
    initialDist: number
    origStart: number
    origEnd: number
    centerRatio: number
  } | null>(null)

  const fx = customCurrency
    ? customCurrency.rateFromUsd
    : (fxRatesFromUsd[currency] ?? 1)

  const selectableYears = useMemo(() => {
    const list: number[] = []
    for (let y = currentYearInTz - 1; y >= FIRST_MARKET_YEAR; y--) {
      list.push(y)
    }
    return list
  }, [currentYearInTz])

  useEffect(() => {
    if (!yearMenuOpen) return
    const handleOutside = (e: MouseEvent) => {
      if (
        yearPopoverRef.current &&
        !yearPopoverRef.current.contains(e.target as Node)
      ) {
        setYearMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [yearMenuOpen])

  useEffect(() => {
    if (!isFullChart) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsFullChart(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isFullChart])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect
        if (width > 0 && height > 0) {
          setCanvasSize({ width: Math.floor(width), height: Math.floor(height) })
        }
      }
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [isFullChart])

  const handleSelectMineral = (nextSymbol: string) => {
    setInternalMineralId(nextSymbol)
    setHoverIndex(null)
    onMineralChange?.(nextSymbol)
  }

  const handleSelectCurrency = (next: CurrencyCode) => {
    setInternalCurrency(next)
    onCurrencyChange?.(next)
  }

  const handleSelectTimeZone = (nextTz: string) => {
    if (!isValidIanaTimeZone(nextTz)) return
    setInternalTimeZone(nextTz)
    onTimeZoneChange?.(nextTz)
  }

  const handleSelectPreset = (preset: PresetRangeKey) => {
    setActivePreset(preset)
    setSelectedStartYear(null)
    setYearMenuOpen(false)
    setHoverIndex(null)
    setViewRange({
      start: Math.max(earliestTs, latestPointTs - PRESET_DURATIONS_MS[preset]),
      end: latestPointTs,
    })
  }

  const handleSelectHistoricalYear = (year: number) => {
    const startTs = Math.max(earliestTs, getYearStartEpochMs(year, timeZone))
    setSelectedStartYear(year)
    setActivePreset(null)
    setYearMenuOpen(false)
    setHoverIndex(null)
    setViewRange({
      start: startTs,
      end: latestPointTs,
    })
  }

  const visiblePoints = useMemo(
    () => sliceSeriesWithBoundaries(series, viewRange.start, viewRange.end),
    [series, viewRange.start, viewRange.end],
  )

  const periodStats = useMemo(() => {
    const openUsd =
      activePreset === '1D' && selectedStartYear === null
        ? dayOpenUnitUsd
        : (visiblePoints[0]?.priceUsd ?? dayOpenUnitUsd)
    const endUsd =
      activePreset !== null || selectedStartYear !== null
        ? spotUnitUsd
        : (visiblePoints[visiblePoints.length - 1]?.priceUsd ?? spotUnitUsd)
    const diffUsd = endUsd - openUsd
    const pct = openUsd > 0 ? (diffUsd / openUsd) * 100 : 0
    return {
      openUsd,
      openLocal: openUsd * fx,
      currentLocal: endUsd * fx,
      diffLocal: diffUsd * fx,
      pct,
      isPositive: diffUsd >= 0,
    }
  }, [
    activePreset,
    selectedStartYear,
    dayOpenUnitUsd,
    visiblePoints,
    spotUnitUsd,
    fx,
  ])

  const presetDeltas = useMemo(() => {
    const out = {} as Record<PresetRangeKey, number>
    ;(Object.keys(PRESET_DURATIONS_MS) as PresetRangeKey[]).forEach((key) => {
      if (key === '1D') {
        out[key] =
          dayOpenUnitUsd > 0
            ? ((spotUnitUsd - dayOpenUnitUsd) / dayOpenUnitUsd) * 100
            : 0
        return
      }
      const targetStart = Math.max(
        earliestTs,
        latestPointTs - PRESET_DURATIONS_MS[key],
      )
      const base = samplePriceAtEpoch(series, targetStart).priceUsd || spotUnitUsd
      out[key] = base > 0 ? ((spotUnitUsd - base) / base) * 100 : 0
    })
    return out
  }, [series, earliestTs, latestPointTs, spotUnitUsd, dayOpenUnitUsd])

  const zoomAroundRatio = useCallback(
    (scaleFactor: number, anchorRatio: number) => {
      setSelectedStartYear(null)
      setActivePreset(null)
      setViewRange((prev) => {
        const span = prev.end - prev.start
        const maxSpan = latestPointTs - earliestTs
        const nextSpan = Math.min(maxSpan, Math.max(MIN_SPAN_MS, span * scaleFactor))
        const anchorTs = prev.start + span * anchorRatio
        let nextStart = anchorTs - nextSpan * anchorRatio
        let nextEnd = nextStart + nextSpan

        if (nextEnd > latestPointTs) {
          nextEnd = latestPointTs
          nextStart = Math.max(earliestTs, nextEnd - nextSpan)
        }
        if (nextStart < earliestTs) {
          nextStart = earliestTs
          nextEnd = Math.min(latestPointTs, nextStart + nextSpan)
        }
        return { start: nextStart, end: nextEnd }
      })
    },
    [latestPointTs, earliestTs],
  )

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const onNativeWheel = (e: WheelEvent) => {
      e.preventDefault()
      const rect = canvas.getBoundingClientRect()
      const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width))
      const factor = e.deltaY > 0 ? 1.18 : 0.84
      zoomAroundRatio(factor, ratio)
    }
    canvas.addEventListener('wheel', onNativeWheel, { passive: false })
    return () => canvas.removeEventListener('wheel', onNativeWheel)
  }, [zoomAroundRatio])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    if (visiblePoints.length < 2) return

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const { width, height } = canvasSize
    canvas.width = width * dpr
    canvas.height = height * dpr
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    const isMobile = width < 640
    const rightAxisWidth = isMobile ? 76 : 96
    const bottomAxisHeight = 32
    const topPad = 14
    const leftPad = isMobile ? 8 : 14

    const plotLeft = leftPad
    const plotRight = Math.max(plotLeft + 70, width - rightAxisWidth)
    const plotTop = topPad
    const plotBottom = Math.max(plotTop + 100, height - bottomAxisHeight)
    const plotWidth = plotRight - plotLeft
    const plotHeight = plotBottom - plotTop

    ctx.clearRect(0, 0, width, height)

    let minPrice = Infinity
    let maxPrice = -Infinity
    for (const pt of visiblePoints) {
      const val = pt.priceUsd * fx
      if (val < minPrice) minPrice = val
      if (val > maxPrice) maxPrice = val
    }
    const openLocal = periodStats.openLocal
    minPrice = Math.min(minPrice, openLocal)
    maxPrice = Math.max(maxPrice, openLocal)

    const yScale = computeNiceYScale(minPrice, maxPrice, isMobile ? 5 : 7)
    const ySpan = Math.max(1e-9, yScale.max - yScale.min)

    const xSpan = Math.max(1, viewRange.end - viewRange.start)
    const toX = (ts: number) => plotLeft + ((ts - viewRange.start) / xSpan) * plotWidth
    const toY = (val: number) =>
      plotBottom - ((val - yScale.min) / ySpan) * plotHeight

    ctx.font = `500 ${isMobile ? 10.5 : 11.5}px ui-monospace, SFMono-Regular, Menlo, monospace`
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'

    for (const tickVal of yScale.ticks) {
      const y = toY(tickVal)
      if (y < plotTop - 4 || y > plotBottom + 4) continue

      ctx.beginPath()
      ctx.strokeStyle = 'rgba(24, 24, 27, 0.07)'
      ctx.lineWidth = 1
      ctx.moveTo(plotLeft, y)
      ctx.lineTo(plotRight, y)
      ctx.stroke()

      ctx.fillStyle = '#52525B'
      ctx.fillText(
        formatPrice(tickVal, currency, true, customCurrency),
        plotRight + 8,
        y,
      )
    }

    const xTicks = buildTimezoneAwareXTicks(
      viewRange.start,
      viewRange.end,
      selectedStartYear,
      plotWidth,
      timeZone,
    )

    ctx.textBaseline = 'top'
    xTicks.forEach((tick, idx) => {
      const x = toX(tick.ts)
      if (x < plotLeft - 2 || x > plotRight + 2) return

      ctx.beginPath()
      ctx.strokeStyle = 'rgba(24, 24, 27, 0.05)'
      ctx.lineWidth = 1
      ctx.moveTo(x, plotTop)
      ctx.lineTo(x, plotBottom)
      ctx.stroke()

      if (idx === 0) ctx.textAlign = 'left'
      else if (idx === xTicks.length - 1) ctx.textAlign = 'right'
      else ctx.textAlign = 'center'

      ctx.font = tick.highlight
        ? `700 ${isMobile ? 10.5 : 11.5}px ui-monospace, SFMono-Regular, Menlo, monospace`
        : `500 ${isMobile ? 10.5 : 11.5}px ui-monospace, SFMono-Regular, Menlo, monospace`
      ctx.fillStyle =
        tick.highlight && idx === xTicks.length - 1 ? '#B85D19' : '#3F3F46'
      ctx.fillText(tick.label, x, plotBottom + 9)
    })

    const refY = toY(openLocal)
    if (refY >= plotTop && refY <= plotBottom) {
      ctx.save()
      ctx.setLineDash([3, 4])
      ctx.strokeStyle = 'rgba(82, 82, 91, 0.45)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(plotLeft, refY)
      ctx.lineTo(plotRight, refY)
      ctx.stroke()
      ctx.restore()
    }

    const lineColor = periodStats.isPositive ? '#15803D' : '#C2410C'
    const fillTopColor = periodStats.isPositive
      ? 'rgba(21, 128, 61, 0.16)'
      : 'rgba(184, 93, 25, 0.16)'
    const fillBottomColor = periodStats.isPositive
      ? 'rgba(21, 128, 61, 0.0)'
      : 'rgba(184, 93, 25, 0.0)'

    ctx.save()
    ctx.beginPath()
    ctx.rect(plotLeft, plotTop, plotWidth, plotHeight)
    ctx.clip()

    const grad = ctx.createLinearGradient(0, plotTop, 0, plotBottom)
    grad.addColorStop(0, fillTopColor)
    grad.addColorStop(1, fillBottomColor)

    ctx.beginPath()
    visiblePoints.forEach((pt, idx) => {
      const x = toX(pt.ts)
      const y = toY(pt.priceUsd * fx)
      if (idx === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    })

    const lastPt = visiblePoints[visiblePoints.length - 1]
    const firstPt = visiblePoints[0]
    ctx.lineTo(toX(lastPt.ts), plotBottom)
    ctx.lineTo(toX(firstPt.ts), plotBottom)
    ctx.closePath()
    ctx.fillStyle = grad
    ctx.fill()

    ctx.beginPath()
    visiblePoints.forEach((pt, idx) => {
      const x = toX(pt.ts)
      const y = toY(pt.priceUsd * fx)
      if (idx === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    })
    ctx.strokeStyle = lineColor
    ctx.lineWidth = 2.2
    ctx.lineJoin = 'round'
    ctx.stroke()
    ctx.restore()

    const latestX = toX(lastPt.ts)
    const latestY = Math.min(
      plotBottom,
      Math.max(plotTop, toY(periodStats.currentLocal)),
    )

    if (latestX >= plotLeft && latestX <= plotRight + 2) {
      ctx.beginPath()
      ctx.arc(latestX, latestY, 4, 0, Math.PI * 2)
      ctx.fillStyle = lineColor
      ctx.fill()
      ctx.lineWidth = 2
      ctx.strokeStyle = '#FAF8F5'
      ctx.stroke()
    }

    const badgeH = 21
    const badgeW = rightAxisWidth - 6
    const badgeY = Math.min(
      plotBottom - badgeH / 2,
      Math.max(plotTop + badgeH / 2, latestY),
    )
    ctx.fillStyle = lineColor
    ctx.beginPath()
    drawRoundedRect(ctx, plotRight + 4, badgeY - badgeH / 2, badgeW, badgeH, 5)
    ctx.fill()

    ctx.fillStyle = '#FFFFFF'
    ctx.font = `700 ${isMobile ? 10 : 11}px ui-monospace, SFMono-Regular, Menlo, monospace`
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillText(
      formatPrice(periodStats.currentLocal, currency, true, customCurrency),
      plotRight + 8,
      badgeY,
    )

    if (hoverIndex !== null && visiblePoints[hoverIndex]) {
      const hPt = visiblePoints[hoverIndex]
      const hx = toX(hPt.ts)
      const hy = toY(hPt.priceUsd * fx)

      ctx.save()
      ctx.setLineDash([4, 4])
      ctx.strokeStyle = 'rgba(24, 24, 27, 0.45)'
      ctx.lineWidth = 1

      ctx.beginPath()
      ctx.moveTo(hx, plotTop)
      ctx.lineTo(hx, plotBottom)
      ctx.stroke()

      ctx.beginPath()
      ctx.moveTo(plotLeft, hy)
      ctx.lineTo(plotRight, hy)
      ctx.stroke()
      ctx.restore()

      ctx.beginPath()
      ctx.arc(hx, hy, 4.5, 0, Math.PI * 2)
      ctx.fillStyle = '#18181B'
      ctx.fill()
      ctx.lineWidth = 2
      ctx.strokeStyle = '#FAF8F5'
      ctx.stroke()
    }
  }, [
    canvasSize,
    visiblePoints,
    viewRange,
    fx,
    currency,
    customCurrency,
    periodStats,
    selectedStartYear,
    timeZone,
    hoverIndex,
  ])

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    dragStateRef.current = {
      isDragging: true,
      startX: e.clientX,
      origStart: viewRange.start,
      origEnd: viewRange.end,
    }
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const isMobile = rect.width < 640
    const plotLeft = isMobile ? 8 : 14
    const plotRight = rect.width - (isMobile ? 76 : 96)
    const plotWidth = Math.max(70, plotRight - plotLeft)

    if (dragStateRef.current.isDragging) {
      const dx = e.clientX - dragStateRef.current.startX
      if (Math.abs(dx) > 3) {
        setSelectedStartYear(null)
        setActivePreset(null)
        const span = dragStateRef.current.origEnd - dragStateRef.current.origStart
        const deltaTs = -(dx / plotWidth) * span
        let nextStart = dragStateRef.current.origStart + deltaTs
        let nextEnd = dragStateRef.current.origEnd + deltaTs

        if (nextEnd > latestPointTs) {
          nextEnd = latestPointTs
          nextStart = nextEnd - span
        }
        if (nextStart < earliestTs) {
          nextStart = earliestTs
          nextEnd = nextStart + span
        }
        setViewRange({ start: nextStart, end: nextEnd })
      }
    }

    const relX = Math.min(
      1,
      Math.max(0, (e.clientX - rect.left - plotLeft) / plotWidth),
    )
    const targetTs = viewRange.start + relX * (viewRange.end - viewRange.start)
    let nearestIdx = 0
    let bestDiff = Infinity
    for (let i = 0; i < visiblePoints.length; i++) {
      const diff = Math.abs(visiblePoints[i].ts - targetTs)
      if (diff < bestDiff) {
        bestDiff = diff
        nearestIdx = i
      }
    }
    setHoverIndex(nearestIdx)
  }

  const handlePointerUp = () => {
    dragStateRef.current.isDragging = false
  }

  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX
      const dy = e.touches[0].clientY - e.touches[1].clientY
      const rect = e.currentTarget.getBoundingClientRect()
      const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2
      pinchStateRef.current = {
        initialDist: Math.max(1, Math.hypot(dx, dy)),
        origStart: viewRange.start,
        origEnd: viewRange.end,
        centerRatio: Math.min(1, Math.max(0, (midX - rect.left) / rect.width)),
      }
    }
  }

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 2 && pinchStateRef.current) {
      const dx = e.touches[0].clientX - e.touches[1].clientX
      const dy = e.touches[0].clientY - e.touches[1].clientY
      const dist = Math.max(1, Math.hypot(dx, dy))
      const scale = pinchStateRef.current.initialDist / dist
      const { origStart, origEnd, centerRatio } = pinchStateRef.current

      setSelectedStartYear(null)
      setActivePreset(null)

      const origSpan = origEnd - origStart
      const maxSpan = latestPointTs - earliestTs
      const nextSpan = Math.min(maxSpan, Math.max(MIN_SPAN_MS, origSpan * scale))
      const anchorTs = origStart + origSpan * centerRatio
      let nextStart = anchorTs - nextSpan * centerRatio
      let nextEnd = nextStart + nextSpan

      if (nextEnd > latestPointTs) {
        nextEnd = latestPointTs
        nextStart = Math.max(earliestTs, nextEnd - nextSpan)
      }
      if (nextStart < earliestTs) {
        nextStart = earliestTs
        nextEnd = Math.min(latestPointTs, nextStart + nextSpan)
      }
      setViewRange({ start: nextStart, end: nextEnd })
    }
  }

  const handleTouchEnd = () => {
    pinchStateRef.current = null
  }

  const hoveredPoint = hoverIndex !== null ? visiblePoints[hoverIndex] : null
  const activeDisplayPrice = hoveredPoint
    ? hoveredPoint.priceUsd * fx
    : periodStats.currentLocal
  const activeDisplayPct = hoveredPoint
    ? periodStats.openUsd > 0
      ? ((hoveredPoint.priceUsd - periodStats.openUsd) / periodStats.openUsd) * 100
      : 0
    : periodStats.pct
  const activeIsPositive = activeDisplayPct >= 0

  const latestRefLabel = formatEpochReadout(latestPointTs, timeZone, true)
  const activeTzAbbr = getTimeZoneAbbreviation(latestPointTs, timeZone)

  const feedBadge = useMemo<{
    label: string
    tone: 'live' | 'desk' | 'cached'
  }>(() => {
    const src: MarketFeedSource = feedSource
    if (src === 'LIVE_API') {
      return { label: 'Live spot', tone: 'live' }
    }
    if (src === 'HYBRID_LIVE' && activeTelemetry.status === 'LIVE') {
      return { label: 'Live desk', tone: 'desk' }
    }
    return { label: 'Cached benchmark', tone: 'cached' }
  }, [feedSource, activeTelemetry.status])

  const rangeDescriptor =
    selectedStartYear !== null
      ? `${selectedStartYear} – ${currentYearInTz}`
      : activePreset === '15m'
        ? '15m window · 5m intervals'
        : `${activePreset ?? 'Custom'} range`

  const activeTimestampLabel = hoveredPoint
    ? `Crosshair · ${formatEpochReadout(hoveredPoint.ts, timeZone, false)} · ${describePointKind(hoveredPoint.kind)}`
    : `${rangeDescriptor} · Latest: ${latestRefLabel}`

  const fxStatusLabel = useMemo(() => {
    const activeCode = customCurrency?.code ?? currency
    if (activeCode === 'USD') return 'Base USD'
    if (!fxFreshness) return `${activeCode} FX synced`
    if (fxFreshness.source === 'live') {
      return `Live FX (${activeCode})`
    }
    if (fxFreshness.source === 'cached') {
      return `Cached FX (${activeCode})`
    }
    return `Fallback FX (${activeCode})`
  }, [currency, customCurrency?.code, fxFreshness])

  const sourceLine = useMemo(() => {
    const desk = activeRecord?.exchange_desk || activeTelemetry.provider
    const storeTag = storeFreshness.supabaseHydrated
      ? 'Supabase + '
      : ''
    return `${storeTag}${desk} · ${fxStatusLabel} · TZ: ${timeZone} (${activeTzAbbr})`
  }, [
    activeRecord?.exchange_desk,
    activeTelemetry.provider,
    storeFreshness.supabaseHydrated,
    fxStatusLabel,
    timeZone,
    activeTzAbbr,
  ])

  const sectionClassName = isFullChart
    ? 'fixed inset-0 z-50 flex flex-col bg-[#FAF8F5] text-[#18181B] p-2.5 sm:p-5'
    : embedded
      ? 'w-full text-[#18181B]'
      : 'w-full bg-[#FAF8F5] text-[#18181B] px-2.5 py-3 sm:px-5 sm:py-4'

  return (
    <section className={sectionClassName}>
      <div
        className={`flex w-full flex-col rounded-2xl border border-[#18181B]/12 bg-[#F5F1EA] shadow-sm ${
          isFullChart
            ? 'mx-auto max-w-6xl flex-1'
            : embedded
              ? ''
              : 'mx-auto max-w-6xl'
        }`}
      >
        {/* Top Controls: Mineral Tabs, Timezone, Currency & Full Chart */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-[#18181B]/10 px-3 py-2.5 sm:px-4">
          <div
            role="tablist"
            aria-label="Mineral benchmarks"
            className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto"
          >
            {activeRecords.map((m) => {
              const selected = m.symbol === activeRecord?.symbol
              return (
                <button
                  key={m.symbol}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => handleSelectMineral(m.symbol)}
                  className={`min-h-[36px] shrink-0 rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors ${
                    selected
                      ? 'bg-[#18181B] text-[#FAF8F5]'
                      : 'border border-[#18181B]/12 bg-[#FAF8F5] text-[#3F3F46] hover:bg-[#18181B]/5'
                  }`}
                >
                  <span className="font-mono">{m.symbol}</span>
                  <span className="hidden sm:inline">
                    {' '}
                    · {m.mineral_name.split(' (')[0]}
                  </span>
                </button>
              )
            })}
          </div>

          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            {/* IANA Timezone Selector */}
            <label className="flex items-center">
              <span className="sr-only">Chart time zone</span>
              <select
                aria-label="Chart time zone"
                value={timeZone}
                onChange={(e) => handleSelectTimeZone(e.target.value)}
                className="min-h-[34px] rounded-lg border border-[#18181B]/12 bg-[#FAF8F5] px-2 text-xs font-semibold text-[#18181B] outline-none hover:bg-[#18181B]/5 focus:border-[#B85D19]"
              >
                {timeZoneOptions.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.shortLabel} · {opt.label}
                  </option>
                ))}
              </select>
            </label>

            {/* Currency Switcher */}
            <div
              role="group"
              aria-label="Display currency"
              className="flex rounded-lg border border-[#18181B]/12 bg-[#FAF8F5] p-0.5"
            >
              {(['TZS', 'USD', 'EUR'] as CurrencyCode[]).map((code) => {
                const active = !customCurrency && currency === code
                return (
                  <button
                    key={code}
                    type="button"
                    aria-pressed={active}
                    onClick={() => handleSelectCurrency(code)}
                    className={`min-h-[30px] rounded-md px-2 text-xs font-semibold tabular-nums transition-colors ${
                      active
                        ? 'bg-[#B85D19] text-white'
                        : 'text-[#3F3F46] hover:text-[#18181B]'
                    }`}
                  >
                    {code}
                  </button>
                )
              })}
            </div>

            <button
              type="button"
              onClick={() => setIsFullChart((v) => !v)}
              className="min-h-[34px] rounded-lg border border-[#18181B]/15 bg-[#FAF8F5] px-2.5 text-xs font-semibold text-[#18181B] hover:bg-[#18181B]/5"
            >
              {isFullChart ? 'Exit full chart' : 'Full chart'}
            </button>
          </div>
        </div>

        {/* Active Mineral Headline, Feed Freshness & Scrubbing Readout */}
        <div className="flex flex-wrap items-baseline justify-between gap-2 px-3.5 pt-3 pb-1.5 sm:px-5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-bold tracking-tight text-[#18181B] sm:text-lg">
                {activeRecord?.mineral_name}
              </h2>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${
                  feedBadge.tone === 'live'
                    ? 'bg-[#15803D]/12 text-[#15803D]'
                    : feedBadge.tone === 'desk'
                      ? 'bg-[#18181B]/8 text-[#18181B]'
                      : 'bg-[#B85D19]/12 text-[#B85D19]'
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    feedBadge.tone === 'live'
                      ? 'bg-[#15803D]'
                      : feedBadge.tone === 'desk'
                        ? 'bg-[#15803D]/80'
                        : 'bg-[#B85D19]'
                  }`}
                />
                {feedBadge.label}
              </span>
            </div>
            <p className="mt-0.5 text-[11px] font-medium text-[#52525B] tabular-nums">
              {activeTimestampLabel}
            </p>
          </div>

          <div className="flex items-baseline gap-2 tabular-nums">
            <span className="text-lg font-bold text-[#18181B] sm:text-2xl">
              {formatPrice(activeDisplayPrice, currency, false, customCurrency)}
              <span className="ml-0.5 text-xs font-medium text-[#52525B]">
                {unitLabel}
              </span>
            </span>
            <span
              className={`rounded-md px-2 py-0.5 text-xs font-bold ${
                activeIsPositive
                  ? 'bg-[#15803D]/12 text-[#15803D]'
                  : 'bg-[#C2410C]/12 text-[#C2410C]'
              }`}
            >
              {activeIsPositive ? '+' : ''}
              {activeDisplayPct.toFixed(2)}%
            </span>
          </div>
        </div>

        {/* Well-Proportioned Chart Viewport */}
        <div
          ref={containerRef}
          className={`relative w-full px-1 sm:px-2 ${
            isFullChart
              ? 'flex-1 min-h-[300px]'
              : 'h-[340px] sm:h-[420px] lg:h-[460px]'
          }`}
        >
          <canvas
            ref={canvasRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onPointerLeave={() => {
              dragStateRef.current.isDragging = false
              setHoverIndex(null)
            }}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            className="h-full w-full touch-none cursor-crosshair select-none"
          />
        </div>

        {/* Single Contiguous Timeframe Row: 15m -> 1Y + */}
        <div className="relative border-t border-[#18181B]/10 px-3 py-2 sm:px-4">
          <div className="flex items-center gap-1.5 overflow-x-auto sm:overflow-visible py-0.5">
            {(['15m', '1D', '5D', '1M', '3M', '6M'] as PresetRangeKey[]).map(
              (preset) => {
                const selected =
                  activePreset === preset && selectedStartYear === null
                const delta = presetDeltas[preset]
                return (
                  <button
                    key={preset}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => handleSelectPreset(preset)}
                    className={`flex min-h-[42px] min-w-[54px] shrink-0 flex-col items-center justify-center rounded-xl px-2 py-1 text-center transition-colors tabular-nums ${
                      selected
                        ? 'bg-[#18181B] text-[#FAF8F5]'
                        : 'bg-[#FAF8F5] text-[#18181B] hover:bg-[#18181B]/5'
                    }`}
                  >
                    <span className="text-xs font-bold">{preset}</span>
                    <span
                      className={`text-[10px] font-semibold ${
                        selected
                          ? 'text-[#FAF8F5]/85'
                          : delta >= 0
                            ? 'text-[#15803D]'
                            : 'text-[#C2410C]'
                      }`}
                    >
                      {delta >= 0 ? '+' : ''}
                      {delta.toFixed(2)}%
                    </span>
                  </button>
                )
              },
            )}

            {/* 1Y + Right Next to 6M in the Same Series */}
            <div ref={yearPopoverRef} className="relative shrink-0">
              <button
                type="button"
                aria-expanded={yearMenuOpen}
                aria-haspopup="listbox"
                onClick={() => setYearMenuOpen((open) => !open)}
                className={`flex min-h-[42px] min-w-[62px] flex-col items-center justify-center rounded-xl px-2.5 py-1 text-center transition-colors tabular-nums ${
                  selectedStartYear !== null || activePreset === '1Y'
                    ? 'bg-[#B85D19] text-white'
                    : 'bg-[#FAF8F5] text-[#18181B] hover:bg-[#18181B]/5'
                }`}
              >
                <span className="text-xs font-bold">
                  {selectedStartYear !== null
                    ? `${selectedStartYear}–${String(currentYearInTz).slice(-2)}`
                    : '1Y +'}
                </span>
                <span className="text-[10px] font-semibold opacity-90">
                  {selectedStartYear !== null
                    ? `${periodStats.pct >= 0 ? '+' : ''}${periodStats.pct.toFixed(1)}%`
                    : `${presetDeltas['1Y'] >= 0 ? '+' : ''}${presetDeltas['1Y'].toFixed(2)}%`}
                </span>
              </button>

              {yearMenuOpen && (
                <div
                  role="listbox"
                  aria-label="Select starting year"
                  className="fixed sm:absolute left-3 sm:left-auto right-3 sm:right-0 bottom-16 sm:bottom-full z-50 sm:mb-2 max-h-60 sm:w-28 overflow-y-auto rounded-xl border border-[#18181B]/15 bg-[#FAF8F5] p-1 shadow-xl"
                >
                  <button
                    type="button"
                    onClick={() => handleSelectPreset('1Y')}
                    className={`w-full rounded-lg px-3 py-2 text-center text-xs font-bold tabular-nums transition-colors ${
                      activePreset === '1Y' && selectedStartYear === null
                        ? 'bg-[#18181B] text-[#FAF8F5]'
                        : 'text-[#18181B] hover:bg-[#18181B]/8'
                    }`}
                  >
                    1Y
                  </button>
                  {selectableYears.map((yr) => {
                    const isYrSelected = selectedStartYear === yr
                    return (
                      <button
                        key={yr}
                        type="button"
                        role="option"
                        aria-selected={isYrSelected}
                        onClick={() => handleSelectHistoricalYear(yr)}
                        className={`w-full rounded-lg px-3 py-2 text-center text-xs font-semibold tabular-nums transition-colors ${
                          isYrSelected
                            ? 'bg-[#B85D19] text-white'
                            : 'text-[#18181B] hover:bg-[#18181B]/8'
                        }`}
                      >
                        {yr}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="mt-1.5 flex flex-wrap items-center justify-between gap-x-4 gap-y-0.5 text-[11px] text-[#52525B]">
            <span>Drag left/right to pan history. Pinch or scroll to zoom.</span>
            <span className="tabular-nums">{sourceLine}</span>
          </div>
        </div>
      </div>
    </section>
  )
}

export default MarketTrendChart
