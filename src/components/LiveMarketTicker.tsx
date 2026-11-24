'use client'

import { useMemo, useState } from 'react'
import { Link } from '@tanstack/react-router'
import {
  Activity,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Clock,
  Globe,
  Radio,
  RefreshCw,
  Search,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react'
import {
  getMarketSyncTelemetry,
  getStoredMineralPrices,
  getTradingDeskSessions,
  subscribeMineralPrices,
} from '../data/mineralPrices'
import { executeLiveMarketSync } from '../app/api/market-sync/route'
import { useLocalization } from '../context/LocalizationContext'
import PriceDisplay from './PriceDisplay'
import { useCallback, useEffect } from 'react'
import type {
  MarketSyncTelemetry,
  MineralCategory,
  MineralPriceRecord,
} from '../types/database'

export type SpotFeedFilterGroup =
  | 'ALL'
  | 'Precious Metals'
  | 'Gemstones'
  | 'Battery & Industrial'

export type SpotFeedSortKey =
  | 'default'
  | 'gainers'
  | 'losers'
  | 'price_desc'
  | 'name_asc'

export interface LiveMarketTickerProps {
  /** Unit basis passed from parent board or controlled internally */
  unitBasis?: 'standard' | 'metric_local'
  /** Compact mode for embedding in User Dashboard or Marketplace header */
  compact?: boolean
  /** Optional link to full /markets page when rendered in compact mode */
  showFullMarketsLink?: boolean
  /** Hide top FX/sync telemetry header when rendered below the sticky Market Context Bar */
  hideTelemetryHeader?: boolean
  /** Enable interactive category pills, search & sort controls for the Live Spot Feed tab */
  showSpotControls?: boolean
  /** Externally controlled minerals array (from MineralPricesBoard) */
  mineralsOverride?: MineralPriceRecord[]
  /** Externally controlled sync telemetry */
  telemetryOverride?: MarketSyncTelemetry
  /** Clicking a mineral card's trend CTA jumps directly to the Interactive Mineral Trend tab */
  onInspectTrend?: (symbol: string) => void
}

function matchesSpotFilterGroup(
  category: MineralCategory,
  group: SpotFeedFilterGroup,
): boolean {
  if (group === 'ALL') return true
  if (group === 'Battery & Industrial') {
    return (
      category === 'Critical & Battery Minerals' ||
      category === 'Base & Industrial Metals'
    )
  }
  return category === group
}

export default function LiveMarketTicker({
  unitBasis: externalUnitBasis,
  compact = false,
  showFullMarketsLink = false,
  hideTelemetryHeader = false,
  showSpotControls = false,
  mineralsOverride,
  telemetryOverride,
  onInspectTrend,
}: LiveMarketTickerProps) {
  const {
    currency,
    currencyMeta,
    rateForSelected,
    ratesSource,
    ratesProvider,
    fetchedAt: fxFetchedAt,
    refreshRates,
    formatStatutoryPrice,
    language,
    ui,
  } = useLocalization()

  const [internalUnitBasis, setInternalUnitBasis] = useState<
    'standard' | 'metric_local'
  >('metric_local')
  const activeUnitBasis = externalUnitBasis ?? internalUnitBasis

  const [internalMinerals, setInternalMinerals] = useState<MineralPriceRecord[]>(() =>
    getStoredMineralPrices(),
  )
  const [internalTelemetry, setInternalTelemetry] = useState<MarketSyncTelemetry>(() =>
    getMarketSyncTelemetry(),
  )
  const [syncing, setSyncing] = useState(false)
  const [secondsToNextSync, setSecondsToNextSync] = useState(45)

  // Live Spot Feed filter, search, and sort controls
  const [spotFilter, setSpotFilter] = useState<SpotFeedFilterGroup>('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<SpotFeedSortKey>('default')

  const minerals = mineralsOverride ?? internalMinerals
  const telemetry = telemetryOverride ?? internalTelemetry

  const handleManualSync = useCallback(
    async (force = true) => {
      setSyncing(true)
      try {
        const [result] = await Promise.all([
          executeLiveMarketSync({ force }),
          force ? refreshRates() : Promise.resolve(),
        ])
        setInternalMinerals(result.records)
        setInternalTelemetry(result.telemetry)
        setSecondsToNextSync(45)
      } finally {
        setSyncing(false)
      }
    },
    [refreshRates],
  )

  // Subscribe to store updates only when managing own data (not controlled by parent)
  useEffect(() => {
    if (mineralsOverride) return

    setInternalMinerals(getStoredMineralPrices())
    setInternalTelemetry(getMarketSyncTelemetry())
    void handleManualSync(false)

    const unsubscribe = subscribeMineralPrices(() => {
      setInternalMinerals(getStoredMineralPrices())
      setInternalTelemetry(getMarketSyncTelemetry())
    })

    return unsubscribe
  }, [handleManualSync, mineralsOverride])

  useEffect(() => {
    if (mineralsOverride) return
    const interval = setInterval(() => {
      setSecondsToNextSync((prev) => {
        if (prev <= 1) {
          void handleManualSync(true)
          return 45
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [handleManualSync, mineralsOverride])

  const deskSessions = useMemo(() => getTradingDeskSessions(), [])

  const displayedMinerals = useMemo(() => {
    let list = compact ? minerals.slice(0, 5) : [...minerals]

    if (showSpotControls) {
      if (spotFilter !== 'ALL') {
        list = list.filter((m) => matchesSpotFilterGroup(m.category, spotFilter))
      }
      const q = searchQuery.trim().toLowerCase()
      if (q) {
        list = list.filter(
          (m) =>
            m.mineral_name.toLowerCase().includes(q) ||
            m.symbol.toLowerCase().includes(q) ||
            (m.producing_regions ?? '').toLowerCase().includes(q) ||
            m.category.toLowerCase().includes(q),
        )
      }

      if (sortBy === 'gainers') {
        list.sort((a, b) => b.trend_percentage - a.trend_percentage)
      } else if (sortBy === 'losers') {
        list.sort((a, b) => a.trend_percentage - b.trend_percentage)
      } else if (sortBy === 'price_desc') {
        list.sort((a, b) => {
          const aVal = formatStatutoryPrice(a.world_market_price_usd, a.unit, activeUnitBasis).unitUsd
          const bVal = formatStatutoryPrice(b.world_market_price_usd, b.unit, activeUnitBasis).unitUsd
          return bVal - aVal
        })
      } else if (sortBy === 'name_asc') {
        list.sort((a, b) => a.mineral_name.localeCompare(b.mineral_name))
      }
    }

    return list
  }, [
    minerals,
    compact,
    showSpotControls,
    spotFilter,
    searchQuery,
    sortBy,
    formatStatutoryPrice,
    activeUnitBasis,
  ])

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

  const filterLabels: Record<SpotFeedFilterGroup, string> = {
    ALL: ui(`All (${minerals.length})`, `Zote (${minerals.length})`, `Todos (${minerals.length})`),
    'Precious Metals': ui('Precious Metals', 'Madini ya Thamani', 'Metales Preciosos'),
    Gemstones: ui('Gemstones', 'Vito vya Thamani', 'Piedras Preciosas'),
    'Battery & Industrial': ui(
      'Battery & Industrial',
      'Betri na Viwandani',
      'Baterías e Industriales',
    ),
  }

  return (
    <div
      data-currency={currency}
      data-language={language}
      className="rounded-xl border border-paper/15 bg-ink-2 p-4 text-paper shadow-sm lg:p-5"
    >
      {/* Optional Standalone Telemetry Header (hidden when sticky Market Context Bar handles it) */}
      {!hideTelemetryHeader && (
        <div className="flex flex-col justify-between gap-3 border-b border-paper/10 pb-3.5 lg:flex-row lg:items-center">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="inline-flex items-center gap-2 rounded-full border border-moss/50 bg-moss/25 px-3 py-1 font-mono text-[11px] font-semibold tracking-wider text-[#9de4b4]">
              <span className="inline-flex h-2 w-2 rounded-full bg-[#9de4b4]" />
              {telemetry.syncMode === 'LIVE_API'
                ? ui(
                    'LIVE SPOT FEED · LBMA / LME / TUME YA MADINI',
                    'SOKO MOJA KWA MOJA · LBMA / LME / TUME YA MADINI',
                    'FEED SPOT EN VIVO · LBMA / LME / TUME YA MADINI',
                  )
                : ui(
                    'ACTIVE BENCHMARK FEED · LBMA / TUME YA MADINI',
                    'BEI ELEKEZI HAI · LBMA / TUME YA MADINI',
                    'FEED DE REFERENCIA ACTIVO · LBMA / TUME YA MADINI',
                  )}
            </span>

            <span
              className="inline-flex items-center gap-1.5 rounded-full border border-paper/12 bg-paper/[0.05] px-2.5 py-1 font-mono text-[11px] text-paper/75 tabular-nums"
              title={
                fxFetchedAt
                  ? `${ratesSource === 'live' ? 'Live FX' : 'Cached FX'} (${ratesProvider}) · ${fxFetchedAt.toLocaleTimeString()}`
                  : 'Offline Fallback FX'
              }
            >
              <Globe size={11} className="text-gold" />
              1 USD ={' '}
              <strong className="text-gold">
                {rateForSelected.toLocaleString('en-US', {
                  minimumFractionDigits:
                    currency === 'USD' || rateForSelected >= 100 ? 2 : 4,
                  maximumFractionDigits:
                    currency === 'USD' || rateForSelected >= 100 ? 2 : 4,
                })}{' '}
                {currency}
              </strong>{' '}
              ({currencyMeta.flag})
            </span>

            <div className="hidden items-center gap-1.5 xl:flex">
              {deskSessions.map((session) => (
                <span
                  key={session.desk}
                  className="inline-flex items-center gap-1.5 rounded-md border border-paper/10 bg-paper/[0.03] px-2 py-0.5 font-mono text-[10px] text-paper/65"
                  title={session.sessionNote}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-gold" />
                  {session.city}
                </span>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 font-mono text-[11px]">
            <span className="inline-flex items-center gap-1.5 text-paper/65">
              <Clock size={12} className="text-gold" />
              {ui('Synced', 'Imesasishwa', 'Sincronizado')}:{' '}
              <strong className="text-paper/90">{formattedSyncTime}</strong>
              <span className="text-paper/45">({secondsToNextSync}s)</span>
            </span>

            {externalUnitBasis === undefined && (
              <div className="inline-flex rounded-lg border border-paper/15 bg-ink p-0.5 text-[10px]">
                <button
                  type="button"
                  onClick={() => setInternalUnitBasis('metric_local')}
                  className={`rounded px-2 py-1 font-mono font-semibold transition ${
                    activeUnitBasis === 'metric_local'
                      ? 'bg-ochre text-paper'
                      : 'text-paper/65 hover:text-paper'
                  }`}
                >
                  {ui('Local (/g, /kg)', 'Ndani (/g, /kg)', 'Local (/g, /kg)')}
                </button>
                <button
                  type="button"
                  onClick={() => setInternalUnitBasis('standard')}
                  className={`rounded px-2 py-1 font-mono font-semibold transition ${
                    activeUnitBasis === 'standard'
                      ? 'bg-ochre text-paper'
                      : 'text-paper/65 hover:text-paper'
                  }`}
                >
                  {ui('Spot (/toz, /t)', 'Kimataifa (/toz, /t)', 'Spot (/toz, /t)')}
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={() => void handleManualSync(true)}
              disabled={syncing}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gold/40 bg-gold/15 px-2.5 py-1 font-mono text-[11px] font-semibold text-gold transition hover:bg-gold/25 disabled:opacity-50"
            >
              <RefreshCw size={11} className={syncing ? 'animate-spin' : ''} />
              {syncing
                ? ui('Syncing Desk...', 'Inasasisha...', 'Sincronizando...')
                : ui('Sync Live', 'Sasisha Sasa', 'Sincronizar')}
            </button>

            {showFullMarketsLink && (
              <Link
                to="/markets"
                className="inline-flex items-center gap-1 rounded-lg border border-paper/20 bg-paper/10 px-2.5 py-1 font-mono text-[11px] font-semibold text-paper transition hover:bg-paper/20"
              >
                {ui('Full Desk', 'Soko Kamili', 'Mercado Completo')}
                <ArrowRight size={11} />
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Live Spot Feed Category Pills + Search & Sort Bar */}
      {showSpotControls && (
        <div className="flex flex-col justify-between gap-3 border-b border-paper/10 pb-4 lg:flex-row lg:items-center">
          <div
            role="group"
            aria-label={ui('Filter minerals by category', 'Chuja madini kwa kategoria', 'Filtrar minerales por categoría')}
            className="flex flex-wrap items-center gap-1.5"
          >
            {(
              [
                'ALL',
                'Precious Metals',
                'Gemstones',
                'Battery & Industrial',
              ] as const
            ).map((group) => {
              const active = spotFilter === group
              return (
                <button
                  key={group}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setSpotFilter(group)}
                  className={`rounded-lg px-3 py-1.5 font-mono text-[11px] font-semibold transition ${
                    active
                      ? 'bg-paper text-ink shadow-xs'
                      : 'border border-paper/15 bg-paper/[0.04] text-paper/75 hover:border-gold/40 hover:text-paper'
                  }`}
                >
                  {filterLabels[group]}
                </button>
              )
            })}
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative min-w-0 sm:w-56">
              <Search
                size={13}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-paper/45"
              />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={ui(
                  'Search mineral or hub...',
                  'Tafuta madini au mkoa...',
                  'Buscar mineral o región...',
                )}
                aria-label={ui('Search minerals', 'Tafuta madini', 'Buscar minerales')}
                className="h-9 w-full rounded-lg border border-paper/15 bg-ink pl-8 pr-3 text-xs text-paper placeholder:text-paper/45 outline-none transition focus:border-gold/60"
              />
            </div>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SpotFeedSortKey)}
              aria-label={ui('Sort spot feed', 'Panga bei', 'Ordenar listado')}
              className="h-9 rounded-lg border border-paper/15 bg-ink px-3 font-mono text-[11px] text-paper outline-none transition focus:border-gold/60"
            >
              <option value="default">
                {ui('Sort: Market Order', 'Panga: Chaguo-msingi', 'Orden: Mercado')}
              </option>
              <option value="gainers">
                {ui('Sort: Top 24h Gainers', 'Panga: Zilizopanda 24h', 'Orden: Mayores alzas 24h')}
              </option>
              <option value="losers">
                {ui('Sort: 24h Decliners', 'Panga: Zilizoshuka 24h', 'Orden: Mayores bajas 24h')}
              </option>
              <option value="price_desc">
                {ui('Sort: Highest Unit Rate', 'Panga: Bei ya Juu', 'Orden: Mayor precio unitario')}
              </option>
              <option value="name_asc">
                {ui('Sort: A – Z', 'Panga: A – Z', 'Orden: A – Z')}
              </option>
            </select>
          </div>
        </div>
      )}

      {/* Live Pricing Matrix Grid */}
      {displayedMinerals.length === 0 ? (
        <div className="my-8 rounded-xl border border-paper/10 bg-paper/[0.03] px-6 py-10 text-center">
          <p className="font-display text-lg text-paper">
            {ui(
              'No matching mineral benchmarks',
              'Hakuna madini yanayolingana na utafutaji',
              'No se encontraron minerales coincidentes',
            )}
          </p>
          <p className="mt-1 text-xs text-paper/60">
            {ui(
              'Try clearing your search or switching back to All categories.',
              'Jaribu kufuta utafutaji au kurudi kwenye kategoria Zote.',
              'Prueba borrar la búsqueda o volver a Todos.',
            )}
          </p>
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
          {displayedMinerals.map((m) => {
            const positive = m.trend_percentage >= 0
            const worldStatutory = formatStatutoryPrice(
              m.world_market_price_usd,
              m.unit,
              activeUnitBasis,
            )
            const sokoStatutory = formatStatutoryPrice(
              m.local_market_price_usd,
              m.unit,
              'metric_local',
            )
            const buyingStatutory = formatStatutoryPrice(
              m.buying_centre_price_usd,
              m.unit,
              'metric_local',
            )
            const intSpotUnit = m.unit.replace(/^USD\//i, '')

            const dayLow = m.day_low_usd ?? m.world_market_price_usd * 0.992
            const dayHigh = m.day_high_usd ?? m.world_market_price_usd * 1.008
            const rangeSpan = Math.max(0.0001, dayHigh - dayLow)
            const rangePct = Math.min(
              100,
              Math.max(
                8,
                Math.round(((m.world_market_price_usd - dayLow) / rangeSpan) * 100),
              ),
            )

            const isDirectLive = m.feed_source === 'LIVE_API'

            return (
              <article
                key={m.id}
                className="group relative flex flex-col justify-between rounded-xl border border-paper/10 bg-paper/[0.04] p-4 transition hover:border-gold/45 hover:bg-paper/[0.07]"
              >
                <div>
                  {/* Row 1: Symbol, Feed Badge, & 24h Trend */}
                  <div className="flex items-center justify-between gap-1.5">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-xs font-bold tracking-wider text-gold">
                        {m.symbol}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider ${
                          isDirectLive
                            ? 'border border-moss/40 bg-moss/25 text-[#9de4b4]'
                            : 'border border-paper/15 bg-paper/10 text-paper/65'
                        }`}
                      >
                        <Radio size={8} />
                        {isDirectLive
                          ? ui('LIVE', 'HAI', 'VIVO')
                          : ui('DESK', 'DAWATI', 'MESA')}
                      </span>
                    </div>

                    <span
                      className={`inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold tabular-nums ${
                        positive
                          ? 'bg-moss/40 text-[#9de4b4]'
                          : 'bg-danger/30 text-[#f59c8a]'
                      }`}
                    >
                      {positive ? (
                        <ArrowUpRight size={11} />
                      ) : (
                        <ArrowDownRight size={11} />
                      )}
                      {positive ? '+' : ''}
                      {m.trend_percentage.toFixed(2)}%
                    </span>
                  </div>

                  {/* Row 2: Commodity Name & Exchange Desk */}
                  <div className="mt-2">
                    <p className="truncate text-sm font-semibold text-paper/95">
                      {m.mineral_name}
                    </p>
                    <p className="truncate font-mono text-[10px] text-paper/50">
                      {m.exchange_desk ?? 'LBMA / Tume ya Madini'}
                    </p>
                  </div>

                  {/* Row 3: Primary Active Price + Statutory Reference Tiers */}
                  <div className="mt-3 border-t border-paper/10 pt-2.5">
                    <div className="flex items-baseline justify-between gap-1">
                      <span className="font-mono text-[10px] uppercase tracking-wider text-paper/55">
                        {ui('World Spot', 'Bei ya Dunia', 'Spot Mundial')}
                      </span>
                      <div className="font-mono text-xs font-bold text-paper tabular-nums">
                        {worldStatutory.formatted}
                        <span className="text-[10px] font-normal text-paper/55">
                          {worldStatutory.unitSuffix}
                        </span>
                      </div>
                    </div>

                    <div className="mt-1 flex items-baseline justify-between gap-1">
                      <span className="font-mono text-[10px] text-paper/60">
                        {ui('Soko la Madini', 'Soko la Madini', 'Soko la Madini')}
                      </span>
                      <div className="font-mono text-[11px] font-semibold text-[#9de4b4] tabular-nums">
                        {sokoStatutory.formatted}
                        <span className="text-[9px] font-normal text-paper/55">
                          {sokoStatutory.unitSuffix}
                        </span>
                      </div>
                    </div>

                    <div className="mt-1 flex items-baseline justify-between gap-1">
                      <span className="font-mono text-[10px] text-paper/55">
                        {ui('Buying Centre', 'Kituo cha Ununuzi', 'Centro Compra')}
                      </span>
                      <div className="font-mono text-[11px] font-semibold text-gold tabular-nums">
                        {buyingStatutory.formatted}
                        <span className="text-[9px] font-normal text-paper/55">
                          {buyingStatutory.unitSuffix}
                        </span>
                      </div>
                    </div>

                    <div className="mt-1 flex items-baseline justify-between gap-1 font-mono text-[10px] text-paper/45 tabular-nums">
                      <span>{ui('Intl Unit', 'Kimataifa', 'Unidad Intl')}</span>
                      <span>
                        <PriceDisplay
                          amountInUSD={m.world_market_price_usd}
                          suffix={`/${intSpotUnit}`}
                        />
                      </span>
                    </div>
                  </div>
                </div>

                {/* Row 4: Intraday Range Bar & Optional Trend Jump CTA */}
                <div className="mt-3 pt-1">
                  <div className="h-1 w-full overflow-hidden rounded-full bg-paper/10">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        positive ? 'bg-[#9de4b4]' : 'bg-gold'
                      }`}
                      style={{ width: `${rangePct}%` }}
                    />
                  </div>
                  {onInspectTrend && (
                    <button
                      type="button"
                      onClick={() => onInspectTrend(m.symbol)}
                      className="mt-2.5 inline-flex w-full items-center justify-between rounded-md border border-paper/10 bg-paper/[0.03] px-2.5 py-1.5 font-mono text-[10px] font-semibold text-paper/75 transition hover:border-gold/45 hover:bg-gold/10 hover:text-gold"
                    >
                      <span className="inline-flex items-center gap-1">
                        <TrendingUp size={11} />
                        {ui('View Trend Chart', 'Tazama Chati', 'Ver Tendencia')}
                      </span>
                      <ArrowRight size={11} />
                    </button>
                  )}
                </div>
              </article>
            )
          })}
        </div>
      )}

      {/* Bottom Regulatory & Provider Telemetry Footer */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-paper/10 pt-3 font-mono text-[10px] text-paper/55">
        <span className="inline-flex items-center gap-1.5">
          <ShieldCheck size={12} className="text-gold" />
          {ui('Source Pipeline:', 'Chanzo cha Takwimu:', 'Pipeline de Datos:')}{' '}
          <strong className="text-paper/80">{telemetry.provider}</strong> ·{' '}
          {ui('Latency', 'Muda', 'Latencia')}: {telemetry.latencyMs}ms
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Activity size={11} className="text-gold" />
          {ui(
            'Statutory Tier 2 (Soko la Madini) & Tier 3 (Buying Centre) auto-adjusted for Mining Act Cap. 123 royalties',
            'Bei za Soko la Madini na Vituo vya Ununuzi zimekokotolewa kulingana na Sheria ya Madini Sura 123',
            'Niveles 2 y 3 ajustados automáticamente según regalías de la Ley de Minería Cap. 123',
          )}
        </span>
      </div>
    </div>
  )
}
