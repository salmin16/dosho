'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

export type SupportedCurrencyCode =
  | 'USD'
  | 'EUR'
  | 'GBP'
  | 'TZS'
  | 'KES'
  | 'CAD'
  | 'AUD'
  | 'JPY';

export interface CurrencyMetadata {
  code: SupportedCurrencyCode;
  name: string;
  symbol: string;
  locale: string;
  flag: string;
  fractionDigits: number;
}

export const SUPPORTED_CURRENCIES: Record<
  SupportedCurrencyCode,
  CurrencyMetadata
> = {
  USD: {
    code: 'USD',
    name: 'US Dollar',
    symbol: '$',
    locale: 'en-US',
    flag: '🇺🇸',
    fractionDigits: 2,
  },
  EUR: {
    code: 'EUR',
    name: 'Euro',
    symbol: '€',
    locale: 'de-DE',
    flag: '🇪🇺',
    fractionDigits: 2,
  },
  GBP: {
    code: 'GBP',
    name: 'British Pound',
    symbol: '£',
    locale: 'en-GB',
    flag: '🇬🇧',
    fractionDigits: 2,
  },
  TZS: {
    code: 'TZS',
    name: 'Tanzanian Shilling',
    symbol: 'TSh',
    locale: 'en-TZ',
    flag: '🇹🇿',
    fractionDigits: 0,
  },
  KES: {
    code: 'KES',
    name: 'Kenyan Shilling',
    symbol: 'KSh',
    locale: 'en-KE',
    flag: '🇰🇪',
    fractionDigits: 0,
  },
  CAD: {
    code: 'CAD',
    name: 'Canadian Dollar',
    symbol: 'CA$',
    locale: 'en-CA',
    flag: '🇨🇦',
    fractionDigits: 2,
  },
  AUD: {
    code: 'AUD',
    name: 'Australian Dollar',
    symbol: 'A$',
    locale: 'en-AU',
    flag: '🇦🇺',
    fractionDigits: 2,
  },
  JPY: {
    code: 'JPY',
    name: 'Japanese Yen',
    symbol: '¥',
    locale: 'ja-JP',
    flag: '🇯🇵',
    fractionDigits: 0,
  },
};

const DEFAULT_FALLBACK_RATES: Record<string, number> = {
  USD: 1,
  EUR: 0.92,
  GBP: 0.79,
  TZS: 2685.0,
  KES: 129.5,
  CAD: 1.39,
  AUD: 1.53,
  JPY: 154.2,
};

const STORAGE_CURRENCY_KEY = 'dosho_preferred_currency';
const STORAGE_RATES_KEY = 'dosho_cached_exchange_rates';
const CLIENT_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

export interface FormatPriceOptions {
  compact?: boolean;
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
}

export interface CurrencyContextValue {
  currency: SupportedCurrencyCode;
  currencyMeta: CurrencyMetadata;
  rates: Record<string, number>;
  isLoading: boolean;
  lastUpdated: string | null;
  setCurrency: (code: SupportedCurrencyCode) => void;
  convertPrice: (amountInUSD: number) => number;
  formatPrice: (amountInUSD: number, options?: FormatPriceOptions) => string;
  refreshRates: () => Promise<void>;
}

const CurrencyContext = createContext<CurrencyContextValue | undefined>(
  undefined
);

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [currency, setCurrencyState] = useState<SupportedCurrencyCode>('USD');
  const [rates, setRates] = useState<Record<string, number>>(
    DEFAULT_FALLBACK_RATES
  );
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const fetchExchangeRates = useCallback(async (force = false) => {
    try {
      if (!force && typeof window !== 'undefined') {
        const cachedRaw = window.localStorage.getItem(STORAGE_RATES_KEY);
        if (cachedRaw) {
          const parsed = JSON.parse(cachedRaw) as {
            rates: Record<string, number>;
            updatedAt: string;
            timestamp: number;
          };
          if (
            parsed.rates &&
            Date.now() - parsed.timestamp < CLIENT_CACHE_TTL_MS
          ) {
            setRates(parsed.rates);
            setLastUpdated(parsed.updatedAt);
            setIsLoading(false);
            return;
          }
        }
      }

      setIsLoading(true);
      const response = await fetch('/api/exchange-rates');
      if (!response.ok) {
        throw new Error(`Exchange rate API responded with ${response.status}`);
      }

      const data = (await response.json()) as {
        rates: Record<string, number>;
        updatedAt: string;
      };

      if (data.rates) {
        setRates(data.rates);
        setLastUpdated(data.updatedAt);
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(
            STORAGE_RATES_KEY,
            JSON.stringify({
              rates: data.rates,
              updatedAt: data.updatedAt,
              timestamp: Date.now(),
            })
          );
        }
      }
    } catch (error) {
      console.warn('[CurrencyContext] Using fallback exchange rates:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load saved currency preference & initial rates on client mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedCurrency = (window.localStorage.getItem('mineconnect.currency.v1') ||
        window.localStorage.getItem(STORAGE_CURRENCY_KEY)) as SupportedCurrencyCode | null;

      if (savedCurrency && savedCurrency in SUPPORTED_CURRENCIES) {
        setCurrencyState(savedCurrency);
      }
    }
    void fetchExchangeRates(false);
  }, [fetchExchangeRates]);

  // Listen for cross-tab storage and custom event synchronization
  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (
        (event.key === STORAGE_CURRENCY_KEY || event.key === 'mineconnect.currency.v1') &&
        event.newValue &&
        event.newValue in SUPPORTED_CURRENCIES
      ) {
        setCurrencyState(event.newValue as SupportedCurrencyCode);
      }
    };
    const handleCustomChange = (event: Event) => {
      const custom = event as CustomEvent<string>;
      if (custom.detail && custom.detail in SUPPORTED_CURRENCIES) {
        setCurrencyState(custom.detail as SupportedCurrencyCode);
      }
    };
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('mineconnect:currency-changed', handleCustomChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('mineconnect:currency-changed', handleCustomChange);
    };
  }, []);

  const setCurrency = useCallback((code: SupportedCurrencyCode) => {
    if (!(code in SUPPORTED_CURRENCIES)) return;
    setCurrencyState(code);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_CURRENCY_KEY, code);
      window.localStorage.setItem('mineconnect.currency.v1', code);
      window.dispatchEvent(new CustomEvent('mineconnect:currency-changed', { detail: code }));
    }
  }, []);

  const convertPrice = useCallback(
    (amountInUSD: number): number => {
      if (!Number.isFinite(amountInUSD)) return 0;
      const rate = rates[currency] ?? DEFAULT_FALLBACK_RATES[currency] ?? 1;
      return amountInUSD * rate;
    },
    [currency, rates]
  );

  const formatPrice = useCallback(
    (amountInUSD: number, options?: FormatPriceOptions): string => {
      const converted = convertPrice(amountInUSD);
      const meta = SUPPORTED_CURRENCIES[currency] ?? SUPPORTED_CURRENCIES.USD;

      const minDigits =
        options?.minimumFractionDigits ?? meta.fractionDigits;
      const maxDigits =
        options?.maximumFractionDigits ?? meta.fractionDigits;

      try {
        return new Intl.NumberFormat(meta.locale, {
          style: 'currency',
          currency: meta.code,
          notation: options?.compact ? 'compact' : 'standard',
          minimumFractionDigits: options?.compact ? 0 : minDigits,
          maximumFractionDigits: options?.compact ? 1 : maxDigits,
        }).format(converted);
      } catch {
        return `${meta.symbol}${converted.toFixed(maxDigits)}`;
      }
    },
    [convertPrice, currency]
  );

  const value = useMemo<CurrencyContextValue>(
    () => ({
      currency,
      currencyMeta: SUPPORTED_CURRENCIES[currency],
      rates,
      isLoading,
      lastUpdated,
      setCurrency,
      convertPrice,
      formatPrice,
      refreshRates: () => fetchExchangeRates(true),
    }),
    [
      currency,
      rates,
      isLoading,
      lastUpdated,
      setCurrency,
      convertPrice,
      formatPrice,
      fetchExchangeRates,
    ]
  );

  return (
    <CurrencyContext.Provider value={value}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency(): CurrencyContextValue {
  const context = useContext(CurrencyContext);
  if (!context) {
    throw new Error('useCurrency must be used within a <CurrencyProvider>');
  }
  return context;
}
