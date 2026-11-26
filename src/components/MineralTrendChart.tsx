'use client'

import { useMemo } from 'react'
import { useLocalization } from '../context/LocalizationContext'
import type { ChartPricingMode } from '../lib/mineralHistory'
import type { MarketSyncTelemetry, MineralPriceRecord } from '../types/database'
import MarketTrendChart, {
  type CurrencyCode,
  type CustomDisplayCurrency,
  type FxFreshnessMetadata,
} from './MarketTrendChart'

export {
  MarketTrendChart,
  type CurrencyCode,
  type CustomDisplayCurrency,
  type FxFreshnessMetadata,
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
  /** Optional live sync telemetry from the shared market feed */
  telemetry?: MarketSyncTelemetry | null
}

export default function MineralTrendChart({
  minerals,
  selectedSymbol,
  onSelectSymbol,
  unitBasis = 'metric_local',
  telemetry = null,
}: MineralTrendChartProps) {
  const {
    currency,
    currencyMeta,
    rates,
    rateForSelected,
    ratesSource,
    ratesProvider,
    fetchedAt,
    setCurrency,
  } = useLocalization()

  const fxRatesFromUsd = useMemo<Record<CurrencyCode, number>>(
    () => ({
      TZS: rates.TZS || 2685,
      USD: rates.USD || 1,
      EUR: rates.EUR || 0.92,
    }),
    [rates],
  )

  const fxFreshness = useMemo<FxFreshnessMetadata>(
    () => ({
      source: ratesSource,
      provider: ratesProvider,
      fetchedAtMs: fetchedAt ? fetchedAt.getTime() : null,
    }),
    [ratesSource, ratesProvider, fetchedAt],
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
      records={minerals}
      unitBasis={unitBasis}
      telemetry={telemetry}
      initialMineralId={selectedSymbol ?? minerals[0]?.symbol ?? 'XAU'}
      selectedMineralId={selectedSymbol}
      onMineralChange={(nextSymbol) => onSelectSymbol?.(nextSymbol)}
      currency={isQuickCurrency ? (currency as CurrencyCode) : 'USD'}
      fxRatesFromUsd={fxRatesFromUsd}
      fxFreshness={fxFreshness}
      onCurrencyChange={(next) => setCurrency(next)}
      customCurrency={customCurrency}
      embedded
    />
  )
}
