'use client'

import { useEffect, useMemo } from 'react'
import { useLocalization } from '../context/LocalizationContext'
import { acquireLiveMarketStream } from '../data/mineralPrices'
import {
  convertToChartUnitUsd,
  type ChartPricingMode,
} from '../lib/mineralHistory'
import type { MineralPriceRecord } from '../types/database'
import MarketTrendChart, {
  type CurrencyCode,
  type CustomDisplayCurrency,
  type MineralAssetConfig,
} from './MarketTrendChart'

export {
  MarketTrendChart,
  type CurrencyCode,
  type CustomDisplayCurrency,
  type MarketTrendChartProps,
  type MineralAssetConfig,
  type PresetRangeKey,
} from './MarketTrendChart'

export interface MineralTrendChartProps {
  minerals: MineralPriceRecord[]
  selectedSymbol?: string
  onSelectSymbol?: (symbol: string) => void
  /** Master unit mode controlled exclusively by the /markets dashboard header */
  unitBasis?: ChartPricingMode
}

function stableSeedForSymbol(symbol: string): number {
  let hash = 101
  for (let i = 0; i < symbol.length; i++) {
    hash = (hash * 31 + symbol.charCodeAt(i)) % 100000
  }
  return Math.max(17, hash)
}

export default function MineralTrendChart({
  minerals,
  selectedSymbol,
  onSelectSymbol,
  unitBasis = 'metric_local',
}: MineralTrendChartProps) {
  const { currency, currencyMeta, rates, rateForSelected, setCurrency } =
    useLocalization()

  // Keep live market stream active while chart view is mounted
  useEffect(() => {
    const release = acquireLiveMarketStream()
    return () => release()
  }, [])

  const assets = useMemo<MineralAssetConfig[]>(() => {
    return minerals.map((m) => {
      const converted = convertToChartUnitUsd(
        m.world_market_price_usd,
        m.unit,
        unitBasis,
      )
      const pct = Number.isFinite(m.trend_percentage) ? m.trend_percentage : 0
      const divisor = 1 + pct / 100
      const prevCloseUsd =
        typeof m.day_open_usd === 'number' && m.day_open_usd > 0
          ? convertToChartUnitUsd(m.day_open_usd, m.unit, unitBasis).unitUsd
          : divisor > 0.05
            ? converted.unitUsd / divisor
            : converted.unitUsd

      return {
        id: m.symbol,
        symbol: m.symbol,
        name: m.mineral_name,
        unitLabel: converted.unitSuffix,
        spotUsd: converted.unitUsd,
        prevCloseUsd,
        seed: stableSeedForSymbol(m.symbol),
      }
    })
  }, [minerals, unitBasis])

  const fxRatesFromUsd = useMemo<Record<CurrencyCode, number>>(
    () => ({
      TZS: rates.TZS || 2683.79,
      USD: rates.USD || 1,
      EUR: rates.EUR || 0.92,
    }),
    [rates],
  )

  const isQuickCurrency =
    currency === 'TZS' || currency === 'USD' || currency === 'EUR'

  const customCurrency = useMemo<CustomDisplayCurrency | null>(() => {
    if (isQuickCurrency) return null
    return {
      code: currency,
      symbol: currencyMeta.symbol,
      rateFromUsd: rateForSelected,
      zeroDecimal: currency === 'JPY',
    }
  }, [currency, currencyMeta.symbol, isQuickCurrency, rateForSelected])

  return (
    <MarketTrendChart
      minerals={assets}
      initialMineralId={selectedSymbol ?? assets[0]?.id ?? 'XAU'}
      selectedMineralId={selectedSymbol}
      onMineralChange={(nextId) => onSelectSymbol?.(nextId)}
      currency={isQuickCurrency ? (currency as CurrencyCode) : 'USD'}
      fxRatesFromUsd={fxRatesFromUsd}
      onCurrencyChange={(next) => setCurrency(next)}
      customCurrency={customCurrency}
      embedded
    />
  )
}
