import { NextResponse } from 'next/server';

export interface ExchangeRatesPayload {
  base: 'USD';
  rates: Record<string, number>;
  updatedAt: string;
  source: 'live' | 'cache' | 'fallback';
}

/**
 * Reliable static fallback rates (base: USD) used if external network requests fail
 * or for regional currencies (such as TZS / KES) not included in ECB/Frankfurter feeds.
 */
const FALLBACK_USD_RATES: Record<string, number> = {
  USD: 1,
  EUR: 0.92,
  GBP: 0.79,
  TZS: 2685.0,
  KES: 129.5,
  CAD: 1.39,
  AUD: 1.53,
  JPY: 154.2,
  CHF: 0.88,
  ZAR: 18.15,
  INR: 84.4,
  CNY: 7.24,
};

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 Hour TTL

interface RateCacheEntry {
  rates: Record<string, number>;
  timestamp: number;
  updatedAt: string;
}

// Module-scoped in-memory cache across warm serverless invocations
let memoryCache: RateCacheEntry | null = null;

export async function GET() {
  const now = Date.now();

  // 1. Serve from in-memory cache if valid within the 1-hour TTL
  if (memoryCache && now - memoryCache.timestamp < CACHE_TTL_MS) {
    return NextResponse.json<ExchangeRatesPayload>(
      {
        base: 'USD',
        rates: memoryCache.rates,
        updatedAt: memoryCache.updatedAt,
        source: 'cache',
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=1800',
        },
      }
    );
  }

  // 2. Fetch live mid-market rates from Frankfurter API (primary) and Open ER API (regional supplement for TZS/KES)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const [frankfurterRes, openErRes] = await Promise.allSettled([
      fetch('https://api.frankfurter.app/latest?from=USD', {
        signal: controller.signal,
        next: { revalidate: 3600 },
      }),
      fetch('https://open.er-api.com/v6/latest/USD', {
        signal: controller.signal,
        next: { revalidate: 3600 },
      }),
    ]);

    clearTimeout(timeoutId);

    const mergedRates: Record<string, number> = {
      ...FALLBACK_USD_RATES,
      USD: 1,
    };

    let fetchedLive = false;

    if (
      openErRes.status === 'fulfilled' &&
      openErRes.value.ok
    ) {
      const openErData = (await openErRes.value.json()) as {
        rates?: Record<string, number>;
      };
      if (openErData?.rates) {
        Object.assign(mergedRates, openErData.rates);
        fetchedLive = true;
      }
    }

    if (
      frankfurterRes.status === 'fulfilled' &&
      frankfurterRes.value.ok
    ) {
      const frankfurterData = (await frankfurterRes.value.json()) as {
        rates?: Record<string, number>;
      };
      if (frankfurterData?.rates) {
        Object.assign(mergedRates, frankfurterData.rates);
        fetchedLive = true;
      }
    }

    mergedRates.USD = 1;
    const updatedAt = new Date(now).toISOString();

    if (fetchedLive) {
      memoryCache = {
        rates: mergedRates,
        timestamp: now,
        updatedAt,
      };

      return NextResponse.json<ExchangeRatesPayload>(
        {
          base: 'USD',
          rates: mergedRates,
          updatedAt,
          source: 'live',
        },
        {
          headers: {
            'Cache-Control':
              'public, s-maxage=3600, stale-while-revalidate=1800',
          },
        }
      );
    }
  } catch (error) {
    console.warn(
      '[ExchangeRatesAPI] External rate fetch failed, using fallback rates:',
      error
    );
  }

  // 3. Resilient Fallback: Always return valid rates even if external providers are unreachable
  const fallbackTimestamp = new Date(now).toISOString();
  return NextResponse.json<ExchangeRatesPayload>(
    {
      base: 'USD',
      rates: FALLBACK_USD_RATES,
      updatedAt: fallbackTimestamp,
      source: 'fallback',
    },
    {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    }
  );
}
