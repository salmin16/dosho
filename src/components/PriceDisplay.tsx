'use client';

import React from 'react';
import {
  type FormatPriceOptions,
  useCurrency,
} from '@/context/CurrencyContext';

export interface PriceDisplayProps extends FormatPriceOptions {
  /** Base amount in USD to be dynamically converted and formatted */
  amountInUSD: number;
  /** Optional CSS classes for styling the price text */
  className?: string;
  /** Optional prefix or suffix label (e.g. "/mo") */
  suffix?: string;
  /** Show original USD value on hover tooltip when viewing non-USD currency */
  showBaseTooltip?: boolean;
}

export default function PriceDisplay({
  amountInUSD,
  className = '',
  suffix,
  compact = false,
  minimumFractionDigits,
  maximumFractionDigits,
  showBaseTooltip = true,
}: PriceDisplayProps) {
  const { currency, formatPrice } = useCurrency();

  const formattedValue = formatPrice(amountInUSD, {
    compact,
    minimumFractionDigits,
    maximumFractionDigits,
  });

  const baseUsdLabel =
    showBaseTooltip && currency !== 'USD'
      ? `Base price: $${amountInUSD.toLocaleString('en-US', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })} USD`
      : undefined;

  return (
    <span
      title={baseUsdLabel}
      className={`tabular-nums transition-colors duration-150 ${className}`}
    >
      {formattedValue}
      {suffix ? (
        <span className="ml-0.5 text-[0.85em] font-normal opacity-75">
          {suffix}
        </span>
      ) : null}
    </span>
  );
}
