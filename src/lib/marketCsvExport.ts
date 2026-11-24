import type { MineralPriceRecord, SupportedCurrency } from '../types/database'

export type MarketCsvUnitBasis = 'standard' | 'metric_local'

export interface MarketCsvExportParams {
  minerals: MineralPriceRecord[]
  currency: SupportedCurrency
  rateForSelected: number
  ratesSource: 'live' | 'cached' | 'fallback'
  unitBasis: MarketCsvUnitBasis
  viewLabel: 'live-spot-feed' | 'statutory-matrix'
  formatStatutoryPrice: (
    usdPerBaseUnit: number,
    baseUnitString: string,
    basis: MarketCsvUnitBasis,
  ) => {
    formatted: string
    unitSuffix: string
    unitUsd: number
  }
}

function escapeCsvCell(value: string | number): string {
  const str = String(value ?? '')
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

export function formatEatTimestamp(date: Date = new Date()): string {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Africa/Dar_es_Salaam',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).formatToParts(date)

    const get = (type: string) =>
      parts.find((p) => p.type === type)?.value ?? '00'

    return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}:${get('second')} EAT (UTC+3)`
  } catch {
    const eatDate = new Date(date.getTime() + 3 * 60 * 60 * 1000)
    return `${eatDate.toISOString().replace('T', ' ').slice(0, 19)} EAT (UTC+3)`
  }
}

export function downloadMarketValuationCsv(params: MarketCsvExportParams): string {
  const {
    minerals,
    currency,
    rateForSelected,
    ratesSource,
    unitBasis,
    viewLabel,
    formatStatutoryPrice,
  } = params

  const now = new Date()
  const eatTimestamp = formatEatTimestamp(now)
  const fxDecimals = currency === 'USD' || rateForSelected >= 100 ? 2 : 4
  const fxRateFormatted = rateForSelected.toFixed(fxDecimals)
  const unitModeLabel =
    unitBasis === 'metric_local'
      ? 'Local Statutory Metric (/g, /kg, /ct)'
      : 'Global International (/toz, /lb, /t)'

  const headers = [
    'ExportedAt_EAT',
    'View',
    'Currency',
    'FX_Rate_Per_USD',
    'FX_Source',
    'UnitMode',
    'Symbol',
    'Mineral',
    'Category',
    'Unit',
    'WorldSpot',
    'SokoLaMadini_Tier2',
    'BuyingCentre_Tier3',
    'Change24hPct',
    'RoyaltyPct',
    'InspectionFeePct',
    'ProducingRegions',
    'FeedSource',
  ]

  const rows = minerals.map((m) => {
    const world = formatStatutoryPrice(m.world_market_price_usd, m.unit, unitBasis)
    const soko = formatStatutoryPrice(m.local_market_price_usd, m.unit, unitBasis)
    const buying = formatStatutoryPrice(m.buying_centre_price_usd, m.unit, unitBasis)

    return [
      eatTimestamp,
      viewLabel === 'live-spot-feed' ? 'Live Spot Feed' : 'Statutory Mineral Matrix',
      currency,
      fxRateFormatted,
      ratesSource.toUpperCase(),
      unitModeLabel,
      m.symbol,
      m.mineral_name,
      m.category,
      world.unitSuffix,
      world.formatted,
      soko.formatted,
      buying.formatted,
      `${m.trend_percentage >= 0 ? '+' : ''}${m.trend_percentage.toFixed(2)}%`,
      `${(m.royalty_rate_pct ?? 6).toFixed(1)}%`,
      `${(m.inspection_fee_pct ?? 1).toFixed(1)}%`,
      m.producing_regions ?? 'Tanzania',
      m.feed_source ?? 'BENCHMARK',
    ]
      .map(escapeCsvCell)
      .join(',')
  })

  // UTF-8 BOM ensures clean symbol rendering (TSh, €, $) in Excel
  const csvContent = `\uFEFF${[headers.join(','), ...rows].join('\r\n')}`
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const dateStamp = now.toISOString().slice(0, 10)
  const unitSlug = unitBasis === 'metric_local' ? 'local' : 'global'
  const filename = `mineconnect-${viewLabel}-${currency.toLowerCase()}-${unitSlug}-${dateStamp}.csv`

  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)

  return filename
}
