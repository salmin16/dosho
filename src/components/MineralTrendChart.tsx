'use client'

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import {
  ArrowDownRight,
  ArrowUpRight,
  Calendar,
  Minus,
  Plus,
  RotateCcw,
  TrendingUp,
} from 'lucide-react'
import { useLocalization } from '../context/LocalizationContext'
import {
  TAPE_TOTAL_SLOTS,
  computeNiceAxisTicks,
  computeNiceTimeTicks,
  computeTapeCounter,
  convertToChartUnitUsd,
  createContinuousMineralModel,
  detectTimelineScale,
  formatChartAxisDateByScale,
  formatChartTooltipDateByScale,
  formatSpanCompact,
  formatVisibleDateWindow,
  type ChartPricingMode,
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

interface ViewportRange {
  startMs: number
  endMs: number
}

interface DragState {
  pointerId: number
  startClientX: number
  startView: ViewportRange
  plotWidth: number
  moved: boolean
}

interface PinchState {
  startDist: number
  startMidFrac: number
  startView: ViewportRange
}

function getShortMineralLabel(mineralName: string): string {
  const withoutParens = mineralName.replace(/\s*\([^)]*\)/g, '').trim()
  return withoutParens || mineralName
}

function clampViewport(
  rawStartMs: number,
  rawEndMs: number,
  historyStartMs: number,
  historyEndMs: number,
  minSpanMs: number,
  maxSpanMs: number,
): ViewportRange {
  const span = Math.max(
    minSpanMs,
    Math.min(maxSpanMs, rawEndMs - rawStartMs),
  )
  let endMs = rawEndMs
  let startMs = endMs - span

  if (endMs > historyEndMs) {
    endMs = historyEndMs
    startMs = endMs - span
  }
  if (startMs < historyStartMs) {
    startMs = historyStartMs
    endMs = Math.min(historyEndMs, startMs + span)
  }

  return { startMs, endMs }
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

  const uid = useId().replace(/:/g, '')
  const chartContainerRef = useRef<HTMLDivElement | null>(null)
  const svgRef = useRef<SVGSVGElement | null>(null)
  const dragRef = useRef<DragState | null>(null)
  const pinchRef = useRef<PinchState | null>(null)
  const viewportRef = useRef<ViewportRange | null>(null)
  const plotMetricsRef = useRef<{ padLeft: number; plotWidth: number }>({
    padLeft: 10,
    plotWidth: 640,
  })

  const [chartWidth, setChartWidth] = useState<number>(880)
  const [internalSymbol, setInternalSymbol] = useState<string>(
    () => minerals[0]?.symbol ?? 'XAU',
  )
  const [viewport, setViewport] = useState<ViewportRange | null>(null)
  const [inspectIndex, setInspectIndex] = useState<number | null>(null)
  const [isDragging, setIsDragging] = useState<boolean>(false)

  const activeSymbol = controlledSymbol ?? internalSymbol

  const activeMineral = useMemo(() => {
    if (!minerals.length) return null
    return minerals.find((m) => m.symbol === activeSymbol) ?? minerals[0]
  }, [minerals, activeSymbol])

  // Continuous 4-year -> sub-minute model anchored to live World Spot Parity
  const model = useMemo(() => {
    if (!activeMineral) return null
    return createContinuousMineralModel(activeMineral, unitBasis)
  }, [activeMineral, unitBasis])

  const defaultViewport = useMemo<ViewportRange | null>(() => {
    if (!model) return null
    return {
      startMs: model.historyEndMs - model.defaultSpanMs,
      endMs: model.historyEndMs,
    }
  }, [model])

  const activeViewport = useMemo<ViewportRange | null>(() => {
    if (!model || !defaultViewport) return null
    if (!viewport) return defaultViewport
    return clampViewport(
      viewport.startMs,
      viewport.endMs,
      model.historyStartMs,
      model.historyEndMs,
      model.minSpanMs,
      model.maxSpanMs,
    )
  }, [model, defaultViewport, viewport])

  useEffect(() => {
    viewportRef.current = activeViewport
  }, [activeViewport])

  const handleSymbolChange = useCallback(
    (symbol: string) => {
      setInspectIndex(null)
      setViewport(null)
      if (onSelectSymbol) {
        onSelectSymbol(symbol)
      } else {
        setInternalSymbol(symbol)
      }
    },
    [onSelectSymbol],
  )

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

  // Clear crosshair readout when switching unit basis
  useEffect(() => {
    setInspectIndex(null)
  }, [unitBasis])

  const isCompact = chartWidth < 600
  const sampleCount = isCompact ? 156 : 220

  const visiblePoints = useMemo(() => {
    if (!model || !activeViewport) return []
    return model.sampleWindow(
      activeViewport.startMs,
      activeViewport.endMs,
      sampleCount,
    )
  }, [model, activeViewport, sampleCount])

  const visibleStats = useMemo(() => {
    if (visiblePoints.length < 2 || !activeViewport || !model) return null
    const startPt = visiblePoints[0]
    const endPt = visiblePoints[visiblePoints.length - 1]
    let minUsd = startPt.unitUsd
    let maxUsd = startPt.unitUsd
    for (const pt of visiblePoints) {
      if (pt.unitUsd < minUsd) minUsd = pt.unitUsd
      if (pt.unitUsd > maxUsd) maxUsd = pt.unitUsd
    }

    const spanMs = Math.max(1, activeViewport.endMs - activeViewport.startMs)
    const scale = detectTimelineScale(spanMs)
    const changeUsd = endPt.unitUsd - startPt.unitUsd
    const changePct =
      startPt.unitUsd > 0 ? (changeUsd / startPt.unitUsd) * 100 : 0

    return {
      startMs: activeViewport.startMs,
      endMs: activeViewport.endMs,
      spanMs,
      scale,
      spanCompact: formatSpanCompact(spanMs),
      startUnitUsd: startPt.unitUsd,
      endUnitUsd: endPt.unitUsd,
      minUnitUsd: minUsd,
      maxUnitUsd: maxUsd,
      changeUnitUsd: changeUsd,
      changePct,
    }
  }, [visiblePoints, activeViewport, model])

  const isModifiedView = useMemo(() => {
    if (!activeViewport || !defaultViewport) return false
    const spanDiff = Math.abs(
      activeViewport.endMs -
        activeViewport.startMs -
        (defaultViewport.endMs - defaultViewport.startMs),
    )
    const endDiff = Math.abs(activeViewport.endMs - defaultViewport.endMs)
    return spanDiff > 30_000 || endDiff > 30_000
  }, [activeViewport, defaultViewport])

  const canZoomIn = Boolean(
    model &&
      activeViewport &&
      activeViewport.endMs - activeViewport.startMs > model.minSpanMs * 1.05,
  )
  const canZoomOut = Boolean(
    model &&
      activeViewport &&
      activeViewport.endMs - activeViewport.startMs < model.maxSpanMs * 0.995,
  )

  // Continuous zoom around a fractional X anchor (0 = left edge, 1 = right edge)
  const applyContinuousZoom = useCallback(
    (scaleFactor: number, anchorFrac = 0.5) => {
      if (!model) return
      const current = viewportRef.current
      if (!current) return

      const curSpan = Math.max(model.minSpanMs, current.endMs - current.startMs)
      const nextSpan = Math.max(
        model.minSpanMs,
        Math.min(model.maxSpanMs, curSpan * scaleFactor),
      )
      const clampedFrac = Math.max(0, Math.min(1, anchorFrac))
      const anchorTime = current.startMs + clampedFrac * curSpan
      const nextStart = anchorTime - clampedFrac * nextSpan
      const nextEnd = nextStart + nextSpan

      const clamped = clampViewport(
        nextStart,
        nextEnd,
        model.historyStartMs,
        model.historyEndMs,
        model.minSpanMs,
        model.maxSpanMs,
      )
      viewportRef.current = clamped
      setViewport(clamped)
      setInspectIndex(null)
    },
    [model],
  )

  const applyContinuousPanByMs = useCallback(
    (deltaMs: number) => {
      if (!model) return
      const current = viewportRef.current
      if (!current) return

      const clamped = clampViewport(
        current.startMs + deltaMs,
        current.endMs + deltaMs,
        model.historyStartMs,
        model.historyEndMs,
        model.minSpanMs,
        model.maxSpanMs,
      )
      viewportRef.current = clamped
      setViewport(clamped)
      setInspectIndex(null)
    },
    [model],
  )

  const handleResetView = useCallback(() => {
    setViewport(null)
    setInspectIndex(null)
  }, [])

  // Smooth non-passive mouse-wheel zoom + horizontal trackpad pan
  useEffect(() => {
    const svg = svgRef.current
    if (!svg || !model) return

    const onWheel = (e: WheelEvent) => {
      const rect = svg.getBoundingClientRect()
      if (rect.width <= 0) return

      const { padLeft, plotWidth } = plotMetricsRef.current
      const svgX = ((e.clientX - rect.left) / rect.width) * chartWidth
      const anchorFrac = Math.max(
        0,
        Math.min(1, (svgX - padLeft) / Math.max(1, plotWidth)),
      )

      // Horizontal swipe or Shift+Wheel pans smoothly across time
      const isHorizontalPan =
        e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY) * 1.15
      if (isHorizontalPan) {
        const deltaPx = e.shiftKey ? e.deltaY : e.deltaX
        if (Math.abs(deltaPx) < 1) return
        e.preventDefault()
        const cur = viewportRef.current
        if (!cur) return
        const span = cur.endMs - cur.startMs
        applyContinuousPanByMs((deltaPx / Math.max(120, plotWidth)) * span * 0.9)
        return
      }

      if (Math.abs(e.deltaY) < 1) return
      e.preventDefault()
      // Exponential zoom curve feels buttery on both trackpads and notched mice
      const clampedDelta = Math.max(-180, Math.min(180, e.deltaY))
      const factor = Math.exp(clampedDelta * 0.0022)
      applyContinuousZoom(factor, anchorFrac)
    }

    svg.addEventListener('wheel', onWheel, { passive: false })
    return () => svg.removeEventListener('wheel', onWheel)
  }, [model, chartWidth, applyContinuousZoom, applyContinuousPanByMs])

  // Format right-side price axis ticks & badges crisply in the active global currency
  const formatAxisPrice = useCallback(
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
        const decimals = isZeroDecimal
          ? 0
          : step < 0.02
            ? 3
            : step < 0.25
              ? 2
              : step < 2
                ? 2
                : 1
        return displayValue.toLocaleString('en-US', {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        })
      }

      if (absVal >= 1_000_000) {
        const decimals = step < 100_000 ? 2 : absVal >= 10_000_000 ? 1 : 2
        return `${currencyMeta.symbol}${(displayValue / 1_000_000).toFixed(decimals)}M`
      }

      const decimals = isZeroDecimal
        ? 0
        : step < 0.05
          ? 3
          : absVal < 100 || step < 1
            ? 2
            : 0

      return formatPrice(usdEquivalent, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
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

  const formatScaleBadge = useCallback(
    (scale: TimelineScale): string => {
      switch (scale) {
        case 'min':
          return ui('min', 'dak', 'min')
        case 'hours':
          return ui('hours', 'saa', 'horas')
        case 'days':
          return ui('days', 'siku', 'días')
        case 'months':
          return ui('months', 'miezi', 'meses')
        case 'years':
          return ui('years', 'miaka', 'años')
      }
    },
    [ui],
  )

  // Compute SVG geometry with classic RIGHT-SIDE price axis & aligned bottom time axis
  const chartGeometry = useMemo(() => {
    if (!visibleStats || visiblePoints.length < 2) return null

    const height = isCompact ? 276 : 368
    const convertedValues = visiblePoints.map((p) => p.unitUsd * rateForSelected)
    const minConverted = Math.min(...convertedValues)
    const maxConverted = Math.max(...convertedValues)

    const {
      min: yMin,
      max: yMax,
      step: yStep,
      ticks: yTicks,
    } = computeNiceAxisTicks(minConverted, maxConverted, isCompact ? 5 : 6)

    const yTickLabels = yTicks.map((val) => ({
      value: val,
      label: formatAxisPrice(val, yStep, isCompact),
    }))

    const maxLabelLen = yTickLabels.reduce(
      (max, item) => Math.max(max, item.label.length),
      4,
    )

    // Right-side price axis width sized tightly for tabular-nums labels & live price pill
    const padLeft = isCompact ? 8 : 14
    const padRight = isCompact
      ? Math.min(68, Math.max(52, Math.round(maxLabelLen * 6.5 + 16)))
      : Math.min(118, Math.max(76, Math.round(maxLabelLen * 7.2 + 22)))
    const padTop = isCompact ? 14 : 18
    const padBottom = isCompact ? 28 : 32
    const plotWidth = Math.max(120, chartWidth - padLeft - padRight)
    const plotHeight = Math.max(120, height - padTop - padBottom)
    const ySpan = Math.max(1e-9, yMax - yMin)
    const timeSpan = Math.max(1, visibleStats.endMs - visibleStats.startMs)

    const coords = visiblePoints.map((pt, idx) => {
      const converted = convertedValues[idx]
      const x =
        padLeft + ((pt.timestampMs - visibleStats.startMs) / timeSpan) * plotWidth
      const y = padTop + (1 - (converted - yMin) / ySpan) * plotHeight
      return { x, y, pt, converted }
    })

    const linePath = coords
      .map(
        (c, idx) =>
          `${idx === 0 ? 'M' : 'L'} ${c.x.toFixed(2)} ${c.y.toFixed(2)}`,
      )
      .join(' ')

    const baselineY = padTop + plotHeight
    const areaPath = `${linePath} L ${coords[coords.length - 1].x.toFixed(2)} ${baselineY.toFixed(2)} L ${coords[0].x.toFixed(2)} ${baselineY.toFixed(2)} Z`

    const yTickPositions = yTickLabels.map((tick) => ({
      ...tick,
      y: padTop + (1 - (tick.value - yMin) / ySpan) * plotHeight,
    }))

    const xTicks = computeNiceTimeTicks({
      viewStartMs: visibleStats.startMs,
      viewEndMs: visibleStats.endMs,
      scale: visibleStats.scale,
      padLeft,
      plotWidth,
      isCompact,
      language,
    })

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
      plotRightX: padLeft + plotWidth,
      baselineY,
      yMin,
      yMax,
      yStep,
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
    isCompact,
    rateForSelected,
    formatAxisPrice,
    language,
  ])

  useEffect(() => {
    if (chartGeometry) {
      plotMetricsRef.current = {
        padLeft: chartGeometry.padLeft,
        plotWidth: chartGeometry.plotWidth,
      }
    }
  }, [chartGeometry])

  const resolveNearestIndex = useCallback(
    (clientX: number, svgEl: SVGSVGElement): number | null => {
      if (!chartGeometry || visiblePoints.length === 0) return null
      const rect = svgEl.getBoundingClientRect()
      if (rect.width <= 0) return null

      const relX = ((clientX - rect.left) / rect.width) * chartGeometry.width
      const clampedX = Math.max(
        chartGeometry.padLeft,
        Math.min(chartGeometry.plotRightX, relX),
      )
      const ratio =
        (clampedX - chartGeometry.padLeft) / Math.max(1, chartGeometry.plotWidth)
      const nearest = Math.round(ratio * (visiblePoints.length - 1))
      return Math.max(0, Math.min(visiblePoints.length - 1, nearest))
    },
    [chartGeometry, visiblePoints.length],
  )

  // Unified Pointer Handlers: Mouse drag-pan + desktop hover crosshair + mobile 1-finger pan / tap inspect
  const handlePointerDown = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (pinchRef.current) return
      if (e.pointerType === 'mouse' && e.button !== 0) return
      const curView = viewportRef.current
      if (!curView || !chartGeometry) return

      dragRef.current = {
        pointerId: e.pointerId,
        startClientX: e.clientX,
        startView: curView,
        plotWidth: chartGeometry.plotWidth,
        moved: false,
      }

      try {
        e.currentTarget.setPointerCapture(e.pointerId)
      } catch {
        // Ignore capture failure on synthetic events
      }
    },
    [chartGeometry],
  )

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (pinchRef.current) return

      const drag = dragRef.current
      if (drag && drag.pointerId === e.pointerId && model) {
        const dx = e.clientX - drag.startClientX
        if (!drag.moved && Math.abs(dx) > 4) {
          drag.moved = true
          setIsDragging(true)
          setInspectIndex(null)
        }
        if (drag.moved) {
          const span = drag.startView.endMs - drag.startView.startMs
          const shiftMs = -(dx / Math.max(80, drag.plotWidth)) * span
          const clamped = clampViewport(
            drag.startView.startMs + shiftMs,
            drag.startView.endMs + shiftMs,
            model.historyStartMs,
            model.historyEndMs,
            model.minSpanMs,
            model.maxSpanMs,
          )
          viewportRef.current = clamped
          setViewport(clamped)
        }
        return
      }

      // Passive desktop mouse hover drives live crosshair inspection
      if (e.pointerType === 'mouse') {
        const idx = resolveNearestIndex(e.clientX, e.currentTarget)
        setInspectIndex(idx)
      }
    },
    [model, resolveNearestIndex],
  )

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      const drag = dragRef.current
      if (drag && drag.pointerId === e.pointerId) {
        const wasTap = !drag.moved
        dragRef.current = null
        setIsDragging(false)
        try {
          if (e.currentTarget.hasPointerCapture(e.pointerId)) {
            e.currentTarget.releasePointerCapture(e.pointerId)
          }
        } catch {
          // Ignore
        }

        // On touch tap, toggle crosshair inspection at the tapped coordinate
        if (wasTap && e.pointerType !== 'mouse') {
          const idx = resolveNearestIndex(e.clientX, e.currentTarget)
          setInspectIndex((prev) =>
            prev !== null && idx !== null && Math.abs(prev - idx) <= 4
              ? null
              : idx,
          )
        }
      }
    },
    [resolveNearestIndex],
  )

  const handlePointerCancel = useCallback(() => {
    dragRef.current = null
    setIsDragging(false)
  }, [])

  // Native two-finger pinch-to-zoom + simultaneous two-finger midpoint pan on touch devices
  const handleTouchStart = useCallback(
    (e: React.TouchEvent<SVGSVGElement>) => {
      if (e.touches.length === 2 && chartGeometry && viewportRef.current) {
        dragRef.current = null
        setIsDragging(false)
        setInspectIndex(null)

        const rect = e.currentTarget.getBoundingClientRect()
        const t0 = e.touches[0]
        const t1 = e.touches[1]
        const dist = Math.hypot(t0.clientX - t1.clientX, t0.clientY - t1.clientY)
        const midClientX = (t0.clientX + t1.clientX) / 2
        const midSvgX =
          rect.width > 0
            ? ((midClientX - rect.left) / rect.width) * chartGeometry.width
            : chartGeometry.padLeft + chartGeometry.plotWidth / 2
        const midFrac = Math.max(
          0,
          Math.min(
            1,
            (midSvgX - chartGeometry.padLeft) / Math.max(1, chartGeometry.plotWidth),
          ),
        )

        pinchRef.current = {
          startDist: Math.max(12, dist),
          startMidFrac: midFrac,
          startView: viewportRef.current,
        }
      }
    },
    [chartGeometry],
  )

  const handleTouchMove = useCallback(
    (e: React.TouchEvent<SVGSVGElement>) => {
      if (e.touches.length === 2 && pinchRef.current && model && chartGeometry) {
        const rect = e.currentTarget.getBoundingClientRect()
        const t0 = e.touches[0]
        const t1 = e.touches[1]
        const curDist = Math.hypot(
          t0.clientX - t1.clientX,
          t0.clientY - t1.clientY,
        )
        if (curDist < 10) return

        const { startDist, startMidFrac, startView } = pinchRef.current
        const scale = startDist / curDist
        const origSpan = startView.endMs - startView.startMs
        const nextSpan = Math.max(
          model.minSpanMs,
          Math.min(model.maxSpanMs, origSpan * scale),
        )

        const curMidClientX = (t0.clientX + t1.clientX) / 2
        const curMidSvgX =
          rect.width > 0
            ? ((curMidClientX - rect.left) / rect.width) * chartGeometry.width
            : chartGeometry.padLeft + chartGeometry.plotWidth / 2
        const curMidFrac = Math.max(
          0,
          Math.min(
            1,
            (curMidSvgX - chartGeometry.padLeft) /
              Math.max(1, chartGeometry.plotWidth),
          ),
        )

        const anchorTime = startView.startMs + startMidFrac * origSpan
        const nextStart = anchorTime - curMidFrac * nextSpan
        const clamped = clampViewport(
          nextStart,
          nextStart + nextSpan,
          model.historyStartMs,
          model.historyEndMs,
          model.minSpanMs,
          model.maxSpanMs,
        )
        viewportRef.current = clamped
        setViewport(clamped)
      }
    },
    [model, chartGeometry],
  )

  const handleTouchEnd = useCallback((e: React.TouchEvent<SVGSVGElement>) => {
    if (e.touches.length < 2) {
      pinchRef.current = null
    }
  }, [])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<SVGSVGElement>) => {
      if (!activeViewport) return
      const span = activeViewport.endMs - activeViewport.startMs
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        applyContinuousPanByMs(-span * 0.2)
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        applyContinuousPanByMs(span * 0.2)
      } else if (e.key === '+' || e.key === '=') {
        e.preventDefault()
        applyContinuousZoom(0.68, 0.5)
      } else if (e.key === '-') {
        e.preventDefault()
        applyContinuousZoom(1.45, 0.5)
      } else if (e.key === '0') {
        e.preventDefault()
        handleResetView()
      } else if (e.key === 'Escape') {
        setInspectIndex(null)
      }
    },
    [activeViewport, applyContinuousPanByMs, applyContinuousZoom, handleResetView],
  )

  if (!activeMineral || !model || !visibleStats || !chartGeometry) {
    return null
  }

  const lastIdx = visiblePoints.length - 1
  const safeInspectIdx =
    inspectIndex !== null && inspectIndex <= lastIdx ? inspectIndex : null
  const activePointIdx = safeInspectIdx !== null ? safeInspectIdx : lastIdx
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
  const fillTopOpacity = seriesPositive ? 0.24 : 0.2

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

  const tapeCounter = computeTapeCounter(
    activePoint.timestampMs,
    model.historyStartMs,
    model.historyEndMs,
    TAPE_TOTAL_SLOTS,
  )

  // Right-side price axis pill badge coordinates (clamped cleanly inside plot height)
  const badgeHeight = isCompact ? 18 : 20
  const badgeHalf = badgeHeight / 2
  const clampBadgeY = (rawY: number) =>
    Math.max(
      chartGeometry.padTop + badgeHalf,
      Math.min(chartGeometry.baselineY - badgeHalf, rawY),
    )

  const terminalBadgeY = clampBadgeY(terminalCoord.y)
  const terminalBadgeLabel = formatAxisPrice(
    terminalCoord.converted,
    chartGeometry.yStep,
    isCompact,
  )

  const inspectBadgeY = clampBadgeY(activeCoord.y)
  const inspectBadgeLabel = formatAxisPrice(
    activeCoord.converted,
    chartGeometry.yStep,
    isCompact,
  )
  const inspectTimeAxisLabel = formatChartAxisDateByScale(
    activePoint.timestampMs,
    visibleStats.scale,
    visibleStats.spanMs,
    language,
  )

  const tooltipAlignRight =
    activeCoord.x > chartGeometry.padLeft + chartGeometry.plotWidth * 0.56

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
      {/* Slim Masthead Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink/10 bg-paper-2 px-4 py-2.5 sm:px-5 lg:px-6">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-ochre">
            <TrendingUp size={13} />
            {ui(
              'Interactive Mineral Trend',
              'Mwenendo wa Bei ya Madini',
              'Tendencia Mineral Interactiva',
            )}
          </span>
          <span className="rounded border border-ink/15 bg-paper px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-stone">
            {ui(
              `World Spot Parity (${model.unitSuffix})`,
              `Soko la Dunia (${model.unitSuffix})`,
              `Paridad Spot Mundial (${model.unitSuffix})`,
            )}
          </span>
        </div>

        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-ink/15 bg-paper px-2.5 py-1 font-mono text-[11px] font-semibold text-ink tabular-nums">
          <span
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: strokeColor }}
            aria-hidden="true"
          />
          {currencyMeta.flag} {currency}
          {model.unitSuffix}
        </span>
      </div>

      {/* Mineral Selector Strip */}
      <div className="border-b border-ink/10 bg-paper px-4 py-2 sm:px-5 lg:px-6">
        <div
          role="tablist"
          aria-label={ui('Select mineral', 'Chagua madini', 'Seleccionar mineral')}
          className="flex items-center gap-1.5 overflow-x-auto pb-0.5 sm:flex-wrap sm:overflow-visible sm:pb-0"
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

      {/* Direct-Manipulation Trading Header: Price + Exact Date / Scale / Counter + Minimal Zoom */}
      <div className="px-4 pt-3.5 pb-2 sm:px-5 lg:px-6">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-display text-xl font-medium text-ink sm:text-2xl">
                {activeMineral.mineral_name}
              </h3>
              <span className="rounded border border-ink/15 bg-ink px-2 py-0.5 font-mono text-[10.5px] font-bold text-gold">
                {activeMineral.symbol}/{currency}
              </span>
            </div>

            <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <span className="font-mono text-2xl font-bold tracking-tight text-ink tabular-nums sm:text-4xl">
                {formatPrice(displayedUnitUsd)}
              </span>
              <span className="font-mono text-sm font-medium text-stone sm:text-base">
                {model.unitSuffix}
              </span>
              <span
                className={`inline-flex items-center gap-0.5 rounded-md border px-2 py-0.5 font-mono text-[11px] font-semibold tabular-nums sm:text-xs ${
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
          </div>

          {/* Minimal Zoom + Reset Controls (Only Essential Controls; Direct Pan/Pinch Drives Navigation) */}
          <div
            role="group"
            aria-label={ui(
              'Chart zoom controls',
              'Vidhibiti vya kukuza chati',
              'Controles de zoom',
            )}
            className="flex items-center gap-1"
          >
            <button
              type="button"
              onClick={() => applyContinuousZoom(1.5, 0.5)}
              disabled={!canZoomOut}
              title={ui('Zoom out', 'Punguza', 'Alejar')}
              aria-label={ui('Zoom out', 'Punguza', 'Alejar')}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-ink/12 bg-paper-2/70 text-ink transition hover:border-ochre hover:text-ochre disabled:opacity-35"
            >
              <Minus size={13} />
            </button>
            <button
              type="button"
              onClick={() => applyContinuousZoom(0.65, 0.5)}
              disabled={!canZoomIn}
              title={ui('Zoom in', 'Kuza ndani', 'Acercar')}
              aria-label={ui('Zoom in', 'Kuza ndani', 'Acercar')}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-ink/12 bg-paper-2/70 text-ink transition hover:border-ochre hover:text-ochre disabled:opacity-35"
            >
              <Plus size={13} />
            </button>
            {isModifiedView && (
              <button
                type="button"
                onClick={handleResetView}
                title={ui('Reset chart view', 'Rejesha mwonekano', 'Restablecer vista')}
                aria-label={ui('Reset chart view', 'Rejesha mwonekano', 'Restablecer vista')}
                className="inline-flex h-7 items-center gap-1 rounded-md border border-ink/20 bg-ink px-2 font-mono text-[10px] font-semibold text-gold transition hover:bg-ochre hover:text-paper"
              >
                <RotateCcw size={11} />
                <span>{ui('Reset', 'Rejesha', 'Reset')}</span>
              </button>
            )}
          </div>
        </div>

        {/* Single Compact Status Strip: Exact Date/EAT Readout + Auto Scale + Window Counter (e.g. 158/1000) */}
        <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-ink/10 bg-paper-2/65 px-2.5 py-1.5 sm:px-3">
          <span className="inline-flex min-w-0 items-center gap-1.5 font-mono text-[10.5px] font-semibold text-ink tabular-nums sm:text-[11px]">
            <Calendar size={12} className="shrink-0 text-ochre" />
            <span className="truncate">
              {safeInspectIdx !== null
                ? formatChartTooltipDateByScale(
                    activePoint.timestampMs,
                    visibleStats.scale,
                    visibleStats.spanMs,
                    language,
                  )
                : visibleDateWindowLabel}
            </span>
          </span>

          <div className="flex shrink-0 items-center gap-1.5 font-mono text-[10px] tabular-nums">
            <span className="rounded border border-ochre/30 bg-ochre/10 px-1.5 py-0.5 font-semibold uppercase tracking-wider text-ochre">
              {formatScaleBadge(visibleStats.scale)}
            </span>
            <span className="rounded border border-ink/12 bg-paper px-1.5 py-0.5 font-semibold text-ink-3">
              {visibleStats.spanCompact}
            </span>
            <span
              title={ui(
                'Timeline window position',
                'Nafasi kwenye mfuatano wa muda',
                'Posición en la línea temporal',
              )}
              className="rounded border border-ink/12 bg-ink px-1.5 py-0.5 font-semibold text-gold"
            >
              {tapeCounter.label}
            </span>
          </div>
        </div>
      </div>

      {/* Continuous Direct-Manipulation Trading Chart Canvas (Right-Side Y-Axis + Bottom X-Axis) */}
      <div className="relative px-2 pb-2 sm:px-5 sm:pb-3 lg:px-6">
        <div ref={chartContainerRef} className="relative w-full select-none">
          <svg
            ref={svgRef}
            width={chartGeometry.width}
            height={chartGeometry.height}
            viewBox={`0 0 ${chartGeometry.width} ${chartGeometry.height}`}
            role="img"
            tabIndex={0}
            aria-label={`${activeMineral.mineral_name} ${visibleStats.spanCompact} World Spot Parity ${ui('interactive trading chart', 'chati ya biashara', 'gráfico interactivo')} (${currency}${model.unitSuffix})`}
            className={`block w-full touch-none rounded-lg border border-ink/8 bg-[#fbf8f2] outline-none focus-visible:ring-2 focus-visible:ring-ochre/40 ${
              isDragging ? 'cursor-grabbing' : 'cursor-grab'
            }`}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerCancel}
            onPointerLeave={() => {
              if (!dragRef.current) setInspectIndex(null)
            }}
            onDoubleClick={handleResetView}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onTouchCancel={handleTouchEnd}
            onKeyDown={handleKeyDown}
          >
            <defs>
              <linearGradient
                id={`trend-fill-${uid}`}
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
              <clipPath id={`plot-clip-${uid}`}>
                <rect
                  x={chartGeometry.padLeft}
                  y={chartGeometry.padTop}
                  width={chartGeometry.plotWidth}
                  height={chartGeometry.plotHeight}
                />
              </clipPath>
            </defs>

            {/* Right-Side Y-Axis Separator Hairline */}
            <line
              x1={chartGeometry.plotRightX}
              y1={chartGeometry.padTop}
              x2={chartGeometry.plotRightX}
              y2={chartGeometry.baselineY}
              stroke="rgba(21, 18, 15, 0.1)"
              strokeWidth={1}
            />

            {/* Bottom X-Axis Separator Hairline */}
            <line
              x1={chartGeometry.padLeft}
              y1={chartGeometry.baselineY}
              x2={chartGeometry.plotRightX}
              y2={chartGeometry.baselineY}
              stroke="rgba(21, 18, 15, 0.12)"
              strokeWidth={1}
            />

            {/* Horizontal Gridlines & Right-Side Price Axis Ticks */}
            {chartGeometry.yTickPositions.map((tick, idx) => (
              <g key={`y-${idx}`}>
                <line
                  x1={chartGeometry.padLeft}
                  y1={tick.y}
                  x2={chartGeometry.plotRightX}
                  y2={tick.y}
                  stroke="rgba(21, 18, 15, 0.07)"
                  strokeWidth={1}
                />
                <text
                  x={chartGeometry.plotRightX + (chartGeometry.isCompact ? 5 : 8)}
                  y={tick.y + 3.5}
                  textAnchor="start"
                  fill="#776c60"
                  fontSize={chartGeometry.isCompact ? '10' : '11'}
                  fontFamily="var(--font-mono)"
                  style={{ fontVariantNumeric: 'tabular-nums' }}
                >
                  {tick.label}
                </text>
              </g>
            ))}

            {/* Vertical Gridlines & Non-Overlapping Bottom X-Axis Date/Time Ticks */}
            {chartGeometry.xTicks.map((tick, idx) => (
              <g key={`x-${idx}-${tick.timestampMs}`}>
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
                  y={chartGeometry.baselineY + (chartGeometry.isCompact ? 17 : 19)}
                  textAnchor="middle"
                  fill="#776c60"
                  fontSize={chartGeometry.isCompact ? '10' : '11'}
                  fontFamily="var(--font-mono)"
                  style={{ fontVariantNumeric: 'tabular-nums' }}
                >
                  {tick.label}
                </text>
              </g>
            ))}

            {/* Clipped Area Fill & Price Line */}
            <g clipPath={`url(#plot-clip-${uid})`}>
              <path
                d={chartGeometry.areaPath}
                fill={`url(#trend-fill-${uid})`}
              />
              <path
                d={chartGeometry.linePath}
                fill="none"
                stroke={strokeColor}
                strokeWidth={chartGeometry.isCompact ? 1.85 : 2.15}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </g>

            {/* Dashed Current/Latest Price Reference Line Extending to Right Axis Badge */}
            <line
              x1={chartGeometry.padLeft}
              y1={terminalCoord.y}
              x2={chartGeometry.plotRightX}
              y2={terminalCoord.y}
              stroke={strokeColor}
              strokeOpacity={0.65}
              strokeWidth={1}
              strokeDasharray="3 3"
            />

            {/* Terminal Live Price Dot */}
            <g aria-hidden="true">
              <circle
                cx={terminalCoord.x}
                cy={terminalCoord.y}
                r={7}
                fill={strokeColor}
                fillOpacity={0.2}
              />
              <circle
                cx={terminalCoord.x}
                cy={terminalCoord.y}
                r={3.6}
                fill={strokeColor}
                stroke="#fbf8f2"
                strokeWidth={1.8}
              />
            </g>

            {/* Highlighted Current Price Pill Badge on Right Y-Axis */}
            <g aria-hidden="true">
              <rect
                x={chartGeometry.plotRightX + 2}
                y={terminalBadgeY - badgeHalf}
                width={Math.max(42, chartGeometry.padRight - 4)}
                height={badgeHeight}
                rx={4}
                fill={strokeColor}
              />
              <text
                x={chartGeometry.plotRightX + (chartGeometry.isCompact ? 6 : 8)}
                y={terminalBadgeY + 3.5}
                textAnchor="start"
                fill="#f6f1e7"
                fontSize={chartGeometry.isCompact ? '10' : '10.5'}
                fontWeight="700"
                fontFamily="var(--font-mono)"
                style={{ fontVariantNumeric: 'tabular-nums' }}
              >
                {terminalBadgeLabel}
              </text>
            </g>

            {/* Active Crosshair Inspection (Hover on Desktop / Tap on Mobile) */}
            {safeInspectIdx !== null && (
              <g>
                <line
                  x1={activeCoord.x}
                  y1={chartGeometry.padTop}
                  x2={activeCoord.x}
                  y2={chartGeometry.baselineY}
                  stroke="rgba(21, 18, 15, 0.34)"
                  strokeWidth={1}
                  strokeDasharray="3 3"
                />
                <line
                  x1={chartGeometry.padLeft}
                  y1={activeCoord.y}
                  x2={chartGeometry.plotRightX}
                  y2={activeCoord.y}
                  stroke="rgba(21, 18, 15, 0.28)"
                  strokeWidth={1}
                  strokeDasharray="3 3"
                />
                <circle
                  cx={activeCoord.x}
                  cy={activeCoord.y}
                  r={6.5}
                  fill="#15120f"
                  fillOpacity={0.14}
                />
                <circle
                  cx={activeCoord.x}
                  cy={activeCoord.y}
                  r={4}
                  fill="#15120f"
                  stroke="#f6f1e7"
                  strokeWidth={2}
                />

                {/* Active Crosshair Price Badge on Right Axis */}
                <rect
                  x={chartGeometry.plotRightX + 2}
                  y={inspectBadgeY - badgeHalf}
                  width={Math.max(42, chartGeometry.padRight - 4)}
                  height={badgeHeight}
                  rx={4}
                  fill="#15120f"
                />
                <text
                  x={chartGeometry.plotRightX + (chartGeometry.isCompact ? 6 : 8)}
                  y={inspectBadgeY + 3.5}
                  textAnchor="start"
                  fill="#d6a443"
                  fontSize={chartGeometry.isCompact ? '10' : '10.5'}
                  fontWeight="700"
                  fontFamily="var(--font-mono)"
                  style={{ fontVariantNumeric: 'tabular-nums' }}
                >
                  {inspectBadgeLabel}
                </text>

                {/* Active Crosshair Time Pill on Bottom X-Axis */}
                <g>
                  <rect
                    x={Math.max(
                      chartGeometry.padLeft,
                      Math.min(
                        chartGeometry.plotRightX - 66,
                        activeCoord.x - 33,
                      ),
                    )}
                    y={chartGeometry.baselineY + 4}
                    width={66}
                    height={18}
                    rx={4}
                    fill="#15120f"
                  />
                  <text
                    x={
                      Math.max(
                        chartGeometry.padLeft,
                        Math.min(
                          chartGeometry.plotRightX - 66,
                          activeCoord.x - 33,
                        ),
                      ) + 33
                    }
                    y={chartGeometry.baselineY + 16}
                    textAnchor="middle"
                    fill="#f6f1e7"
                    fontSize="10"
                    fontWeight="600"
                    fontFamily="var(--font-mono)"
                    style={{ fontVariantNumeric: 'tabular-nums' }}
                  >
                    {inspectTimeAxisLabel}
                  </text>
                </g>
              </g>
            )}
          </svg>

          {/* Compact Floating Crosshair Tooltip (Exact Date + EAT Time + Price) */}
          {safeInspectIdx !== null && (
            <div
              role="status"
              aria-live="polite"
              className="pointer-events-none absolute top-2.5 z-20 min-w-[186px] rounded-lg border border-ink/15 bg-ink/95 px-3 py-2 text-paper shadow-md backdrop-blur-xs"
              style={
                tooltipAlignRight
                  ? {
                      left: `${chartGeometry.padLeft + 10}px`,
                    }
                  : {
                      right: `${chartGeometry.padRight + 10}px`,
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
              <div className="mt-0.5 flex items-baseline gap-1 font-mono text-sm font-bold text-paper tabular-nums">
                <span>{formatPrice(displayedUnitUsd)}</span>
                <span className="text-[11px] font-normal text-gold">
                  {model.unitSuffix}
                </span>
              </div>
              <div
                className={`mt-0.5 font-mono text-[10.5px] font-semibold tabular-nums ${
                  displayedPositive ? 'text-[#9de4b4]' : 'text-[#f59c8a]'
                }`}
              >
                {formatSignedDelta(displayedDeltaUsd)} (
                {displayedPositive ? '+' : ''}
                {displayedDeltaPct.toFixed(2)}%)
              </div>
            </div>
          )}
        </div>

        {/* Minimal Direct-Manipulation Hint */}
        <p className="mt-1.5 text-center font-mono text-[10px] text-stone/85">
          {ui(
            'Drag to pan (2023–2026) · Pinch or scroll to zoom (years → min) · Tap to inspect',
            'Buruta kusogeza (2023–2026) · Bana au zungusha kukuza (miaka → dakika) · Gusa kukagua',
            'Arrastra para desplazar (2023–2026) · Pellizca o haz scroll para zoom (años → min)',
          )}
        </p>
      </div>

      {/* Mode-Matched Statutory Benchmark Summary Strip */}
      <div className="grid grid-cols-2 gap-x-3 gap-y-3 border-t border-ink/10 bg-paper-2/70 px-4 py-3.5 sm:grid-cols-4 sm:px-5 lg:px-6">
        <div className="min-w-0">
          <span className="block truncate font-mono text-[9.5px] uppercase tracking-wider text-stone sm:text-[10px]">
            {visibleStats.spanCompact} {ui('High', 'Juu Zaidi', 'Máximo')} (
            {model.unitSuffix})
          </span>
          <span className="mt-0.5 block whitespace-nowrap font-mono text-[12px] font-bold text-ink tabular-nums sm:text-xs">
            {formatPrice(visibleStats.maxUnitUsd)}
            <span className="font-normal text-stone">{model.unitSuffix}</span>
          </span>
        </div>

        <div className="min-w-0">
          <span className="block truncate font-mono text-[9.5px] uppercase tracking-wider text-stone sm:text-[10px]">
            {visibleStats.spanCompact} {ui('Low', 'Chini Zaidi', 'Mínimo')} (
            {model.unitSuffix})
          </span>
          <span className="mt-0.5 block whitespace-nowrap font-mono text-[12px] font-bold text-ink tabular-nums sm:text-xs">
            {formatPrice(visibleStats.minUnitUsd)}
            <span className="font-normal text-stone">{model.unitSuffix}</span>
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
            {ui('Buying Centre Floor', 'Kituo cha Ununuzi', 'Centro de Compra')}{' '}
            ({buyingTier.unitSuffix})
          </span>
          <span className="mt-0.5 block whitespace-nowrap font-mono text-[12px] font-bold text-ink tabular-nums sm:text-xs">
            {formatPrice(buyingTier.unitUsd)}
            <span className="font-normal text-stone">
              {buyingTier.unitSuffix}
            </span>
          </span>
        </div>
      </div>
    </section>
  )
}
