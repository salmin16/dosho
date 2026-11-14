import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useMemo, useRef, useState } from 'react'
import {
  ArrowRight,
  Check,
  CheckCircle2,
  CreditCard,
  Crown,
  ExternalLink,
  Landmark,
  ShieldCheck,
  Smartphone,
  X,
} from 'lucide-react'
import { useLocalization } from '../context/LocalizationContext'
import InternationalCheckout from '../components/InternationalCheckout'
import LocalMobileCheckout from '../components/LocalMobileCheckout'
import {
  MERCHANT_SETTLEMENT_ACCOUNT,
  type SettlementLedgerEntry,
} from '../lib/payments/settlement'
import {
  SUBSCRIPTION_TIERS,
  normalizeSubscriptionTier,
  resolveVerifiedTierPricing,
  useSubscription,
} from '../lib/subscriptions'
import { ensureAdminDemoSession, useAuthSession } from '../lib/supabaseAuth'
import type { BillingCycle, SubscriptionTierName } from '../types/database'

export const Route = createFileRoute('/pricing')({
  head: () => ({ meta: [{ title: 'Membership & pricing — MineConnect' }] }),
  component: Pricing,
})

function Pricing() {
  const navigate = useNavigate()
  const session = useAuthSession()
  const { subscription } = useSubscription()
  const { t, fixtures, currency, formatPrice, convertText, ui } =
    useLocalization()

  const [yearly, setYearly] = useState(false)
  const [selectedCheckoutTier, setSelectedCheckoutTier] =
    useState<SubscriptionTierName | null>('Investor')
  const [activeGatewayTab, setActiveGatewayTab] = useState<
    'both' | 'mobile_money' | 'international'
  >('both')
  const [receipt, setReceipt] = useState<{
    reference: string
    tierName: SubscriptionTierName
    billingCycle: BillingCycle
    gatewayLabel: string
    amountTzs: number
    amountUsd: number
    expiresAt: string
    settlement?: SettlementLedgerEntry
  } | null>(null)

  const paymentOptionsRef = useRef<HTMLDivElement | null>(null)

  const billingCycle: BillingCycle = yearly ? 'yearly' : 'monthly'

  const effectiveUserId = useMemo(() => {
    if (session?.user.id) return session.user.id
    return ensureAdminDemoSession().user.id
  }, [session?.user.id])

  const verifiedPricing = useMemo(
    () =>
      resolveVerifiedTierPricing(
        selectedCheckoutTier ?? 'Investor',
        billingCycle,
      ),
    [selectedCheckoutTier, billingCycle],
  )

  const displayPrimaryAmount = useMemo(() => {
    if (verifiedPricing.verifiedAmountTzs === 0) {
      return ui('Free (TSh 0)', 'Bure (TSh 0)', 'Gratis (TSh 0)')
    }
    if (currency === 'TZS') {
      return `TSh ${verifiedPricing.verifiedAmountTzs.toLocaleString('en-US')}`
    }
    return formatPrice(verifiedPricing.verifiedAmountUsd)
  }, [currency, verifiedPricing, formatPrice, ui])

  const handleSubscribeClick = (planId: string) => {
    const normalized = normalizeSubscriptionTier(planId)
    setSelectedCheckoutTier(normalized)
    setReceipt(null)
    setTimeout(() => {
      paymentOptionsRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      })
    }, 60)
  }

  return (
    <div className="pt-[72px]">
      <section className="px-5 pb-12 pt-16 text-center lg:px-8">
        <p className="eyebrow mb-4 text-ochre">{t('pricing.eyebrow')}</p>
        <h1 className="font-display mx-auto max-w-3xl text-5xl font-light leading-[1] md:text-6xl">
          {t('pricing.titlePre')}
          <em className="italic text-ochre">{t('pricing.titleEm')}</em>
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-lg text-stone">
          {t('pricing.subtitle')}
        </p>

        <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-ochre/30 bg-ochre/10 px-4 py-1.5 font-mono text-xs text-ochre">
          <Crown size={13} />
          {ui('Your Active Plan:', 'Mpango Wako wa Sasa:', 'Tu Plan Activo:')}{' '}
          <strong>{subscription.tier_name}</strong> ({subscription.billing_cycle})
        </div>

        <div className="mt-8 flex justify-center">
          <div className="inline-flex flex-wrap justify-center rounded-lg border border-ink/15 bg-white/60 p-1">
            {(
              [
                ['monthly', t('pricing.monthly'), false],
                ['yearly', t('pricing.yearly'), true],
              ] as const
            ).map(([id, label, isYearly]) => (
              <button
                key={id}
                type="button"
                onClick={() => setYearly(isYearly)}
                className={`rounded-md px-5 py-2 text-sm font-semibold transition ${
                  isYearly === yearly ? 'bg-ink text-paper' : 'text-stone'
                }`}
              >
                {label}
                {isYearly && (
                  <span className="ml-1.5 text-xs text-gold">
                    {t('pricing.twoMonthsFree')}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="px-5 pb-12 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-4 md:grid-cols-2 xl:grid-cols-5">
          {fixtures.plans.map((p) => {
            const hl = 'highlighted' in p && p.highlighted
            const tierName = normalizeSubscriptionTier(p.id)
            const tierMeta = SUBSCRIPTION_TIERS[tierName]
            const isSelectedForCheckout = selectedCheckoutTier === tierName
            const isCurrentUserTier =
              subscription.tier_name === tierName &&
              subscription.status === 'active'

            // Dynamic multi-currency price formatting via LocalizationContext
            const rawTzs = yearly ? tierMeta.yearlyTzs : tierMeta.monthlyTzs
            const rawUsd = yearly ? tierMeta.yearlyUsd : tierMeta.monthlyUsd

            const formattedPrice =
              rawTzs === 0
                ? p.price
                : currency === 'TZS'
                  ? yearly && p.id === 'corporate'
                    ? 'TSh 10M+'
                    : p.id === 'corporate'
                      ? 'TSh 1M+'
                      : `TSh ${rawTzs.toLocaleString('en-US')}`
                  : `${formatPrice(rawUsd)}${p.id === 'corporate' ? '+' : ''}`

            const formattedPeriod =
              rawTzs === 0
                ? ''
                : yearly
                  ? t('pricing.perYear')
                  : p.period || '/month'

            return (
              <article
                key={p.id}
                id={p.id}
                className={`relative flex flex-col rounded-2xl border p-6 transition ${
                  hl
                    ? 'border-ink bg-ink text-paper shadow-xl'
                    : isSelectedForCheckout
                      ? 'border-ochre bg-white shadow-lg ring-2 ring-ochre'
                      : 'border-ink/10 bg-white/60 hover:border-ochre/40'
                }`}
              >
                {hl && (
                  <span className="absolute -top-3 left-6 rounded-full bg-gold px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-ink">
                    {t('pricing.forInvestors')}
                  </span>
                )}
                {isCurrentUserTier && (
                  <span className="absolute -top-3 right-6 rounded-full bg-moss px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-paper">
                    {ui('Active Plan', 'Mpango Wako', 'Plan Activo')}
                  </span>
                )}

                <h2 className="font-display text-2xl">{p.name}</h2>
                <p
                  className={`mt-1 text-sm ${
                    hl ? 'text-paper/60' : 'text-stone'
                  }`}
                >
                  {p.audience}
                </p>

                <div className="mt-6">
                  <span className="font-display text-3xl">
                    {formattedPrice}
                  </span>
                  <span
                    className={`text-sm ${
                      hl ? 'text-paper/60' : 'text-stone'
                    }`}
                  >
                    {formattedPeriod}
                  </span>
                </div>

                <ul className="mt-6 flex-1 space-y-2.5 text-sm">
                  {p.features.map((f) => (
                    <li key={f} className="flex gap-2">
                      <Check
                        size={15}
                        className={`mt-0.5 shrink-0 ${
                          hl ? 'text-gold' : 'text-moss'
                        }`}
                      />{' '}
                      {f}
                    </li>
                  ))}
                </ul>

                <button
                  type="button"
                  onClick={() => handleSubscribeClick(p.id)}
                  className={`mt-8 ${
                    hl || isSelectedForCheckout ? 'btn-primary' : 'btn-ghost'
                  } w-full justify-center`}
                >
                  {ui('Subscribe', 'Jiunge Sasa', 'Suscribirse')}
                </button>
              </article>
            )
          })}
        </div>
      </section>

      {/* Instant Dual-Rail Payment Options Section (Appears immediately & scrolls into view when "Subscribe" is clicked) */}
      {selectedCheckoutTier && (
        <section
          ref={paymentOptionsRef}
          id="payment-options"
          className="scroll-mt-24 border-y border-ink/15 bg-paper-2 px-5 py-14 lg:px-8"
        >
          <div className="mx-auto max-w-7xl">
            {/* Section Header */}
            <div className="mb-8 flex flex-col justify-between gap-4 rounded-2xl border border-ink/15 bg-ink p-6 text-paper shadow-lg lg:flex-row lg:items-center">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-gold/40 bg-ochre/25 px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-widest text-gold">
                    <Crown size={12} />
                    {ui(
                      'Selected Plan for Payment:',
                      'Mpango Uliochaguliwa:',
                      'Plan Seleccionado:'
                    )}{' '}
                    {selectedCheckoutTier} ({billingCycle})
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-moss/40 bg-moss/25 px-3 py-1 font-mono text-[10px] text-[#9de4b4]">
                    <Landmark size={11} />
                    NMB Bank · {MERCHANT_SETTLEMENT_ACCOUNT.accountNumber} (
                    {MERCHANT_SETTLEMENT_ACCOUNT.accountName})
                  </span>
                </div>

                <h2 className="mt-2 font-display text-3xl font-light text-paper md:text-4xl">
                  {ui(
                    'Complete Subscription via Mobile Money or International Card',
                    'Kamilisha Malipo kwa Simu (M-Pesa / Airtel / Mixx) au Kadi',
                    'Complete su Suscripción con Dinero Móvil o Tarjeta Internacional'
                  )}
                </h2>
                <p className="mt-1 text-xs text-paper/70">
                  {ui(
                    `Verified Amount: ${displayPrimaryAmount} (TSh ${verifiedPricing.verifiedAmountTzs.toLocaleString('en-US')} / US$${verifiedPricing.verifiedAmountUsd.toLocaleString('en-US')}) · Instant tier activation`,
                    `Kiasi kilichothibitishwa: ${displayPrimaryAmount} (TSh ${verifiedPricing.verifiedAmountTzs.toLocaleString('en-US')})`,
                    `Monto verificado: ${displayPrimaryAmount}`
                  )}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <div className="inline-flex rounded-lg border border-paper/15 bg-ink-2 p-1 text-xs">
                  <button
                    type="button"
                    onClick={() => setActiveGatewayTab('both')}
                    className={`rounded-md px-3 py-1.5 font-mono text-[11px] font-semibold transition ${
                      activeGatewayTab === 'both'
                        ? 'bg-ochre text-paper'
                        : 'text-paper/70 hover:text-paper'
                    }`}
                  >
                    {ui('All Payment Options', 'Njia Zote', 'Todas las Opciones')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveGatewayTab('mobile_money')}
                    className={`inline-flex items-center gap-1 rounded-md px-3 py-1.5 font-mono text-[11px] font-semibold transition ${
                      activeGatewayTab === 'mobile_money'
                        ? 'bg-ochre text-paper'
                        : 'text-paper/70 hover:text-paper'
                    }`}
                  >
                    <Smartphone size={12} />
                    Mobile Money
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveGatewayTab('international')}
                    className={`inline-flex items-center gap-1 rounded-md px-3 py-1.5 font-mono text-[11px] font-semibold transition ${
                      activeGatewayTab === 'international'
                        ? 'bg-ochre text-paper'
                        : 'text-paper/70 hover:text-paper'
                    }`}
                  >
                    <CreditCard size={12} />
                    Apple / Google Pay & Card
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    navigate({
                      to: '/checkout',
                      search: {
                        tier: selectedCheckoutTier.toLowerCase(),
                        billing: billingCycle,
                      },
                    })
                  }
                  className="inline-flex items-center gap-1.5 rounded-lg border border-gold/40 bg-gold/15 px-3 py-2 font-mono text-xs font-semibold text-gold transition hover:bg-gold/25"
                >
                  <ExternalLink size={13} />
                  {ui('Full Checkout Page', 'Ukurasa wa Malipo', 'Página de Pago')}
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedCheckoutTier(null)}
                  className="rounded-lg border border-paper/15 bg-paper/5 p-2 text-paper/65 hover:text-paper"
                  title="Close payment options"
                >
                  <X size={15} />
                </button>
              </div>
            </div>

            {receipt ? (
              /* Verified Payment & NMB Settlement Confirmation */
              <div className="mx-auto max-w-2xl rounded-2xl border border-moss/40 bg-ink p-8 text-paper shadow-2xl">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-moss/30 text-[#9de4b4]">
                    <CheckCircle2 size={26} />
                  </div>
                  <div>
                    <span className="font-mono text-[10px] font-semibold uppercase tracking-widest text-[#9de4b4]">
                      WEBHOOK VERIFIED · NMB BANK 60510047212 SETTLED
                    </span>
                    <h3 className="font-display text-3xl text-paper">
                      {receipt.tierName} Plan Activated!
                    </h3>
                  </div>
                </div>

                <dl className="mt-6 grid grid-cols-1 gap-4 rounded-xl border border-paper/12 bg-ink-2 p-5 font-mono text-xs sm:grid-cols-2">
                  <div>
                    <dt className="text-[10px] uppercase text-paper/50">
                      Reference
                    </dt>
                    <dd className="mt-1 font-bold text-gold">
                      {receipt.reference}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[10px] uppercase text-paper/50">
                      Payment Channel
                    </dt>
                    <dd className="mt-1 text-paper">{receipt.gatewayLabel}</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] uppercase text-paper/50">
                      Settled to NMB Account
                    </dt>
                    <dd className="mt-1 font-bold text-[#9de4b4]">
                      {MERCHANT_SETTLEMENT_ACCOUNT.accountNumber} (
                      {MERCHANT_SETTLEMENT_ACCOUNT.accountName})
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[10px] uppercase text-paper/50">
                      Amount Verified
                    </dt>
                    <dd className="mt-1 text-paper">
                      TSh {receipt.amountTzs.toLocaleString('en-US')} (
                      {formatPrice(receipt.amountUsd)})
                    </dd>
                  </div>
                </dl>

                <div className="mt-6 flex flex-wrap gap-3">
                  <Link to="/dashboard" className="btn-primary">
                    Open Dashboard & View Quotas <ArrowRight size={15} />
                  </Link>
                  <button
                    type="button"
                    onClick={() => setReceipt(null)}
                    className="rounded-md border border-paper/20 bg-paper/10 px-4 py-2.5 text-xs font-semibold text-paper hover:bg-paper/20"
                  >
                    Make Another Payment
                  </button>
                </div>
              </div>
            ) : (
              /* Side-by-Side or Tabbed Dual-Rail Payment Components */
              <div
                className={`grid grid-cols-1 gap-8 ${
                  activeGatewayTab === 'both'
                    ? 'lg:grid-cols-2'
                    : 'mx-auto max-w-2xl'
                }`}
              >
                {(activeGatewayTab === 'both' ||
                  activeGatewayTab === 'mobile_money') && (
                  <LocalMobileCheckout
                    userId={effectiveUserId}
                    tierName={selectedCheckoutTier}
                    billingCycle={billingCycle}
                    formattedAmount={displayPrimaryAmount}
                    verifiedAmountTzs={verifiedPricing.verifiedAmountTzs}
                    pdpaConsent={true}
                    onSwitchToCardRail={() =>
                      setActiveGatewayTab('international')
                    }
                    onSuccess={(res) => {
                      if (res.subscription && res.transaction) {
                        setReceipt({
                          reference: res.transaction.external_reference,
                          tierName: res.subscription.tier_name,
                          billingCycle: res.subscription.billing_cycle,
                          gatewayLabel: res.transaction.payment_method_label,
                          amountTzs: verifiedPricing.verifiedAmountTzs,
                          amountUsd: verifiedPricing.verifiedAmountUsd,
                          expiresAt: res.subscription.expires_at,
                          settlement: res.settlement,
                        })
                      }
                    }}
                  />
                )}

                {(activeGatewayTab === 'both' ||
                  activeGatewayTab === 'international') && (
                  <InternationalCheckout
                    userId={effectiveUserId}
                    tierName={selectedCheckoutTier}
                    billingCycle={billingCycle}
                    formattedAmount={displayPrimaryAmount}
                    pdpaConsent={true}
                    onSuccess={(res) => {
                      if (res.subscription && res.transaction) {
                        setReceipt({
                          reference: res.transaction.external_reference,
                          tierName: res.subscription.tier_name,
                          billingCycle: res.subscription.billing_cycle,
                          gatewayLabel: res.transaction.payment_method_label,
                          amountTzs: verifiedPricing.verifiedAmountTzs,
                          amountUsd: verifiedPricing.verifiedAmountUsd,
                          expiresAt: res.subscription.expires_at,
                          settlement: res.settlement,
                        })
                      }
                    }}
                  />
                )}
              </div>
            )}
          </div>
        </section>
      )}

      <section className="border-t border-ink/10 bg-paper-2 px-5 py-20 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="font-display text-4xl font-light">
                {t('pricing.feesTitle')}
              </h2>
              <p className="mt-3 text-stone">{t('pricing.feesSubtitle')}</p>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-ink/15 bg-white px-3.5 py-1.5 font-mono text-xs text-stone">
              <ShieldCheck size={14} className="text-moss" />
              {ui(
                'Settled to NMB Bank · 60510047212 (Salmin Ally Mwenesi)',
                'Malipo yanaingia NMB Bank · 60510047212 (Salmin Ally Mwenesi)',
                'Liquidación NMB Bank · 60510047212 (Salmin Ally Mwenesi)'
              )}
            </span>
          </div>

          <div className="mt-8 overflow-x-auto rounded-xl border border-ink/10 bg-white/70">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-ink/10 font-mono text-[11px] uppercase tracking-wider text-stone">
                  <th className="px-5 py-4 font-normal">
                    {t('pricing.col.product')}
                  </th>
                  <th className="px-5 py-4 font-normal">
                    {t('pricing.col.price')}
                  </th>
                  <th className="px-5 py-4 font-normal">
                    {t('pricing.col.customer')}
                  </th>
                  <th className="px-5 py-4 font-normal">
                    {t('pricing.col.basis')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink/10">
                {fixtures.servicesPricing.map((r) => (
                  <tr key={r.product} className="hover:bg-paper/60">
                    <td className="px-5 py-4 font-medium">{r.product}</td>
                    <td className="px-5 py-4 font-display text-lg">
                      {convertText(r.price)}
                    </td>
                    <td className="px-5 py-4 text-stone">{r.customer}</td>
                    <td className="px-5 py-4 text-stone">{r.type}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-6 text-xs leading-relaxed text-stone">
            {t('pricing.footnote')}
          </p>
          <Link
            to="/faq"
            className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-ochre hover:underline"
          >
            {t('pricing.faqLink')} <ArrowRight size={15} />
          </Link>
        </div>
      </section>
    </div>
  )
}
