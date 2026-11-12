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
}: {
  points: number[];
  positive: boolean;
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

  const strokeColor = positive ? '#34d399' : '#fb7185';
  const fillId = `spark-${positive ? 'pos' : 'neg'}-${points[0]}`;

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
          <stop offset="0%" stopColor={strokeColor} stopOpacity="0.32" />
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
      className="relative overflow-hidden bg-slate-950 py-16 text-slate-100 border-b border-amber-500/20"
    >
      {/* Subtle Radial Gold Ambient Glow */}
      <div
        className="pointer-events-none absolute -top-40 left-1/2 -z-10 h-96 w-[60rem] -translate-x-1/2 rounded-full bg-amber-500/10 blur-3xl"
        aria-hidden="true"
      />

      <div className="mx-auto max-w-7xl px-5 lg:px-8 space-y-8">
        {/* Top Header & Regulatory Board Masthead */}
        <div className="flex flex-col justify-between gap-6 border-b border-amber-500/20 pb-6 lg:flex-row lg:items-end">
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 font-mono text-[11px] font-semibold uppercase tracking-widest text-amber-400">
                <Sparkles size={12} />
                Indicative Mineral Prices Board
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 font-mono text-[11px] text-emerald-400">
                <Activity size={12} />
                LBMA · LME · Tanzania Mining Commission Aligned
              </span>
            </div>

            <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Global &amp; Regional Indicative Mineral Benchmarks
            </h2>
            <p className="mt-2 max-w-3xl text-sm text-slate-400">
              Live reference benchmarks comparing international spot markets with statutory Tanzania Mineral Market (Soko la Madini) and Buying Centre (Kituo cha Ununuzi) thresholds in{' '}
              <strong className="font-mono text-amber-400">
                {currencyMeta.flag} {currency} ({currencyMeta.name})
              </strong>
              .
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <CurrencySwitcher dark />

            <div className="inline-flex rounded-lg border border-amber-500/25 bg-slate-900/90 p-1 text-xs">
              <button
                type="button"
                onClick={() => setUnitBasis('standard')}
                className={`rounded-md px-3 py-1.5 font-mono text-[11px] font-semibold transition ${
                  unitBasis === 'standard'
                    ? 'bg-amber-500 text-slate-950 shadow-xs'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                Global Units (/toz, /t)
              </button>
              <button
                type="button"
                onClick={() => setUnitBasis('metric_local')}
                className={`rounded-md px-3 py-1.5 font-mono text-[11px] font-semibold transition ${
                  unitBasis === 'metric_local'
                    ? 'bg-amber-500 text-slate-950 shadow-xs'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                Local Buying Units (/g, /kg)
              </button>
            </div>

            {showHeaderCta && (
              <Link
                to="/admin"
                className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3.5 py-2 text-xs font-semibold text-amber-300 transition hover:bg-amber-500/20"
              >
                <SlidersHorizontal size={14} />
                Admin Price Control
              </Link>
            )}
          </div>
        </div>

        {/* 1. Live Market Ticker Grid */}
        <div
          aria-label="Live Commodity Ticker Cards"
          className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4"
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
                className="group relative overflow-hidden rounded-xl border border-amber-500/20 bg-slate-900/75 p-4 shadow-lg backdrop-blur-md transition hover:border-amber-400/50"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-amber-500/15 px-2 py-0.5 font-mono text-[11px] font-bold text-amber-400">
                        {item.symbol}
                      </span>
                      <span className="text-sm font-semibold text-white">
                        {item.mineral_name}
                      </span>
                    </div>
                    <p className="mt-1 font-mono text-[10px] text-slate-400">
                      {item.purity_note}
                    </p>
                  </div>

                  <span
                    className={`inline-flex items-center gap-0.5 rounded-full border px-2 py-0.5 font-mono text-[11px] font-semibold ${
                      isPositive
                        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                        : 'border-rose-500/30 bg-rose-500/10 text-rose-400'
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

                <div className="mt-4 flex items-end justify-between gap-2">
                  <div>
                    <div className="font-mono text-[10px] uppercase tracking-wider text-slate-400">
                      World Market ({currency})
                    </div>
                    <div className="font-mono text-xl font-bold text-amber-400 tabular-nums">
                      {formatConvertedCurrency(worldAdj)}
                      <span className="ml-1 text-xs font-normal text-slate-400">
                        {unitSuffix}
                      </span>
                    </div>
                    <div className="mt-1 font-mono text-[11px] text-slate-300 tabular-nums">
                      Local Market:{' '}
                      <span className="text-emerald-400">
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
        <div className="flex flex-col justify-between gap-4 rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3 sm:flex-row sm:items-center">
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
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  selectedCategory === cat
                    ? 'bg-amber-500 text-slate-950'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                {cat === 'ALL' ? `All Commodities (${minerals.length})` : cat}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-4 font-mono text-xs text-slate-400">
            <span className="inline-flex items-center gap-1.5 text-amber-400">
              <Coins size={13} />1 USD ={' '}
              {rateForSelected.toLocaleString('en-US', {
                maximumFractionDigits: 2,
              })}{' '}
              {currency}
            </span>
            <span>Updated: {latestTimestamp}</span>
          </div>
        </div>

        {/* 2. Detailed Breakdown Matrix Table */}
        <div className="overflow-hidden rounded-2xl border border-amber-500/20 bg-slate-900/75 shadow-2xl backdrop-blur-md">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-amber-500/20 bg-slate-950/90 font-mono text-[11px] uppercase tracking-wider text-amber-400/90">
                <tr>
                  <th className="px-5 py-4">Commodity &amp; Standard</th>
                  <th className="px-5 py-4">
                    <div className="flex items-center gap-1.5">
                      <Globe size={13} />
                      <span>World Market (USD Base)</span>
                    </div>
                  </th>
                  <th className="px-5 py-4">
                    <div className="flex items-center gap-1.5 text-amber-300">
                      <Coins size={13} />
                      <span>World Market ({currency} Converted)</span>
                    </div>
                  </th>
                  <th className="px-5 py-4">
                    <div className="flex items-center gap-1.5 text-emerald-400">
                      <Scale size={13} />
                      <span>Mineral Market (Soko la Madini)</span>
                    </div>
                  </th>
                  <th className="px-5 py-4">
                    <div className="flex items-center gap-1.5 text-sky-400">
                      <ShieldCheck size={13} />
                      <span>Buying Centre (Kituo cha Ununuzi)</span>
                    </div>
                  </th>
                  <th className="px-5 py-4 text-right">24h Trend &amp; 7d Chart</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
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
                      className="transition hover:bg-amber-500/[0.04]"
                    >
                      {/* Commodity & Purity */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2.5">
                          <span className="inline-flex h-8 w-11 shrink-0 items-center justify-center rounded-md border border-amber-500/30 bg-amber-500/10 font-mono text-xs font-bold text-amber-400">
                            {item.symbol}
                          </span>
                          <div>
                            <div className="font-semibold text-white text-sm">
                              {item.mineral_name}
                            </div>
                            <div className="font-mono text-[11px] text-slate-400">
                              {item.purity_note} · Royalty:{' '}
                              {item.royalty_rate_pct}%
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* World Market Price (Base USD) */}
                      <td className="whitespace-nowrap px-5 py-4 font-mono tabular-nums">
                        <div className="text-sm font-semibold text-slate-200">
                          {formatConvertedCurrency(
                            worldCalc.adjustedUsd,
                            'USD',
                            1
                          )}
                          <span className="ml-1 text-[11px] font-normal text-slate-400">
                            {worldCalc.unitSuffix}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-500">
                          Spot Benchmark ({item.unit})
                        </div>
                      </td>

                      {/* World Market Price Converted (Active Currency) */}
                      <td className="whitespace-nowrap px-5 py-4 font-mono tabular-nums">
                        <div className="text-sm font-bold text-amber-400">
                          {formatConvertedCurrency(worldCalc.adjustedUsd)}
                          <span className="ml-1 text-[11px] font-normal text-amber-400/70">
                            {worldCalc.unitSuffix}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {currencyMeta.flag} {currency} Mid-Market Parity
                        </div>
                      </td>

                      {/* Mineral Market Price (Local Benchmark) */}
                      <td className="whitespace-nowrap px-5 py-4 font-mono tabular-nums">
                        <div className="text-sm font-bold text-emerald-400">
                          {formatConvertedCurrency(localCalc.adjustedUsd)}
                          <span className="ml-1 text-[11px] font-normal text-emerald-400/70">
                            {localCalc.unitSuffix}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400">
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
                        <div className="text-sm font-bold text-sky-400">
                          {formatConvertedCurrency(buyingCalc.adjustedUsd)}
                          <span className="ml-1 text-[11px] font-normal text-sky-400/70">
                            {buyingCalc.unitSuffix}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400">
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
                          />
                          <span
                            className={`inline-flex min-w-[68px] items-center justify-center gap-0.5 rounded-md border px-2 py-1 font-mono text-xs font-semibold ${
                              isPositive
                                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                                : 'border-rose-500/30 bg-rose-500/10 text-rose-400'
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
          <div className="flex flex-col justify-between gap-2 border-t border-amber-500/20 bg-slate-950/80 px-5 py-3.5 text-[11px] text-slate-400 sm:flex-row sm:items-center">
            <p>
              <strong className="text-amber-400">Regulatory Notice:</strong>{' '}
              Indicative prices are published for market transparency and due-diligence modeling. Final settlement at licensed Mineral Markets (Soko la Madini) and Buying Centres depends on certified XRF/fire assay purity and statutory Mining Act royalties.
            </p>
            <span className="shrink-0 font-mono text-[10px] text-slate-500">
              SOURCE: LBMA / LME / `/api/mineral-prices`
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
