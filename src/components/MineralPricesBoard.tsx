'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from '@tanstack/react-router'
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  Calculator,
  Check,
  Clock,
  Coins,
  Download,
  Globe,
  Lock,
  Radio,
  RefreshCw,
  Scale,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Table2,
  TrendingUp,
} from 'lucide-react'
import { executeLiveMarketSync } from '../app/api/market-sync/route'
import {
  acquireLiveMarketStream,
  getMarketSyncTelemetry,
  getStoredMineralPrices,
  subscribeMineralPrices,
} from '../data/mineralPrices'
import { useLocalization } from '../context/LocalizationContext'
import LiveMarketTicker from './LiveMarketTicker'
import MineralTrendChart from './MineralTrendChart'
import PriceDisplay from './PriceDisplay'
import UpgradeRequiredGate from './UpgradeRequiredGate'
import { downloadMarketValuationCsv } from '../lib/marketCsvExport'
import { useSubscription } from '../lib/subscriptions'
import type {
  MarketSyncTelemetry,
  MineralCategory,
  MineralPriceRecord,
} from '../types/database'

export type MarketTerminalView = 'spot' | 'trend' | 'matrix'

function SparklineSvg({
  points,
  positive,
  onLight = false,
}: {
  points: number[]
  positive: boolean
  onLight?: boolean
}) {
  if (!points || points.length < 2) return null
  const min = Math.min(...points)
  const max = Math.max(...points)
  const range = max - min || 1
  const width = 92
  const height = 28

  const coords = points.map((val, idx) => {
    const x = (idx / (points.length - 1)) * width
    const y = height - ((val - min) / range) * (height - 6) - 3
    return `${x.toFixed(1)},${y.toFixed(1)}`
  })

  const strokeColor = positive
    ? onLight
      ? '#3e5c49'
      : '#d6a443'
    : onLight
      ? '#a33a2a'
      : '#d96b52'
  const fillId = `spark-${onLight ? 'lt' : 'dk'}-${positive ? 'pos' : 'neg'}-${points[0]}`

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="overflow-visible"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={strokeColor} stopOpacity="0.28" />
          <stop offset="100%" stopColor={strokeColor} stopOpacity="0.0" />
        </linearGradient>
      </defs>
      <polygon
        points={`0,${height} ${coords.join(' ')} ${width},${height}`}
        fill={`url(#${fillId})`}
      />
      <polyline
        fill="none"
        stroke={strokeColor}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={coords.join(' ')}
      />
    </svg>
  )
}

export interface MineralPricesBoardProps {
  showHeaderCta?: boolean
  /** URL-synced active terminal tab (`spot` | `trend` | `matrix`) */
  activeView?: MarketTerminalView
  onViewChange?: (view: MarketTerminalView, symbol?: string) => void
  /** Optional URL-synced mineral symbol for the trend chart */
  initialSymbol?: string
}

export default function MineralPricesBoard({
  showHeaderCta = true,
  activeView: controlledView,
  onViewChange,
  initialSymbol,
}: MineralPricesBoardProps) {
  const {
    currency,
    currencyMeta,
    rateForSelected,
    ratesSource,
    ratesProvider,
    fetchedAt: fxFetchedAt,
    refreshRates,
    formatPrice,
    formatStatutoryPrice,
    language,
    ui,
  } = useLocalization()

  const [minerals, setMinerals] = useState<MineralPriceRecord[]>(() =>
    getStoredMineralPrices(),
  )
  const [telemetry, setTelemetry] = useState<MarketSyncTelemetry>(() =>
    getMarketSyncTelemetry(),
  )
  const [syncing, setSyncing] = useState(false)
  const [justUpdatedTime, setJustUpdatedTime] = useState<string | null>(null)

  const isSyncingRef = useRef(false)
  const abortRef = useRef<AbortController | null>(null)
  const updatedTimerRef = useRef<number | null>(null)

  const [internalView, setInternalView] = useState<MarketTerminalView>('spot')
  const activeView = controlledView ?? internalView

  const [selectedCategory, setSelectedCategory] = useState<'ALL' | MineralCategory>('ALL')
  const [matrixSearch, setMatrixSearch] = useState('')
  const [unitBasis, setUnitBasis] = useState<'standard' | 'metric_local'>('metric_local')
  const [chartSymbol, setChartSymbol] = useState<string>(initialSymbol || 'XAU')
  const [showExportUpgrade, setShowExportUpgrade] = useState(false)
  const [csvDownloaded, setCsvDownloaded] = useState(false)
  const csvConfirmTimerRef = useRef<number | null>(null)
  const {
    plan: activePlan,
    accountState,
    isPaidActive,
    canExportMarkets,
  } = useSubscription()
  const canExportValuation = canExportMarkets || isPaidActive

  // Interactive Statutory Valuation & Royalty Calculator State
  const [calcSymbol, setCalcSymbol] = useState<string>('XAU')
  const [calcQuantity, setCalcQuantity] = useState<string>('100')

  useEffect(() => {
    if (initialSymbol) {
      setChartSymbol(initialSymbol)
    }
  }, [initialSymbol])

  const triggerUpdatedConfirmation = useCallback((isoTimestamp: string) => {
    let timeStr: string
    try {
      timeStr = new Date(isoTimestamp).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    } catch {
      timeStr = new Date().toLocaleTimeString()
    }
    setJustUpdatedTime(timeStr)
    if (updatedTimerRef.current !== null) {
      window.clearTimeout(updatedTimerRef.current)
    }
    updatedTimerRef.current = window.setTimeout(() => {
      setJustUpdatedTime(null)
      updatedTimerRef.current = null
    }, 3500)
  }, [])

  const handleManualSync = useCallback(
    async (force = true) => {
      if (isSyncingRef.current) return
      isSyncingRef.current = true
      setSyncing(true)

      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller

      try {
        // Non-blocking fail-fast FX refresh guard (3500ms) so slow mobile networks never stall the feed
        const guardedFxRefresh = force
          ? Promise.race([
              refreshRates().catch(() => undefined),
              new Promise<void>((resolve) => window.setTimeout(resolve, 3500)),
            ])
          : Promise.resolve()

        const [result] = await Promise.all([
          executeLiveMarketSync({ force, signal: controller.signal }),
          guardedFxRefresh,
        ])

        if (!controller.signal.aborted && result.records.length > 0) {
          setMinerals(result.records)
          setTelemetry(result.telemetry)
          if (force) {
            triggerUpdatedConfirmation(result.telemetry.lastSyncedAt)
          }
        }
      } finally {
        isSyncingRef.current = false
        setSyncing(false)
      }
    },
    [refreshRates, triggerUpdatedConfirmation],
  )

  useEffect(() => {
    return () => {
      abortRef.current?.abort()
      if (updatedTimerRef.current !== null) {
        window.clearTimeout(updatedTimerRef.current)
      }
      if (csvConfirmTimerRef.current !== null) {
        window.clearTimeout(csvConfirmTimerRef.current)
      }
    }
  }, [])

  // Shared single reactive rate store subscription + 2s live tick & 12s zero-cache upstream stream
  useEffect(() => {
    setMinerals(getStoredMineralPrices())
    setTelemetry(getMarketSyncTelemetry())

    const unsubscribe = subscribeMineralPrices(() => {
      setMinerals(getStoredMineralPrices())
      setTelemetry(getMarketSyncTelemetry())
    })
    const releaseStream = acquireLiveMarketStream()

    return () => {
      unsubscribe()
      releaseStream()
    }
  }, [])

  const selectView = useCallback(
    (nextView: MarketTerminalView, symbol?: string) => {
      if (symbol) {
        setChartSymbol(symbol)
      }
      if (onViewChange) {
        onViewChange(nextView, symbol)
      } else {
        setInternalView(nextView)
      }
    },
    [onViewChange],
  )

  const handleInspectTrend = useCallback(
    (symbol: string) => {
      selectView('trend', symbol)
    },
    [selectView],
  )

  const filteredMinerals = useMemo(() => {
    let list =
      selectedCategory === 'ALL'
        ? minerals
        : minerals.filter((m) => m.category === selectedCategory)

    const q = matrixSearch.trim().toLowerCase()
    if (q) {
      list = list.filter(
        (m) =>
          m.mineral_name.toLowerCase().includes(q) ||
          m.symbol.toLowerCase().includes(q) ||
          (m.producing_regions ?? '').toLowerCase().includes(q) ||
          m.purity_note.toLowerCase().includes(q),
      )
    }

    return list
  }, [minerals, selectedCategory, matrixSearch])

  const handleExportValuationCsv = useCallback(
    (
      rowsToExport: MineralPriceRecord[],
      viewLabel: 'live-spot-feed' | 'statutory-matrix',
    ) => {
      if (!canExportValuation) {
        setShowExportUpgrade(true)
        return
      }
      downloadMarketValuationCsv({
        minerals: rowsToExport,
        currency,
        rateForSelected,
        ratesSource,
        unitBasis,
        viewLabel,
        formatStatutoryPrice,
      })
      setCsvDownloaded(true)
      if (csvConfirmTimerRef.current !== null) {
        window.clearTimeout(csvConfirmTimerRef.current)
      }
      csvConfirmTimerRef.current = window.setTimeout(() => {
        setCsvDownloaded(false)
        csvConfirmTimerRef.current = null
      }, 3200)
    },
    [
      canExportValuation,
      currency,
      rateForSelected,
      ratesSource,
      unitBasis,
      formatStatutoryPrice,
    ],
  )

  const handleExportMatrixCsv = useCallback(() => {
    handleExportValuationCsv(filteredMinerals, 'statutory-matrix')
  }, [handleExportValuationCsv, filteredMinerals])

  const translateCategory = (cat: 'ALL' | MineralCategory): string => {
    switch (cat) {
      case 'ALL':
        return ui(`All (${minerals.length})`, `Zote (${minerals.length})`, `Todos (${minerals.length})`)
      case 'Precious Metals':
        return ui('Precious Metals', 'Madini ya Thamani', 'Metales Preciosos')
      case 'Base & Industrial Metals':
        return ui('Base & Industrial', 'Madini ya Viwandani', 'Metales Industriales')
      case 'Critical & Battery Minerals':
        return ui('Critical & Battery', 'Kimkakati na Betri', 'Críticos y Baterías')
      case 'Gemstones':
        return ui('Gemstones', 'Vito vya Thamani', 'Piedras Preciosas')
    }
  }

  const formattedSyncTime = useMemo(() => {
    try {
      return new Date(telemetry.lastSyncedAt).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    } catch {
      return new Date().toLocaleTimeString()
    }
  }, [telemetry.lastSyncedAt])

  const selectedCalcMineral = useMemo(
    () => minerals.find((m) => m.symbol === calcSymbol) ?? minerals[0],
    [minerals, calcSymbol],
  )

  const calcBreakdown = useMemo(() => {
    if (!selectedCalcMineral) return null
    const qty = Math.max(0, parseFloat(calcQuantity) || 0)
    const worldLocal = formatStatutoryPrice(
      selectedCalcMineral.world_market_price_usd,
      selectedCalcMineral.unit,
      unitBasis,
    )
    const sokoLocal = formatStatutoryPrice(
      selectedCalcMineral.local_market_price_usd,
      selectedCalcMineral.unit,
      unitBasis,
    )
    const buyingLocal = formatStatutoryPrice(
      selectedCalcMineral.buying_centre_price_usd,
      selectedCalcMineral.unit,
      unitBasis,
    )

    const grossWorldUsd = worldLocal.unitUsd * qty
    const royaltyPct = selectedCalcMineral.royalty_rate_pct ?? 6
    const inspectionPct = selectedCalcMineral.inspection_fee_pct ?? 1
    const royaltyUsd = grossWorldUsd * (royaltyPct / 100)
    const inspectionUsd = grossWorldUsd * (inspectionPct / 100)
    const sokoPayoutUsd = sokoLocal.unitUsd * qty
    const buyingCentrePayoutUsd = buyingLocal.unitUsd * qty

    return {
      qty,
      unitLabel: worldLocal.unitSuffix.replace(/^\//, ''),
      grossWorldFormatted: formatPrice(grossWorldUsd),
      royaltyPct,
      royaltyFormatted: formatPrice(royaltyUsd),
      inspectionPct,
      inspectionFormatted: formatPrice(inspectionUsd),
      sokoPayoutFormatted: formatPrice(sokoPayoutUsd),
      buyingCentrePayoutFormatted: formatPrice(buyingCentrePayoutUsd),
    }
  }, [selectedCalcMineral, calcQuantity, unitBasis, formatStatutoryPrice, formatPrice])

  const fxDecimals = currency === 'USD' || rateForSelected >= 100 ? 2 : 4

  const terminalTabs: Array<{
    id: MarketTerminalView
    label: string
    shortLabel: string
    icon: typeof Radio
  }> = [
    {
      id: 'spot',
      label: ui('Live Spot Feed', 'Bei za Moja kwa Moja', 'Feed Spot en Vivo'),
      shortLabel: ui('Spot Feed', 'Spot', 'Spot'),
      icon: Radio,
    },
    {
      id: 'trend',
      label: ui(
        'Interactive Mineral Trend',
        'Chati ya Mwenendo',
        'Tendencia Mineral',
      ),
      shortLabel: ui('Trend Chart', 'Chati', 'Gráfico'),
      icon: TrendingUp,
    },
    {
      id: 'matrix',
      label: ui(
        'Statutory Mineral Matrix',
        'Jedwali Rasmi la Bei',
        'Matriz Oficial',
      ),
      shortLabel: ui('Pricing Matrix', 'Jedwali', 'Matriz'),
      icon: Table2,
    },
  ]

  return (
    <div
      data-currency={currency}
      data-language={language}
      className="bg-ink text-paper"
    >
      {/* 1. Compact Sticky Market Context Bar */}
      <div className="sticky top-[72px] z-30 border-b border-paper/12 bg-ink/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-5 py-2.5 lg:px-8">
          <div className="flex flex-wrap items-center gap-2 font-mono text-[11px]">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-moss/50 bg-moss/25 px-2.5 py-0.5 font-semibold text-[#9de4b4]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#9de4b4]" />
              {currencyMeta.flag} {currency}
            </span>

            <span
              className="inline-flex items-center gap-1.5 rounded-full border border-paper/12 bg-paper/[0.05] px-2.5 py-0.5 text-paper/80 tabular-nums"
              title={
                fxFetchedAt
                  ? `${ratesSource === 'live' ? 'Live FX' : 'Cached FX'} (${ratesProvider}) · ${fxFetchedAt.toLocaleTimeString()}`
                  : 'Offline Fallback FX'
              }
            >
              <Globe size={11} className="text-gold" />
              <span>
                1 USD ={' '}
                <strong className="text-gold">
                  {rateForSelected.toLocaleString('en-US', {
                    minimumFractionDigits: fxDecimals,
                    maximumFractionDigits: fxDecimals,
                  })}{' '}
                  {currency}
                </strong>
              </span>
              <span
                className={`rounded px-1 py-0.2 text-[9px] font-semibold uppercase tracking-wider ${
                  ratesSource === 'live'
                    ? 'bg-moss/35 text-[#9de4b4]'
                    : ratesSource === 'cached'
                      ? 'bg-ochre/30 text-gold'
                      : 'bg-danger/30 text-[#f59c8a]'
                }`}
              >
                {ratesSource === 'live'
                  ? ui('LIVE FX', 'FX HAI', 'FX VIVO')
                  : ratesSource === 'cached'
                    ? ui('CACHED', 'HIFADHI', 'CACHÉ')
                    : ui('FALLBACK', 'AKIBA', 'RESPALDO')}
              </span>
            </span>

            {justUpdatedTime ? (
              <span
                role="status"
                aria-live="polite"
                className="inline-flex items-center gap-1 rounded-full border border-moss/50 bg-moss/25 px-2 py-0.5 text-[10px] font-semibold text-[#9de4b4] tabular-nums"
              >
                <Check size={11} />
                <span>
                  {ui('Updated', 'Imesasishwa', 'Actualizado')} · {justUpdatedTime}
                </span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-[10px] text-paper/75 tabular-nums sm:text-[11px]">
                <span className="relative flex h-2 w-2" aria-hidden="true">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#9de4b4] opacity-65" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-[#9de4b4]" />
                </span>
                <span className="font-semibold text-[#9de4b4]">LIVE · 2s</span>
                <span className="text-paper/35">·</span>
                <Clock size={11} className="text-gold" />
                <strong className="text-paper/90">{formattedSyncTime}</strong>
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Master Unit Mode Toggle (Controls All 3 Views) */}
            <div
              role="group"
              aria-label={ui('Unit basis', 'Msingi wa kipimo', 'Base de unidad')}
              className="inline-flex rounded-md border border-paper/20 bg-ink-2 p-0.5 text-[10px]"
            >
              <button
                type="button"
                aria-pressed={unitBasis === 'metric_local'}
                onClick={() => setUnitBasis('metric_local')}
                className={`min-h-[32px] rounded px-2.5 py-1 font-mono font-semibold transition-colors ${
                  unitBasis === 'metric_local'
                    ? 'bg-gold text-ink shadow-xs'
                    : 'text-paper/75 hover:text-paper'
                }`}
              >
                {ui('Local (/g, /kg, /ct)', 'Ndani (/g, /kg, /ct)', 'Local (/g, /kg, /ct)')}
              </button>
              <button
                type="button"
                aria-pressed={unitBasis === 'standard'}
                onClick={() => setUnitBasis('standard')}
                className={`min-h-[32px] rounded px-2.5 py-1 font-mono font-semibold transition-colors ${
                  unitBasis === 'standard'
                    ? 'bg-gold text-ink shadow-xs'
                    : 'text-paper/75 hover:text-paper'
                }`}
              >
                {ui('Global (/toz, /lb, /t)', 'Dunia (/toz, /lb, /t)', 'Global (/toz, /lb, /t)')}
              </button>
            </div>

            <button
              type="button"
              onClick={() => void handleManualSync(true)}
              disabled={syncing}
              className="inline-flex items-center gap-1.5 rounded-md border border-gold/40 bg-gold/15 px-2.5 py-1 font-mono text-[10px] font-semibold text-gold transition hover:bg-gold/25 disabled:opacity-60"
            >
              <RefreshCw size={11} className={syncing ? 'animate-spin' : ''} />
              <span>
                {syncing
                  ? ui('Refreshing...', 'Inasasisha...', 'Actualizando...')
                  : ui('Refresh', 'Sasisha', 'Actualizar')}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Compact Above-the-Fold Terminal Header + Editorial 3-Tab Switcher + Active Module */}
      <section
        aria-label="Indicative Mineral Prices Board"
        className="grain relative isolate overflow-hidden border-b border-ink/15 bg-ink py-6 text-paper lg:py-8"
      >
        {/* Signature MineConnect Topographic Contour Texture */}
        <div className="contours absolute inset-0 -z-10 opacity-75" aria-hidden="true" />

        <div className="relative mx-auto max-w-7xl space-y-5 px-5 lg:px-8">
          {/* Compact Masthead & Segmented Terminal View Switcher */}
          <div className="flex flex-col justify-between gap-4 border-b border-paper/12 pb-5 lg:flex-row lg:items-end">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-gold/35 bg-ochre/20 px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-gold">
                  <Scale size={11} />
                  {ui(
                    'Tume ya Madini Aligned',
                    'Tume ya Madini Tanzania',
                    'Alineado Tume ya Madini',
                  )}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-moss/45 bg-moss/20 px-2.5 py-0.5 font-mono text-[10px] text-paper/85">
                  <Activity size={11} className="text-gold" />
                  LBMA · LME · {minerals.length}{' '}
                  {ui('Benchmarks', 'Viwango', 'Referencias')}
                </span>
              </div>

              <h1 className="font-display mt-2.5 text-3xl font-light leading-[1.08] text-paper sm:text-4xl">
                {language === 'sw' ? (
                  <>
                    Kituo cha <em className="italic text-gold">Bei Elekezi za Madini</em>
                  </>
                ) : language === 'es' ? (
                  <>
                    Terminal de <em className="italic text-gold">Precios de Minerales</em>
                  </>
                ) : (
                  <>
                    Statutory &amp; Global{' '}
                    <em className="italic text-gold">Mineral Benchmarks</em>
                  </>
                )}
              </h1>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Editorial 3-Tab Segmented Switcher */}
              <div
                role="tablist"
                aria-label={ui(
                  'Market terminal views',
                  'Mionekano ya soko',
                  'Vistas del terminal de mercados',
                )}
                className="flex w-full gap-1 overflow-x-auto rounded-xl border border-paper/20 bg-ink-2 p-1 sm:inline-flex sm:w-auto sm:overflow-visible"
              >
                {terminalTabs.map((tab) => {
                  const Icon = tab.icon
                  const isActive = activeView === tab.id
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      role="tab"
                      aria-selected={isActive}
                      onClick={() => selectView(tab.id)}
                      className={`inline-flex min-h-[44px] sm:min-h-[38px] flex-1 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border px-3 py-2 font-mono text-[11px] font-semibold transition-colors sm:flex-initial sm:px-3.5 ${
                        isActive
                          ? 'border-gold bg-gold text-ink shadow-sm'
                          : 'border-transparent text-paper/75 hover:bg-paper/[0.08] hover:text-paper'
                      }`}
                    >
                      <Icon
                        size={13}
                        className={isActive ? 'shrink-0 text-ink' : 'shrink-0 text-gold/85'}
                      />
                      <span className="hidden md:inline">{tab.label}</span>
                      <span className="truncate md:hidden">{tab.shortLabel}</span>
                    </button>
                  )
                })}
              </div>

              {showHeaderCta && (
                <Link
                  to="/markets"
                  className="inline-flex items-center gap-1.5 rounded-md border border-gold/45 bg-gold/15 px-3.5 py-2 font-mono text-xs font-semibold text-gold transition hover:bg-gold/25"
                >
                  <SlidersHorizontal size={13} />
                  {ui('Full Markets Terminal', 'Fungua Soko Kamili', 'Terminal de Mercados')}
                </Link>
              )}
            </div>
          </div>

          {/* 3. Active Focused Module Stage (One Module at a Time) */}
          <div role="tabpanel" className="min-h-[420px]">
            {activeView === 'spot' && (
              <LiveMarketTicker
                unitBasis={unitBasis}
                hideTelemetryHeader
                showSpotControls
                mineralsOverride={minerals}
                telemetryOverride={telemetry}
                onInspectTrend={handleInspectTrend}
                onExportValuationCsv={(visible) =>
                  handleExportValuationCsv(visible, 'live-spot-feed')
                }
                canExportMarkets={canExportValuation}
                csvDownloaded={csvDownloaded}
              />
            )}

            {activeView === 'trend' && (
              <MineralTrendChart
                minerals={minerals}
                selectedSymbol={chartSymbol}
                onSelectSymbol={(sym) => {
                  setChartSymbol(sym)
                  onViewChange?.('trend', sym)
                }}
                unitBasis={unitBasis}
              />
            )}

            {activeView === 'matrix' && (
              <div className="overflow-hidden rounded-xl border border-ink/15 bg-paper text-ink shadow-sm">
                {/* Matrix Header & Filter/Search Bar */}
                <div className="flex flex-col justify-between gap-4 border-b border-ink/10 bg-paper-2 px-5 py-4 lg:flex-row lg:items-center lg:px-6">
                  <div>
                    <div className="flex items-center gap-2">
                      <Scale size={16} className="text-ochre" />
                      <h2 className="font-display text-xl font-medium text-ink">
                        {ui(
                          'Statutory Mineral Pricing Matrix (World · Soko la Madini · Kituo cha Ununuzi)',
                          'Jedwali Rasmi la Bei za Madini (Soko la Dunia · Soko la Madini · Kituo cha Ununuzi)',
                          'Matriz Oficial de Precios de Minerales (Mundial · Soko la Madini · Kituo cha Ununuzi)',
                        )}
                      </h2>
                    </div>
                    <p className="mt-0.5 text-xs text-stone">
                      {ui('Showing converted rates in', 'Inaonyesha bei kwa sarafu ya', 'Mostrando precios convertidos en')}{' '}
                      <strong className="font-mono text-ochre">
                        {currencyMeta.flag} {currency} ({currencyMeta.symbol.trim()})
                      </strong>{' '}
                      · {ui('Unit Basis', 'Msingi wa Kipimo', 'Base de Unidad')}:{' '}
                      <strong className="font-mono text-ink">
                        {unitBasis === 'standard'
                          ? ui(
                              'International Benchmark (/toz, /lb, /tonne, /ct)',
                              'Kipimo cha Kimataifa (/toz, /lb, /tonne, /ct)',
                              'Estándar Internacional (/toz, /lb, /tonne, /ct)',
                            )
                          : ui(
                              'Tanzania Statutory Local Metric (/g, /kg, /ct)',
                              'Kipimo Rasmi cha Tanzania (/g, /kg, /ct)',
                              'Métrico Local de Tanzania (/g, /kg, /ct)',
                            )}
                      </strong>
                    </p>
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <div className="relative min-w-0 sm:w-52">
                      <Search
                        size={13}
                        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone"
                      />
                      <input
                        type="search"
                        value={matrixSearch}
                        onChange={(e) => setMatrixSearch(e.target.value)}
                        placeholder={ui(
                          'Filter mineral or hub...',
                          'Chuja madini au mkoa...',
                          'Filtrar mineral...',
                        )}
                        aria-label={ui('Search statutory matrix', 'Tafuta jedwali', 'Buscar matriz')}
                        className="h-9 w-full rounded-lg border border-ink/15 bg-paper pl-8 pr-3 text-xs text-ink placeholder:text-stone/70 outline-none transition focus:border-ochre"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleExportMatrixCsv}
                      className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-ink/15 bg-ink px-3.5 font-mono text-[11px] font-semibold text-gold transition hover:bg-ochre hover:text-paper"
                    >
                      {csvDownloaded ? (
                        <>
                          <Check size={13} />
                          <span>{ui('CSV Downloaded', 'CSV Imepakuliwa', 'CSV Descargado')}</span>
                        </>
                      ) : (
                        <>
                          {canExportValuation ? <Download size={13} /> : <Lock size={12} />}
                          <span>
                            {ui('Export Valuation CSV', 'Pakua CSV ya Thamani', 'Exportar CSV')}
                          </span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Matrix Category Filter Pills */}
                <div className="flex flex-wrap items-center gap-1.5 border-b border-ink/10 bg-paper px-5 py-3 lg:px-6">
                  {(
                    [
                      'ALL',
                      'Precious Metals',
                      'Base & Industrial Metals',
                      'Critical & Battery Minerals',
                      'Gemstones',
                    ] as const
                  ).map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setSelectedCategory(cat)}
                      className={`rounded-lg px-3 py-1.5 font-mono text-[11px] font-semibold transition ${
                        selectedCategory === cat
                          ? 'bg-ink text-gold shadow-xs'
                          : 'border border-ink/12 bg-paper-2/60 text-ink-3 hover:border-ochre/40 hover:text-ink'
                      }`}
                    >
                      {translateCategory(cat)}
                    </button>
                  ))}
                </div>

                {/* Matrix Table (Horizontal Scroll Safe on Mobile) */}
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[780px] text-left text-xs">
                    <thead className="border-b border-ink/12 bg-paper-2/60 font-mono text-[11px] uppercase tracking-wider text-stone">
                      <tr>
                        <th className="px-5 py-3.5">
                          {ui('Mineral & Purity Standard', 'Aina ya Madini na Ubora', 'Mineral y Pureza')}
                        </th>
                        <th className="px-4 py-3.5">
                          <span className="inline-flex items-center gap-1 text-ink">
                            <Globe size={12} className="text-ochre" />
                            {ui(`World Spot (${currency})`, `Soko la Dunia (${currency})`, `Precio Mundial (${currency})`)}
                          </span>
                        </th>
                        <th className="px-4 py-3.5">
                          <span className="inline-flex items-center gap-1 text-ochre">
                            <Coins size={12} />
                            {ui(`Local Unit Rate (${currency})`, `Bei kwa Kipimo (${currency})`, `Tasa por Unidad (${currency})`)}
                          </span>
                        </th>
                        <th className="px-4 py-3.5">
                          <span className="inline-flex items-center gap-1 text-moss">
                            <ShieldCheck size={12} />
                            {ui(`Soko la Madini (${currency})`, `Soko la Madini (${currency})`, `Mercado Local (${currency})`)}
                          </span>
                        </th>
                        <th className="px-4 py-3.5">
                          <span className="inline-flex items-center gap-1 text-ink">
                            {ui(`Buying Centre (${currency})`, `Kituo cha Ununuzi (${currency})`, `Centro de Compra (${currency})`)}
                          </span>
                        </th>
                        <th className="px-4 py-3.5 text-center">
                          {ui('Royalty + Insp.', 'Mrabaha + Ada', 'Regalía + Insp.')}
                        </th>
                        <th className="px-5 py-3.5 text-right">
                          {ui('24h Change & Trend', 'Mabadiliko ya Saa 24', 'Cambio 24h y Tendencia')}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-ink/10">
                      {filteredMinerals.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-6 py-10 text-center text-sm text-stone">
                            {ui(
                              'No statutory benchmarks match your current filter.',
                              'Hakuna viwango vya madini vinavyolingana na kichujio chako.',
                              'Ninguna referencia coincide con el filtro actual.',
                            )}
                          </td>
                        </tr>
                      ) : (
                        filteredMinerals.map((m) => {
                          const positive = m.trend_percentage >= 0
                          const intSpotUnit = m.unit.replace(/^USD\//i, '')
                          const worldAdj = formatStatutoryPrice(
                            m.world_market_price_usd,
                            m.unit,
                            unitBasis,
                          )
                          const localAdj = formatStatutoryPrice(
                            m.local_market_price_usd,
                            m.unit,
                            unitBasis,
                          )
                          const buyingAdj = formatStatutoryPrice(
                            m.buying_centre_price_usd,
                            m.unit,
                            unitBasis,
                          )
                          const perGramOrKgNote = formatStatutoryPrice(
                            m.world_market_price_usd,
                            m.unit,
                            'metric_local',
                          )
                          const localIntSpot = formatPrice(m.local_market_price_usd)
                          const buyingIntSpot = formatPrice(m.buying_centre_price_usd)

                          return (
                            <tr key={m.id} className="transition hover:bg-paper-2/70">
                              <td className="px-5 py-3.5">
                                <div className="flex items-center gap-3">
                                  <button
                                    type="button"
                                    onClick={() => handleInspectTrend(m.symbol)}
                                    title={ui(
                                      `Open ${m.symbol} Trend Chart`,
                                      `Fungua Chati ya ${m.symbol}`,
                                      `Abrir gráfico de ${m.symbol}`,
                                    )}
                                    className="flex h-9 w-11 shrink-0 items-center justify-center rounded-lg border border-ink/15 bg-ink font-mono text-xs font-bold text-gold transition hover:bg-ochre hover:text-paper"
                                  >
                                    {m.symbol}
                                  </button>
                                  <div>
                                    <div className="font-display text-base font-medium text-ink">
                                      {m.mineral_name}
                                    </div>
                                    <div className="font-mono text-[11px] text-stone">
                                      {m.purity_note}
                                    </div>
                                    {m.producing_regions && (
                                      <div className="mt-0.5 font-mono text-[10px] text-ochre">
                                        {ui('Hubs', 'Mikoa', 'Regiones')}: {m.producing_regions}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </td>

                              <td className="whitespace-nowrap px-4 py-3.5 font-mono">
                                <div className="text-sm font-semibold text-ink">
                                  <PriceDisplay
                                    amountInUSD={m.world_market_price_usd}
                                    suffix={`/${intSpotUnit}`}
                                  />
                                </div>
                                <div className="text-[10px] text-stone">
                                  {perGramOrKgNote.formatted}
                                  {perGramOrKgNote.unitSuffix} ({ui('local metric', 'kipimo cha ndani', 'métrico local')})
                                </div>
                              </td>

                              <td className="whitespace-nowrap px-4 py-3.5 font-mono">
                                <div className="text-sm font-bold text-ochre">
                                  {worldAdj.formatted}
                                  <span className="ml-1 text-[11px] font-normal text-stone">
                                    {worldAdj.unitSuffix}
                                  </span>
                                </div>
                                <div className="text-[10px] text-stone">
                                  {perGramOrKgNote.formatted}
                                  {perGramOrKgNote.unitSuffix} ({currency})
                                </div>
                              </td>

                              <td className="whitespace-nowrap px-4 py-3.5 font-mono">
                                <div className="text-sm font-bold text-moss">
                                  {localAdj.formatted}
                                  <span className="ml-1 text-[11px] font-normal text-stone">
                                    {localAdj.unitSuffix}
                                  </span>
                                </div>
                                <div className="text-[10px] text-stone">
                                  {localIntSpot}/{intSpotUnit}
                                </div>
                              </td>

                              <td className="whitespace-nowrap px-4 py-3.5 font-mono">
                                <div className="text-sm font-bold text-ink">
                                  {buyingAdj.formatted}
                                  <span className="ml-1 text-[11px] font-normal text-stone">
                                    {buyingAdj.unitSuffix}
                                  </span>
                                </div>
                                <div className="text-[10px] text-stone">
                                  {buyingIntSpot}/{intSpotUnit}
                                </div>
                              </td>

                              <td className="whitespace-nowrap px-4 py-3.5 text-center font-mono">
                                <span className="rounded-md border border-ink/15 bg-paper-2 px-2 py-1 text-[11px] font-semibold text-ink-2">
                                  {m.royalty_rate_pct.toFixed(1)}% +{' '}
                                  {(m.inspection_fee_pct ?? 1.0).toFixed(1)}%
                                </span>
                              </td>

                              <td className="whitespace-nowrap px-5 py-3.5 text-right">
                                <div className="inline-flex items-center justify-end gap-3">
                                  <SparklineSvg
                                    points={m.sparkline_points}
                                    positive={positive}
                                    onLight
                                  />
                                  <span
                                    className={`inline-flex min-w-[68px] items-center justify-center gap-0.5 rounded-md border px-2 py-1 font-mono text-xs font-semibold ${
                                      positive
                                        ? 'border-moss/35 bg-moss-light text-moss'
                                        : 'border-danger/35 bg-danger/10 text-danger'
                                    }`}
                                  >
                                    {positive ? (
                                      <ArrowUpRight size={12} />
                                    ) : (
                                      <ArrowDownRight size={12} />
                                    )}
                                    {positive ? '+' : ''}
                                    {m.trend_percentage.toFixed(2)}%
                                  </span>
                                </div>
                              </td>
                            </tr>
                          )
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Interactive Statutory Mineral Valuation & Royalty Calculator */}
                {calcBreakdown && selectedCalcMineral && (
                  <div className="border-t border-ink/12 bg-paper-2/90 px-5 py-5 lg:px-6">
                    <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="inline-flex items-center gap-1.5 rounded-lg bg-ink px-3 py-1.5 font-mono text-[11px] font-semibold text-gold">
                          <Calculator size={13} />
                          {ui(
                            `Statutory Valuation & Royalty Calculator (${currency})`,
                            `Kikokotoo cha Thamani ya Madini na Mrabaha (${currency})`,
                            `Calculadora Oficial de Valoración y Regalías (${currency})`,
                          )}
                        </span>
                        <select
                          value={calcSymbol}
                          onChange={(e) => setCalcSymbol(e.target.value)}
                          aria-label="Select mineral for valuation"
                          className="rounded-lg border border-ink/20 bg-paper px-3 py-1.5 font-mono text-xs font-semibold text-ink"
                        >
                          {minerals.map((m) => (
                            <option key={m.id} value={m.symbol}>
                              {m.symbol} — {m.mineral_name}
                            </option>
                          ))}
                        </select>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            min="0.01"
                            step="any"
                            value={calcQuantity}
                            onChange={(e) => setCalcQuantity(e.target.value)}
                            aria-label="Quantity"
                            className="w-28 rounded-lg border border-ink/20 bg-paper px-3 py-1.5 font-mono text-xs font-semibold text-ink"
                          />
                          <span className="font-mono text-xs font-semibold text-stone">
                            {calcBreakdown.unitLabel}
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                        <div className="rounded-lg border border-ink/10 bg-paper px-3 py-2">
                          <span className="block font-mono text-[10px] uppercase text-stone">
                            {ui('Gross World Value', 'Thamani Soko la Dunia', 'Valor Bruto Mundial')}
                          </span>
                          <span className="font-mono text-xs font-bold text-ink">
                            {calcBreakdown.grossWorldFormatted}
                          </span>
                        </div>
                        <div className="rounded-lg border border-ink/10 bg-paper px-3 py-2">
                          <span className="block font-mono text-[10px] uppercase text-stone">
                            {ui('Royalty', 'Mrabaha', 'Regalía')} ({calcBreakdown.royaltyPct}%) +{' '}
                            {ui('Fee', 'Ada', 'Tasa')} ({calcBreakdown.inspectionPct}%)
                          </span>
                          <span className="font-mono text-xs font-bold text-ochre">
                            {calcBreakdown.royaltyFormatted} + {calcBreakdown.inspectionFormatted}
                          </span>
                        </div>
                        <div className="rounded-lg border border-moss/30 bg-moss-light/60 px-3 py-2">
                          <span className="block font-mono text-[10px] uppercase text-moss">
                            {ui('Soko la Madini Net', 'Malipo Soko la Madini', 'Neto Soko la Madini')}
                          </span>
                          <span className="font-mono text-xs font-bold text-moss">
                            {calcBreakdown.sokoPayoutFormatted}
                          </span>
                        </div>
                        <div className="rounded-lg border border-gold/40 bg-gold/15 px-3 py-2">
                          <span className="block font-mono text-[10px] uppercase text-ink-2">
                            {ui('Buying Centre Payout', 'Malipo Kituo cha Ununuzi', 'Pago Centro de Compra')}
                          </span>
                          <span className="font-mono text-xs font-bold text-ink">
                            {calcBreakdown.buyingCentrePayoutFormatted}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Regulatory Compliance & Statutory Disclaimer Footer */}
                <div className="flex flex-col justify-between gap-3 border-t border-ink/10 bg-paper px-5 py-4 text-[11px] text-stone sm:flex-row sm:items-center lg:px-6">
                  <p>
                    <strong className="text-ink">
                      {ui('Regulatory Notice:', 'Taarifa ya Kisheria:', 'Aviso Regulatorio:')}
                    </strong>{' '}
                    {ui(
                      'Indicative prices are published for market transparency and financial modelling only. Final statutory royalty assessments (6% metallic/gemstones, 3% industrial minerals) and 1% clearing & inspection fees are determined by the Mining Commission of Tanzania (Tume ya Madini) at licensed Mineral Markets (Masoko ya Madini).',
                      'Bei elekezi zinachapishwa kwa uwazi wa soko na makadirio ya kifedha pekee. Tathmini ya mwisho ya mrabaha wa serikali (6% madini ya metali/vito, 3% madini ya viwandani) na ada ya ukaguzi ya 1% huamuliwa na Tume ya Madini katika Masoko ya Madini yaliyosajiliwa.',
                      'Los precios indicativos se publican únicamente para transparencia del mercado. Las regalías legales finales (6% metálicos/gemas, 3% industriales) y la tasa de inspección del 1% son determinadas por la Comisión Minera de Tanzania (Tume ya Madini).',
                    )}
                  </p>
                  <span className="shrink-0 font-mono text-[10px] uppercase tracking-wider text-ochre">
                    1 toz = 31.1035 g · 1 lb = 453.59 g
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
      {showExportUpgrade && (
        <UpgradeRequiredGate
          variant="modal"
          requiredPlan="pro"
          currentPlanLabel={activePlan.name}
          accountStateOverride={accountState}
          featureTitle={
            accountState === 'dormant'
              ? 'Renew Subscription to Export Markets Valuation CSV'
              : 'Upgrade to Export Markets Valuation CSV'
          }
          reason={
            accountState === 'dormant'
              ? `Your paid subscription is currently dormant. Renew Operator Pro or Institutional / JV Desk to download live ${currency} (${unitBasis === 'metric_local' ? 'Local /g, /kg, /ct' : 'Global /toz, /lb, /t'}) valuation CSV snapshots with active FX rates and EAT timestamps.`
              : `Downloading formatted ${currency} valuation CSV snapshots (World Spot, Soko la Madini, Buying Centre, active FX rate & EAT timestamp) requires an active Operator Pro or Institutional / JV Desk subscription.`
          }
          onClose={() => setShowExportUpgrade(false)}
        />
      )}
    </div>
  )
}
