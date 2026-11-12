import { useEffect, useMemo, useState } from 'react';
import { Link } from '@tanstack/react-router';
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  Coins,
  Globe,
  Scale,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
} from 'lucide-react';
import {
  GRAMS_PER_POUND,
  GRAMS_PER_TROY_OUNCE,
  KILOGRAMS_PER_TONNE,
  getStoredMineralPrices,
  subscribeMineralPrices,
} from '../data/mineralPrices';
import { useCurrency } from '../lib/currency';
import CurrencySwitcher from './CurrencySwitcher';
import type { MineralCategory, MineralPriceRecord } from '../types/database';

function SparklineSvg({
  points,
  positive,
  onLight = false,
}: {
  points: number[];
  positive: boolean;
  onLight?: boolean;
}) {
  if (!points || points.length < 2) return null;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const width = 92;
  const height = 28;

  const coords = points.map((val, idx) => {
    const x = (idx / (points.length - 1)) * width;
    const y = height - ((val - min) / range) * (height - 6) - 3;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  // MineConnect palette: Gold/Moss for positive, Terracotta/Danger for negative
  const strokeColor = positive
    ? onLight
      ? '#3e5c49'
      : '#d6a443'
    : onLight
      ? '#a33a2a'
      : '#d96b52';
  const fillId = `spark-${onLight ? 'lt' : 'dk'}-${positive ? 'pos' : 'neg'}-${points[0]}`;

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
  );
}

export interface IndicativeMineralPricesProps {
  showHeaderCta?: boolean;
}

export default function IndicativeMineralPrices({
  showHeaderCta = true,
}: IndicativeMineralPricesProps) {
  const { currency, currencyMeta, rateForSelected } = useCurrency();
  const [minerals, setMinerals] = useState<MineralPriceRecord[]>(() =>
    getStoredMineralPrices()
  );
  const [selectedCategory, setSelectedCategory] = useState<
    'ALL' | MineralCategory
  >('ALL');
  const [unitBasis, setUnitBasis] = useState<'standard' | 'metric_local'>(
    'standard'
  );

  useEffect(() => {
    setMinerals(getStoredMineralPrices());
    return subscribeMineralPrices(() => {
      setMinerals(getStoredMineralPrices());
    });
  }, []);

  const filteredMinerals = useMemo(() => {
    if (selectedCategory === 'ALL') return minerals;
    return minerals.filter((m) => m.category === selectedCategory);
  }, [minerals, selectedCategory]);

  /**
   * Formats a USD amount into the selected currency using native `Intl.NumberFormat`
   */
  const formatConvertedCurrency = (
    usdAmount: number,
    targetCurrency = currency,
    rate = rateForSelected
  ): string => {
    const converted = usdAmount * rate;
    const isZeroDecimal =
      targetCurrency === 'TZS' || targetCurrency === 'JPY';
    const fractionDigits = isZeroDecimal
      ? converted < 100
        ? 2
        : 0
      : converted < 10
        ? 3
        : 2;

    try {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: targetCurrency,
        minimumFractionDigits: isZeroDecimal ? 0 : 2,
        maximumFractionDigits: fractionDigits,
      }).format(converted);
    } catch {
      return `${currencyMeta.symbol}${converted.toLocaleString('en-US', {
        maximumFractionDigits: fractionDigits,
      })}`;
    }
  };

  /**
   * Adjusts unit price when user toggles between international benchmark units (`toz`, `tonne`, `lb`)
   * and local buying centre metric units (`g` for precious metals, `kg` for base/battery metals).
   */
  const computeUnitAdjustedUsd = (
    usdPrice: number,
    rawUnit: string
  ): { adjustedUsd: number; unitSuffix: string } => {
    const baseUnit = rawUnit.replace(/^USD\//i, '');
    if (unitBasis === 'standard') {
      return { adjustedUsd: usdPrice, unitSuffix: `/${baseUnit}` };
    }
    if (baseUnit === 'toz') {
      return {
        adjustedUsd: usdPrice / GRAMS_PER_TROY_OUNCE,
        unitSuffix: '/g',
      };
    }
    if (baseUnit === 'lb') {
      return {
        adjustedUsd: (usdPrice / GRAMS_PER_POUND) * 1000,
        unitSuffix: '/kg',
      };
    }
    if (baseUnit === 'tonne') {
      return {
        adjustedUsd: usdPrice / KILOGRAMS_PER_TONNE,
        unitSuffix: '/kg',
      };
    }
    return { adjustedUsd: usdPrice, unitSuffix: `/${baseUnit}` };
  };

  const latestTimestamp = useMemo(() => {
    if (minerals.length === 0) return new Date().toLocaleDateString();
    const maxTime = Math.max(
      ...minerals.map((m) => new Date(m.updated_at).getTime())
    );
    return new Date(maxTime).toLocaleString();
  }, [minerals]);

  return (
    <section
      aria-label="Indicative Mineral Prices Board"
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
                Indicative Mineral Prices Board
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-moss/50 bg-moss/25 px-3 py-1 font-mono text-[11px] text-paper/90">
                <Activity size={12} className="text-gold" />
                LBMA · LME · Tanzania Mining Commission Aligned
              </span>
            </div>

            <h2 className="font-display mt-4 text-4xl font-light leading-[1.05] text-paper md:text-5xl">
              Global &amp; Regional{' '}
              <em className="italic text-gold">Indicative Mineral Benchmarks</em>
            </h2>
            <p className="mt-3 max-w-3xl text-base leading-relaxed text-paper/70">
              Live reference benchmarks comparing international spot markets with statutory Tanzania Mineral Market (
              <span className="text-paper/90">Soko la Madini</span>) and Buying Centre (
              <span className="text-paper/90">Kituo cha Ununuzi</span>) thresholds in{' '}
              <strong className="font-mono text-gold">
                {currencyMeta.flag} {currency} ({currencyMeta.name})
              </strong>
              .
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <CurrencySwitcher dark />

            <div className="inline-flex rounded-lg border border-paper/15 bg-ink-2 p-1 text-xs">
              <button
                type="button"
                onClick={() => setUnitBasis('standard')}
                className={`rounded-md px-3 py-1.5 font-mono text-[11px] font-semibold transition ${
                  unitBasis === 'standard'
                    ? 'bg-ochre text-paper shadow-xs'
                    : 'text-paper/70 hover:text-paper'
                }`}
              >
                Global Units (/toz, /t)
              </button>
              <button
                type="button"
                onClick={() => setUnitBasis('metric_local')}
                className={`rounded-md px-3 py-1.5 font-mono text-[11px] font-semibold transition ${
                  unitBasis === 'metric_local'
                    ? 'bg-ochre text-paper shadow-xs'
                    : 'text-paper/70 hover:text-paper'
                }`}
              >
                Local Buying Units (/g, /kg)
              </button>
            </div>

            {showHeaderCta && (
              <Link
                to="/admin"
                className="inline-flex items-center gap-1.5 rounded-md border border-gold/45 bg-moss/30 px-3.5 py-2 text-xs font-semibold text-gold transition hover:bg-moss/45"
              >
                <SlidersHorizontal size={14} />
                Admin Price Control
              </Link>
            )}
          </div>
        </div>

        {/* 1. Live Market Ticker Grid (Warm Basalt & Laterite Cards) */}
        <div
          aria-label="Live Commodity Ticker Cards"
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
        >
          {minerals.slice(0, 4).map((item) => {
            const isPositive = item.trend_percentage >= 0;
            const { adjustedUsd: worldAdj, unitSuffix } = computeUnitAdjustedUsd(
              item.world_market_price_usd,
              item.unit
            );
            const { adjustedUsd: localAdj } = computeUnitAdjustedUsd(
              item.local_market_price_usd,
              item.unit
            );

            return (
              <div
                key={item.id}
                className="group relative overflow-hidden rounded-2xl border border-paper/12 bg-ink-2/90 p-5 shadow-xl backdrop-blur-md transition duration-300 hover:-translate-y-0.5 hover:border-gold/45"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-ochre/25 px-2 py-0.5 font-mono text-[11px] font-bold text-gold">
                        {item.symbol}
                      </span>
                      <span className="font-display text-lg font-medium text-paper">
                        {item.mineral_name}
                      </span>
                    </div>
                    <p className="mt-1 font-mono text-[10px] text-paper/55">
                      {item.purity_note}
                    </p>
                  </div>

                  <span
                    className={`inline-flex items-center gap-0.5 rounded-full border px-2.5 py-0.5 font-mono text-[11px] font-semibold ${
                      isPositive
                        ? 'border-gold/35 bg-moss/35 text-gold'
                        : 'border-danger/45 bg-danger/20 text-paper'
                    }`}
                  >
                    {isPositive ? (
                      <ArrowUpRight size={12} />
                    ) : (
                      <ArrowDownRight size={12} />
                    )}
                    {isPositive ? '+' : ''}
                    {item.trend_percentage.toFixed(2)}%
                  </span>
                </div>

                <div className="mt-4 flex items-end justify-between gap-2 border-t border-paper/10 pt-3.5">
                  <div>
                    <div className="font-mono text-[10px] uppercase tracking-wider text-paper/55">
                      World Market ({currency})
                    </div>
                    <div className="font-display text-2xl font-medium text-gold tabular-nums">
                      {formatConvertedCurrency(worldAdj)}
                      <span className="ml-1 font-mono text-xs font-normal text-paper/55">
                        {unitSuffix}
                      </span>
                    </div>
                    <div className="mt-1 font-mono text-[11px] text-paper/75 tabular-nums">
                      Soko la Madini:{' '}
                      <span className="font-semibold text-paper">
                        {formatConvertedCurrency(localAdj)}
                        {unitSuffix}
                      </span>
                    </div>
                  </div>

                  <SparklineSvg
                    points={item.sparkline_points}
                    positive={isPositive}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Category Filter Tabs & Exchange Rate Telemetry Bar */}
        <div className="flex flex-col justify-between gap-4 rounded-xl border border-paper/12 bg-ink-2/85 px-4 py-3 sm:flex-row sm:items-center">
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
                className={`rounded-md px-3.5 py-1.5 text-xs font-semibold transition ${
                  selectedCategory === cat
                    ? 'bg-ochre text-paper shadow-xs'
                    : 'text-paper/70 hover:bg-paper/10 hover:text-paper'
                }`}
              >
                {cat === 'ALL' ? `All Commodities (${minerals.length})` : cat}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-4 font-mono text-xs text-paper/65">
            <span className="inline-flex items-center gap-1.5 text-gold">
              <Coins size={13} />1 USD ={' '}
              {rateForSelected.toLocaleString('en-US', {
                maximumFractionDigits: 2,
              })}{' '}
              {currency}
            </span>
            <span>Updated: {latestTimestamp}</span>
          </div>
        </div>

        {/* 2. Detailed Breakdown Matrix Table (Warm Parchment Ledger inside Basalt Frame) */}
        <div className="overflow-hidden rounded-2xl border border-sand/40 bg-paper text-ink shadow-[0_28px_60px_-28px_rgba(0,0,0,0.65)]">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-ink/12 bg-paper-2 font-mono text-[11px] uppercase tracking-wider text-stone">
                <tr>
                  <th className="px-5 py-4 text-ink">Commodity &amp; Standard</th>
                  <th className="px-5 py-4">
                    <div className="flex items-center gap-1.5 text-ink">
                      <Globe size={13} className="text-stone" />
                      <span>World Market (USD Base)</span>
                    </div>
                  </th>
                  <th className="px-5 py-4">
                    <div className="flex items-center gap-1.5 text-ochre">
                      <Coins size={13} />
                      <span>World Market ({currency} Converted)</span>
                    </div>
                  </th>
                  <th className="px-5 py-4">
                    <div className="flex items-center gap-1.5 text-moss">
                      <Scale size={13} />
                      <span>Mineral Market (Soko la Madini)</span>
                    </div>
                  </th>
                  <th className="px-5 py-4">
                    <div className="flex items-center gap-1.5 text-ink">
                      <ShieldCheck size={13} className="text-ochre" />
                      <span>Buying Centre (Kituo cha Ununuzi)</span>
                    </div>
                  </th>
                  <th className="px-5 py-4 text-right text-ink">
                    24h Trend &amp; 7d Chart
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink/10">
                {filteredMinerals.map((item) => {
                  const isPositive = item.trend_percentage >= 0;
                  const worldCalc = computeUnitAdjustedUsd(
                    item.world_market_price_usd,
                    item.unit
                  );
                  const localCalc = computeUnitAdjustedUsd(
                    item.local_market_price_usd,
                    item.unit
                  );
                  const buyingCalc = computeUnitAdjustedUsd(
                    item.buying_centre_price_usd,
                    item.unit
                  );

                  return (
                    <tr
                      key={item.id}
                      className="transition hover:bg-paper-2/70"
                    >
                      {/* Commodity & Purity */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <span className="inline-flex h-9 w-12 shrink-0 items-center justify-center rounded-lg bg-ink font-mono text-xs font-bold text-gold">
                            {item.symbol}
                          </span>
                          <div>
                            <div className="font-display text-base font-medium text-ink">
                              {item.mineral_name}
                            </div>
                            <div className="font-mono text-[11px] text-stone">
                              {item.purity_note} · Royalty:{' '}
                              {item.royalty_rate_pct}%
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* World Market Price (Base USD) */}
                      <td className="whitespace-nowrap px-5 py-4 font-mono tabular-nums">
                        <div className="text-sm font-semibold text-ink">
                          {formatConvertedCurrency(
                            worldCalc.adjustedUsd,
                            'USD',
                            1
                          )}
                          <span className="ml-1 text-[11px] font-normal text-stone">
                            {worldCalc.unitSuffix}
                          </span>
                        </div>
                        <div className="text-[10px] text-stone">
                          Spot Benchmark ({item.unit})
                        </div>
                      </td>

                      {/* World Market Price Converted (Active Currency) */}
                      <td className="whitespace-nowrap px-5 py-4 font-mono tabular-nums">
                        <div className="text-sm font-bold text-ochre">
                          {formatConvertedCurrency(worldCalc.adjustedUsd)}
                          <span className="ml-1 text-[11px] font-normal text-stone">
                            {worldCalc.unitSuffix}
                          </span>
                        </div>
                        <div className="text-[10px] text-stone">
                          {currencyMeta.flag} {currency} Mid-Market Parity
                        </div>
                      </td>

                      {/* Mineral Market Price (Local Benchmark) */}
                      <td className="whitespace-nowrap px-5 py-4 font-mono tabular-nums">
                        <div className="text-sm font-bold text-moss">
                          {formatConvertedCurrency(localCalc.adjustedUsd)}
                          <span className="ml-1 text-[11px] font-normal text-stone">
                            {localCalc.unitSuffix}
                          </span>
                        </div>
                        <div className="text-[10px] text-stone">
                          USD Equiv:{' '}
                          {formatConvertedCurrency(
                            localCalc.adjustedUsd,
                            'USD',
                            1
                          )}
                          {localCalc.unitSuffix}
                        </div>
                      </td>

                      {/* Buying Centre Price (Commercial Floor) */}
                      <td className="whitespace-nowrap px-5 py-4 font-mono tabular-nums">
                        <div className="text-sm font-bold text-ink">
                          {formatConvertedCurrency(buyingCalc.adjustedUsd)}
                          <span className="ml-1 text-[11px] font-normal text-stone">
                            {buyingCalc.unitSuffix}
                          </span>
                        </div>
                        <div className="text-[10px] text-stone">
                          USD Equiv:{' '}
                          {formatConvertedCurrency(
                            buyingCalc.adjustedUsd,
                            'USD',
                            1
                          )}
                          {buyingCalc.unitSuffix}
                        </div>
                      </td>

                      {/* 24h Trend & Mini-Chart */}
                      <td className="whitespace-nowrap px-5 py-4 text-right">
                        <div className="inline-flex items-center justify-end gap-3">
                          <SparklineSvg
                            points={item.sparkline_points}
                            positive={isPositive}
                            onLight
                          />
                          <span
                            className={`inline-flex min-w-[68px] items-center justify-center gap-0.5 rounded-md border px-2 py-1 font-mono text-xs font-semibold ${
                              isPositive
                                ? 'border-moss/35 bg-moss-light text-moss'
                                : 'border-danger/35 bg-danger/10 text-danger'
                            }`}
                          >
                            {isPositive ? (
                              <ArrowUpRight size={13} />
                            ) : (
                              <ArrowDownRight size={13} />
                            )}
                            {isPositive ? '+' : ''}
                            {item.trend_percentage.toFixed(2)}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Regulatory & Methodology Notice Footer */}
          <div className="flex flex-col justify-between gap-2 border-t border-ink/10 bg-paper-2 px-5 py-4 text-xs text-stone sm:flex-row sm:items-center">
            <p>
              <strong className="text-ochre">Regulatory Notice:</strong>{' '}
              Indicative prices are published for market transparency and due-diligence modeling. Final settlement at licensed Mineral Markets (Soko la Madini) and Buying Centres depends on certified XRF/fire assay purity and statutory Mining Act royalties.
            </p>
            <span className="shrink-0 font-mono text-[10px] uppercase tracking-wider text-stone">
              SOURCE: LBMA / LME / `/api/mineral-prices`
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
