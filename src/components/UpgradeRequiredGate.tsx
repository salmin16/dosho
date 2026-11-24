'use client'

import { Link } from '@tanstack/react-router'
import { ArrowRight, Check, Crown, Lock, ShieldCheck, X } from 'lucide-react'
import { useLocalization } from '../context/LocalizationContext'
import { CANONICAL_SUBSCRIPTION_PLANS, PLAN_FEATURE_BULLETS } from '../lib/subscriptions'
import type { SubscriptionPlanId } from '../types/database'

export interface UpgradeRequiredGateProps {
  /** 'banner' renders inline inside a page; 'modal' renders an editorial overlay dialog */
  variant?: 'banner' | 'modal'
  requiredPlan?: Exclude<SubscriptionPlanId, 'free'>
  featureTitle: string
  reason: string
  currentPlanLabel?: string
  quotaSummary?: string
  onClose?: () => void
}

export default function UpgradeRequiredGate({
  variant = 'banner',
  requiredPlan = 'pro',
  featureTitle,
  reason,
  currentPlanLabel = 'Explorer',
  quotaSummary,
  onClose,
}: UpgradeRequiredGateProps) {
  const { currency, formatPrice, ui } = useLocalization()
  const targetPlan =
    CANONICAL_SUBSCRIPTION_PLANS.find((p) => p.id === requiredPlan) ??
    CANONICAL_SUBSCRIPTION_PLANS[1]
  const bullets = PLAN_FEATURE_BULLETS[targetPlan.id]

  const displayPrice =
    currency === 'TZS'
      ? `TSh ${targetPlan.price_tzs.toLocaleString('en-US')}`
      : formatPrice(targetPlan.price_usd)

  const content = (
    <div className="relative w-full max-w-full overflow-hidden rounded-2xl border border-gold/40 bg-ink p-5 text-paper shadow-xl sm:p-7">
      {variant === 'modal' && onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label={ui('Close upgrade prompt', 'Funga dirisha', 'Cerrar')}
          className="absolute right-4 top-4 rounded-full border border-paper/15 bg-paper/5 p-1.5 text-paper/75 transition hover:border-gold hover:text-gold"
        >
          <X size={16} />
        </button>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-gold/45 bg-ochre/25 px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-gold">
          <Lock size={11} />
          {ui('Upgrade Required', 'Pandisha Mpango', 'Actualización Requerida')}
        </span>
        <span className="rounded-full border border-paper/15 bg-paper/[0.06] px-2.5 py-1 font-mono text-[10px] text-paper/75">
          {ui('Current Plan:', 'Mpango wa Sasa:', 'Plan Actual:')}{' '}
          <strong className="text-paper">{currentPlanLabel}</strong>
        </span>
        {quotaSummary && (
          <span className="rounded-full border border-danger/40 bg-danger/15 px-2.5 py-1 font-mono text-[10px] font-semibold text-[#f59c8a] tabular-nums">
            {quotaSummary}
          </span>
        )}
      </div>

      <h3 className="font-display mt-3.5 text-2xl font-light leading-tight text-paper sm:text-3xl">
        {featureTitle}
      </h3>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-paper/75">
        {reason}
      </p>

      <div className="mt-5 rounded-xl border border-paper/12 bg-ink-2/90 p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-paper/10 pb-3">
          <div className="flex items-center gap-2">
            <Crown size={15} className="text-gold" />
            <span className="font-display text-lg font-medium text-paper">
              {targetPlan.name}
            </span>
          </div>
          <div className="font-mono text-sm font-bold text-gold tabular-nums">
            {displayPrice}
            <span className="text-[11px] font-normal text-paper/60">
              {ui('/month', '/mwezi', '/mes')}
            </span>
          </div>
        </div>

        <ul className="mt-3 grid grid-cols-1 gap-2 text-xs text-paper/80 sm:grid-cols-2">
          {bullets.map((item) => (
            <li key={item} className="flex items-start gap-2">
              <Check size={13} className="mt-0.5 shrink-0 text-[#9de4b4]" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <span className="inline-flex items-center gap-1.5 font-mono text-[10.5px] text-paper/60">
          <ShieldCheck size={13} className="text-gold" />
          {ui(
            'Verified via Mobile Money, NMB/CRDB EFT, or Instant Gateway',
            'Lipa kupitia Simu, Benki (NMB/CRDB), au Lango la Papo Hapo',
            'Verificado vía Dinero Móvil, Transferencia Bancaria o Pasarela',
          )}
        </span>

        <div className="flex flex-wrap items-center gap-2.5">
          {variant === 'modal' && onClose && (
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-paper/20 bg-paper/5 px-4 py-2.5 text-xs font-semibold text-paper transition hover:bg-paper/15"
            >
              {ui('Not Now', 'Baadaye', 'Ahora no')}
            </button>
          )}
          <Link
            to="/pricing"
            search={{ plan: requiredPlan } as unknown as undefined}
            onClick={onClose}
            className="btn-primary !py-2.5 !px-5 text-xs"
          >
            {ui(
              `Upgrade to ${targetPlan.name}`,
              `Pandisha hadi ${targetPlan.name}`,
              `Actualizar a ${targetPlan.name}`,
            )}
            <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    </div>
  )

  if (variant === 'modal') {
    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-label={featureTitle}
        className="fixed inset-0 z-[80] flex items-end justify-center p-3 sm:items-center sm:p-6"
      >
        <div
          className="absolute inset-0 bg-ink/70 backdrop-blur-xs animate-fade"
          onClick={onClose}
        />
        <div className="relative z-10 w-full max-w-xl animate-rise">
          {content}
        </div>
      </div>
    )
  }

  return content
}
