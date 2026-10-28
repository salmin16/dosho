import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, Coins, RefreshCw } from 'lucide-react';
import { CURRENCY_LIST, useCurrency } from '../lib/currency';
import { updatePreferredCurrency } from '../lib/supabaseAuth';

export default function CurrencySwitcher({ dark = false }: { dark?: boolean }) {
  const {
    currency,
    currencyMeta,
    rateForSelected,
    ratesSource,
    setCurrency,
    refreshRates,
  } = useCurrency();
  const [open, setOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const handleSelect = async (code: typeof currency) => {
    setCurrency(code);
    setOpen(false);
    await updatePreferredCurrency(code);
  };

  const handleRefresh = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setRefreshing(true);
    try {
      await refreshRates();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Select global display currency"
        aria-expanded={open}
        className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 font-mono text-xs font-medium transition ${
          dark
            ? 'border-paper/25 bg-paper/10 text-paper hover:bg-paper/20'
            : 'border-ink/15 bg-paper-2/80 text-ink hover:border-ink/35'
        }`}
      >
        <Coins size={13} className="text-gold" />
        <span>{currencyMeta.flag}</span>
        <span>{currency}</span>
        <ChevronDown size={12} className="opacity-70" />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="Supported world currencies"
          className="absolute right-0 z-50 mt-2 w-64 rounded-xl border border-ink/15 bg-paper p-2 text-ink shadow-2xl"
        >
          <div className="flex items-center justify-between border-b border-ink/10 px-2.5 pb-2 pt-1">
            <div>
              <p className="font-mono text-[10px] font-semibold uppercase tracking-wider text-ochre">
                Global Currency ({ratesSource === 'live' ? 'Live FX' : 'Market FX'})
              </p>
              <p className="font-mono text-[10px] text-stone">
                1 USD = {rateForSelected.toLocaleString('en-US', { maximumFractionDigits: 2 })} {currency}
              </p>
            </div>
            <button
              type="button"
              onClick={handleRefresh}
              title="Refresh live exchange rates"
              className="rounded p-1 text-stone transition hover:bg-ink/5 hover:text-ink"
            >
              <RefreshCw size={12} className={refreshing ? 'animate-spin text-ochre' : ''} />
            </button>
          </div>

          <div className="mt-1.5 max-h-64 space-y-0.5 overflow-y-auto">
            {CURRENCY_LIST.map((item) => {
              const active = item.code === currency;
              return (
                <button
                  key={item.code}
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => handleSelect(item.code)}
                  className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs transition ${
                    active
                      ? 'bg-ochre text-paper font-semibold'
                      : 'text-ink hover:bg-ink/5'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span>{item.flag}</span>
                    <span>{item.name}</span>
                  </span>
                  <span className="font-mono text-[11px] opacity-85">
                    {item.code} ({item.symbol.trim()})
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
