'use client'

import React, { createContext, useContext, useSyncExternalStore } from 'react'
import {
  getMarketSyncTelemetry,
  getStoredMineralPrices,
  subscribeMineralPrices,
} from '../data/mineralPrices'
import {
  getFxStoreSnapshot,
  subscribeFxStore,
  type CachedRatesPayload,
} from '../lib/currency'
import type {
  MarketSyncTelemetry,
  MineralPriceRecord,
} from '../types/database'

interface MarketDataStoreApi {
  getPricesSnapshot: () => MineralPriceRecord[]
  getTelemetrySnapshot: () => MarketSyncTelemetry
  subscribeMarkets: (listener: () => void) => () => void
  getFxSnapshot: () => CachedRatesPayload
  subscribeFx: (listener: () => void) => () => void
}

// Memoized snapshots so useSyncExternalStore gets stable references between ticks
let cachedPricesSnapshot: MineralPriceRecord[] = getStoredMineralPrices()
let cachedTelemetrySnapshot: MarketSyncTelemetry = getMarketSyncTelemetry()

function refreshMarketSnapshots() {
  cachedPricesSnapshot = getStoredMineralPrices()
  cachedTelemetrySnapshot = getMarketSyncTelemetry()
}

function subscribeMarketsStore(listener: () => void): () => void {
  return subscribeMineralPrices(() => {
    refreshMarketSnapshots()
    listener()
  })
}

function getPricesSnapshot(): MineralPriceRecord[] {
  const live = getStoredMineralPrices()
  if (live !== cachedPricesSnapshot) {
    cachedPricesSnapshot = live
  }
  return cachedPricesSnapshot
}

function getTelemetrySnapshot(): MarketSyncTelemetry {
  const live = getMarketSyncTelemetry()
  if (live !== cachedTelemetrySnapshot) {
    cachedTelemetrySnapshot = live
  }
  return cachedTelemetrySnapshot
}

const DEFAULT_STORE_API: MarketDataStoreApi = {
  getPricesSnapshot,
  getTelemetrySnapshot,
  subscribeMarkets: subscribeMarketsStore,
  getFxSnapshot: getFxStoreSnapshot,
  subscribeFx: subscribeFxStore,
}

/**
 * Isolated Market & FX Data Context.
 * Holds ONLY stable store references (never reactive state values), so mounting
 * `MarketDataProvider` at the app root NEVER causes Dashboards, forms, or routes
 * to re-render when mineral spot quotes or FX rates tick in the background.
 * Only components that explicitly call `useMarketPrices()`, `useMineralQuote()`,
 * `useMarketTelemetry()`, or `useLiveFxRates()` re-render on live ticks.
 */
const MarketDataContext = createContext<MarketDataStoreApi>(DEFAULT_STORE_API)

export function MarketDataProvider({ children }: { children: React.ReactNode }) {
  return (
    <MarketDataContext.Provider value={DEFAULT_STORE_API}>
      {children}
    </MarketDataContext.Provider>
  )
}

export function useMarketPrices(): MineralPriceRecord[] {
  const api = useContext(MarketDataContext)
  return useSyncExternalStore(
    api.subscribeMarkets,
    api.getPricesSnapshot,
    api.getPricesSnapshot,
  )
}

export function useMineralQuote(symbol: string): MineralPriceRecord | undefined {
  const prices = useMarketPrices()
  const upper = symbol.toUpperCase()
  return prices.find((m) => m.symbol.toUpperCase() === upper)
}

export function useMarketTelemetry(): MarketSyncTelemetry {
  const api = useContext(MarketDataContext)
  return useSyncExternalStore(
    api.subscribeMarkets,
    api.getTelemetrySnapshot,
    api.getTelemetrySnapshot,
  )
}

export function useLiveFxRates(): CachedRatesPayload {
  const api = useContext(MarketDataContext)
  return useSyncExternalStore(
    api.subscribeFx,
    api.getFxSnapshot,
    api.getFxSnapshot,
  )
}
