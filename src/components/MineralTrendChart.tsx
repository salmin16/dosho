'use client'

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { ArrowDownRight, ArrowUpRight, TrendingUp } from 'lucide-react'
import { useLocalization } from '../context/LocalizationContext'
import {
  CHART_TIMEFRAMES,
  buildMineralTrendSeries,
  computeNiceAxisTicks,
  convertToChartUnitUsd,
  formatChartAxisDate,
  formatChartTooltipDate,
  type ChartPricingMode,
  type ChartTimeframe,
} from '../lib/mineralHistory'
import type { MineralPriceRecord } from '../types/database'

export interface MineralTrendChartProps {
  minerals: MineralPriceRecord[]
  selectedSymbol?: string
  onSelectSymbol?: (symbol: string) => void
  /** Master unit mode controlled exclusively by the /markets dashboard header */
  unitBasis?: ChartPricingMode
}

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
  const [chartWidth, setChartWidth] = useState<number>(880)
  const [internalSymbol, setInternalSymbol] = useState<string>(
    () => minerals[0]?.symbol ?? 'XAU',
  )
  const [timeframe, setTimeframe] = useState<ChartTimeframe>('30D')
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)

  const activeSymbol = controlledSymbol ?? internalSymbol

  const handleSymbolChange = useCallback(
    (symbol: string) => {
      setHoverIndex(null)
      if (onSelectSymbol) {
        onSelectSymbol(symbol)
      } else {
        setInternalSymbol(symbol)
      }
    },
    [onSelectSymbol],
  )

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

  // Reset scrub index when timeframe or master unit mode changes
  useEffect(() => {
    setHoverIndex(null)
  }, [timeframe, unitBasis])

  const series = useMemo(() => {
    if (!activeMineral) return null
    return buildMineralTrendSeries(activeMineral, timeframe, unitBasis)
  }, [activeMineral, timeframe, unitBasis])

  // Format a value that is already in the active display currency for Y-axis ticks
  const formatAxisTickValue = useCallback(
    (displayValue: number, step: number, compactMobile: boolean): string => {
      const usdEquivalent =
        rateForSelected > 0 ? displayValue / rateForSelected : displayValue
      const isZeroDecimal = currency === 'TZS' || currency === 'JPY'
      const absVal = Math.abs(displayValue)

      if (compactMobile) {
        if (absVal >= 1_000_000) {
          const decimals = step < 100_000 ? 2 : 1
          return `${(displayValue / 1_000_000).toFixed(decimals)}M`
        }
        if (absVal >= 10_000) {
          const decimals = step < 1_000 ? 1 : 0
          return `${(displayValue / 1_000).toFixed(decimals)}k`
        }
        if (absVal >= 1_000) {
          return `${(displayValue / 1_000).toFixed(step < 500 ? 2 : 1)}k`
        }
        const decimals = isZeroDecimal ? 0 : step < 0.1 ? 2 : step < 1 ? 1 : 0
        return displayValue.toLocaleString('en-US', {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        })
      }

      if (absVal >= 1_000_000) {
        const decimals = absVal >= 10_000_000 ? 1 : 2
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

  const timeframeLabel = useCallback(
    (tf: ChartTimeframe): string => {
      switch (tf) {
        case '1H':
          return ui('past 1 hour', 'saa 1 iliyopita', 'última hora')
        case '1D':
          return ui('past 24 hours', 'saa 24 zilizopita', 'últimas 24 horas')
        case '7D':
          return ui('past 7 days', 'siku 7 zilizopita', 'últimos 7 días')
        case '30D':
          return ui('past 30 days', 'siku 30 zilizopita', 'últimos 30 días')
        case '90D':
          return ui('past 90 days', 'siku 90 zilizopita', 'últimos 90 días')
        case '1Y':
          return ui('past 1 year', 'mwaka 1 uliopita', 'último año')
      }
    },
    [ui],
  )

  // Compute SVG geometry in measured pixel coordinates (mobile-first plot width ~80%+)
  const chartGeometry = useMemo(() => {
    if (!series || series.points.length < 2) return null

    const isCompact = chartWidth < 600
    const height = isCompact ? 256 : 352
    const convertedValues = series.points.map((p) => p.unitUsd * rateForSelected)
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

    // Compact left Y-axis margin on mobile so the plot spans ~80%+ of card width
    const padLeft = isCompact
      ? Math.min(54, Math.max(38, Math.round(maxLabelLen * 6.4 + 10)))
      : Math.min(126, Math.max(66, Math.round(maxLabelLen * 7.2 + 16)))
    const padRight = isCompact ? 12 : 22
    const padTop = isCompact ? 14 : 18
    const padBottom = isCompact ? 28 : 34
    const plotWidth = Math.max(120, chartWidth - padLeft - padRight)
    const plotHeight = Math.max(120, height - padTop - padBottom)
    const ySpan = Math.max(1e-9, yMax - yMin)

    const coords = series.points.map((pt, idx) => {
      const converted = convertedValues[idx]
      const x = padLeft + (idx / (series.points.length - 1)) * plotWidth
      const y = padTop + (1 - (converted - yMin) / ySpan) * plotHeight
      return { x, y, pt, converted }
    })

    const linePath = coords
      .map((c, idx) => `${idx === 0 ? 'M' : 'L'} ${c.x.toFixed(2)} ${c.y.toFixed(2)}`)
      .join(' ')

    const baselineY = padTop + plotHeight
    const areaPath = `${linePath} L ${coords[coords.length - 1].x.toFixed(2)} ${baselineY.toFixed(2)} L ${coords[0].x.toFixed(2)} ${baselineY.toFixed(2)} Z`

    // Period-opening horizontal reference dashed line
    const openY =
      padTop + (1 - (convertedValues[0] - yMin) / ySpan) * plotHeight

    // Max 4 X-axis ticks on mobile so labels never collide, 6 on desktop
    const xTickCount = isCompact ? 4 : 6
    const xTicks: Array<{ x: number; label: string; idx: number }> = []
    for (let i = 0; i < xTickCount; i++) {
      const frac = i / (xTickCount - 1)
      const idx = Math.round(frac * (series.points.length - 1))
      const coord = coords[idx]
      xTicks.push({
        x: coord.x,
        idx,
        label: formatChartAxisDate(coord.pt.timestampMs, timeframe, language),
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
    series,
    chartWidth,
    rateForSelected,
    formatAxisTickValue,
    timeframe,
    language,
  ])

  const handlePointerScrub = useCallback(
    (clientX: number, currentTarget: SVGSVGElement) => {
      if (!chartGeometry || !series) return
      const rect = currentTarget.getBoundingClientRect()
      if (rect.width <= 0) return

      const relX = ((clientX - rect.left) / rect.width) * chartGeometry.width
      const clampedX = Math.max(
        chartGeometry.padLeft,
        Math.min(chartGeometry.padLeft + chartGeometry.plotWidth, relX),
      )
      const ratio =
        (clampedX - chartGeometry.padLeft) / Math.max(1, chartGeometry.plotWidth)
      const nearestIdx = Math.round(ratio * (series.points.length - 1))
      setHoverIndex(
        Math.max(0, Math.min(series.points.length - 1, nearestIdx)),
      )
    },
    [chartGeometry, series],
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<SVGSVGElement>) => {
      if (!series || series.points.length === 0) return
      const last = series.points.length - 1
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        setHoverIndex((prev) => (prev === null ? last - 1 : Math.max(0, prev - 1)))
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        setHoverIndex((prev) => (prev === null ? last : Math.min(last, prev + 1)))
      } else if (e.key === 'Escape') {
        setHoverIndex(null)
      }
    },
    [series],
  )

  if (!activeMineral || !series || !chartGeometry) {
    return null
  }

  const lastIdx = series.points.length - 1
  const activePointIdx = hoverIndex !== null ? hoverIndex : lastIdx
  const activePoint = series.points[activePointIdx]
  const activeCoord = chartGeometry.coords[activePointIdx]
  const terminalCoord = chartGeometry.coords[lastIdx]

  const displayedUnitUsd = activePoint.unitUsd
  const displayedDeltaUsd = displayedUnitUsd - series.startUnitUsd
  const displayedDeltaPct =
    series.startUnitUsd > 0
      ? (displayedDeltaUsd / series.startUnitUsd) * 100
      : 0

  // Trend polarity based on overall selected timeframe performance
  const seriesPositive = series.changeUnitUsd >= 0
  const displayedPositive = displayedDeltaUsd >= 0

  // Classic institutional palette harmonized with MineConnect brand tokens
  const strokeColor = seriesPositive ? '#2f6f4e' : '#a33a2a'
  const fillTopOpacity = seriesPositive ? 0.25 : 0.22

  // Reference statutory benchmarks matched to the active /markets master unit mode
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

  const isLocalUnits = unitBasis === 'metric_local'

  // Tooltip horizontal alignment so it never clips off left or right edge
  const tooltipAlignRight =
    activeCoord.x > chartGeometry.padLeft + chartGeometry.plotWidth * 0.62

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
      <div className="flex flex-col justify-between gap-3 border-b border-ink/10 bg-paper-2 px-5 py-4 sm:flex-row sm:items-center lg:px-6">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
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
                `World Spot Parity (${series.unitSuffix})`,
                `Soko la Dunia (${series.unitSuffix})`,
                `Paridad Spot Mundial (${series.unitSuffix})`,
              )}
            </span>
          </div>
          <p className="mt-1 text-xs text-stone">
            {isLocalUnits
              ? ui(
                  `Plotting World Spot Parity benchmarks in local units (${currency}${series.unitSuffix}), synced with the Markets header unit mode and top navbar.`,
                  `Inaonyesha mwenendo wa bei za Soko la Dunia kwa kipimo cha ndani (${currency}${series.unitSuffix}), ikioana na upau wa Soko na upau mkuu wa juu.`,
                  `Graficando referencias de Paridad Spot Mundial en unidades locales (${currency}${series.unitSuffix}), sincronizado con la cabecera de Mercados.`,
                )
              : ui(
                  `Plotting World Spot Parity benchmarks in global spot units (${currency}${series.unitSuffix}), synced with the Markets header unit mode and top navbar.`,
                  `Inaonyesha mwenendo wa bei za Soko la Dunia kwa kipimo cha kimataifa (${currency}${series.unitSuffix}), ikioana na upau wa Soko na upau mkuu wa juu.`,
                  `Graficando referencias de Paridad Spot Mundial en unidades internacionales (${currency}${series.unitSuffix}), sincronizado con la cabecera de Mercados.`,
                )}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-md border border-ink/15 bg-paper px-2.5 py-1 font-mono text-[11px] font-semibold text-ink">
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: strokeColor }}
              aria-hidden="true"
            />
            {currencyMeta.flag} {currency}
            {series.unitSuffix}
          </span>
        </div>
      </div>

      {/* Mineral Selector Strip (All Benchmarks on /markets) */}
      <div className="border-b border-ink/10 bg-paper px-5 py-3 lg:px-6">
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

      {/* Headline Price Readout & Timeframe Pills */}
      <div className="flex flex-col justify-between gap-4 px-5 pt-5 pb-3 lg:flex-row lg:items-end lg:px-6">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display text-2xl font-medium text-ink sm:text-[26px]">
              {activeMineral.mineral_name}
            </h3>
            <span className="rounded border border-ink/15 bg-ink px-2 py-0.5 font-mono text-[11px] font-bold text-gold">
              {activeMineral.symbol}
            </span>
            <span className="font-mono text-[11px] text-stone">
              {activeMineral.purity_note}
            </span>
          </div>

          <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="font-mono text-3xl font-bold tracking-tight text-ink tabular-nums sm:text-4xl">
              {formatPrice(displayedUnitUsd)}
            </span>
            <span className="font-mono text-base font-medium text-stone">
              {series.unitSuffix}
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
            {hoverIndex !== null ? (
              <>
                <span className="font-semibold text-ink">
                  {formatChartTooltipDate(
                    activePoint.timestampMs,
                    timeframe,
                    language,
                  )}
                </span>{' '}
                ·{' '}
                {ui(
                  `Change since start of ${timeframe}`,
                  `Mabadiliko tangu mwanzo wa ${timeframe}`,
                  `Cambio desde el inicio de ${timeframe}`,
                )}
              </>
            ) : (
              <>
                {ui(
                  'World Spot Parity rate ·',
                  'Bei ya Soko la Dunia ·',
                  'Tasa de Paridad Spot Mundial ·',
                )}{' '}
                {timeframeLabel(timeframe)} ·{' '}
                {activeMineral.exchange_desk ?? 'LBMA / Tume ya Madini'}
              </>
            )}
          </p>
        </div>

        {/* Classic Single-Row Timeframe Selector Pills (1H, 1D, 7D, 30D, 90D, 1Y) */}
        <div
          role="group"
          aria-label={ui('Chart timeframe', 'Muda wa chati', 'Período del gráfico')}
          className="grid w-full grid-cols-6 gap-0.5 rounded-lg border border-ink/12 bg-paper-2 p-1 sm:inline-flex sm:w-auto sm:gap-1 lg:self-end"
        >
          {CHART_TIMEFRAMES.map((tf) => {
            const active = tf === timeframe
            return (
              <button
                key={tf}
                type="button"
                aria-pressed={active}
                onClick={() => setTimeframe(tf)}
                className={`rounded-md px-1.5 py-1.5 text-center font-mono text-[11px] font-semibold transition sm:px-3.5 sm:text-xs ${
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

      {/* Interactive Financial Area/Line Chart */}
      <div className="relative px-2 pb-3 sm:px-6 sm:pb-4">
        <div ref={chartContainerRef} className="relative w-full select-none">
          <svg
            width={chartGeometry.width}
            height={chartGeometry.height}
            viewBox={`0 0 ${chartGeometry.width} ${chartGeometry.height}`}
            role="img"
            tabIndex={0}
            aria-label={`${activeMineral.mineral_name} ${timeframe} World Spot Parity ${ui('price trend', 'mwenendo wa bei', 'tendencia de precio')} (${currency}${series.unitSuffix})`}
            className="block w-full cursor-crosshair touch-none rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ochre/40"
            onPointerMove={(e) => handlePointerScrub(e.clientX, e.currentTarget)}
            onPointerDown={(e) => handlePointerScrub(e.clientX, e.currentTarget)}
            onPointerLeave={() => setHoverIndex(null)}
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

            {/* Period-Opening Reference Dashed Baseline */}
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
            {hoverIndex !== null && (
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

            {/* Live Terminal Marker Dot at Latest Data Point */}
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

          {/* Interactive Floating Scrub Tooltip */}
          {hoverIndex !== null && (
            <div
              role="status"
              aria-live="polite"
              className="pointer-events-none absolute top-3 z-20 min-w-[200px] rounded-lg border border-ink/15 bg-ink px-3.5 py-2.5 text-paper shadow-md"
              style={
                tooltipAlignRight
                  ? {
                      right: `${Math.max(
                        12,
                        chartGeometry.width - activeCoord.x + 14,
                      )}px`,
                    }
                  : {
                      left: `${Math.min(
                        chartGeometry.width - 214,
                        Math.max(chartGeometry.padLeft + 8, activeCoord.x + 14),
                      )}px`,
                    }
              }
            >
              <div className="font-mono text-[10px] uppercase tracking-wider text-paper/65">
                {formatChartTooltipDate(
                  activePoint.timestampMs,
                  timeframe,
                  language,
                )}
              </div>
              <div className="mt-1 flex items-baseline gap-1 font-mono text-sm font-bold text-paper tabular-nums">
                <span>{formatPrice(displayedUnitUsd)}</span>
                <span className="text-[11px] font-normal text-gold">
                  {series.unitSuffix}
                </span>
              </div>
              <div
                className={`mt-0.5 font-mono text-[11px] font-semibold tabular-nums ${
                  displayedPositive ? 'text-[#9de4b4]' : 'text-[#f59c8a]'
                }`}
              >
                {formatSignedDelta(displayedDeltaUsd)} (
                {displayedPositive ? '+' : ''}
                {displayedDeltaPct.toFixed(2)}%) · {timeframe}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Mode-Matched Benchmark Summary Strip */}
      <div className="grid grid-cols-2 gap-x-3 gap-y-3 border-t border-ink/10 bg-paper-2/70 px-4 py-3.5 sm:grid-cols-4 sm:px-5 lg:px-6">
        <div className="min-w-0">
          <span className="block truncate font-mono text-[9.5px] uppercase tracking-wider text-stone sm:text-[10px]">
            {timeframe} {ui('High', 'Juu Zaidi', 'Máximo')} ({series.unitSuffix})
          </span>
          <span className="mt-0.5 block whitespace-nowrap font-mono text-[12px] font-bold text-ink tabular-nums sm:text-xs">
            {formatPrice(series.maxUnitUsd)}
            <span className="font-normal text-stone">{series.unitSuffix}</span>
          </span>
        </div>

        <div className="min-w-0">
          <span className="block truncate font-mono text-[9.5px] uppercase tracking-wider text-stone sm:text-[10px]">
            {timeframe} {ui('Low', 'Chini Zaidi', 'Mínimo')} ({series.unitSuffix})
          </span>
          <span className="mt-0.5 block whitespace-nowrap font-mono text-[12px] font-bold text-ink tabular-nums sm:text-xs">
            {formatPrice(series.minUnitUsd)}
            <span className="font-normal text-stone">{series.unitSuffix}</span>
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
