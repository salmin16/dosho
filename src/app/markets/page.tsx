import { CurrencyProvider } from '@/context/CurrencyContext';
import CurrencySelector from '@/components/CurrencySelector';
import PriceDisplay from '@/components/PriceDisplay';
import { INITIAL_MINERAL_PRICES } from '@/data/mineralPrices';

export const dynamic = 'force-dynamic';

export default function NextMarketsPage() {
  return (
    <CurrencyProvider>
      <div className="min-h-screen bg-paper text-ink">
        <header className="grain relative overflow-hidden border-b border-ink/15 bg-ink text-paper">
          <div className="contours absolute inset-0" aria-hidden="true" />
          <div className="relative mx-auto flex max-w-7xl items-center justify-between px-6 py-8">
            <div>
              <span className="eyebrow text-gold">
                LBMA · LME · Mining Commission Benchmarks
              </span>
              <h1 className="font-display mt-2 text-3xl font-light text-paper">
                Indicative <em className="italic text-gold">Mineral Prices</em> Board
              </h1>
            </div>
            <CurrencySelector />
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-6 py-12">
          <div className="overflow-x-auto rounded-2xl border border-ink/12 bg-paper shadow-xl">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-ink/12 bg-paper-2 font-mono uppercase text-stone">
                <tr>
                  <th className="px-5 py-4 text-ink">Mineral &amp; Symbol</th>
                  <th className="px-5 py-4">Unit</th>
                  <th className="px-5 py-4 text-ochre">World Market Price</th>
                  <th className="px-5 py-4 text-moss">Mineral Market Price</th>
                  <th className="px-5 py-4 text-ink">Buying Centre Price</th>
                  <th className="px-5 py-4 text-right text-ink">24h Change</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink/10">
                {INITIAL_MINERAL_PRICES.map((m) => (
                  <tr key={m.id} className="hover:bg-paper-2/70">
                    <td className="px-5 py-4 font-display text-base font-medium text-ink">
                      {m.mineral_name}{' '}
                      <span className="ml-1 rounded bg-ink px-1.5 py-0.5 font-mono text-[10px] text-gold">
                        {m.symbol}
                      </span>
                    </td>
                    <td className="px-5 py-4 font-mono text-stone">
                      {m.unit}
                    </td>
                    <td className="px-5 py-4 font-mono font-bold text-ochre">
                      <PriceDisplay amountInUSD={m.world_market_price_usd} />
                    </td>
                    <td className="px-5 py-4 font-mono font-bold text-moss">
                      <PriceDisplay amountInUSD={m.local_market_price_usd} />
                    </td>
                    <td className="px-5 py-4 font-mono font-bold text-ink">
                      <PriceDisplay amountInUSD={m.buying_centre_price_usd} />
                    </td>
                    <td className="px-5 py-4 text-right font-mono">
                      <span
                        className={`inline-flex rounded border px-2 py-0.5 text-[11px] font-semibold ${
                          m.trend_percentage >= 0
                            ? 'border-moss/35 bg-moss-light text-moss'
                            : 'border-danger/35 bg-danger/10 text-danger'
                        }`}
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
