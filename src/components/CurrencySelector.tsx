'use client';

import {
  SUPPORTED_CURRENCIES,
  type SupportedCurrencyCode,
  useCurrency,
} from '@/context/CurrencyContext';

export interface CurrencySelectorProps {
  className?: string;
  compact?: boolean;
}

export default function CurrencySelector({
  className = '',
  compact = false,
}: CurrencySelectorProps) {
  const { currency, setCurrency, rates, isLoading } = useCurrency();

  const currentRate = rates[currency] ?? 1;

  return (
    <div className={`relative inline-flex items-center gap-2 ${className}`}>
      <div className="relative flex items-center">
        <label htmlFor="global-currency-select" className="sr-only">
          Select Display Currency
        </label>
        <select
          id="global-currency-select"
          value={currency}
          onChange={(e) =>
            setCurrency(e.target.value as SupportedCurrencyCode)
          }
          disabled={isLoading && Object.keys(rates).length === 0}
          aria-label="Select Currency"
          className="appearance-none rounded-lg border border-slate-700/80 bg-slate-900/90 py-1.5 pl-3 pr-8 text-xs font-medium text-slate-100 shadow-sm transition hover:border-indigo-500/60 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-900"
        >
          {Object.values(SUPPORTED_CURRENCIES).map((item) => (
            <option
              key={item.code}
              value={item.code}
              className="bg-slate-900 text-slate-100"
            >
              {item.flag} {item.code}{' '}
              {!compact ? `— ${item.name} (${item.symbol})` : `(${item.symbol})`}
            </option>
          ))}
        </select>

        {/* Custom Dropdown Chevron */}
        <span className="pointer-events-none absolute right-2.5 flex items-center text-slate-400">
          <svg
            className="h-3.5 w-3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </span>
      </div>

      {!compact && currency !== 'USD' && (
        <span
          title={`Live conversion rate: 1 USD = ${currentRate.toFixed(2)} ${currency}`}
          className="hidden rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 font-mono text-[11px] text-emerald-400 sm:inline-block"
        >
          1 USD = {currentRate >= 100 ? Math.round(currentRate).toLocaleString() : currentRate.toFixed(2)}{' '}
          {currency}
        </span>
      )}
    </div>
  );
}
