'use client'

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import {
  ArrowDownRight,
  ArrowUpRight,
  Calendar,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  TrendingUp,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import { useLocalization } from '../context/LocalizationContext'
import {
  CHART_TIMEFRAMES,
  buildMineralYearDrilldownSeries,
  computeNiceAxisTicks,
  convertToChartUnitUsd,
  detectTimelineScale,
  formatChartAxisDateByScale,
  formatChartTooltipDateByScale,
  formatVisibleDateWindow,
  getSelectableYears,
  type ChartPricingMode,
  type ChartTimeframe,
  type TimelineScale,
} from '../lib/mineralHistory'
import type { MineralPriceRecord } from '../types/database'

export interface MineralTrendChartProps {
  minerals: MineralPriceRecord[]
  selectedSymbol?: string
  onSelectSymbol?: (symbol: string) => void
  /** Master unit mode controlled exclusively by the /markets dashboard header */
  unitBasis?: ChartPricingMode
}

const MIN_VISIBLE_POINTS = 6

function getShortMineralLabel(mineralName: string): string {
  const withoutParens = mineralName.replace(/\s*\([^)]*\)/g, '').trim()
  return withoutParens || mineralName
}

export default function MineralTrendChart({
  minerals,
  selectedSymbol: controlledSymbol,
  onSelectSymbol,
  unitBasis = 'metric_local',
}: MineralTrendChartProps) {
  const {
    currency,
    currencyMeta,
    rateForSelected,
    formatPrice,
    language,
    ui,
  } = useLocalization()

  const gradientId = useId().replace(/:/g, '')
  const chartContainerRef = useRef<HTMLDivElement | null>(null)
  const svgRef = useRef<SVGSVGElement | null>(null)
  const pinchStartRef = useRef<{ dist: number; window: [number, number] } | null>(
    null,
  )

  const selectableYears = useMemo(() => getSelectableYears(), [])
  const [chartWidth, setChartWidth] = useState<number>(880)
  const [internalSymbol, setInternalSymbol] = useState<string>(
    () => minerals[0]?.symbol ?? 'XAU',
  )
  const [selectedYear, setSelectedYear] = useState<number>(() => selectableYears[0] ?? 2026)
  const [timeframe, setTimeframe] = useState<ChartTimeframe>('1Mo')
  const [focusTimestampMs, setFocusTimestampMs] = useState<number | null>(null)
  const [zoomWindow, setZoomWindow] = useState<[number, number] | null>(null)
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)

  const activeSymbol = controlledSymbol ?? internalSymbol

  const handleSymbolChange = useCallback(
    (symbol: string) => {
      setHoverIndex(null)
      setZoomWindow(null)
      if (onSelectSymbol) {
        onSelectSymbol(symbol)
      } else {
        setInternalSymbol(symbol)
      }
    },
    [onSelectSymbol],
  )

  const handleYearChange = useCallback((year: number) => {
    setSelectedYear(year)
    setFocusTimestampMs(null)
    setZoomWindow(null)
    setHoverIndex(null)
  }, [])

  const activeMineral = useMemo(() => {
    if (!minerals.length) return null
    return minerals.find((m) => m.symbol === activeSymbol) ?? minerals[0]
  }, [minerals, activeSymbol])

  // Observe container width for razor-sharp, non-distorted SVG text & strokes
  useEffect(() => {
    const el = chartContainerRef.current
    if (!el) return

    const updateSize = () => {
      const nextWidth = Math.round(el.getBoundingClientRect().width)
      if (nextWidth > 0) {
        setChartWidth(nextWidth)
      }
    }

    updateSize()

    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(updateSize)
      observer.observe(el)
      return () => observer.disconnect()
    }

    window.addEventListener('resize', updateSize)
    return () => window.removeEventListener('resize', updateSize)
  }, [])

  // Reset scrub index when unit mode changes
  useEffect(() => {
    setHoverIndex(null)
  }, [unitBasis])

  const fullSeries = useMemo(() => {
    if (!activeMineral) return null
    return buildMineralYearDrilldownSeries(
      activeMineral,
      selectedYear,
      timeframe,
      unitBasis,
      focusTimestampMs,
    )
  }, [activeMineral, selectedYear, timeframe, unitBasis, focusTimestampMs])

  // Resolve active zoomed index bounds safely
  const totalPoints = fullSeries?.points.length ?? 0
  const [startIdx, endIdx] = useMemo<[number, number]>(() => {
    if (totalPoints < 2) return [0, 0]
    if (!zoomWindow) return [0, totalPoints - 1]
    const clampedStart = Math.max(0, Math.min(totalPoints - MIN_VISIBLE_POINTS, zoomWindow[0]))
    const clampedEnd = Math.min(
      totalPoints - 1,
      Math.max(clampedStart + MIN_VISIBLE_POINTS - 1, zoomWindow[1]),
    )
    return [clampedStart, clampedEnd]
  }, [zoomWindow, totalPoints])

  const isZoomed = totalPoints > 1 && (startIdx > 0 || endIdx < totalPoints - 1)
  const canZoomIn = endIdx - startIdx + 1 > MIN_VISIBLE_POINTS
  const canZoomOut = isZoomed

  const visiblePoints = useMemo(() => {
    if (!fullSeries) return []
    return fullSeries.points.slice(startIdx, endIdx + 1)
  }, [fullSeries, startIdx, endIdx])

  const visibleStats = useMemo(() => {
    if (visiblePoints.length === 0) return null
    const startPt = visiblePoints[0]
    const endPt = visiblePoints[visiblePoints.length - 1]
    let minUsd = startPt.unitUsd
    let maxUsd = startPt.unitUsd
    for (const pt of visiblePoints) {
      if (pt.unitUsd < minUsd) minUsd = pt.unitUsd
      if (pt.unitUsd > maxUsd) maxUsd = pt.unitUsd
    }
    const spanMs = Math.max(0, endPt.timestampMs - startPt.timestampMs)
    const scale = detectTimelineScale(spanMs)
    const changeUsd = endPt.unitUsd - startPt.unitUsd
    const changePct = startPt.unitUsd > 0 ? (changeUsd / startPt.unitUsd) * 100 : 0

    return {
      startMs: startPt.timestampMs,
      endMs: endPt.timestampMs,
      spanMs,
      scale,
      startUnitUsd: startPt.unitUsd,
      endUnitUsd: endPt.unitUsd,
      minUnitUsd: minUsd,
      maxUnitUsd: maxUsd,
      changeUnitUsd: changeUsd,
      changePct,
    }
  }, [visiblePoints])

  // Switching timeframe preserves zoomed focal point when drilling down inside a chosen year
  const handleTimeframeChange = useCallback(
    (nextTf: ChartTimeframe) => {
      if (nextTf === '1Y') {
        setFocusTimestampMs(null)
      } else if (isZoomed && visiblePoints.length > 0) {
        const focalPt = visiblePoints[visiblePoints.length - 1]
        setFocusTimestampMs(focalPt.timestampMs)
      }
      setTimeframe(nextTf)
      setZoomWindow(null)
      setHoverIndex(null)
    },
    [isZoomed, visiblePoints],
  )

  const applyZoom = useCallback(
    (direction: 'in' | 'out', anchorRatio?: number) => {
      if (totalPoints < MIN_VISIBLE_POINTS) return
      const curLen = endIdx - startIdx + 1
      const factor = direction === 'in' ? 0.65 : 1.55
      const nextLen = Math.max(
        MIN_VISIBLE_POINTS,
        Math.min(totalPoints, Math.round(curLen * factor)),
      )
      if (nextLen >= totalPoints) {
        setZoomWindow(null)
        setHoverIndex(null)
        return
      }
      const focal =
        anchorRatio !== undefined
          ? Math.max(0, Math.min(1, anchorRatio))
          : hoverIndex !== null && curLen > 1
            ? hoverIndex / (curLen - 1)
            : 0.5

      const anchorGlobal = startIdx + focal * (curLen - 1)
      let nextStart = Math.round(anchorGlobal - focal * (nextLen - 1))
      nextStart = Math.max(0, Math.min(totalPoints - nextLen, nextStart))
      const nextEnd = nextStart + nextLen - 1

      setHoverIndex(null)
      setZoomWindow([nextStart, nextEnd])
    },
    [totalPoints, startIdx, endIdx, hoverIndex],
  )

  const applyPan = useCallback(
    (direction: 'left' | 'right') => {
      if (!isZoomed || totalPoints < 2) return
      const curLen = endIdx - startIdx + 1
      const shift = Math.max(1, Math.round(curLen * 0.25))
      const delta = direction === 'left' ? -shift : shift
      let nextStart = startIdx + delta
      nextStart = Math.max(0, Math.min(totalPoints - curLen, nextStart))
      setHoverIndex(null)
      setZoomWindow([nextStart, nextStart + curLen - 1])
    },
    [isZoomed, totalPoints, startIdx, endIdx],
  )

  const handleResetZoom = useCallback(() => {
    setZoomWindow(null)
    setFocusTimestampMs(null)
    setHoverIndex(null)
  }, [])

  // Smooth non-passive mouse-wheel zoom over the chart canvas
  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return

    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) < 2) return
      e.preventDefault()
      const rect = svg.getBoundingClientRect()
      const ratio = rect.width > 0 ? (e.clientX - rect.left) / rect.width : 0.5
      applyZoom(e.deltaY < 0 ? 'in' : 'out', ratio)
    }

    svg.addEventListener('wheel', onWheel, { passive: false })
    return () => svg.removeEventListener('wheel', onWheel)
  }, [applyZoom])

  // Format a value that is already in the active display currency for Y-axis ticks
  const formatAxisTickValue = useCallback(
    (displayValue: number, step: number, compactMobile: boolean): string => {
      const usdEquivalent =
        rateForSelected > 0 ? displayValue / rateForSelected : displayValue
      const isZeroDecimal = currency === 'TZS' || currency === 'JPY'
      const absVal = Math.abs(displayValue)

      if (compactMobile) {
        if (absVal >= 1_000_000) {
          const decimals = step < 10_000 ? 3 : step < 100_000 ? 2 : 1
          return `${(displayValue / 1_000_000).toFixed(decimals)}M`
        }
        if (absVal >= 10_000) {
          const decimals = step < 100 ? 2 : step < 1_000 ? 1 : 0
          return `${(displayValue / 1_000).toFixed(decimals)}k`
        }
        if (absVal >= 1_000) {
          return `${(displayValue / 1_000).toFixed(step < 500 ? 2 : 1)}k`
        }
        const decimals = isZeroDecimal ? 0 : step < 0.05 ? 3 : step < 0.5 ? 2 : step < 1 ? 1 : 0
        return displayValue.toLocaleString('en-US', {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        })
      }

      if (absVal >= 1_000_000) {
        const decimals = step < 100_000 ? 2 : absVal >= 10_000_000 ? 1 : 2
        const compactNum = (displayValue / 1_000_000).toFixed(decimals)
        return `${currencyMeta.symbol}${compactNum}M`
      }

      return formatPrice(usdEquivalent, {
        minimumFractionDigits: isZeroDecimal ? 0 : absVal < 10 ? 2 : 0,
        maximumFractionDigits: isZeroDecimal
          ? 0
          : absVal < 10
            ? 2
            : absVal < 100
              ? 2
              : 0,
      })
    },
    [currency, currencyMeta.symbol, formatPrice, rateForSelected],
  )

  const formatSignedDelta = useCallback(
    (deltaUsd: number): string => {
      const sign = deltaUsd >= 0 ? '+' : '-'
      return `${sign}${formatPrice(Math.abs(deltaUsd))}`
    },
    [formatPrice],
  )

  const formatScaleLabel = useCallback(
    (scale: TimelineScale): string => {
      switch (scale) {
        case 'min':
          return ui('Scale: min', 'Kipimo: dak', 'Escala: min')
        case 'hours':
          return ui('Scale: hours', 'Kipimo: saa', 'Escala: horas')
        case 'days':
          return ui('Scale: days', 'Kipimo: siku', 'Escala: días')
        case 'months':
          return ui('Scale: months', 'Kipimo: miezi', 'Escala: meses')
        case 'years':
          return ui('Scale: years', 'Kipimo: miaka', 'Escala: años')
      }
    },
    [ui],
  )

  // Compute SVG geometry from the currently visible (zoomed or full) slice
  const chartGeometry = useMemo(() => {
    if (!visibleStats || visiblePoints.length < 2) return null

    const isCompact = chartWidth < 600
    const height = isCompact ? 256 : 344
    const convertedValues = visiblePoints.map((p) => p.unitUsd * rateForSelected)
    const minConverted = Math.min(...convertedValues)
    const maxConverted = Math.max(...convertedValues)

    const {
      min: yMin,
      max: yMax,
      step: yStep,
      ticks: yTicks,
    } = computeNiceAxisTicks(minConverted, maxConverted, isCompact ? 4 : 5)

    const yTickLabels = yTicks.map((val) => ({
      value: val,
      label: formatAxisTickValue(val, yStep, isCompact),
    }))

    const maxLabelLen = yTickLabels.reduce(
      (max, item) => Math.max(max, item.label.length),
      3,
    )

    const padLeft = isCompact
      ? Math.min(54, Math.max(38, Math.round(maxLabelLen * 6.4 + 10)))
      : Math.min(126, Math.max(66, Math.round(maxLabelLen * 7.2 + 16)))
    const padRight = isCompact ? 12 : 22
    const padTop = isCompact ? 14 : 18
    const padBottom = isCompact ? 28 : 34
    const plotWidth = Math.max(120, chartWidth - padLeft - padRight)
    const plotHeight = Math.max(120, height - padTop - padBottom)
    const ySpan = Math.max(1e-9, yMax - yMin)

    const coords = visiblePoints.map((pt, idx) => {
      const converted = convertedValues[idx]
      const x = padLeft + (idx / (visiblePoints.length - 1)) * plotWidth
      const y = padTop + (1 - (converted - yMin) / ySpan) * plotHeight
      return { x, y, pt, converted }
    })

    const linePath = coords
      .map((c, idx) => `${idx === 0 ? 'M' : 'L'} ${c.x.toFixed(2)} ${c.y.toFixed(2)}`)
      .join(' ')

    const baselineY = padTop + plotHeight
    const areaPath = `${linePath} L ${coords[coords.length - 1].x.toFixed(2)} ${baselineY.toFixed(2)} L ${coords[0].x.toFixed(2)} ${baselineY.toFixed(2)} Z`

    const openY =
      padTop + (1 - (convertedValues[0] - yMin) / ySpan) * plotHeight

    const xTickCount = isCompact ? 4 : visibleStats.scale === 'min' ? 5 : 6
    const xTicks: Array<{ x: number; label: string; idx: number }> = []
    for (let i = 0; i < xTickCount; i++) {
      const frac = i / (xTickCount - 1)
      const idx = Math.round(frac * (visiblePoints.length - 1))
      const coord = coords[idx]
      xTicks.push({
        x: coord.x,
        idx,
        label: formatChartAxisDateByScale(
          coord.pt.timestampMs,
          visibleStats.scale,
          visibleStats.spanMs,
          language,
        ),
      })
    }

    const yTickPositions = yTickLabels.map((tick) => ({
      ...tick,
      y: padTop + (1 - (tick.value - yMin) / ySpan) * plotHeight,
    }))

    return {
      isCompact,
      width: chartWidth,
      height,
      padLeft,
      padRight,
      padTop,
      padBottom,
      plotWidth,
      plotHeight,
      baselineY,
      openY,
      coords,
      linePath,
      areaPath,
      yTickPositions,
      xTicks,
    }
  }, [
    visiblePoints,
    visibleStats,
    chartWidth,
    rateForSelected,
    formatAxisTickValue,
    language,
  ])

  const handlePointerScrub = useCallback(
    (clientX: number, currentTarget: SVGSVGElement) => {
      if (!chartGeometry || visiblePoints.length === 0) return
      const rect = currentTarget.getBoundingClientRect()
      if (rect.width <= 0) return

      const relX = ((clientX - rect.left) / rect.width) * chartGeometry.width
      const clampedX = Math.max(
        chartGeometry.padLeft,
        Math.min(chartGeometry.padLeft + chartGeometry.plotWidth, relX),
      )
      const ratio =
        (clampedX - chartGeometry.padLeft) / Math.max(1, chartGeometry.plotWidth)
      const nearestIdx = Math.round(ratio * (visiblePoints.length - 1))
      setHoverIndex(
        Math.max(0, Math.min(visiblePoints.length - 1, nearestIdx)),
      )
    },
    [chartGeometry, visiblePoints.length],
  )

  const handleTouchStart = useCallback(
    (e: React.TouchEvent<SVGSVGElement>) => {
      if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX
        const dy = e.touches[0].clientY - e.touches[1].clientY
        pinchStartRef.current = {
          dist: Math.hypot(dx, dy),
          window: [startIdx, endIdx],
        }
      }
    },
    [startIdx, endIdx],
  )

  const handleTouchMove = useCallback(
    (e: React.TouchEvent<SVGSVGElement>) => {
      if (e.touches.length === 2 && pinchStartRef.current && totalPoints >= MIN_VISIBLE_POINTS) {
        const dx = e.touches[0].clientX - e.touches[1].clientX
        const dy = e.touches[0].clientY - e.touches[1].clientY
        const curDist = Math.hypot(dx, dy)
        if (pinchStartRef.current.dist > 10 && curDist > 10) {
          const scaleRatio = pinchStartRef.current.dist / curDist
          const [origStart, origEnd] = pinchStartRef.current.window
          const origLen = origEnd - origStart + 1
          const nextLen = Math.max(
            MIN_VISIBLE_POINTS,
            Math.min(totalPoints, Math.round(origLen * scaleRatio)),
          )
          if (nextLen >= totalPoints) {
            setZoomWindow(null)
            return
          }
          const mid = (origStart + origEnd) / 2
          let nextStart = Math.round(mid - (nextLen - 1) / 2)
          nextStart = Math.max(0, Math.min(totalPoints - nextLen, nextStart))
          setZoomWindow([nextStart, nextStart + nextLen - 1])
          setHoverIndex(null)
        }
      }
    },
    [totalPoints],
  )

  const handleTouchEnd = useCallback(() => {
    pinchStartRef.current = null
  }, [])

  const handleScrubBarClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!isZoomed || totalPoints < MIN_VISIBLE_POINTS) return
      const rect = e.currentTarget.getBoundingClientRect()
      if (rect.width <= 0) return
      const frac = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
      const curLen = endIdx - startIdx + 1
      const centerIdx = Math.round(frac * (totalPoints - 1))
      const nextStart = Math.max(
        0,
        Math.min(totalPoints - curLen, Math.round(centerIdx - curLen / 2)),
      )
      setHoverIndex(null)
      setZoomWindow([nextStart, nextStart + curLen - 1])
    },
    [isZoomed, totalPoints, startIdx, endIdx],
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<SVGSVGElement>) => {
      if (visiblePoints.length === 0) return
      const last = visiblePoints.length - 1
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        setHoverIndex((prev) => (prev === null ? last - 1 : Math.max(0, prev - 1)))
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        setHoverIndex((prev) => (prev === null ? last : Math.min(last, prev + 1)))
      } else if (e.key === '+' || e.key === '=') {
        e.preventDefault()
        applyZoom('in')
      } else if (e.key === '-') {
        e.preventDefault()
        applyZoom('out')
      } else if (e.key === 'Escape') {
        setHoverIndex(null)
      }
    },
    [visiblePoints.length, applyZoom],
  )

  if (!activeMineral || !fullSeries || !visibleStats || !chartGeometry) {
    return null
  }

  const lastIdx = visiblePoints.length - 1
  const safeHoverIdx =
    hoverIndex !== null && hoverIndex <= lastIdx ? hoverIndex : null
  const activePointIdx = safeHoverIdx !== null ? safeHoverIdx : lastIdx
  const activePoint = visiblePoints[activePointIdx]
  const activeCoord = chartGeometry.coords[activePointIdx]
  const terminalCoord = chartGeometry.coords[lastIdx]

  const displayedUnitUsd = activePoint.unitUsd
  const displayedDeltaUsd = displayedUnitUsd - visibleStats.startUnitUsd
  const displayedDeltaPct =
    visibleStats.startUnitUsd > 0
      ? (displayedDeltaUsd / visibleStats.startUnitUsd) * 100
      : 0

  const seriesPositive = visibleStats.changeUnitUsd >= 0
  const displayedPositive = displayedDeltaUsd >= 0

  const strokeColor = seriesPositive ? '#2f6f4e' : '#a33a2a'
  const fillTopOpacity = seriesPositive ? 0.25 : 0.22

  const sokoTier = convertToChartUnitUsd(
    activeMineral.local_market_price_usd,
    activeMineral.unit,
    unitBasis,
  )
  const buyingTier = convertToChartUnitUsd(
    activeMineral.buying_centre_price_usd,
    activeMineral.unit,
    unitBasis,
  )

  const visibleDateWindowLabel = formatVisibleDateWindow(
    visibleStats.startMs,
    visibleStats.endMs,
    visibleStats.scale,
    language,
  )

  const activeRangeBadge =
    timeframe === '1Y' ? String(selectedYear) : `${selectedYear} · ${timeframe}`

  const tooltipAlignRight =
    activeCoord.x > chartGeometry.padLeft + chartGeometry.plotWidth * 0.62

  const scrubLeftPct = totalPoints > 1 ? (startIdx / (totalPoints - 1)) * 100 : 0
  const scrubWidthPct =
    totalPoints > 1 ? ((endIdx - startIdx) / (totalPoints - 1)) * 100 : 100

  const { yearSummary } = fullSeries
  const showYearEvaluationCard = timeframe === '1Y' || !yearSummary.isYtd

  return (
    <section
      aria-label={ui(
        'Interactive Mineral Trend Chart',
        'Chati Shirikishi ya Mwenendo wa Bei za Madini',
        'Gráfico Interactivo de Tendencia Mineral',
      )}
      data-currency={currency}
      data-language={language}
      data-unit-basis={unitBasis}
      className="overflow-hidden rounded-xl border border-ink/15 bg-paper text-ink shadow-sm"
    >
      {/* Top Masthead Bar */}
      <div className="flex flex-col justify-between gap-2 border-b border-ink/10 bg-paper-2 px-4 py-3 sm:flex-row sm:items-center sm:px-5 lg:px-6">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-ochre">
            <TrendingUp size={13} />
            {ui(
              'Interactive Mineral Trend',
              'Mwenendo wa Bei ya Madini',
              'Tendencia Histórica Mineral',
            )}
          </span>
          <span className="rounded border border-ink/15 bg-paper px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-stone">
            {ui(
              `World Spot Parity (${fullSeries.unitSuffix})`,
              `Soko la Dunia (${fullSeries.unitSuffix})`,
              `Paridad Spot Mundial (${fullSeries.unitSuffix})`,
            )}
          </span>
        </div>

        <span className="inline-flex shrink-0 self-start items-center gap-1.5 rounded-md border border-ink/15 bg-paper px-2.5 py-1 font-mono text-[11px] font-semibold text-ink sm:self-center">
          <span
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: strokeColor }}
            aria-hidden="true"
          />
          {currencyMeta.flag} {currency}
          {fullSeries.unitSuffix}
        </span>
      </div>

      {/* Mineral Selector Strip */}
      <div className="border-b border-ink/10 bg-paper px-4 py-2.5 sm:px-5 lg:px-6">
        <div
          role="tablist"
          aria-label={ui('Select mineral', 'Chagua madini', 'Seleccionar mineral')}
          className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0"
        >
          {minerals.map((m) => {
            const isSelected = m.symbol === activeMineral.symbol
            const shortName = getShortMineralLabel(m.mineral_name)
            return (
              <button
                key={m.id}
                type="button"
                role="tab"
                aria-selected={isSelected}
                onClick={() => handleSymbolChange(m.symbol)}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-left transition ${
                  isSelected
                    ? 'border-ink bg-ink text-paper shadow-xs'
                    : 'border-ink/12 bg-paper-2/55 text-ink-3 hover:border-ochre/45 hover:bg-paper-2 hover:text-ink'
                }`}
              >
                <span
                  className={`font-mono text-[11px] font-bold tracking-wide ${
                    isSelected ? 'text-gold' : 'text-ochre'
                  }`}
                >
                  {m.symbol}
                </span>
                <span className="text-xs font-medium">{shortName}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Headline Price Readout + Unified Year Selector & 5-Pill Timeframe Strip */}
      <div className="flex flex-col justify-between gap-3.5 px-4 pt-4 pb-3 sm:px-5 lg:flex-row lg:items-end lg:px-6">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display text-2xl font-medium text-ink sm:text-[26px]">
              {activeMineral.mineral_name}
            </h3>
            <span className="rounded border border-ink/15 bg-ink px-2 py-0.5 font-mono text-[11px] font-bold text-gold">
              {activeMineral.symbol}
            </span>
          </div>

          <div className="mt-1.5 flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
            <span className="font-mono text-3xl font-bold tracking-tight text-ink tabular-nums sm:text-4xl">
              {formatPrice(displayedUnitUsd)}
            </span>
            <span className="font-mono text-base font-medium text-stone">
              {fullSeries.unitSuffix}
            </span>

            <span
              className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 font-mono text-xs font-semibold tabular-nums ${
                displayedPositive
                  ? 'border-moss/30 bg-moss-light text-moss'
                  : 'border-danger/30 bg-danger/10 text-danger'
              }`}
            >
              {displayedPositive ? (
                <ArrowUpRight size={13} />
              ) : (
                <ArrowDownRight size={13} />
              )}
              {formatSignedDelta(displayedDeltaUsd)} (
              {displayedPositive ? '+' : ''}
              {displayedDeltaPct.toFixed(2)}%)
            </span>
          </div>

          <p className="mt-1 font-mono text-[11px] text-stone tabular-nums">
            {safeHoverIdx !== null ? (
              <>
                <span className="font-semibold text-ink">
                  {formatChartTooltipDateByScale(
                    activePoint.timestampMs,
                    visibleStats.scale,
                    visibleStats.spanMs,
                    language,
                  )}
                </span>{' '}
                · {activeRangeBadge}
              </>
            ) : (
              <>
                {yearSummary.isYtd
                  ? ui(
                      'World Spot Parity rate ·',
                      'Bei ya Soko la Dunia ·',
                      'Tasa de Paridad Spot Mundial ·',
                    )
                  : ui(
                      `${selectedYear} Historical Benchmark ·`,
                      `Bei ya Kihistoria ${selectedYear} ·`,
                      `Referencia Histórica ${selectedYear} ·`,
                    )}{' '}
                {activeMineral.exchange_desk ?? 'LBMA / Tume ya Madini'}
              </>
            )}
          </p>
        </div>

        {/* Unified Compact Year Selector + 5-Pill Multipurpose Timeframe Strip */}
        <div className="flex w-full min-w-0 flex-col gap-2 sm:w-auto sm:flex-row sm:items-center lg:self-end">
          {/* Compact Year Selector (2026, 2025, 2024, 2023) */}
          <div className="flex items-center gap-1.5">
            <div
              role="group"
              aria-label={ui('Select year', 'Chagua mwaka', 'Seleccionar año')}
              className="grid w-full grid-cols-4 gap-0.5 rounded-lg border border-ink/12 bg-paper-2 p-1 sm:inline-flex sm:w-auto"
            >
              {selectableYears.map((yr) => {
                const active = selectedYear === yr
                return (
                  <button
                    key={yr}
                    type="button"
                    aria-pressed={active}
                    onClick={() => handleYearChange(yr)}
                    className={`rounded-md px-2 py-1.5 text-center font-mono text-[11px] font-semibold transition tabular-nums sm:px-2.5 sm:text-xs ${
                      active
                        ? 'bg-ochre text-paper shadow-xs'
                        : 'text-ink-3 hover:text-ink'
                    }`}
                  >
                    {yr}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Minimal 5-Pill Granularity Strip (1M | 1H | 1D | 1Mo | 1Y) */}
          <div
            role="group"
            aria-label={ui('Chart timeframe', 'Muda wa chati', 'Período del gráfico')}
            className="grid w-full grid-cols-5 gap-0.5 rounded-lg border border-ink/12 bg-paper-2 p-1 sm:inline-flex sm:w-auto sm:gap-1"
          >
            {CHART_TIMEFRAMES.map((tf) => {
              const active = tf === timeframe
              return (
                <button
                  key={tf}
                  type="button"
                  aria-pressed={active}
                  onClick={() => handleTimeframeChange(tf)}
                  className={`rounded-md px-2 py-1.5 text-center font-mono text-[11px] font-semibold transition sm:px-3 sm:text-xs ${
                    active
                      ? 'bg-ink text-gold shadow-xs'
                      : 'text-ink-3 hover:text-ink'
                  }`}
                >
                  {tf}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Explicit Date & EAT Window + Auto-Granularity Scale + Zoom Controls Toolbar */}
      <div className="mx-4 mb-2 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-ink/10 bg-paper-2/65 px-3 py-2 sm:mx-5 lg:mx-6">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 font-mono text-[10.5px] font-semibold text-ink tabular-nums sm:text-[11px]">
            <Calendar size={12} className="shrink-0 text-ochre" />
            <span className="truncate">{visibleDateWindowLabel}</span>
          </span>
          <span className="inline-flex items-center rounded border border-ochre/25 bg-ochre/10 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-ochre">
            {formatScaleLabel(visibleStats.scale)}
          </span>
        </div>

        <div
          role="group"
          aria-label={ui('Chart zoom controls', 'Vidhibiti vya kukuza chati', 'Controles de zoom')}
          className="flex items-center gap-1"
        >
          {isZoomed && (
            <>
              <button
                type="button"
                onClick={() => applyPan('left')}
                disabled={startIdx <= 0}
                title={ui('Pan earlier', 'Sogeza nyuma', 'Desplazar atrás')}
                aria-label={ui('Pan earlier', 'Sogeza nyuma', 'Desplazar atrás')}
                className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-ink/12 bg-paper text-ink transition hover:border-ochre hover:text-ochre disabled:opacity-35"
              >
                <ChevronLeft size={13} />
              </button>
              <button
                type="button"
                onClick={() => applyPan('right')}
                disabled={endIdx >= totalPoints - 1}
                title={ui('Pan later', 'Sogeza mbele', 'Desplazar adelante')}
                aria-label={ui('Pan later', 'Sogeza mbele', 'Desplazar adelante')}
                className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-ink/12 bg-paper text-ink transition hover:border-ochre hover:text-ochre disabled:opacity-35"
              >
                <ChevronRight size={13} />
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => applyZoom('in')}
            disabled={!canZoomIn}
            title={ui('Zoom in', 'Kuza ndani', 'Acercar')}
            aria-label={ui('Zoom in', 'Kuza ndani', 'Acercar')}
            className="inline-flex h-7 items-center gap-1 rounded-md border border-ink/12 bg-paper px-2 font-mono text-[10px] font-semibold text-ink transition hover:border-ochre hover:text-ochre disabled:opacity-35"
          >
            <ZoomIn size={12} />
            <span className="hidden sm:inline">{ui('Zoom In', 'Kuza', 'Acercar')}</span>
          </button>
          <button
            type="button"
            onClick={() => applyZoom('out')}
            disabled={!canZoomOut}
            title={ui('Zoom out', 'Punguza', 'Alejar')}
            aria-label={ui('Zoom out', 'Punguza', 'Alejar')}
            className="inline-flex h-7 items-center gap-1 rounded-md border border-ink/12 bg-paper px-2 font-mono text-[10px] font-semibold text-ink transition hover:border-ochre hover:text-ochre disabled:opacity-35"
          >
            <ZoomOut size={12} />
            <span className="hidden sm:inline">{ui('Zoom Out', 'Punguza', 'Alejar')}</span>
          </button>
          {(isZoomed || focusTimestampMs !== null) && (
            <button
              type="button"
              onClick={handleResetZoom}
              title={ui('Reset zoom', 'Rejesha ukubwa', 'Restablecer zoom')}
              aria-label={ui('Reset zoom', 'Rejesha ukubwa', 'Restablecer zoom')}
              className="inline-flex h-7 items-center gap-1 rounded-md border border-ink/20 bg-ink px-2 font-mono text-[10px] font-semibold text-gold transition hover:bg-ochre hover:text-paper"
            >
              <RotateCcw size={11} />
              <span>{ui('Reset', 'Rejesha', 'Reset')}</span>
            </button>
          )}
        </div>
      </div>

      {/* Interactive Financial Area/Line Chart */}
      <div className="relative px-2 pb-3 sm:px-6 sm:pb-4">
        <div ref={chartContainerRef} className="relative w-full select-none">
          <svg
            ref={svgRef}
            width={chartGeometry.width}
            height={chartGeometry.height}
            viewBox={`0 0 ${chartGeometry.width} ${chartGeometry.height}`}
            role="img"
            tabIndex={0}
            aria-label={`${activeMineral.mineral_name} ${activeRangeBadge} World Spot Parity ${ui('price trend', 'mwenendo wa bei', 'tendencia de precio')} (${currency}${fullSeries.unitSuffix})`}
            className="block w-full cursor-crosshair touch-none rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ochre/40"
            onPointerMove={(e) => handlePointerScrub(e.clientX, e.currentTarget)}
            onPointerDown={(e) => handlePointerScrub(e.clientX, e.currentTarget)}
            onPointerLeave={() => setHoverIndex(null)}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onKeyDown={handleKeyDown}
          >
            <defs>
              <linearGradient
                id={`trend-fill-${gradientId}`}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop
                  offset="0%"
                  stopColor={strokeColor}
                  stopOpacity={fillTopOpacity}
                />
                <stop
                  offset="82%"
                  stopColor={strokeColor}
                  stopOpacity={0.03}
                />
                <stop offset="100%" stopColor={strokeColor} stopOpacity={0} />
              </linearGradient>
            </defs>

            {/* Horizontal Gridlines & Left Y-Axis Labels (tabular-nums) */}
            {chartGeometry.yTickPositions.map((tick, idx) => (
              <g key={`y-${idx}`}>
                <line
                  x1={chartGeometry.padLeft}
                  y1={tick.y}
                  x2={chartGeometry.width - chartGeometry.padRight}
                  y2={tick.y}
                  stroke="rgba(21, 18, 15, 0.08)"
                  strokeWidth={1}
                />
                <text
                  x={chartGeometry.padLeft - (chartGeometry.isCompact ? 6 : 10)}
                  y={tick.y + 3.5}
                  textAnchor="end"
                  fill="#776c60"
                  fontSize={chartGeometry.isCompact ? '10' : '11'}
                  fontFamily="var(--font-mono)"
                  style={{ fontVariantNumeric: 'tabular-nums' }}
                >
                  {tick.label}
                </text>
              </g>
            ))}

            {/* Vertical Gridlines & Bottom X-Axis Date/Time Labels */}
            {chartGeometry.xTicks.map((tick, idx) => {
              const isFirst = idx === 0
              const isLast = idx === chartGeometry.xTicks.length - 1
              return (
                <g key={`x-${idx}`}>
                  <line
                    x1={tick.x}
                    y1={chartGeometry.padTop}
                    x2={tick.x}
                    y2={chartGeometry.baselineY}
                    stroke="rgba(21, 18, 15, 0.05)"
                    strokeWidth={1}
                  />
                  <text
                    x={tick.x}
                    y={chartGeometry.baselineY + (chartGeometry.isCompact ? 17 : 20)}
                    textAnchor={isFirst ? 'start' : isLast ? 'end' : 'middle'}
                    fill="#776c60"
                    fontSize={chartGeometry.isCompact ? '10' : '11'}
                    fontFamily="var(--font-mono)"
                    style={{ fontVariantNumeric: 'tabular-nums' }}
                  >
                    {tick.label}
                  </text>
                </g>
              )
            })}

            {/* Visible-Period Opening Reference Dashed Baseline */}
            <line
              x1={chartGeometry.padLeft}
              y1={chartGeometry.openY}
              x2={chartGeometry.width - chartGeometry.padRight}
              y2={chartGeometry.openY}
              stroke="rgba(21, 18, 15, 0.22)"
              strokeWidth={1}
              strokeDasharray="3 4"
            />

            {/* Soft Translucent Area Fill Beneath Trend Curve */}
            <path
              d={chartGeometry.areaPath}
              fill={`url(#trend-fill-${gradientId})`}
            />

            {/* Crisp Continuous Price Trend Line */}
            <path
              d={chartGeometry.linePath}
              fill="none"
              stroke={strokeColor}
              strokeWidth={2.25}
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Hover / Scrub Crosshair Lines & Active Point Marker */}
            {safeHoverIdx !== null && (
              <g>
                <line
                  x1={activeCoord.x}
                  y1={chartGeometry.padTop}
                  x2={activeCoord.x}
                  y2={chartGeometry.baselineY}
                  stroke="rgba(21, 18, 15, 0.28)"
                  strokeWidth={1}
                  strokeDasharray="3 3"
                />
                <line
                  x1={chartGeometry.padLeft}
                  y1={activeCoord.y}
                  x2={chartGeometry.width - chartGeometry.padRight}
                  y2={activeCoord.y}
                  stroke="rgba(21, 18, 15, 0.14)"
                  strokeWidth={1}
                  strokeDasharray="3 3"
                />
                <circle
                  cx={activeCoord.x}
                  cy={activeCoord.y}
                  r={7}
                  fill={strokeColor}
                  fillOpacity={0.2}
                />
                <circle
                  cx={activeCoord.x}
                  cy={activeCoord.y}
                  r={4.2}
                  fill={strokeColor}
                  stroke="#f6f1e7"
                  strokeWidth={2}
                />
              </g>
            )}

            {/* Terminal Marker Dot at Latest Visible Data Point */}
            <g aria-hidden="true">
              <circle
                cx={terminalCoord.x}
                cy={terminalCoord.y}
                r={9}
                fill={strokeColor}
                fillOpacity={0.2}
              />
              <circle
                cx={terminalCoord.x}
                cy={terminalCoord.y}
                r={4.5}
                fill={strokeColor}
                stroke="#f6f1e7"
                strokeWidth={2.25}
              />
            </g>
          </svg>

          {/* Interactive Floating Scrub Tooltip (Exact Date + EAT Time) */}
          {safeHoverIdx !== null && (
            <div
              role="status"
              aria-live="polite"
              className="pointer-events-none absolute top-2 z-20 min-w-[200px] rounded-lg border border-ink/15 bg-ink px-3.5 py-2.5 text-paper shadow-md"
              style={
                tooltipAlignRight
                  ? {
                      right: `${Math.max(
                        10,
                        chartGeometry.width - activeCoord.x + 12,
                      )}px`,
                    }
                  : {
                      left: `${Math.min(
                        Math.max(10, chartGeometry.width - 210),
                        Math.max(chartGeometry.padLeft + 6, activeCoord.x + 12),
                      )}px`,
                    }
              }
            >
              <div className="font-mono text-[10px] tracking-wide text-paper/75 tabular-nums">
                {formatChartTooltipDateByScale(
                  activePoint.timestampMs,
                  visibleStats.scale,
                  visibleStats.spanMs,
                  language,
                )}
              </div>
              <div className="mt-1 flex items-baseline gap-1 font-mono text-sm font-bold text-paper tabular-nums">
                <span>{formatPrice(displayedUnitUsd)}</span>
                <span className="text-[11px] font-normal text-gold">
                  {fullSeries.unitSuffix}
                </span>
              </div>
              <div
                className={`mt-0.5 font-mono text-[11px] font-semibold tabular-nums ${
                  displayedPositive ? 'text-[#9de4b4]' : 'text-[#f59c8a]'
                }`}
              >
                {formatSignedDelta(displayedDeltaUsd)} (
                {displayedPositive ? '+' : ''}
                {displayedDeltaPct.toFixed(2)}%) · {activeRangeBadge}
              </div>
            </div>
          )}

          {/* Interactive Zoom Position Scrub Track (Shown When Zoomed) */}
          {isZoomed && (
            <div className="mt-2 px-1">
              <div
                role="slider"
                aria-label={ui('Pan visible zoom window', 'Sogeza sehemu iliyokuzwa', 'Desplazar rango visible')}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(scrubLeftPct)}
                tabIndex={0}
                onClick={handleScrubBarClick}
                className="relative h-2 w-full cursor-pointer overflow-hidden rounded-full bg-ink/10"
              >
                <div
                  className="absolute top-0 h-full rounded-full bg-ochre transition-all duration-150"
                  style={{
                    left: `${scrubLeftPct}%`,
                    width: `${Math.max(8, scrubWidthPct)}%`,
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Year Evaluation Card (Shown on 1Y or Any Selected Historical Year) */}
      {showYearEvaluationCard && (
        <div className="mx-4 mb-4 rounded-xl border border-ink/12 bg-white px-4 py-3.5 shadow-xs sm:mx-5 sm:px-5 lg:mx-6">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink/8 pb-2.5">
            <div className="flex items-center gap-2">
              <span className="rounded bg-ink px-2 py-0.5 font-mono text-[10px] font-bold text-gold tabular-nums">
                {yearSummary.year}
              </span>
              <span className="font-display text-sm font-medium text-ink sm:text-base">
                {yearSummary.isYtd
                  ? ui(
                      `${yearSummary.year} Year-to-Date Evaluation`,
                      `Tathmini ya Mwaka ${yearSummary.year} Hadi Sasa`,
                      `Evaluación Acumulada ${yearSummary.year}`,
                    )
                  : ui(
                      `${yearSummary.year} Full-Year Evaluation`,
                      `Tathmini ya Mwaka Kamili ${yearSummary.year}`,
                      `Evaluación Anual ${yearSummary.year}`,
                    )}
              </span>
            </div>
            <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-stone">
              {currencyMeta.flag} {currency}
              {fullSeries.unitSuffix}
            </span>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-3 sm:grid-cols-5">
            <div className="min-w-0">
              <span className="block truncate font-mono text-[9.5px] uppercase tracking-wider text-stone">
                {ui('Opening', 'Kufungua', 'Apertura')}
              </span>
              <span className="mt-0.5 block whitespace-nowrap font-mono text-[12px] font-bold text-ink tabular-nums sm:text-xs">
                {formatPrice(yearSummary.openUnitUsd)}
                <span className="font-normal text-stone">{fullSeries.unitSuffix}</span>
              </span>
            </div>

            <div className="min-w-0">
              <span className="block truncate font-mono text-[9.5px] uppercase tracking-wider text-stone">
                {yearSummary.year} {ui('High', 'Juu Zaidi', 'Máximo')}
              </span>
              <span className="mt-0.5 block whitespace-nowrap font-mono text-[12px] font-bold text-ink tabular-nums sm:text-xs">
                {formatPrice(yearSummary.highUnitUsd)}
                <span className="font-normal text-stone">{fullSeries.unitSuffix}</span>
              </span>
            </div>

            <div className="min-w-0">
              <span className="block truncate font-mono text-[9.5px] uppercase tracking-wider text-stone">
                {yearSummary.year} {ui('Low', 'Chini Zaidi', 'Mínimo')}
              </span>
              <span className="mt-0.5 block whitespace-nowrap font-mono text-[12px] font-bold text-ink tabular-nums sm:text-xs">
                {formatPrice(yearSummary.lowUnitUsd)}
                <span className="font-normal text-stone">{fullSeries.unitSuffix}</span>
              </span>
            </div>

            <div className="min-w-0">
              <span className="block truncate font-mono text-[9.5px] uppercase tracking-wider text-stone">
                {yearSummary.isYtd
                  ? ui('Latest', 'Ya Sasa', 'Actual')
                  : ui('Year-End', 'Mwisho wa Mwaka', 'Cierre')}
              </span>
              <span className="mt-0.5 block whitespace-nowrap font-mono text-[12px] font-bold text-ink tabular-nums sm:text-xs">
                {formatPrice(yearSummary.closeUnitUsd)}
                <span className="font-normal text-stone">{fullSeries.unitSuffix}</span>
              </span>
            </div>

            <div className="col-span-2 min-w-0 sm:col-span-1">
              <span className="block truncate font-mono text-[9.5px] uppercase tracking-wider text-stone">
                {ui('Annual Move', 'Mabadiliko', 'Variación')}
              </span>
              <span
                className={`mt-0.5 inline-flex items-center gap-0.5 whitespace-nowrap font-mono text-[12px] font-bold tabular-nums sm:text-xs ${
                  yearSummary.yoyChangeUsd >= 0 ? 'text-moss' : 'text-danger'
                }`}
              >
                {yearSummary.yoyChangeUsd >= 0 ? '+' : ''}
                {yearSummary.yoyChangePct.toFixed(2)}%
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Mode-Matched Statutory Benchmark Summary Strip */}
      <div className="grid grid-cols-2 gap-x-3 gap-y-3 border-t border-ink/10 bg-paper-2/70 px-4 py-3.5 sm:grid-cols-4 sm:px-5 lg:px-6">
        <div className="min-w-0">
          <span className="block truncate font-mono text-[9.5px] uppercase tracking-wider text-stone sm:text-[10px]">
            {timeframe} {ui('High', 'Juu Zaidi', 'Máximo')} ({fullSeries.unitSuffix})
          </span>
          <span className="mt-0.5 block whitespace-nowrap font-mono text-[12px] font-bold text-ink tabular-nums sm:text-xs">
            {formatPrice(visibleStats.maxUnitUsd)}
            <span className="font-normal text-stone">{fullSeries.unitSuffix}</span>
          </span>
        </div>

        <div className="min-w-0">
          <span className="block truncate font-mono text-[9.5px] uppercase tracking-wider text-stone sm:text-[10px]">
            {timeframe} {ui('Low', 'Chini Zaidi', 'Mínimo')} ({fullSeries.unitSuffix})
          </span>
          <span className="mt-0.5 block whitespace-nowrap font-mono text-[12px] font-bold text-ink tabular-nums sm:text-xs">
            {formatPrice(visibleStats.minUnitUsd)}
            <span className="font-normal text-stone">{fullSeries.unitSuffix}</span>
          </span>
        </div>

        <div className="min-w-0">
          <span className="block truncate font-mono text-[9.5px] uppercase tracking-wider text-moss sm:text-[10px]">
            {ui(
              'Statutory Soko la Madini',
              'Soko la Madini (Rasmi)',
              'Soko la Madini Oficial',
            )}{' '}
            ({sokoTier.unitSuffix})
          </span>
          <span className="mt-0.5 block whitespace-nowrap font-mono text-[12px] font-bold text-moss tabular-nums sm:text-xs">
            {formatPrice(sokoTier.unitUsd)}
            <span className="font-normal text-stone">{sokoTier.unitSuffix}</span>
          </span>
        </div>

        <div className="min-w-0">
          <span className="block truncate font-mono text-[9.5px] uppercase tracking-wider text-ochre sm:text-[10px]">
            {ui('Buying Centre Floor', 'Kituo cha Ununuzi', 'Centro de Compra')} (
            {buyingTier.unitSuffix})
          </span>
          <span className="mt-0.5 block whitespace-nowrap font-mono text-[12px] font-bold text-ink tabular-nums sm:text-xs">
            {formatPrice(buyingTier.unitUsd)}
            <span className="font-normal text-stone">{buyingTier.unitSuffix}</span>
          </span>
        </div>
      </div>
    </section>
  )
}
