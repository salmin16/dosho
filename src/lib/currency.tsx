import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { SupportedCurrency } from '../types/database';

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

/**
 * Fallback market exchange rates (1 USD -> Target Currency) used immediately
 * before live daily rates resolve or when offline.
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
const RATES_CACHE_KEY = 'mineconnect.fx_rates.v1';
const CURRENCY_COOKIE_NAME = 'mc_currency';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours daily refresh
const CURRENCY_CHANGE_EVENT = 'mineconnect:currency-changed';

interface CachedRatesPayload {
  updatedAt: number;
  source: 'live' | 'fallback';
  rates: Record<SupportedCurrency, number>;
}

// Module-level state so non-hook utilities (`formatUsd`) always format with the active currency
let activeCurrencyCode: SupportedCurrency = 'USD';
let activeRates: Record<SupportedCurrency, number> = { ...FALLBACK_RATES_PER_USD };

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
    return { updatedAt: Date.now(), source: 'fallback', rates: { ...FALLBACK_RATES_PER_USD } };
  }
  try {
    const raw = window.localStorage.getItem(RATES_CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as CachedRatesPayload;
      if (parsed?.rates && typeof parsed.updatedAt === 'number') {
        return parsed;
      }
    }
  } catch {
    // ignore parse errors
  }
  return { updatedAt: 0, source: 'fallback', rates: { ...FALLBACK_RATES_PER_USD } };
}

/**
 * Formats a USD numeric amount into the currently selected global currency
 * using compact notation (e.g. k, M, B) for marketplace cards and tables.
 */
export function formatCurrencyFromUsd(
  usdAmount: number,
  currencyCode: SupportedCurrency = activeCurrencyCode,
  rates: Record<SupportedCurrency, number> = activeRates
): string {
  const meta = CURRENCIES[currencyCode] ?? CURRENCIES.USD;
  const rate = rates[currencyCode] ?? 1;
  const converted = usdAmount * rate;

  if (converted >= 1_000_000_000) {
    const val = (converted / 1_000_000_000).toFixed(2).replace(/\.?0+$/, '');
    return `${meta.symbol}${val}B`;
  }
  if (converted >= 1_000_000) {
    const val = (converted / 1_000_000)
      .toFixed(converted % 1_000_000 === 0 ? 0 : 2)
      .replace(/\.?0+$/, '');
    return `${meta.symbol}${val}M`;
  }
  if (converted >= 1_000) {
    return `${meta.symbol}${Math.round(converted / 1_000).toLocaleString('en-US')}k`;
  }
  return `${meta.symbol}${converted.toLocaleString('en-US', {
    maximumFractionDigits: meta.decimals,
  })}`;
}

/**
 * Formats an exact USD numeric amount in full locale format (e.g., for invoices, quotes, and packages).
 */
export function formatExactFromUsd(
  usdAmount: number,
  currencyCode: SupportedCurrency = activeCurrencyCode,
  rates: Record<SupportedCurrency, number> = activeRates
): string {
  const meta = CURRENCIES[currencyCode] ?? CURRENCIES.USD;
  const rate = rates[currencyCode] ?? 1;
  const converted = usdAmount * rate;

  return `${meta.symbol}${converted.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: meta.decimals,
  })}`;
}

/**
 * Converts a user-entered amount in their selected currency back to baseline USD
 * for normalized PostgreSQL storage (`investment_usd`, `estimated_budget_usd`).
 */
export function convertToUsd(
  amountInSelectedCurrency: number,
  currencyCode: SupportedCurrency = activeCurrencyCode,
  rates: Record<SupportedCurrency, number> = activeRates
): number {
  const rate = rates[currencyCode] ?? 1;
  if (rate <= 0) return amountInSelectedCurrency;
  return Number((amountInSelectedCurrency / rate).toFixed(2));
}

/**
 * Dynamically converts inline USD text strings (e.g. "US$250k – US$3.5M", "$450")
 * into the active currency in real time.
 */
export function convertInlineUsdText(
  text: string,
  currencyCode: SupportedCurrency = activeCurrencyCode,
  rates: Record<SupportedCurrency, number> = activeRates
): string {
  if (currencyCode === 'USD') return text;
  return text.replace(
    /(?:US\$|\$)(\d+(?:,\d{3})*(?:\.\d+)?)\s*([kKmMbB])?/g,
    (_, rawNum: string, suffix?: string) => {
      const base = parseFloat(rawNum.replace(/,/g, ''));
      if (Number.isNaN(base)) return _;
      let multiplier = 1;
      if (suffix) {
        const s = suffix.toLowerCase();
        if (s === 'k') multiplier = 1_000;
        else if (s === 'm') multiplier = 1_000_000;
        else if (s === 'b') multiplier = 1_000_000_000;
      }
      const totalUsd = base * multiplier;
      return suffix
        ? formatCurrencyFromUsd(totalUsd, currencyCode, rates)
        : formatExactFromUsd(totalUsd, currencyCode, rates);
    }
  );
}

interface CurrencyContextValue {
  currency: SupportedCurrency;
  currencyMeta: CurrencyMetadata;
  rates: Record<SupportedCurrency, number>;
  rateForSelected: number;
  ratesSource: 'live' | 'fallback';
  lastUpdated: Date | null;
  setCurrency: (code: SupportedCurrency) => void;
  refreshRates: () => Promise<void>;
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
    activeRates = cached.rates;
    return cached;
  });

  const setCurrency = useCallback((code: SupportedCurrency) => {
    if (!(code in CURRENCIES)) return;
    activeCurrencyCode = code;
    setCurrencyState(code);
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(CURRENCY_STORAGE_KEY, code);
        document.cookie = `${CURRENCY_COOKIE_NAME}=${code}; path=/; max-age=31536000; SameSite=Lax`;
        window.dispatchEvent(new CustomEvent(CURRENCY_CHANGE_EVENT, { detail: code }));
      } catch {
        // ignore storage errors
      }
    }
  }, []);

  const refreshRates = useCallback(async () => {
    try {
      const response = await fetch('https://open.er-api.com/v6/latest/USD');
      if (!response.ok) return;
      const data = (await response.json()) as {
        result?: string;
        rates?: Record<string, number>;
      };
      if (data?.rates) {
        const merged: Record<SupportedCurrency, number> = {
          ...FALLBACK_RATES_PER_USD,
        };
        (Object.keys(CURRENCIES) as SupportedCurrency[]).forEach((code) => {
          if (typeof data.rates?.[code] === 'number' && data.rates[code] > 0) {
            merged[code] = data.rates[code];
          }
        });
        const payload: CachedRatesPayload = {
          updatedAt: Date.now(),
          source: 'live',
          rates: merged,
        };
        activeRates = merged;
        setRatesState(payload);
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(RATES_CACHE_KEY, JSON.stringify(payload));
          window.dispatchEvent(new CustomEvent(CURRENCY_CHANGE_EVENT));
        }
      }
    } catch {
      // Gracefully retain cached / fallback market rates when offline
    }
  }, []);

  useEffect(() => {
    const initial = readInitialCurrency();
    activeCurrencyCode = initial;
    setCurrencyState(initial);

    const cached = readCachedRates();
    activeRates = cached.rates;
    setRatesState(cached);

    // Fetch live world market exchange rates if cache is older than 24h
    if (Date.now() - cached.updatedAt > CACHE_TTL_MS) {
      refreshRates();
    }
  }, [refreshRates]);

  const value = useMemo<CurrencyContextValue>(() => {
    const meta = CURRENCIES[currency] ?? CURRENCIES.USD;
    const currentRates = ratesState.rates;
    return {
      currency,
      currencyMeta: meta,
      rates: currentRates,
      rateForSelected: currentRates[currency] ?? 1,
      ratesSource: ratesState.source,
      lastUpdated: ratesState.updatedAt ? new Date(ratesState.updatedAt) : null,
      setCurrency,
      refreshRates,
      formatUsd: (usdAmount: number) =>
        formatCurrencyFromUsd(usdAmount, currency, currentRates),
      formatExactUsd: (usdAmount: number) =>
        formatExactFromUsd(usdAmount, currency, currentRates),
      convertText: (text: string) =>
        convertInlineUsdText(text, currency, currentRates),
      toUsd: (amountInSelected: number) =>
        convertToUsd(amountInSelected, currency, currentRates),
    };
  }, [currency, ratesState, setCurrency, refreshRates]);

  return (
    <CurrencyContext.Provider value={value}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency(): CurrencyContextValue {
  const ctx = useContext(CurrencyContext);
  if (!ctx) {
    return {
      currency: activeCurrencyCode,
      currencyMeta: CURRENCIES[activeCurrencyCode] ?? CURRENCIES.USD,
      rates: activeRates,
      rateForSelected: activeRates[activeCurrencyCode] ?? 1,
      ratesSource: 'fallback',
      lastUpdated: null,
      setCurrency: (code: SupportedCurrency) => {
        activeCurrencyCode = code;
      },
      refreshRates: async () => {},
      formatUsd: (n: number) => formatCurrencyFromUsd(n),
      formatExactUsd: (n: number) => formatExactFromUsd(n),
      convertText: (t: string) => convertInlineUsdText(t),
      toUsd: (n: number) => convertToUsd(n),
    };
  }
  return ctx;
}
