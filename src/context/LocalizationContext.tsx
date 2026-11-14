'use client'

import React, { createContext, useCallback, useContext, useMemo } from 'react'
import {
  CURRENCIES,
  CURRENCY_LIST,
  CurrencyProvider,
  useCurrency,
  type CurrencyMetadata,
} from '../lib/currency'
import {
  LANGUAGES,
  LanguageProvider,
  useI18n,
  type LanguageCode,
  type TranslationKey,
} from '../i18n'
import {
  GRAMS_PER_POUND,
  GRAMS_PER_TROY_OUNCE,
  KILOGRAMS_PER_TONNE,
} from '../data/mineralPrices'
import type { SupportedCurrency } from '../types/database'
import type { Project } from '../data/fixtures'

export interface FormatCurrencyOptions {
  /** Compact notation (e.g., TSh 6.71B, US$2.50M) */
  compact?: boolean
  /** Override minimum decimal places */
  minimumFractionDigits?: number
  /** Override maximum decimal places */
  maximumFractionDigits?: number
  /** Target currency override (defaults to active user currency) */
  currencyOverride?: SupportedCurrency
}

export interface StatutoryConversionResult {
  /** USD value per target unit */
  unitUsd: number
  /** Converted value in the user's selected currency */
  convertedAmount: number
  /** Formatted string with currency symbol & native Intl grouping */
  formatted: string
  /** Unit suffix (e.g. "/g", "/kg", "/ct", "/toz", "/lb", "/tonne") */
  unitSuffix: string
}

export interface LocalizationContextValue {
  // Currency State & Actions
  currency: SupportedCurrency
  currencyMeta: CurrencyMetadata
  currencies: CurrencyMetadata[]
  rates: Record<SupportedCurrency, number>
  rateForSelected: number
  ratesSource: 'live' | 'fallback'
  lastUpdated: Date | null
  setCurrency: (code: SupportedCurrency) => void
  refreshRates: () => Promise<void>

  // Native Intl.NumberFormat & Conversion Helpers
  formatCurrency: (usdAmount: number, options?: FormatCurrencyOptions) => string
  formatUsd: (usdAmount: number) => string
  formatExactUsd: (usdAmount: number) => string
  formatStatutoryPrice: (
    usdAmount: number,
    rawUnit: string,
    basis?: 'standard' | 'metric_local',
  ) => StatutoryConversionResult
  convertText: (text: string) => string
  toUsd: (amountInSelected: number) => number

  // Language State & Actions
  lang: LanguageCode
  languages: typeof LANGUAGES
  setLang: (lang: LanguageCode) => void
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string
  tv: (value: string) => string
  localizeProject: (project: Project) => Project
  formatDate: (iso: string) => string
  fixtures: ReturnType<typeof useI18n>['fixtures']
}

const LocalizationContext = createContext<LocalizationContextValue | null>(null)

const LOCALE_BY_CURRENCY: Record<SupportedCurrency, string> = {
  USD: 'en-US',
  TZS: 'en-TZ',
  EUR: 'de-DE',
  GBP: 'en-GB',
  JPY: 'ja-JP',
  ZAR: 'en-ZA',
  AUD: 'en-AU',
  CAD: 'en-CA',
  CNY: 'zh-CN',
  AED: 'en-AE',
}

function LocalizationBridge({ children }: { children: React.ReactNode }) {
  const {
    currency,
    currencyMeta,
    rates,
    rateForSelected,
    ratesSource,
    lastUpdated,
    setCurrency,
    refreshRates,
    formatUsd,
    formatExactUsd,
    convertText,
    toUsd,
  } = useCurrency()

  const { lang, setLang, t, tv, localizeProject, formatDate, fixtures } = useI18n()

  /**
   * Formats any USD numeric value into the active user currency using native `Intl.NumberFormat`
   */
  const formatCurrency = useCallback(
    (usdAmount: number, options?: FormatCurrencyOptions): string => {
      const targetCode = options?.currencyOverride ?? currency
      const meta = CURRENCIES[targetCode] ?? CURRENCIES.USD
      const rate = rates[targetCode] ?? 1
      const converted = usdAmount * rate
      const isZeroDecimal = targetCode === 'TZS' || targetCode === 'JPY'

      if (options?.compact) {
        return formatUsd(usdAmount)
      }

      const defaultMaxDecimals = isZeroDecimal
        ? converted < 100
          ? 2
          : 0
        : converted < 10
          ? 3
          : meta.decimals

      const minDecimals =
        options?.minimumFractionDigits ?? (isZeroDecimal ? 0 : Math.min(2, defaultMaxDecimals))
      const maxDecimals =
        options?.maximumFractionDigits ?? Math.max(minDecimals, defaultMaxDecimals)

      try {
        const locale = LOCALE_BY_CURRENCY[targetCode] || 'en-US'
        return new Intl.NumberFormat(locale, {
          style: 'currency',
          currency: targetCode,
          minimumFractionDigits: minDecimals,
          maximumFractionDigits: maxDecimals,
        }).format(converted)
      } catch {
        return `${meta.symbol}${converted.toLocaleString('en-US', {
          minimumFractionDigits: minDecimals,
          maximumFractionDigits: maxDecimals,
        })}`
      }
    },
    [currency, rates, formatUsd],
  )

  /**
   * Computes statutory unit conversions (e.g., Troy Ounce -> Gram for Gold/Silver,
   * Pound/Tonne -> Kilogram for Copper/Tin/Nickel/Graphite, Carat -> Carat for Gemstones)
   * modeled on Mining Commission of Tanzania (Tume ya Madini) indicative boards.
   */
  const formatStatutoryPrice = useCallback(
    (
      usdAmount: number,
      rawUnit: string,
      basis: 'standard' | 'metric_local' = 'standard',
    ): StatutoryConversionResult => {
      const baseUnit = rawUnit.replace(/^USD\//i, '').trim()
      let unitUsd = usdAmount
      let unitSuffix = `/${baseUnit}`

      if (basis === 'metric_local') {
        if (baseUnit === 'toz') {
          unitUsd = usdAmount / GRAMS_PER_TROY_OUNCE
          unitSuffix = '/g'
        } else if (baseUnit === 'lb') {
          unitUsd = (usdAmount / GRAMS_PER_POUND) * 1000
          unitSuffix = '/kg'
        } else if (baseUnit === 'tonne') {
          unitUsd = usdAmount / KILOGRAMS_PER_TONNE
          unitSuffix = '/kg'
        } else if (baseUnit === 'carat' || baseUnit === 'ct') {
          unitUsd = usdAmount
          unitSuffix = '/ct'
        }
      } else if (baseUnit === 'carat') {
        unitSuffix = '/ct'
      }

      const convertedAmount = unitUsd * rateForSelected
      const formatted = formatCurrency(unitUsd)

      return {
        unitUsd,
        convertedAmount,
        formatted,
        unitSuffix,
      }
    },
    [rateForSelected, formatCurrency],
  )

  const value = useMemo<LocalizationContextValue>(
    () => ({
      currency,
      currencyMeta,
      currencies: CURRENCY_LIST,
      rates,
      rateForSelected,
      ratesSource,
      lastUpdated,
      setCurrency,
      refreshRates,
      formatCurrency,
      formatUsd,
      formatExactUsd,
      formatStatutoryPrice,
      convertText,
      toUsd,
      lang,
      languages: LANGUAGES,
      setLang,
      t,
      tv,
      localizeProject,
      formatDate,
      fixtures,
    }),
    [
      currency,
      currencyMeta,
      rates,
      rateForSelected,
      ratesSource,
      lastUpdated,
      setCurrency,
      refreshRates,
      formatCurrency,
      formatUsd,
      formatExactUsd,
      formatStatutoryPrice,
      convertText,
      toUsd,
      lang,
      setLang,
      t,
      tv,
      localizeProject,
      formatDate,
      fixtures,
    ],
  )

  return (
    <LocalizationContext.Provider value={value}>
      {children}
    </LocalizationContext.Provider>
  )
}

/**
 * Global Provider combining Currency and Language state with instant cross-component
 * localStorage and DOM event synchronization.
 */
export function LocalizationProvider({ children }: { children: React.ReactNode }) {
  return (
    <CurrencyProvider>
      <LanguageProvider>
        <LocalizationBridge>{children}</LocalizationBridge>
      </LanguageProvider>
    </CurrencyProvider>
  )
}

export function useLocalization(): LocalizationContextValue {
  const ctx = useContext(LocalizationContext)
  if (!ctx) {
    throw new Error('useLocalization must be used within a LocalizationProvider')
  }
  return ctx
}
