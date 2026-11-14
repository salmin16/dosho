'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
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
  ShieldCheck,
} from 'lucide-react'
import { executeLiveMarketSync } from '../app/api/market-sync/route'
import {
  getMarketSyncTelemetry,
  getStoredMineralPrices,
  getTradingDeskSessions,
  subscribeMineralPrices,
} from '../data/mineralPrices'
import { useLocalization } from '../context/LocalizationContext'
import PriceDisplay from './PriceDisplay'
import type { MarketSyncTelemetry, MineralPriceRecord } from '../types/database'

export interface LiveMarketTickerProps {
  /** Unit basis passed from parent board or controlled internally */
  unitBasis?: 'standard' | 'metric_local'
  /** Compact mode for embedding in User Dashboard or Marketplace header */
  compact?: boolean
  /** Optional link to full /markets page when rendered in compact mode */
  showFullMarketsLink?: boolean
}

export default function LiveMarketTicker({
  unitBasis: externalUnitBasis,
  compact = false,
  showFullMarketsLink = false,
}: LiveMarketTickerProps) {
  const {
    currency,
    currencyMeta,
    rateForSelected,
    formatStatutoryPrice,
    language,
    ui,
  } = useLocalization()

  const [internalUnitBasis, setInternalUnitBasis] = useState<
    'standard' | 'metric_local'
  >('metric_local')
  const activeUnitBasis = externalUnitBasis ?? internalUnitBasis

  const [minerals, setMinerals] = useState<MineralPriceRecord[]>(() =>
    getStoredMineralPrices(),
  )
  const [telemetry, setTelemetry] = useState<MarketSyncTelemetry>(() =>
    getMarketSyncTelemetry(),
  )
  const [syncing, setSyncing] = useState(false)
  const [secondsToNextSync, setSecondsToNextSync] = useState(45)

  const handleManualSync = useCallback(async (force = true) => {
    setSyncing(true)
    try {
      const result = await executeLiveMarketSync({ force })
      setMinerals(result.records)
      setTelemetry(result.telemetry)
      setSecondsToNextSync(45)
    } finally {
      setSyncing(false)
    }
  }, [])

  // Subscribe to store updates + trigger initial live sync on mount
  useEffect(() => {
    setMinerals(getStoredMineralPrices())
    setTelemetry(getMarketSyncTelemetry())

    // Run non-blocking initial live check
    void handleManualSync(false)

    const unsubscribe = subscribeMineralPrices(() => {
      setMinerals(getStoredMineralPrices())
      setTelemetry(getMarketSyncTelemetry())
    })

    return unsubscribe
  }, [handleManualSync])

  // Automated 45-second polling & 1-second countdown timer
  useEffect(() => {
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
  }, [handleManualSync])

  const deskSessions = useMemo(() => getTradingDeskSessions(), [])

  const displayedMinerals = useMemo(
    () => (compact ? minerals.slice(0, 5) : minerals),
    [minerals, compact],
  )

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

  return (
    <div
      data-currency={currency}
      data-language={language}
      className="rounded-2xl border border-paper/15 bg-ink-2/95 p-4 text-paper shadow-xl backdrop-blur-md lg:p-5"
    >
      {/* Top Status & Desk Telemetry Header */}
      <div className="flex flex-col justify-between gap-3 border-b border-paper/10 pb-3.5 lg:flex-row lg:items-center">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="inline-flex items-center gap-2 rounded-full border border-moss/50 bg-moss/25 px-3 py-1 font-mono text-[11px] font-semibold tracking-wider text-[#9de4b4]">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#9de4b4] opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[#9de4b4]" />
            </span>
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

          <span className="inline-flex items-center gap-1.5 rounded-full border border-paper/12 bg-paper/[0.05] px-2.5 py-1 font-mono text-[11px] text-paper/75">
            <Globe size={11} className="text-gold" />
            1 USD ={' '}
            <strong className="text-gold">
              {rateForSelected.toLocaleString('en-US', {
                maximumFractionDigits: currency === 'TZS' ? 0 : 4,
              })}{' '}
              {currency}
            </strong>{' '}
            ({currencyMeta.flag})
          </span>

          {/* Trading Desk Sessions */}
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

        {/* Right Controls: Sync Timestamp, Countdown, Manual Sync Button & Optional Unit Toggle */}
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

      {/* Live Pricing Matrix Grid */}
      <div className="mt-3.5 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-5">
        {displayedMinerals.map((m) => {
          const positive = m.trend_percentage >= 0
          const worldStatutory = formatStatutoryPrice(
            m.world_market_price_usd,
            m.unit,
            activeUnitBasis,
          )
          const buyingStatutory = formatStatutoryPrice(
            m.buying_centre_price_usd,
            m.unit,
            'metric_local',
          )
          const intSpotUnit = m.unit.replace(/^USD\//i, '')

          // Calculate intraday position percentage between day_low_usd and day_high_usd
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
            <div
              key={m.id}
              className="group relative flex flex-col justify-between rounded-xl border border-paper/10 bg-paper/[0.04] p-3.5 transition hover:border-gold/45 hover:bg-paper/[0.07]"
            >
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
                  className={`inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold ${
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
              <div className="mt-1.5">
                <p className="truncate text-xs font-semibold text-paper/90">
                  {m.mineral_name}
                </p>
                <p className="truncate font-mono text-[10px] text-paper/50">
                  {m.exchange_desk ?? 'LBMA / Tume ya Madini'}
                </p>
              </div>

              {/* Row 3: Primary Active Price + World Spot Reference */}
              <div className="mt-2.5 border-t border-paper/10 pt-2.5">
                <div className="flex items-baseline justify-between gap-1">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-paper/55">
                    {ui('World Spot', 'Bei ya Dunia', 'Spot Mundial')}
                  </span>
                  <div className="font-mono text-xs font-bold text-paper">
                    {worldStatutory.formatted}
                    <span className="text-[10px] font-normal text-paper/55">
                      {worldStatutory.unitSuffix}
                    </span>
                  </div>
                </div>

                <div className="mt-1 flex items-baseline justify-between gap-1">
                  <span className="font-mono text-[10px] text-ochre-light">
                    {ui('Buying Centre', 'Kituo cha Ununuzi', 'Centro Compra')}
                  </span>
                  <div className="font-mono text-[11px] font-semibold text-gold">
                    {buyingStatutory.formatted}
                    <span className="text-[9px] font-normal text-paper/55">
                      {buyingStatutory.unitSuffix}
                    </span>
                  </div>
                </div>

                <div className="mt-1 flex items-baseline justify-between gap-1 font-mono text-[10px] text-paper/50">
                  <span>{ui('Intl Unit', 'Kimataifa', 'Unidad Intl')}</span>
                  <span>
                    <PriceDisplay
                      amountInUSD={m.world_market_price_usd}
                      suffix={`/${intSpotUnit}`}
                    />
                  </span>
                </div>
              </div>

              {/* Row 4: Intraday Low/High Range Bar */}
              <div className="mt-2.5 pt-1">
                <div className="h-1 w-full overflow-hidden rounded-full bg-paper/10">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      positive ? 'bg-[#9de4b4]' : 'bg-gold'
                    }`}
                    style={{ width: `${rangePct}%` }}
                  />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Bottom Regulatory & Provider Telemetry Footer */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-paper/10 pt-2.5 font-mono text-[10px] text-paper/55">
        <span className="inline-flex items-center gap-1.5">
          <ShieldCheck size={12} className="text-gold" />
          {ui(
            'Source Pipeline:',
            'Chanzo cha Takwimu:',
            'Pipeline de Datos:',
          )}{' '}
          <strong className="text-paper/80">{telemetry.provider}</strong> ·{' '}
          {ui('Latency', 'Muda', 'Latencia')}: {telemetry.latencyMs}ms
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Activity size={11} className="text-ochre-light" />
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
