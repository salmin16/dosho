'use client'

import { useEffect, useMemo, useState } from 'react'
import { Link } from '@tanstack/react-router'
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  Calculator,
  Coins,
  Globe,
  MapPin,
  Scale,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
} from 'lucide-react'
import {
  getStoredMineralPrices,
  subscribeMineralPrices,
} from '../data/mineralPrices'
import { useLocalization } from '../context/LocalizationContext'
import CurrencySwitcher from './CurrencySwitcher'
import LanguageSwitcher from './LanguageSwitcher'
import PriceDisplay from './PriceDisplay'
import type { MineralCategory, MineralPriceRecord } from '../types/database'

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
}

export default function MineralPricesBoard({
  showHeaderCta = true,
}: MineralPricesBoardProps) {
  const {
    currency,
    currencyMeta,
    rateForSelected,
    formatPrice,
    formatStatutoryPrice,
    language,
    ui,
  } = useLocalization()

  const [minerals, setMinerals] = useState<MineralPriceRecord[]>(() =>
    getStoredMineralPrices(),
  )
  const [selectedCategory, setSelectedCategory] = useState<'ALL' | MineralCategory>('ALL')
  const [unitBasis, setUnitBasis] = useState<'standard' | 'metric_local'>('metric_local')

  // Interactive Statutory Valuation & Royalty Calculator State
  const [calcSymbol, setCalcSymbol] = useState<string>('XAU')
  const [calcQuantity, setCalcQuantity] = useState<string>('100')

  useEffect(() => {
    setMinerals(getStoredMineralPrices())
    return subscribeMineralPrices(() => {
      setMinerals(getStoredMineralPrices())
    })
  }, [])

  const filteredMinerals = useMemo(() => {
    if (selectedCategory === 'ALL') return minerals
    return minerals.filter((m) => m.category === selectedCategory)
  }, [minerals, selectedCategory])

  const translateCategory = (cat: 'ALL' | MineralCategory): string => {
    switch (cat) {
      case 'ALL':
        return ui(`All (${minerals.length})`, `Zote (${minerals.length})`, `Todos (${minerals.length})`)
      case 'Precious Metals':
        return ui('Precious Metals', 'Madini ya Thamani', 'Metales Preciosos')
      case 'Base & Industrial Metals':
        return ui('Base & Industrial Metals', 'Madini ya Viwandani', 'Metales Industriales')
      case 'Critical & Battery Minerals':
        return ui('Critical & Battery Minerals', 'Madini ya Kimkakati na Betri', 'Minerales Críticos y Baterías')
      case 'Gemstones':
        return ui('Gemstones', 'Vito vya Thamani', 'Piedras Preciosas')
    }
  }

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

  const latestTimestamp = useMemo(() => {
    if (minerals.length === 0) return new Date().toLocaleDateString()
    const maxTime = Math.max(...minerals.map((m) => new Date(m.updated_at).getTime()))
    return new Date(maxTime).toLocaleString()
  }, [minerals])

  return (
    <section
      aria-label="Indicative Mineral Prices Board"
      data-currency={currency}
      data-language={language}
      className="grain relative isolate overflow-hidden border-b border-ink/15 bg-ink py-20 text-paper lg:py-24"
    >
      {/* Signature MineConnect Topographic Contour Texture */}
      <div className="contours absolute inset-0 -z-10" aria-hidden="true" />
      <div
        className="pointer-events-none absolute -top-36 left-1/2 -z-10 h-80 w-[56rem] -translate-x-1/2 rounded-full bg-ochre/15 blur-3xl"
        aria-hidden="true"
      />

      <div className="relative mx-auto max-w-7xl space-y-8 px-5 lg:px-8">
        {/* Top Header & Regulatory Board Masthead */}
        <div className="flex flex-col justify-between gap-6 border-b border-paper/12 pb-8 lg:flex-row lg:items-end">
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-gold/35 bg-ochre/20 px-3 py-1 font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-gold">
                <Sparkles size={12} />
                {ui(
                  'Indicative Mineral Prices · Tume ya Madini Aligned',
                  'Bei Elekezi za Madini · Tume ya Madini',
                  'Precios Indicativos de Minerales · Tume ya Madini',
                )}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-moss/50 bg-moss/25 px-3 py-1 font-mono text-[11px] text-paper/90">
                <Activity size={12} className="text-gold" />
                {ui(
                  'LBMA · LME · Mining Commission of Tanzania',
                  'LBMA · LME · Tume ya Madini Tanzania',
                  'LBMA · LME · Comisión Minera de Tanzania',
                )}
              </span>
            </div>

            <h2 className="font-display mt-4 text-4xl font-light leading-[1.05] text-paper md:text-5xl">
              {language === 'sw' ? (
                <>
                  Jedwali la <em className="italic text-gold">Bei Elekezi za Madini</em>
                </>
              ) : language === 'es' ? (
                <>
                  Referencia Oficial de{' '}
                  <em className="italic text-gold">Precios de Minerales</em>
                </>
              ) : (
                <>
                  Statutory &amp; Global{' '}
                  <em className="italic text-gold">Indicative Mineral Benchmarks</em>
                </>
              )}
            </h2>
            <p className="mt-3 max-w-3xl text-base leading-relaxed text-paper/70">
              {ui(
                'Official reference benchmarks comparing international spot markets with statutory Tanzania Mineral Market (Soko la Madini) and Buying Centre (Kituo cha Ununuzi) thresholds, dynamically converted into',
                'Viwango rasmi vya kumbukumbu vinavyolinganisha soko la kimataifa na Soko la Madini pamoja na Vituo vya Ununuzi nchini Tanzania, vikibadilishwa papo hapo kwa sarafu ya',
                'Valores de referencia oficiales que comparan los mercados internacionales con el Mercado de Minerales de Tanzania (Soko la Madini) y los Centros de Compra, convertidos dinámicamente a',
              )}{' '}
              <strong className="font-mono text-gold">
                {currencyMeta.flag} {currency} ({currencyMeta.name})
              </strong>
              .
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <CurrencySwitcher dark />
            <LanguageSwitcher dark />

            <div className="inline-flex rounded-lg border border-paper/15 bg-ink-2 p-1 text-xs">
              <button
                type="button"
                onClick={() => setUnitBasis('metric_local')}
                className={`rounded-md px-3 py-1.5 font-mono text-[11px] font-semibold transition ${
                  unitBasis === 'metric_local'
                    ? 'bg-ochre text-paper shadow-xs'
                    : 'text-paper/70 hover:text-paper'
                }`}
              >
                {ui('Statutory Local (/g, /kg, /ct)', 'Kipimo cha Ndani (/g, /kg, /ct)', 'Métrico Local (/g, /kg, /ct)')}
              </button>
              <button
                type="button"
                onClick={() => setUnitBasis('standard')}
                className={`rounded-md px-3 py-1.5 font-mono text-[11px] font-semibold transition ${
                  unitBasis === 'standard'
                    ? 'bg-ochre text-paper shadow-xs'
                    : 'text-paper/70 hover:text-paper'
                }`}
              >
                {ui('Global Spot (/toz, /lb, /t)', 'Kipimo cha Kimataifa (/toz, /lb, /t)', 'Estándar Global (/toz, /lb, /t)')}
              </button>
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

        {/* 1. Live Market Ticker Header Strip */}
        <div className="rounded-xl border border-paper/12 bg-ink-2/90 p-3.5 shadow-lg backdrop-blur-md">
          <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2 border-b border-paper/10 pb-2 font-mono text-[11px] text-paper/65">
            <span className="inline-flex items-center gap-2">
              <span className="h-2 w-2 animate-pulse rounded-full bg-gold" />
              <strong className="tracking-wider text-paper/90">
                {ui(
                  'LIVE STATUTORY & SPOT COMMODITY TICKER',
                  'MWENENDO WA BEI ZA MADINI MOJA KWA MOJA',
                  'TICKER EN VIVO DE MATERIAS PRIMAS Y MINERALES',
                )}
              </strong>{' '}
              · {ui('Active FX', 'Kiwango cha Fedha', 'Tasa Activa')}: 1 USD ={' '}
              {rateForSelected.toLocaleString('en-US', {
                maximumFractionDigits: 2,
              })}{' '}
              {currency}
            </span>
            <span>
              {ui('Updated', 'Imesasishwa', 'Actualizado')}: {latestTimestamp}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
            {minerals.map((m) => {
              const positive = m.trend_percentage >= 0
              const statutory = formatStatutoryPrice(
                m.world_market_price_usd,
                m.unit,
                unitBasis,
              )
              const intSpotUnit = m.unit.replace(/^USD\//i, '')
              return (
                <div
                  key={m.id}
                  className="group flex flex-col justify-between rounded-lg border border-paper/10 bg-paper/[0.04] p-3 transition hover:border-gold/45 hover:bg-paper/[0.08]"
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-mono text-xs font-bold text-gold">
                      {m.symbol}
                    </span>
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

                  <p className="mt-1 truncate text-xs font-medium text-paper/80">
                    {m.mineral_name}
                  </p>

                  <div className="mt-2 border-t border-paper/10 pt-2">
                    <div className="font-mono text-xs font-semibold text-paper">
                      {statutory.formatted}
                      <span className="text-[10px] font-normal text-paper/55">
                        {statutory.unitSuffix}
                      </span>
                    </div>
                    <div className="font-mono text-[10px] text-paper/55">
                      {ui('Spot', 'Soko', 'Spot')}:{' '}
                      <PriceDisplay
                        amountInUSD={m.world_market_price_usd}
                        suffix={`/${intSpotUnit}`}
                      />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* 2. Priority Commodity Spotlight Cards (Gold, Silver, Copper, Tanzanite) */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {minerals.slice(0, 4).map((m) => {
            const positive = m.trend_percentage >= 0
            const worldLocal = formatStatutoryPrice(
              m.world_market_price_usd,
              m.unit,
              'metric_local',
            )
            const sokoLocal = formatStatutoryPrice(
              m.local_market_price_usd,
              m.unit,
              unitBasis,
            )
            const buyingLocal = formatStatutoryPrice(
              m.buying_centre_price_usd,
              m.unit,
              unitBasis,
            )
            const intUnit = m.unit.replace(/^USD\//i, '')

            return (
              <article
                key={m.id}
                className="flex flex-col justify-between rounded-xl border border-paper/12 bg-gradient-to-b from-ink-2 to-ink p-5 shadow-xl transition hover:border-gold/40"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="font-mono text-[10px] uppercase tracking-widest text-gold">
                        {translateCategory(m.category)}
                      </span>
                      <h3 className="font-display mt-0.5 text-xl font-medium text-paper">
                        {m.mineral_name}
                      </h3>
                    </div>
                    <span className="rounded border border-gold/35 bg-ochre/20 px-2 py-0.5 font-mono text-xs font-bold text-gold">
                      {m.symbol}
                    </span>
                  </div>

                  <div className="mt-4 flex items-end justify-between gap-2">
                    <div>
                      <span className="block font-mono text-[10px] uppercase text-paper/55">
                        {ui('World Spot', 'Soko la Dunia', 'Mercado Mundial')} ({currency}/{intUnit})
                      </span>
                      <span className="font-mono text-2xl font-bold text-paper">
                        <PriceDisplay amountInUSD={m.world_market_price_usd} />
                      </span>
                      <span className="block font-mono text-[11px] text-gold">
                        {ui('Local Metric', 'Bei kwa Kipimo', 'Base Local')}: {worldLocal.formatted}
                        {worldLocal.unitSuffix}
                      </span>
                    </div>
                    <SparklineSvg points={m.sparkline_points} positive={positive} />
                  </div>
                </div>

                <div className="mt-4 space-y-1.5 border-t border-paper/10 pt-3 font-mono text-[11px]">
                  <div className="flex items-center justify-between text-paper/75">
                    <span>{ui('Soko la Madini (Market):', 'Soko la Madini:', 'Mercado Mineral:') }</span>
                    <span className="font-semibold text-[#9de4b4]">
                      {sokoLocal.formatted}
                      {sokoLocal.unitSuffix}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-paper/75">
                    <span>{ui('Buying Centre (Floor):', 'Kituo cha Ununuzi:', 'Centro de Compra:')}</span>
                    <span className="font-semibold text-gold">
                      {buyingLocal.formatted}
                      {buyingLocal.unitSuffix}
                    </span>
                  </div>
                  {m.producing_regions && (
                    <div className="flex items-center gap-1 pt-1 text-[10px] text-paper/55">
                      <MapPin size={10} className="shrink-0 text-ochre" />
                      <span className="truncate">{m.producing_regions}</span>
                    </div>
                  )}
                </div>
              </article>
            )
          })}
        </div>

        {/* 3. Detailed Breakdown Matrix Table */}
        <div className="overflow-hidden rounded-2xl border border-ink/15 bg-paper text-ink shadow-2xl">
          {/* Matrix Filter Bar */}
          <div className="flex flex-col justify-between gap-4 border-b border-ink/10 bg-paper-2 px-6 py-5 sm:flex-row sm:items-center">
            <div>
              <div className="flex items-center gap-2">
                <Scale size={16} className="text-ochre" />
                <h3 className="font-display text-xl font-medium text-ink">
                  {ui(
                    'Statutory Mineral Pricing Matrix (World · Soko la Madini · Kituo cha Ununuzi)',
                    'Jedwali Rasmi la Bei za Madini (Soko la Dunia · Soko la Madini · Kituo cha Ununuzi)',
                    'Matriz Oficial de Precios de Minerales (Mundial · Soko la Madini · Kituo cha Ununuzi)',
                  )}
                </h3>
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

            <div className="flex flex-wrap items-center gap-1.5">
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
                      : 'border border-ink/12 bg-paper text-ink-3 hover:border-ochre/40 hover:text-ink'
                  }`}
                >
                  {translateCategory(cat)}
                </button>
              ))}
            </div>
          </div>

          {/* Matrix Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-ink/12 bg-paper-2/60 font-mono text-[11px] uppercase tracking-wider text-stone">
                <tr>
                  <th className="px-5 py-4">
                    {ui('Mineral & Purity Standard', 'Aina ya Madini na Ubora', 'Mineral y Pureza')}
                  </th>
                  <th className="px-4 py-4">
                    <span className="inline-flex items-center gap-1 text-ink">
                      <Globe size={12} className="text-ochre" />
                      {ui(`World Spot (${currency})`, `Soko la Dunia (${currency})`, `Precio Mundial (${currency})`)}
                    </span>
                  </th>
                  <th className="px-4 py-4">
                    <span className="inline-flex items-center gap-1 text-ochre">
                      <Coins size={12} />
                      {ui(`Local Unit Rate (${currency})`, `Bei kwa Kipimo (${currency})`, `Tasa por Unidad (${currency})`)}
                    </span>
                  </th>
                  <th className="px-4 py-4">
                    <span className="inline-flex items-center gap-1 text-moss">
                      <ShieldCheck size={12} />
                      {ui(`Soko la Madini (${currency})`, `Soko la Madini (${currency})`, `Mercado Local (${currency})`)}
                    </span>
                  </th>
                  <th className="px-4 py-4">
                    <span className="inline-flex items-center gap-1 text-ink">
                      {ui(`Buying Centre (${currency})`, `Kituo cha Ununuzi (${currency})`, `Centro de Compra (${currency})`)}
                    </span>
                  </th>
                  <th className="px-4 py-4 text-center">
                    {ui('Royalty + Insp.', 'Mrabaha + Ada', 'Regalía + Insp.')}
                  </th>
                  <th className="px-5 py-4 text-right">
                    {ui('24h Change & Trend', 'Mabadiliko ya Saa 24', 'Cambio 24h y Tendencia')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink/10">
                {filteredMinerals.map((m) => {
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
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <span className="flex h-9 w-11 shrink-0 items-center justify-center rounded-lg border border-ink/15 bg-ink font-mono text-xs font-bold text-gold">
                            {m.symbol}
                          </span>
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

                      {/* Tier 1A: World Market Price in Active Currency per International Unit */}
                      <td className="whitespace-nowrap px-4 py-4 font-mono">
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

                      {/* Tier 1B: World Market Price Converted to Statutory Unit in Active Currency */}
                      <td className="whitespace-nowrap px-4 py-4 font-mono">
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

                      {/* Tier 2: Mineral Market Price (Local Regulatory Benchmark) */}
                      <td className="whitespace-nowrap px-4 py-4 font-mono">
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

                      {/* Tier 3: Buying Centre Price (Commercial ASM Threshold) */}
                      <td className="whitespace-nowrap px-4 py-4 font-mono">
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

                      {/* Statutory Royalty + Clearing Inspection Rate */}
                      <td className="whitespace-nowrap px-4 py-4 text-center font-mono">
                        <span className="rounded-md border border-ink/15 bg-paper-2 px-2 py-1 text-[11px] font-semibold text-ink-2">
                          {m.royalty_rate_pct.toFixed(1)}% +{' '}
                          {(m.inspection_fee_pct ?? 1.0).toFixed(1)}%
                        </span>
                      </td>

                      {/* 24h Trend & Sparkline */}
                      <td className="whitespace-nowrap px-5 py-4 text-right">
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
                })}
              </tbody>
            </table>
          </div>

          {/* 4. Interactive Statutory Mineral Valuation & Royalty Calculator */}
          {calcBreakdown && selectedCalcMineral && (
            <div className="border-t border-ink/12 bg-paper-2/90 px-6 py-5">
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
          <div className="flex flex-col justify-between gap-3 border-t border-ink/10 bg-paper px-6 py-4 text-[11px] text-stone sm:flex-row sm:items-center">
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
      </div>
    </section>
  )
}
