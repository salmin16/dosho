import React from 'react';
import { CurrencyProvider } from '@/context/CurrencyContext';
import CurrencySelector from '@/components/CurrencySelector';
import PriceDisplay from '@/components/PriceDisplay';
import { INITIAL_MINERAL_PRICES } from '@/data/mineralPrices';

export const dynamic = 'force-dynamic';

export default function NextMarketsPage() {
  return (
    <CurrencyProvider>
      <div className="min-h-screen bg-slate-950 text-slate-100">
        <header className="border-b border-amber-500/20 bg-slate-900/80 backdrop-blur-md">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
            <div>
              <span className="font-mono text-xs uppercase tracking-widest text-amber-400">
                LBMA · LME · Mining Commission Benchmarks
              </span>
              <h1 className="text-xl font-bold text-white">
                Indicative Mineral Prices Board (`/markets`)
              </h1>
            </div>
            <CurrencySelector />
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-6 py-10">
          <div className="overflow-x-auto rounded-2xl border border-amber-500/20 bg-slate-900/75 shadow-2xl">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-amber-500/20 bg-slate-950/90 font-mono uppercase text-amber-400">
                <tr>
                  <th className="px-5 py-4">Mineral &amp; Symbol</th>
                  <th className="px-5 py-4">Unit</th>
                  <th className="px-5 py-4">World Market Price</th>
                  <th className="px-5 py-4">Mineral Market Price</th>
                  <th className="px-5 py-4">Buying Centre Price</th>
                  <th className="px-5 py-4 text-right">24h Change</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {INITIAL_MINERAL_PRICES.map((m) => (
                  <tr key={m.id} className="hover:bg-amber-500/5">
                    <td className="px-5 py-4 font-semibold text-white">
                      {m.mineral_name} ({m.symbol})
                    </td>
                    <td className="px-5 py-4 font-mono text-slate-400">
                      {m.unit}
                    </td>
                    <td className="px-5 py-4 font-mono font-bold text-amber-400">
                      <PriceDisplay amountInUSD={m.world_market_price_usd} />
                    </td>
                    <td className="px-5 py-4 font-mono font-bold text-emerald-400">
                      <PriceDisplay amountInUSD={m.local_market_price_usd} />
                    </td>
                    <td className="px-5 py-4 font-mono font-bold text-sky-400">
                      <PriceDisplay amountInUSD={m.buying_centre_price_usd} />
                    </td>
                    <td className="px-5 py-4 text-right font-mono">
                      <span
                        className={
                          m.trend_percentage >= 0
                            ? 'text-emerald-400'
                            : 'text-rose-400'
                        }
                      >
                        {m.trend_percentage >= 0 ? '+' : ''}
                        {m.trend_percentage.toFixed(2)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </main>
      </div>
    </CurrencyProvider>
  );
}
