'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'

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

export interface MarketTrendChartProps {
  minerals?: MineralAssetConfig[]
  initialMineralId?: string
  selectedMineralId?: string
  onMineralChange?: (mineralId: string) => void
  currency?: CurrencyCode
  fxRatesFromUsd?: Record<CurrencyCode, number>
  onCurrencyChange?: (currency: CurrencyCode) => void
  /** Optional non-TZS/USD/EUR currency synchronized from global app localization */
  customCurrency?: CustomDisplayCurrency | null
  /** When embedded inside an existing page container (e.g. /markets), omits full-page outer padding */
  embedded?: boolean
}

interface DataPoint {
  ts: number // Unix timestamp in ms
  priceUsd: number
}

interface XTick {
  ts: number
  label: string
  highlight?: boolean
}

const DEFAULT_MINERALS: MineralAssetConfig[] = [
  {
    id: 'gold',
    symbol: 'XAU',
    name: 'Gold Bullion (Dhahabu)',
    unitLabel: '/g',
    spotUsd: 114.25,
    prevCloseUsd: 112.62,
    seed: 101,
  },
  {
    id: 'copper',
    symbol: 'HG',
    name: 'Copper Cathode (Shaba)',
    unitLabel: '/kg',
    spotUsd: 11.85,
    prevCloseUsd: 11.74,
    seed: 202,
  },
  {
    id: 'graphite',
    symbol: 'GRF',
    name: 'Flake Graphite (Kinywe 97%)',
    unitLabel: '/kg',
    spotUsd: 1.18,
    prevCloseUsd: 1.19,
    seed: 303,
  },
  {
    id: 'lithium',
    symbol: 'LI',
    name: 'Lithium Spodumene (SC6)',
    unitLabel: '/kg',
    spotUsd: 1.1,
    prevCloseUsd: 1.09,
    seed: 404,
  },
]

const DEFAULT_FX: Record<CurrencyCode, number> = {
  TZS: 2683.79,
  USD: 1,
  EUR: 0.92,
}

const CURRENT_YEAR = 2026
const FIRST_MARKET_YEAR = 1968
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

// Deterministic pseudo-random generator for clean, repeatable trend curves
function createRng(seed: number) {
  let s = seed % 2147483647
  if (s <= 0) s += 2147483646
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}

// Safe rounded rectangle path helper for broad browser & WebView compatibility
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

// Multi-resolution series spanning 1968 -> anchorNowTs with 1-minute resolution near now
function buildMultiResolutionSeries(
  asset: MineralAssetConfig,
  anchorNowTs: number,
): DataPoint[] {
  const rng = createRng(asset.seed)
  const points: DataPoint[] = []

  // 1) Historical monthly anchors from Jan 1968 up to 400 days ago
  const start1968 = Date.UTC(FIRST_MARKET_YEAR, 0, 1)
  const cutoff400d = anchorNowTs - 400 * 24 * 60 * 60 * 1000
  const monthStep = 30 * 24 * 60 * 60 * 1000

  let t = start1968
  const totalHistSpan = Math.max(1, cutoff400d - start1968)
  while (t < cutoff400d) {
    const progress = (t - start1968) / totalHistSpan // 0..1
    // Secular growth curve + multi-decade cycle waves + controlled noise
    const baseRatio = 0.045 + 0.72 * Math.pow(progress, 1.55)
    const wave =
      0.06 * Math.sin(progress * Math.PI * 7) +
      0.035 * Math.cos(progress * Math.PI * 15)
    const jitter = (rng() - 0.5) * 0.025
    const ratio = Math.max(0.025, baseRatio + wave + jitter)
    points.push({ ts: t, priceUsd: asset.spotUsd * ratio })
    t += monthStep
  }

  // 2) Daily points from 400 days ago up to 7 days ago
  const cutoff7d = anchorNowTs - 7 * 24 * 60 * 60 * 1000
  const dayStep = 24 * 60 * 60 * 1000
  let lastPrice =
    points.length > 0 ? points[points.length - 1].priceUsd : asset.spotUsd * 0.78
  const target7d = asset.spotUsd * 0.975
  const daysCount = Math.max(1, Math.floor((cutoff7d - cutoff400d) / dayStep))

  for (let i = 0; i < daysCount; i++) {
    const ts = cutoff400d + i * dayStep
    const pull = (target7d - lastPrice) / Math.max(1, daysCount - i)
    const shock = asset.spotUsd * 0.0085 * (rng() - 0.49)
    lastPrice = Math.max(asset.spotUsd * 0.2, lastPrice + pull + shock)
    points.push({ ts, priceUsd: lastPrice })
  }

  // 3) 15-minute bars from 7 days ago up to 2 hours ago
  const cutoff2h = anchorNowTs - 2 * 60 * 60 * 1000
  const step15m = 15 * 60 * 1000
  const bars15m = Math.max(1, Math.floor((cutoff2h - cutoff7d) / step15m))

  for (let i = 0; i < bars15m; i++) {
    const ts = cutoff7d + i * step15m
    const target =
      ts >= anchorNowTs - 24 * 60 * 60 * 1000
        ? asset.prevCloseUsd
        : asset.spotUsd * 0.992
    const pull = (target - lastPrice) / Math.max(1, bars15m - i)
    const shock = asset.spotUsd * 0.0022 * (rng() - 0.5)
    lastPrice = Math.max(asset.spotUsd * 0.2, lastPrice + pull + shock)
    points.push({ ts, priceUsd: lastPrice })
  }

  // 4) High-resolution 1-minute points over the last 2 hours up to anchorNowTs
  const step1m = 60 * 1000
  const mins = Math.floor((anchorNowTs - cutoff2h) / step1m)
  for (let i = 0; i <= mins; i++) {
    const ts = cutoff2h + i * step1m
    if (i === mins) {
      points.push({ ts: anchorNowTs, priceUsd: asset.spotUsd })
    } else {
      const pull = (asset.spotUsd - lastPrice) / Math.max(1, mins - i)
      const shock = asset.spotUsd * 0.0011 * (rng() - 0.49)
      lastPrice = Math.max(asset.spotUsd * 0.2, lastPrice + pull + shock)
      points.push({ ts, priceUsd: lastPrice })
    }
  }

  return points
}

// Clean "nice number" Y-axis ticks so trend movement occupies balanced vertical space
function computeNiceYScale(minVal: number, maxVal: number, targetTicks = 7) {
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

  // Add 12% visual breathing room above and below so peaks/troughs never touch borders
  const span = rawMax - rawMin
  const paddedMin = Math.max(0, rawMin - span * 0.12)
  const paddedMax = rawMax + span * 0.12
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
    const isZeroDec = Boolean(customCurrency.zeroDecimal)
    if (isZeroDec) {
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

function formatTimeHM(ts: number): string {
  const d = new Date(ts)
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}

function formatDateShort(ts: number): string {
  return new Date(ts).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
  })
}

function formatMonthYear(ts: number): string {
  return new Date(ts).toLocaleDateString('en-GB', {
    month: 'short',
    year: '2-digit',
  })
}

// Collision-free X-axis ticks tailored to the selected timeline
function buildBalancedXTicks(
  startTs: number,
  endTs: number,
  selectedYear: number | null,
  chartWidthPx: number,
): XTick[] {
  const spanMs = Math.max(1, endTs - startTs)
  const minLabelGapPx = chartWidthPx < 480 ? 64 : 84
  const maxLabels = Math.max(3, Math.floor(chartWidthPx / minLabelGapPx))

  // Case 1: Historical year selected from 1Y+ (e.g., 2020 -> 2026 or 1968 -> 2026)
  // Always anchor selectedYear on the left and 2026 on the right
  if (selectedYear !== null) {
    const endYear = CURRENT_YEAR
    const totalYears = Math.max(1, endYear - selectedYear)
    const candidateSteps = [1, 2, 3, 5, 10, 15, 20]
    const stepYears =
      candidateSteps.find((s) => Math.ceil(totalYears / s) + 1 <= maxLabels) ?? 20

    const ticks: XTick[] = [
      { ts: startTs, label: String(selectedYear), highlight: true },
    ]

    const firstAligned = Math.ceil((selectedYear + 1) / stepYears) * stepYears
    for (let y = firstAligned; y < endYear; y += stepYears) {
      const yTs = Date.UTC(y, 0, 1)
      const leftPx = ((yTs - startTs) / spanMs) * chartWidthPx
      const rightPx = ((endTs - yTs) / spanMs) * chartWidthPx
      if (leftPx >= minLabelGapPx * 0.85 && rightPx >= minLabelGapPx * 0.85) {
        ticks.push({ ts: yTs, label: String(y) })
      }
    }

    ticks.push({ ts: endTs, label: String(endYear), highlight: true })
    return ticks
  }

  // Case 2: 15-minute default (or <= 30m zoomed) -> crisp 5-minute intervals
  if (spanMs <= 35 * 60 * 1000) {
    const step = 5 * 60 * 1000
    const firstTick = Math.ceil(startTs / step) * step
    const ticks: XTick[] = []
    for (let t = firstTick; t <= endTs; t += step) {
      ticks.push({ ts: t, label: formatTimeHM(t) })
    }
    return ticks
  }

  // Case 3: Intraday (35m -> 36h)
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
    const ticks: XTick[] = []
    for (let t = firstTick; t <= endTs; t += step) {
      ticks.push({ ts: t, label: formatTimeHM(t) })
    }
    return ticks
  }

  // Case 4: Multi-day up to ~4 months
  if (spanMs <= 120 * 24 * 60 * 60 * 1000) {
    const dayMs = 24 * 60 * 60 * 1000
    const daySteps = [1, 2, 5, 7, 14, 21]
    const dStep = daySteps.find((d) => spanMs / (d * dayMs) <= maxLabels) ?? 21
    const step = dStep * dayMs
    const firstTick = Math.ceil(startTs / step) * step
    const ticks: XTick[] = []
    for (let t = firstTick; t <= endTs; t += step) {
      ticks.push({ ts: t, label: formatDateShort(t) })
    }
    return ticks
  }

  // Case 5: 6M / 1Y rolling or multi-year manual pan
  const count = Math.min(maxLabels, 6)
  const step = spanMs / Math.max(1, count - 1)
  const ticks: XTick[] = []
  for (let i = 0; i < count; i++) {
    const t = startTs + i * step
    ticks.push({
      ts: t,
      label:
        spanMs > 400 * 24 * 60 * 60 * 1000
          ? String(new Date(t).getUTCFullYear())
          : formatMonthYear(t),
    })
  }
  return ticks
}

export const MarketTrendChart: React.FC<MarketTrendChartProps> = ({
  minerals = DEFAULT_MINERALS,
  initialMineralId = 'gold',
  selectedMineralId: controlledMineralId,
  onMineralChange,
  currency: controlledCurrency,
  fxRatesFromUsd = DEFAULT_FX,
  onCurrencyChange,
  customCurrency = null,
  embedded = false,
}) => {
  const safeMinerals = minerals.length > 0 ? minerals : DEFAULT_MINERALS
  const [internalMineralId, setInternalMineralId] = useState(
    controlledMineralId ?? initialMineralId,
  )
  const selectedMineralId = controlledMineralId ?? internalMineralId

  const [internalCurrency, setInternalCurrency] = useState<CurrencyCode>('TZS')
  const currency = controlledCurrency ?? internalCurrency

  // Anchor timestamp aligned cleanly to current minute so 5m intervals land cleanly
  const [anchorNowTs] = useState<number>(() => {
    const now = Date.now()
    return Math.floor(now / 60000) * 60000
  })

  const [activePreset, setActivePreset] = useState<PresetRangeKey | null>('15m')
  const [selectedStartYear, setSelectedStartYear] = useState<number | null>(null)
  const [yearMenuOpen, setYearMenuOpen] = useState(false)
  const [isFullChart, setIsFullChart] = useState(false)

  // Active viewport [viewStartTs, viewEndTs] — defaults to latest 15m
  const [viewRange, setViewRange] = useState<{ start: number; end: number }>(() => ({
    start: anchorNowTs - PRESET_DURATIONS_MS['15m'],
    end: anchorNowTs,
  }))

  const [hoverIndex, setHoverIndex] = useState<number | null>(null)
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 540 })

  const containerRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const yearPopoverRef = useRef<HTMLDivElement | null>(null)

  // Pointer & pinch gesture refs
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

  const activeAsset = useMemo(
    () =>
      safeMinerals.find(
        (m) =>
          m.id === selectedMineralId ||
          m.symbol.toUpperCase() === selectedMineralId.toUpperCase(),
      ) ?? safeMinerals[0],
    [safeMinerals, selectedMineralId],
  )

  const fx = customCurrency
    ? customCurrency.rateFromUsd
    : (fxRatesFromUsd[currency] ?? 1)

  const series = useMemo(
    () => buildMultiResolutionSeries(activeAsset, anchorNowTs),
    [activeAsset, anchorNowTs],
  )

  const earliestTs = series[0]?.ts ?? Date.UTC(FIRST_MARKET_YEAR, 0, 1)

  // Descending list of years: 2025 -> 1968
  const selectableYears = useMemo(() => {
    const list: number[] = []
    for (let y = CURRENT_YEAR - 1; y >= FIRST_MARKET_YEAR; y--) {
      list.push(y)
    }
    return list
  }, [])

  // Close year picker when clicking outside
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

  // Escape key & body scroll lock when expanded to full chart
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

  // Measure chart container responsively for crisp DPR rendering & balanced axis labels
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

  const handleSelectMineral = (nextId: string) => {
    setInternalMineralId(nextId)
    setHoverIndex(null)
    onMineralChange?.(nextId)
  }

  const handleSelectCurrency = (next: CurrencyCode) => {
    setInternalCurrency(next)
    onCurrencyChange?.(next)
  }

  const handleSelectPreset = (preset: PresetRangeKey) => {
    setActivePreset(preset)
    setSelectedStartYear(null)
    setYearMenuOpen(false)
    setHoverIndex(null)
    setViewRange({
      start: Math.max(earliestTs, anchorNowTs - PRESET_DURATIONS_MS[preset]),
      end: anchorNowTs,
    })
  }

  const handleSelectHistoricalYear = (year: number) => {
    const startTs = Math.max(earliestTs, Date.UTC(year, 0, 1))
    setSelectedStartYear(year)
    setActivePreset(null)
    setYearMenuOpen(false)
    setHoverIndex(null)
    setViewRange({
      start: startTs,
      end: anchorNowTs,
    })
  }

  // Visible data slice + boundary interpolation so lines never clip awkwardly at edges
  const visiblePoints = useMemo(() => {
    const { start, end } = viewRange
    const inRange = series.filter((p) => p.ts >= start && p.ts <= end)
    if (inRange.length >= 2) return inRange

    // Fallback if zoomed tightly between two points
    const prev = [...series].reverse().find((p) => p.ts <= start) ?? series[0]
    const next = series.find((p) => p.ts >= end) ?? series[series.length - 1]
    return [
      { ts: start, priceUsd: prev.priceUsd },
      { ts: end, priceUsd: next.priceUsd },
    ]
  }, [series, viewRange])

  // Period change calculation (from left edge of selected range to latest live price)
  const periodStats = useMemo(() => {
    const openUsd = visiblePoints[0]?.priceUsd ?? activeAsset.prevCloseUsd
    const currentUsd = activeAsset.spotUsd
    const diffUsd = currentUsd - openUsd
    const pct = openUsd > 0 ? (diffUsd / openUsd) * 100 : 0
    return {
      openLocal: openUsd * fx,
      currentLocal: currentUsd * fx,
      diffLocal: diffUsd * fx,
      pct,
      isPositive: diffUsd >= 0,
    }
  }, [visiblePoints, activeAsset, fx])

  // Precomputed preset delta badges for the timeframe strip
  const presetDeltas = useMemo(() => {
    const out = {} as Record<PresetRangeKey, number>
    ;(Object.keys(PRESET_DURATIONS_MS) as PresetRangeKey[]).forEach((key) => {
      const targetStart = anchorNowTs - PRESET_DURATIONS_MS[key]
      const startPt = series.find((p) => p.ts >= targetStart) ?? series[0]
      const base = startPt?.priceUsd || activeAsset.spotUsd
      out[key] = base > 0 ? ((activeAsset.spotUsd - base) / base) * 100 : 0
    })
    return out
  }, [series, anchorNowTs, activeAsset.spotUsd])

  // Zoom helper centered around a normalized horizontal anchor (0..1)
  const zoomAroundRatio = useCallback(
    (scaleFactor: number, anchorRatio: number) => {
      setSelectedStartYear(null)
      setActivePreset(null)
      setViewRange((prev) => {
        const span = prev.end - prev.start
        const maxSpan = anchorNowTs - earliestTs
        const nextSpan = Math.min(maxSpan, Math.max(MIN_SPAN_MS, span * scaleFactor))
        const anchorTs = prev.start + span * anchorRatio
        let nextStart = anchorTs - nextSpan * anchorRatio
        let nextEnd = nextStart + nextSpan

        if (nextEnd > anchorNowTs) {
          nextEnd = anchorNowTs
          nextStart = Math.max(earliestTs, nextEnd - nextSpan)
        }
        if (nextStart < earliestTs) {
          nextStart = earliestTs
          nextEnd = Math.min(anchorNowTs, nextStart + nextSpan)
        }
        return { start: nextStart, end: nextEnd }
      })
    },
    [anchorNowTs, earliestTs],
  )

  // Attach non-passive wheel listener so zooming never triggers page scroll warnings
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

  // Canvas rendering
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const { width, height } = canvasSize
    canvas.width = width * dpr
    canvas.height = height * dpr
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    const isMobile = width < 640
    const rightAxisWidth = isMobile ? 84 : 104
    const bottomAxisHeight = 34
    const topPad = 18
    const leftPad = isMobile ? 10 : 16

    const plotLeft = leftPad
    const plotRight = Math.max(plotLeft + 80, width - rightAxisWidth)
    const plotTop = topPad
    const plotBottom = Math.max(plotTop + 120, height - bottomAxisHeight)
    const plotWidth = plotRight - plotLeft
    const plotHeight = plotBottom - plotTop

    // Clear background
    ctx.clearRect(0, 0, width, height)

    // Compute balanced Y-axis domain
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

    const yScale = computeNiceYScale(minPrice, maxPrice, isMobile ? 6 : 8)
    const ySpan = Math.max(1e-9, yScale.max - yScale.min)

    const xSpan = Math.max(1, viewRange.end - viewRange.start)
    const toX = (ts: number) => plotLeft + ((ts - viewRange.start) / xSpan) * plotWidth
    const toY = (val: number) =>
      plotBottom - ((val - yScale.min) / ySpan) * plotHeight

    // Horizontal grid lines & right-aligned price labels
    ctx.font = `500 ${isMobile ? 11 : 12}px ui-monospace, SFMono-Regular, Menlo, monospace`
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

    // Vertical X-axis grid lines & balanced timeline labels
    const xTicks = buildBalancedXTicks(
      viewRange.start,
      viewRange.end,
      selectedStartYear,
      plotWidth,
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
        ? `700 ${isMobile ? 11 : 12}px ui-monospace, SFMono-Regular, Menlo, monospace`
        : `500 ${isMobile ? 11 : 12}px ui-monospace, SFMono-Regular, Menlo, monospace`
      ctx.fillStyle =
        tick.highlight && idx === xTicks.length - 1 ? '#B85D19' : '#3F3F46'
      ctx.fillText(tick.label, x, plotBottom + 10)
    })

    // Dotted reference line for period open / prev baseline
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

    // Trend line + soft area gradient fill
    const lineColor = periodStats.isPositive ? '#15803D' : '#C2410C'
    const fillTopColor = periodStats.isPositive
      ? 'rgba(21, 128, 61, 0.18)'
      : 'rgba(184, 93, 25, 0.18)'
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

    // Main trend stroke
    ctx.beginPath()
    visiblePoints.forEach((pt, idx) => {
      const x = toX(pt.ts)
      const y = toY(pt.priceUsd * fx)
      if (idx === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    })
    ctx.strokeStyle = lineColor
    ctx.lineWidth = 2.25
    ctx.lineJoin = 'round'
    ctx.stroke()
    ctx.restore()

    // Latest live spot marker dot + right-axis highlight badge
    const latestX = toX(lastPt.ts)
    const latestY = Math.min(
      plotBottom,
      Math.max(plotTop, toY(periodStats.currentLocal)),
    )

    if (latestX >= plotLeft && latestX <= plotRight + 2) {
      ctx.beginPath()
      ctx.arc(latestX, latestY, 4.5, 0, Math.PI * 2)
      ctx.fillStyle = lineColor
      ctx.fill()
      ctx.lineWidth = 2
      ctx.strokeStyle = '#FAF8F5'
      ctx.stroke()
    }

    // Highlighted current price badge on Y-axis
    const badgeH = 22
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
    ctx.font = `700 ${isMobile ? 10.5 : 11.5}px ui-monospace, SFMono-Regular, Menlo, monospace`
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillText(
      formatPrice(periodStats.currentLocal, currency, true, customCurrency),
      plotRight + 9,
      badgeY,
    )

    // Interactive crosshair when scrubbing
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
      ctx.arc(hx, hy, 5, 0, Math.PI * 2)
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
    hoverIndex,
  ])

  // Pointer scrubbing + drag-to-pan
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
    const plotLeft = isMobile ? 10 : 16
    const plotRight = rect.width - (isMobile ? 84 : 104)
    const plotWidth = Math.max(80, plotRight - plotLeft)

    if (dragStateRef.current.isDragging) {
      const dx = e.clientX - dragStateRef.current.startX
      if (Math.abs(dx) > 3) {
        setSelectedStartYear(null)
        setActivePreset(null)
        const span = dragStateRef.current.origEnd - dragStateRef.current.origStart
        const deltaTs = -(dx / plotWidth) * span
        let nextStart = dragStateRef.current.origStart + deltaTs
        let nextEnd = dragStateRef.current.origEnd + deltaTs

        if (nextEnd > anchorNowTs) {
          nextEnd = anchorNowTs
          nextStart = nextEnd - span
        }
        if (nextStart < earliestTs) {
          nextStart = earliestTs
          nextEnd = nextStart + span
        }
        setViewRange({ start: nextStart, end: nextEnd })
      }
    }

    // Update hover crosshair index
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

  // Touch pinch-to-zoom
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
      const maxSpan = anchorNowTs - earliestTs
      const nextSpan = Math.min(maxSpan, Math.max(MIN_SPAN_MS, origSpan * scale))
      const anchorTs = origStart + origSpan * centerRatio
      let nextStart = anchorTs - nextSpan * centerRatio
      let nextEnd = nextStart + nextSpan

      if (nextEnd > anchorNowTs) {
        nextEnd = anchorNowTs
        nextStart = Math.max(earliestTs, nextEnd - nextSpan)
      }
      if (nextStart < earliestTs) {
        nextStart = earliestTs
        nextEnd = Math.min(anchorNowTs, nextStart + nextSpan)
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

  const activeTimestampLabel = hoveredPoint
    ? new Date(hoveredPoint.ts).toLocaleString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : selectedStartYear !== null
      ? `${selectedStartYear} – ${CURRENT_YEAR}`
      : activePreset === '15m'
        ? '15m window · 5m intervals'
        : `${activePreset ?? 'Custom'} range`

  const sectionClassName = isFullChart
    ? 'fixed inset-0 z-50 flex flex-col bg-[#FAF8F5] text-[#18181B] p-3 sm:p-6'
    : embedded
      ? 'w-full text-[#18181B]'
      : 'w-full min-h-[100dvh] bg-[#FAF8F5] text-[#18181B] px-3 py-4 sm:px-6 sm:py-6'

  return (
    <section className={sectionClassName}>
      <div
        className={`flex w-full flex-1 flex-col rounded-2xl border border-[#18181B]/12 bg-[#F5F1EA] shadow-sm ${
          embedded && !isFullChart ? '' : 'mx-auto max-w-7xl'
        }`}
      >
        {/* Top Controls: Mineral Tabs, Currency Switcher & Full Chart Toggle */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#18181B]/10 px-3 py-3 sm:px-5">
          <div
            role="tablist"
            aria-label="Mineral benchmarks"
            className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0"
          >
            {safeMinerals.map((m) => {
              const selected = m.id === activeAsset.id
              return (
                <button
                  key={m.id}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => handleSelectMineral(m.id)}
                  className={`min-h-[40px] shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors sm:text-sm ${
                    selected
                      ? 'bg-[#18181B] text-[#FAF8F5]'
                      : 'border border-[#18181B]/12 bg-[#FAF8F5] text-[#3F3F46] hover:bg-[#18181B]/5'
                  }`}
                >
                  <span className="font-mono">{m.symbol}</span>{' '}
                  <span className="hidden sm:inline">· {m.name.split(' (')[0]}</span>
                </button>
              )
            })}
          </div>

          <div className="flex shrink-0 items-center gap-2">
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
                    className={`min-h-[34px] rounded-md px-2.5 text-xs font-semibold tabular-nums transition-colors ${
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

            {/* Full Chart Expand Toggle */}
            <button
              type="button"
              onClick={() => setIsFullChart((v) => !v)}
              className="min-h-[38px] rounded-lg border border-[#18181B]/15 bg-[#FAF8F5] px-3 text-xs font-semibold text-[#18181B] hover:bg-[#18181B]/5"
            >
              {isFullChart ? 'Exit full chart' : 'Full chart'}
            </button>
          </div>
        </div>

        {/* Active Mineral Headline & Live Scrubbing Price Readout */}
        <div className="flex flex-wrap items-baseline justify-between gap-2 px-4 pt-3.5 pb-2 sm:px-6">
          <div>
            <h2 className="text-base font-bold tracking-tight text-[#18181B] sm:text-xl">
              {activeAsset.name}
            </h2>
            <p className="mt-0.5 text-xs font-medium text-[#52525B] tabular-nums">
              {activeTimestampLabel}
            </p>
          </div>

          <div className="flex items-baseline gap-2.5 tabular-nums">
            <span className="text-xl font-bold text-[#18181B] sm:text-2xl">
              {formatPrice(activeDisplayPrice, currency, false, customCurrency)}
              <span className="ml-0.5 text-xs font-medium text-[#52525B]">
                {activeAsset.unitLabel}
              </span>
            </span>
            <span
              className={`rounded-md px-2 py-0.5 text-xs font-bold ${
                periodStats.isPositive
                  ? 'bg-[#15803D]/12 text-[#15803D]'
                  : 'bg-[#C2410C]/12 text-[#C2410C]'
              }`}
            >
              {periodStats.isPositive ? '+' : ''}
              {periodStats.pct.toFixed(2)}%
            </span>
          </div>
        </div>

        {/* Large Responsive Chart Canvas (Covers Generous Viewport Space) */}
        <div
          ref={containerRef}
          className="relative w-full flex-1 px-1 sm:px-2"
          style={{
            height: isFullChart
              ? 'calc(100dvh - 190px)'
              : 'clamp(460px, 66dvh, 740px)',
            minHeight: isFullChart ? 380 : 460,
          }}
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

        {/* Bottom Timeframe Bar + Years-Only (1Y +) Selector (2025 -> 1968) */}
        <div className="relative border-t border-[#18181B]/10 px-3 py-2.5 sm:px-5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto py-0.5">
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
                      className={`flex min-h-[46px] min-w-[58px] shrink-0 flex-col items-center justify-center rounded-xl px-2.5 py-1.5 text-center transition-colors tabular-nums ${
                        selected
                          ? 'bg-[#18181B] text-[#FAF8F5]'
                          : 'bg-[#FAF8F5] text-[#18181B] hover:bg-[#18181B]/5'
                      }`}
                    >
                      <span className="text-xs font-bold">{preset}</span>
                      <span
                        className={`text-[10.5px] font-semibold ${
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
            </div>

            {/* 1Y + Historical Year Selector Trigger (outside overflow-x-auto so popover never clips) */}
            <div ref={yearPopoverRef} className="relative shrink-0">
              <button
                type="button"
                aria-expanded={yearMenuOpen}
                aria-haspopup="listbox"
                onClick={() => setYearMenuOpen((open) => !open)}
                className={`flex min-h-[46px] min-w-[68px] flex-col items-center justify-center rounded-xl px-3 py-1.5 text-center transition-colors tabular-nums ${
                  selectedStartYear !== null || activePreset === '1Y'
                    ? 'bg-[#B85D19] text-white'
                    : 'bg-[#FAF8F5] text-[#18181B] hover:bg-[#18181B]/5'
                }`}
              >
                <span className="text-xs font-bold">
                  {selectedStartYear !== null ? `${selectedStartYear}–26` : '1Y +'}
                </span>
                <span className="text-[10.5px] font-semibold opacity-90">
                  {selectedStartYear !== null
                    ? `${periodStats.pct >= 0 ? '+' : ''}${periodStats.pct.toFixed(1)}%`
                    : `${presetDeltas['1Y'] >= 0 ? '+' : ''}${presetDeltas['1Y'].toFixed(2)}%`}
                </span>
              </button>

              {/* Years-Only Descending List (2025 -> 1968) */}
              {yearMenuOpen && (
                <div
                  role="listbox"
                  aria-label="Select starting year"
                  className="absolute right-0 bottom-full z-40 mb-2 max-h-64 w-28 overflow-y-auto rounded-xl border border-[#18181B]/15 bg-[#FAF8F5] p-1 shadow-xl"
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

          <p className="mt-1.5 text-center text-[11px] text-[#52525B] sm:text-left">
            Drag left/right to pan history. Pinch or scroll to zoom.
          </p>
        </div>
      </div>
    </section>
  )
}

export default MarketTrendChart
