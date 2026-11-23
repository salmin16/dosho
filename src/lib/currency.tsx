import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { SupportedCurrency } from '../types/database';
import { hasPreferencesConsent } from '../components/CookieConsentBanner';

export interface CurrencyMetadata {
  code: SupportedCurrency;
  symbol: string;
  name: string;
  flag: string;
  decimals: number;
}

export const CURRENCIES: Record<SupportedCurrency, CurrencyMetadata> = {
  USD: { code: 'USD', symbol: 'US$', name: 'US Dollar', flag: '🇺🇸', decimals: 2 },
  TZS: { code: 'TZS', symbol: 'TSh ', name: 'Tanzanian Shilling', flag: '🇹🇿', decimals: 0 },
  EUR: { code: 'EUR', symbol: '€', name: 'Euro', flag: '🇪🇺', decimals: 2 },
  GBP: { code: 'GBP', symbol: '£', name: 'British Pound', flag: '🇬🇧', decimals: 2 },
  JPY: { code: 'JPY', symbol: '¥', name: 'Japanese Yen', flag: '🇯🇵', decimals: 0 },
  ZAR: { code: 'ZAR', symbol: 'R ', name: 'South African Rand', flag: '🇿🇦', decimals: 2 },
  AUD: { code: 'AUD', symbol: 'A$', name: 'Australian Dollar', flag: '🇦🇺', decimals: 2 },
  CAD: { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar', flag: '🇨🇦', decimals: 2 },
  CNY: { code: 'CNY', symbol: 'CN¥', name: 'Chinese Yuan', flag: '🇨🇳', decimals: 2 },
  AED: { code: 'AED', symbol: 'AED ', name: 'UAE Dirham', flag: '🇦🇪', decimals: 2 },
};

export const CURRENCY_LIST: CurrencyMetadata[] = Object.values(CURRENCIES);

export type FxRatesSource = 'live' | 'cached' | 'fallback';

/**
 * Last-resort static fallback rates (1 USD -> Target Currency) used ONLY when
 * neither live APIs nor a previously verified live rate cache are available.
 */
export const FALLBACK_RATES_PER_USD: Record<SupportedCurrency, number> = {
  USD: 1,
  TZS: 2685,
  EUR: 0.92,
  GBP: 0.79,
  JPY: 153.4,
  ZAR: 18.15,
  AUD: 1.52,
  CAD: 1.38,
  CNY: 7.24,
  AED: 3.6725,
};

const CURRENCY_STORAGE_KEY = 'mineconnect.currency.v1';
const RATES_CACHE_KEY = 'mineconnect.fx_rates.v2';
const LEGACY_RATES_CACHE_KEY = 'mineconnect.fx_rates.v1';
const CURRENCY_COOKIE_NAME = 'mc_currency';
const CURRENCY_CHANGE_EVENT = 'mineconnect:currency-changed';
const RATES_UPDATED_EVENT = 'mineconnect:fx-rates-updated';

/** Live freshness window before automatic refresh (90 seconds) */
const LIVE_FRESH_TTL_MS = 90 * 1000;
/** Periodic background refresh interval while tab is visible (2 minutes) */
const AUTO_REFRESH_INTERVAL_MS = 120 * 1000;
/** Per-endpoint network timeout */
const FX_FETCH_TIMEOUT_MS = 5000;

export interface CachedRatesPayload {
  /** Epoch ms when rates were last fetched from a live FX provider (0 if offline fallback) */
  fetchedAt: number;
  /** Alias for fetchedAt for backward compatibility */
  updatedAt: number;
  source: FxRatesSource;
  provider: string;
  rates: Record<SupportedCurrency, number>;
}

// Canonical module-level FX state so non-hook utilities always read the same rate map
let activeCurrencyCode: SupportedCurrency = 'USD';
let activeRatesPayload: CachedRatesPayload = {
  fetchedAt: 0,
  updatedAt: 0,
  source: 'fallback',
  provider: 'offline-fallback',
  rates: { ...FALLBACK_RATES_PER_USD },
};
let inFlightFxRefresh: Promise<CachedRatesPayload> | null = null;

function isValidRateNumber(val: unknown): val is number {
  return typeof val === 'number' && Number.isFinite(val) && val > 0;
}

function normalizeRateMap(
  incoming: Record<string, unknown>,
  baseline: Record<SupportedCurrency, number>,
): { rates: Record<SupportedCurrency, number>; matchedCount: number } {
  const merged: Record<SupportedCurrency, number> = { ...baseline, USD: 1 };
  let matchedCount = 0;

  (Object.keys(CURRENCIES) as SupportedCurrency[]).forEach((code) => {
    if (code === 'USD') {
      merged.USD = 1;
      return;
    }
    const candidate = incoming[code] ?? incoming[code.toLowerCase()];
    if (isValidRateNumber(candidate)) {
      merged[code] = candidate;
      matchedCount += 1;
    }
  });

  return { rates: merged, matchedCount };
}

function readInitialCurrency(): SupportedCurrency {
  if (typeof window === 'undefined') return 'USD';
  try {
    const stored = window.localStorage.getItem(CURRENCY_STORAGE_KEY) as SupportedCurrency | null;
    if (stored && stored in CURRENCIES) return stored;
    const cookieMatch = document.cookie.match(/(?:^|;\s*)mc_currency=([A-Z]{3})/);
    if (cookieMatch && cookieMatch[1] in CURRENCIES) {
      return cookieMatch[1] as SupportedCurrency;
    }
  } catch {
    // ignore storage errors
  }
  return 'USD';
}

function readCachedRates(): CachedRatesPayload {
  if (typeof window === 'undefined') {
    return {
      fetchedAt: 0,
      updatedAt: 0,
      source: 'fallback',
      provider: 'offline-fallback',
      rates: { ...FALLBACK_RATES_PER_USD },
    };
  }
  try {
    const raw =
      window.localStorage.getItem(RATES_CACHE_KEY) ??
      window.localStorage.getItem(LEGACY_RATES_CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<CachedRatesPayload>;
      const timestamp =
        typeof parsed.fetchedAt === 'number'
          ? parsed.fetchedAt
          : typeof parsed.updatedAt === 'number'
            ? parsed.updatedAt
            : 0;
      if (parsed?.rates && timestamp > 0) {
        const { rates } = normalizeRateMap(
          parsed.rates as Record<string, unknown>,
          FALLBACK_RATES_PER_USD,
        );
        const ageMs = Date.now() - timestamp;
        const source: FxRatesSource =
          parsed.source === 'fallback'
            ? 'fallback'
            : ageMs <= LIVE_FRESH_TTL_MS * 2
              ? 'live'
              : 'cached';
        return {
          fetchedAt: timestamp,
          updatedAt: timestamp,
          source,
          provider: parsed.provider ?? 'open.er-api.com',
          rates,
        };
      }
    }
  } catch {
    // ignore parse errors
  }
  return {
    fetchedAt: 0,
    updatedAt: 0,
    source: 'fallback',
    provider: 'offline-fallback',
    rates: { ...FALLBACK_RATES_PER_USD },
  };
}

async function fetchJsonWithTimeout(url: string, timeoutMs = FX_FETCH_TIMEOUT_MS): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: 'GET',
      cache: 'no-store',
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fetches real-time FX rates with automatic multi-provider fallback:
 *  1. Primary: Open Exchange Rates (`open.er-api.com`) — full global + TZS coverage
 *  2. Secondary: Fawaz Ahmed Currency CDN (`cdn.jsdelivr.net`) — full global + TZS coverage
 *  3. Tertiary: Frankfurter / ECB (`api.frankfurter.app`) — live major pairs merged over last verified TZS/AED
 *  4. Resilient Cache: Preserves last verified live rates + original `fetchedAt` if offline
 */
async function fetchLiveExchangeRates(
  previous: CachedRatesPayload,
): Promise<CachedRatesPayload> {
  if (inFlightFxRefresh) {
    return inFlightFxRefresh;
  }

  const run = (async (): Promise<CachedRatesPayload> => {
    const baseline =
      previous.fetchedAt > 0 && previous.source !== 'fallback'
        ? previous.rates
        : FALLBACK_RATES_PER_USD;

    // 1. Primary FX Endpoint (open.er-api.com)
    try {
      const data = (await fetchJsonWithTimeout(
        'https://open.er-api.com/v6/latest/USD',
      )) as { result?: string; rates?: Record<string, unknown> };
      if (data?.rates) {
        const { rates, matchedCount } = normalizeRateMap(data.rates, baseline);
        if (matchedCount >= 6 && isValidRateNumber(rates.TZS) && isValidRateNumber(rates.EUR)) {
          const now = Date.now();
          return {
            fetchedAt: now,
            updatedAt: now,
            source: 'live',
            provider: 'open.er-api.com',
            rates,
          };
        }
      }
    } catch {
      // Automatically fall back to secondary FX endpoint
    }

    // 2. Secondary FX Endpoint (Global CDN Currency API — full TZS/EUR/USD coverage)
    try {
      const data = (await fetchJsonWithTimeout(
        'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json',
      )) as { usd?: Record<string, unknown> };
      if (data?.usd) {
        const { rates, matchedCount } = normalizeRateMap(data.usd, baseline);
        if (matchedCount >= 6 && isValidRateNumber(rates.TZS) && isValidRateNumber(rates.EUR)) {
          const now = Date.now();
          return {
            fetchedAt: now,
            updatedAt: now,
            source: 'live',
            provider: 'currency-api (CDN)',
            rates,
          };
        }
      }
    } catch {
      // Automatically fall back to tertiary ECB endpoint
    }

    // 3. Tertiary FX Endpoint (ECB Frankfurter for major global pairs + preserved last-verified TZS/AED)
    try {
      const data = (await fetchJsonWithTimeout(
        'https://api.frankfurter.app/latest?from=USD',
      )) as { rates?: Record<string, unknown> };
      if (data?.rates) {
        const { rates, matchedCount } = normalizeRateMap(data.rates, baseline);
        if (matchedCount >= 4 && isValidRateNumber(rates.EUR)) {
          const now = Date.now();
          return {
            fetchedAt: now,
            updatedAt: now,
            source: 'live',
            provider: 'frankfurter.app (ECB)',
            rates,
          };
        }
      }
    } catch {
      // All remote providers unavailable
    }

    // 4. Preserve last verified live rates with their original `fetchedAt` rather than silently overwriting
    if (previous.fetchedAt > 0 && previous.source !== 'fallback') {
      return {
        ...previous,
        source: 'cached',
      };
    }

    return {
      fetchedAt: 0,
      updatedAt: 0,
      source: 'fallback',
      provider: 'offline-fallback',
      rates: { ...FALLBACK_RATES_PER_USD },
    };
  })();

  inFlightFxRefresh = run;
  try {
    return await run;
  } finally {
    inFlightFxRefresh = null;
  }
}

/**
 * Canonical high-precision cross-currency conversion through the single USD-anchored rate table.
 * Preserves full IEEE-754 floating-point precision for intermediate calculations (no premature rounding).
 */
export function convertCurrencyPair(
  amount: number,
  fromCurrency: SupportedCurrency,
  toCurrency: SupportedCurrency = activeCurrencyCode,
  rates: Record<SupportedCurrency, number> = activeRatesPayload.rates,
): number {
  if (!Number.isFinite(amount)) return 0;
  if (fromCurrency === toCurrency) return amount;
  const fromRate = rates[fromCurrency] ?? FALLBACK_RATES_PER_USD[fromCurrency] ?? 1;
  const toRate = rates[toCurrency] ?? FALLBACK_RATES_PER_USD[toCurrency] ?? 1;
  if (!Number.isFinite(fromRate) || fromRate <= 0 || !Number.isFinite(toRate) || toRate <= 0) {
    return amount;
  }
  return (amount / fromRate) * toRate;
}

/**
 * Returns the exact live cross-rate for 1 unit of `fromCurrency` in `toCurrency`.
 */
export function getCrossRate(
  fromCurrency: SupportedCurrency,
  toCurrency: SupportedCurrency,
  rates: Record<SupportedCurrency, number> = activeRatesPayload.rates,
): number {
  return convertCurrencyPair(1, fromCurrency, toCurrency, rates);
}

/**
 * Formats a USD numeric amount into the currently selected global currency
 * using compact notation (e.g. k, M, B) for marketplace cards and tables.
 */
export function formatCurrencyFromUsd(
  usdAmount: number,
  currencyCode: SupportedCurrency = activeCurrencyCode,
  rates: Record<SupportedCurrency, number> = activeRatesPayload.rates,
): string {
  const meta = CURRENCIES[currencyCode] ?? CURRENCIES.USD;
  const converted = convertCurrencyPair(usdAmount, 'USD', currencyCode, rates);
  const absConverted = Math.abs(converted);
  const sign = converted < 0 ? '-' : '';

  if (absConverted >= 1_000_000_000) {
    const val = (absConverted / 1_000_000_000).toFixed(2).replace(/\.?0+$/, '');
    return `${sign}${meta.symbol}${val}B`;
  }
  if (absConverted >= 1_000_000) {
    const val = (absConverted / 1_000_000)
      .toFixed(absConverted % 1_000_000 === 0 ? 0 : 2)
      .replace(/\.?0+$/, '');
    return `${sign}${meta.symbol}${val}M`;
  }
  if (absConverted >= 1_000) {
    const thousands = absConverted / 1_000;
    const formattedK =
      thousands >= 100
        ? Math.round(thousands).toLocaleString('en-US')
        : Number(thousands.toFixed(1)).toLocaleString('en-US');
    return `${sign}${meta.symbol}${formattedK}k`;
  }
  return `${sign}${meta.symbol}${absConverted.toLocaleString('en-US', {
    maximumFractionDigits: meta.decimals,
  })}`;
}

/**
 * Formats an exact USD numeric amount in full locale format (display rounding only at the final step).
 */
export function formatExactFromUsd(
  usdAmount: number,
  currencyCode: SupportedCurrency = activeCurrencyCode,
  rates: Record<SupportedCurrency, number> = activeRatesPayload.rates,
): string {
  const meta = CURRENCIES[currencyCode] ?? CURRENCIES.USD;
  const converted = convertCurrencyPair(usdAmount, 'USD', currencyCode, rates);

  return `${meta.symbol}${converted.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: meta.decimals,
  })}`;
}

/**
 * Converts a user-entered amount in their selected currency back to baseline USD
 * with full floating-point precision (no premature intermediate rounding).
 */
export function convertToUsd(
  amountInSelectedCurrency: number,
  currencyCode: SupportedCurrency = activeCurrencyCode,
  rates: Record<SupportedCurrency, number> = activeRatesPayload.rates,
): number {
  return convertCurrencyPair(amountInSelectedCurrency, currencyCode, 'USD', rates);
}

function parseSuffixMultiplier(suffix?: string): number {
  if (!suffix) return 1;
  const s = suffix.toLowerCase();
  if (s === 'k') return 1_000;
  if (s === 'm') return 1_000_000;
  if (s === 'b') return 1_000_000_000;
  return 1;
}

/**
 * Dynamically converts inline USD, TSh/TZS, and EUR figures in text strings
 * into the active global currency using the single canonical FX rate map.
 */
export function convertInlineUsdText(
  text: string,
  currencyCode: SupportedCurrency = activeCurrencyCode,
  rates: Record<SupportedCurrency, number> = activeRatesPayload.rates,
): string {
  if (!text) return text;
  let result = text;

  // 1. Convert inline USD figures when active currency is not USD
  if (currencyCode !== 'USD') {
    result = result.replace(
      /(?:US\$|\$)(\d+(?:,\d{3})*(?:\.\d+)?)\s*([kKmMbB])?/g,
      (match, rawNum: string, suffix?: string) => {
        const base = parseFloat(rawNum.replace(/,/g, ''));
        if (Number.isNaN(base)) return match;
        const totalUsd = base * parseSuffixMultiplier(suffix);
        return suffix
          ? formatCurrencyFromUsd(totalUsd, currencyCode, rates)
          : formatExactFromUsd(totalUsd, currencyCode, rates);
      },
    );
  }

  // 2. Convert inline TSh / TZS figures when active currency is not TZS
  if (currencyCode !== 'TZS') {
    result = result.replace(
      /(?:TSh|TZS)\s*(\d+(?:,\d{3})*(?:\.\d+)?)\s*([kKmMbB])?/g,
      (match, rawNum: string, suffix?: string) => {
        const baseTzs = parseFloat(rawNum.replace(/,/g, ''));
        if (Number.isNaN(baseTzs)) return match;
        const totalUsd = convertCurrencyPair(
          baseTzs * parseSuffixMultiplier(suffix),
          'TZS',
          'USD',
          rates,
        );
        return suffix
          ? formatCurrencyFromUsd(totalUsd, currencyCode, rates)
          : formatExactFromUsd(totalUsd, currencyCode, rates);
      },
    );
  }

  // 3. Convert inline EUR figures when active currency is not EUR
  if (currencyCode !== 'EUR') {
    result = result.replace(
      /(?:€|EUR\s*)(\d+(?:,\d{3})*(?:\.\d+)?)\s*([kKmMbB])?/g,
      (match, rawNum: string, suffix?: string) => {
        const baseEur = parseFloat(rawNum.replace(/,/g, ''));
        if (Number.isNaN(baseEur)) return match;
        const totalUsd = convertCurrencyPair(
          baseEur * parseSuffixMultiplier(suffix),
          'EUR',
          'USD',
          rates,
        );
        return suffix
          ? formatCurrencyFromUsd(totalUsd, currencyCode, rates)
          : formatExactFromUsd(totalUsd, currencyCode, rates);
      },
    );
  }

  return result;
}

export interface CurrencyContextValue {
  currency: SupportedCurrency;
  currencyMeta: CurrencyMetadata;
  rates: Record<SupportedCurrency, number>;
  rateForSelected: number;
  ratesSource: FxRatesSource;
  ratesProvider: string;
  fetchedAt: Date | null;
  lastUpdated: Date | null;
  isRefreshingRates: boolean;
  setCurrency: (code: SupportedCurrency) => void;
  refreshRates: () => Promise<void>;
  convertPair: (
    amount: number,
    fromCurrency: SupportedCurrency,
    toCurrency?: SupportedCurrency,
  ) => number;
  formatUsd: (usdAmount: number) => string;
  formatExactUsd: (usdAmount: number) => string;
  convertText: (text: string) => string;
  toUsd: (amountInSelected: number) => number;
}

const CurrencyContext = createContext<CurrencyContextValue | null>(null);

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [currency, setCurrencyState] = useState<SupportedCurrency>(() => {
    const initial = readInitialCurrency();
    activeCurrencyCode = initial;
    return initial;
  });

  const [ratesState, setRatesState] = useState<CachedRatesPayload>(() => {
    const cached = readCachedRates();
    activeRatesPayload = cached;
    return cached;
  });

  const [isRefreshingRates, setIsRefreshingRates] = useState<boolean>(false);

  const setCurrency = useCallback((code: SupportedCurrency) => {
    if (!(code in CURRENCIES)) return;
    activeCurrencyCode = code;
    setCurrencyState(code);
    if (typeof window !== 'undefined') {
      try {
        if (hasPreferencesConsent()) {
          window.localStorage.setItem(CURRENCY_STORAGE_KEY, code);
          window.localStorage.setItem('dosho_preferred_currency', code);
          document.cookie = `${CURRENCY_COOKIE_NAME}=${code}; path=/; max-age=31536000; SameSite=Lax`;
        }
        const currentLang = window.localStorage.getItem('mc:lang') || 'en';
        window.dispatchEvent(new CustomEvent(CURRENCY_CHANGE_EVENT, { detail: code }));
        window.dispatchEvent(
          new CustomEvent('app-localization-update', {
            detail: { currency: code, language: currentLang },
          }),
        );
      } catch {
        // ignore storage errors
      }
    }
  }, []);

  const refreshRates = useCallback(async () => {
    setIsRefreshingRates(true);
    try {
      const nextPayload = await fetchLiveExchangeRates(activeRatesPayload);
      activeRatesPayload = nextPayload;
      setRatesState(nextPayload);
      if (typeof window !== 'undefined') {
        try {
          if (nextPayload.fetchedAt > 0) {
            window.localStorage.setItem(RATES_CACHE_KEY, JSON.stringify(nextPayload));
          }
          window.dispatchEvent(
            new CustomEvent(RATES_UPDATED_EVENT, { detail: nextPayload }),
          );
        } catch {
          // ignore storage quota errors
        }
      }
    } finally {
      setIsRefreshingRates(false);
    }
  }, []);

  useEffect(() => {
    const initial = readInitialCurrency();
    activeCurrencyCode = initial;
    setCurrencyState(initial);

    const cached = readCachedRates();
    activeRatesPayload = cached;
    setRatesState(cached);

    // Always hydrate live FX rates on mount if cache is older than 90s or not live
    if (cached.source !== 'live' || Date.now() - cached.fetchedAt > LIVE_FRESH_TTL_MS) {
      void refreshRates();
    }

    // Periodic live FX refresh every 2 minutes while tab is active
    const intervalId = window.setInterval(() => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') {
        void refreshRates();
      }
    }, AUTO_REFRESH_INTERVAL_MS);

    const handleVisibilityChange = () => {
      if (
        document.visibilityState === 'visible' &&
        (activeRatesPayload.source !== 'live' ||
          Date.now() - activeRatesPayload.fetchedAt > LIVE_FRESH_TTL_MS)
      ) {
        void refreshRates();
      }
    };

    const handleOnline = () => {
      void refreshRates();
    };

    const handleCurrencySync = (e: Event) => {
      if (e instanceof StorageEvent) {
        if (e.key === RATES_CACHE_KEY && e.newValue) {
          const synced = readCachedRates();
          activeRatesPayload = synced;
          setRatesState(synced);
          return;
        }
      }

      const custom = e as CustomEvent<
        SupportedCurrency | { currency?: SupportedCurrency; language?: string }
      >;
      const nextCode =
        typeof custom.detail === 'string'
          ? custom.detail
          : custom.detail?.currency;
      if (nextCode && nextCode in CURRENCIES) {
        activeCurrencyCode = nextCode;
        setCurrencyState(nextCode);
      } else {
        const stored = readInitialCurrency();
        activeCurrencyCode = stored;
        setCurrencyState(stored);
      }
    };

    const handleRatesBroadcast = (e: Event) => {
      const custom = e as CustomEvent<CachedRatesPayload>;
      if (custom.detail?.rates) {
        activeRatesPayload = custom.detail;
        setRatesState(custom.detail);
      }
    };

    window.addEventListener(CURRENCY_CHANGE_EVENT, handleCurrencySync);
    window.addEventListener('app-localization-update', handleCurrencySync);
    window.addEventListener(RATES_UPDATED_EVENT, handleRatesBroadcast);
    window.addEventListener('storage', handleCurrencySync);
    window.addEventListener('online', handleOnline);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener(CURRENCY_CHANGE_EVENT, handleCurrencySync);
      window.removeEventListener('app-localization-update', handleCurrencySync);
      window.removeEventListener(RATES_UPDATED_EVENT, handleRatesBroadcast);
      window.removeEventListener('storage', handleCurrencySync);
      window.removeEventListener('online', handleOnline);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [refreshRates]);

  const value = useMemo<CurrencyContextValue>(() => {
    const meta = CURRENCIES[currency] ?? CURRENCIES.USD;
    const currentRates = ratesState.rates;
    const fetchedDate = ratesState.fetchedAt > 0 ? new Date(ratesState.fetchedAt) : null;

    return {
      currency,
      currencyMeta: meta,
      rates: currentRates,
      rateForSelected: currentRates[currency] ?? 1,
      ratesSource: ratesState.source,
      ratesProvider: ratesState.provider,
      fetchedAt: fetchedDate,
      lastUpdated: fetchedDate,
      isRefreshingRates,
      setCurrency,
      refreshRates,
      convertPair: (
        amount: number,
        fromCurrency: SupportedCurrency,
        toCurrency: SupportedCurrency = currency,
      ) => convertCurrencyPair(amount, fromCurrency, toCurrency, currentRates),
      formatUsd: (usdAmount: number) =>
        formatCurrencyFromUsd(usdAmount, currency, currentRates),
      formatExactUsd: (usdAmount: number) =>
        formatExactFromUsd(usdAmount, currency, currentRates),
      convertText: (text: string) =>
        convertInlineUsdText(text, currency, currentRates),
      toUsd: (amountInSelected: number) =>
        convertToUsd(amountInSelected, currency, currentRates),
    };
  }, [currency, ratesState, isRefreshingRates, setCurrency, refreshRates]);

  return (
    <CurrencyContext.Provider value={value}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency(): CurrencyContextValue {
  const ctx = useContext(CurrencyContext);
  if (!ctx) {
    const fetchedDate =
      activeRatesPayload.fetchedAt > 0 ? new Date(activeRatesPayload.fetchedAt) : null;
    return {
      currency: activeCurrencyCode,
      currencyMeta: CURRENCIES[activeCurrencyCode] ?? CURRENCIES.USD,
      rates: activeRatesPayload.rates,
      rateForSelected: activeRatesPayload.rates[activeCurrencyCode] ?? 1,
      ratesSource: activeRatesPayload.source,
      ratesProvider: activeRatesPayload.provider,
      fetchedAt: fetchedDate,
      lastUpdated: fetchedDate,
      isRefreshingRates: false,
      setCurrency: (code: SupportedCurrency) => {
        activeCurrencyCode = code;
      },
      refreshRates: async () => {},
      convertPair: (
        amount: number,
        fromCurrency: SupportedCurrency,
        toCurrency: SupportedCurrency = activeCurrencyCode,
      ) => convertCurrencyPair(amount, fromCurrency, toCurrency, activeRatesPayload.rates),
      formatUsd: (n: number) => formatCurrencyFromUsd(n),
      formatExactUsd: (n: number) => formatExactFromUsd(n),
      convertText: (t: string) => convertInlineUsdText(t),
      toUsd: (n: number) => convertToUsd(n),
    };
  }
  return ctx;
}
