'use client'

import { useCurrency } from '../lib/currency'
import { useLocalization } from '../context/LocalizationContext'

export interface PriceDisplayProps {
  /** Base amount in USD to be dynamically converted and formatted */
  amountInUSD: number
  /** Optional CSS classes for styling the price text */
  className?: string
  /** Optional prefix or suffix label (e.g. "/mo", "/toz", "/g") */
  suffix?: string
  /** Compact notation (e.g. k, M, B) */
  compact?: boolean
  /** Override minimum fraction digits */
  minimumFractionDigits?: number
  /** Override maximum fraction digits */
  maximumFractionDigits?: number
  /** Show original USD value on hover tooltip when viewing non-USD currency */
  showBaseTooltip?: boolean
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
  const { currency, formatUsd, formatExactUsd } = useCurrency()

  let formatted: string
  try {
    const loc = useLocalization()
    formatted = loc.formatPrice(amountInUSD, {
      compact,
      minimumFractionDigits,
      maximumFractionDigits,
    })
  } catch {
    formatted = compact ? formatUsd(amountInUSD) : formatExactUsd(amountInUSD)
  }

  const usdTooltip =
    showBaseTooltip && currency !== 'USD'
      ? `Base Spot USD: $${amountInUSD.toLocaleString('en-US', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`
      : undefined

  return (
    <span
      title={usdTooltip}
      data-currency={currency}
      className={` tabular-nums transition-opacity duration-150 ${className}`}
    >
      {formatted}
      {suffix ? (
        <span className="ml-0.5 text-[0.82em] opacity-75">{suffix}</span>
      ) : null}
    </span>
  )
}
