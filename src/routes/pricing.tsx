import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import {
  ArrowRight,
  Building2,
  Check,
  CheckCircle2,
  CreditCard,
  Crown,
  Lock,
  ShieldCheck,
  Smartphone,
  X,
  Zap,
} from 'lucide-react'
import { useLocalization } from '../context/LocalizationContext'
import TurnstileWidget, {
  isTurnstileEnabled,
  type TurnstileWidgetHandle,
} from '../components/TurnstileWidget'
import {
  PLAN_FEATURE_BULLETS,
  activateSubscriptionDirect,
  normalizePlanId,
  useSubscription,
} from '../lib/subscriptions'
import { useAuthState } from '../lib/supabaseAuth'
import type { SubscriptionPlanId } from '../types/database'

export const Route = createFileRoute('/pricing')({
  validateSearch: (
    s: Record<string, unknown>,
  ): { plan?: SubscriptionPlanId; checkout?: string } => {
    const raw = typeof s.plan === 'string' ? s.plan.toLowerCase() : ''
    const plan =
      raw === 'free' || raw === 'pro' || raw === 'enterprise' ? raw : undefined
    const checkout = typeof s.checkout === 'string' ? s.checkout : undefined
    return { plan, checkout }
  },
  head: () => ({ meta: [{ title: 'Membership & pricing — MineConnect' }] }),
  component: Pricing,
})

const MOBILE_MONEY_NETWORKS = [
  'M-Pesa',
  'Tigo Pesa',
  'Airtel Money',
  'Halopesa',
] as const

const BANK_CARD_PROVIDERS = [
  'NMB Bank',
  'CRDB Bank',
  'NBC Bank',
  'Visa / Mastercard',
] as const

interface ActivationReceipt {
  planName: string
  referenceCode: string
  paymentMethod: string
  amount: number
  currency: string
  expiresAt: string
}

function Pricing() {
  const { plan: initialPlanParam, checkout: checkoutParam } = Route.useSearch()
  const { session } = useAuthState()
  const {
    plans,
    plan: activePlan,
    planId: activePlanId,
    accountState,
    isPaidActive,
  } = useSubscription()
  const { t, fixtures, currency, formatPrice, convertText, ui } =
    useLocalization()

  const [checkoutPlanId, setCheckoutPlanId] = useState<
    Exclude<SubscriptionPlanId, 'free'> | null
  >(() =>
    initialPlanParam === 'pro' || initialPlanParam === 'enterprise'
      ? initialPlanParam
      : checkoutParam === '1'
        ? 'pro'
        : null,
  )

  const [channel, setChannel] = useState<'mobile_money' | 'bank_card'>(
    'mobile_money',
  )
  const [mobileNetwork, setMobileNetwork] = useState<string>(
    MOBILE_MONEY_NETWORKS[0],
  )
  const [bankProvider, setBankProvider] = useState<string>(
    BANK_CARD_PROVIDERS[0],
  )
  const [accountInput, setAccountInput] = useState('')
  const [captchaToken, setCaptchaToken] = useState('')
  const [turnstileResetKey, setTurnstileResetKey] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [receipt, setReceipt] = useState<ActivationReceipt | null>(null)

  const turnstileRef = useRef<TurnstileWidgetHandle | null>(null)
  const turnstileEnabled = isTurnstileEnabled()

  useEffect(() => {
    if (initialPlanParam === 'pro' || initialPlanParam === 'enterprise') {
      setCheckoutPlanId(initialPlanParam)
      setReceipt(null)
      setErrorMsg(null)
    }
  }, [initialPlanParam])

  const selectedPlan = checkoutPlanId
    ? (plans.find((p) => p.id === checkoutPlanId) ??
      plans.find((p) => p.id === 'pro') ??
      plans[0])
    : null

  const formatPlanPrice = (priceTzs: number, priceUsd: number) => {
    if (priceTzs === 0 && priceUsd === 0) {
      return ui('Free', 'Bure', 'Gratis')
    }
    if (currency === 'TZS') {
      return `TSh ${priceTzs.toLocaleString('en-US')}`
    }
    return formatPrice(priceUsd)
  }

  const openCheckoutSheet = (planSlug: Exclude<SubscriptionPlanId, 'free'>) => {
    setCheckoutPlanId(planSlug)
    setErrorMsg(null)
    setReceipt(null)
    setAccountInput('')
  }

  const closeCheckoutSheet = () => {
    setCheckoutPlanId(null)
    setErrorMsg(null)
    setReceipt(null)
  }

  const handlePayAndActivate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!checkoutPlanId || !selectedPlan) return
    setErrorMsg(null)

    if (turnstileEnabled && !captchaToken) {
      setErrorMsg(
        ui(
          'Please complete the security check before activating.',
          'Tafadhali kamilisha uthibitisho wa usalama kabla ya kuendelea.',
          'Por favor completa la verificación de seguridad antes de continuar.',
        ),
      )
      return
    }

    setSubmitting(true)
    try {
      const activeProvider =
        channel === 'mobile_money' ? mobileNetwork : bankProvider
      const payCurrency =
        currency === 'TZS' || currency === 'USD' || currency === 'EUR'
          ? currency
          : 'TZS'

      const res = await activateSubscriptionDirect({
        planId: checkoutPlanId,
        channel,
        provider: activeProvider,
        accountInput,
        currency: payCurrency,
        turnstileToken: captchaToken || undefined,
      })

      if (!res.ok) {
        setErrorMsg(
          res.error || 'Could not activate subscription. Please try again.',
        )
        return
      }

      setReceipt({
        planName: res.planName || selectedPlan.name,
        referenceCode: res.referenceCode || 'MC-ACTIVE',
        paymentMethod: res.paymentMethod || activeProvider,
        amount:
          res.amount ??
          (payCurrency === 'TZS'
            ? selectedPlan.price_tzs
            : selectedPlan.price_usd),
        currency: res.currency || payCurrency,
        expiresAt:
          res.expiresAt ||
          new Date(Date.now() + 30 * 86_400_000).toISOString(),
      })
      setAccountInput('')
    } finally {
      setSubmitting(false)
      setCaptchaToken('')
      setTurnstileResetKey((k) => k + 1)
      turnstileRef.current?.reset()
    }
  }

  return (
    <div className="min-h-screen bg-paper pt-[72px] text-ink">
      {/* Masthead */}
      <section className="px-5 pb-12 pt-14 text-center lg:px-8">
        <p className="eyebrow mb-3 text-ochre">
          {ui(
            'Institutional Subscriptions & Entitlements',
            'Mipango ya Uanachama na Haki za Matumizi',
            'Suscripciones Institucionales y Acceso',
          )}
        </p>
        <h1 className="font-display mx-auto max-w-3xl text-4xl font-light leading-[1.04] sm:text-5xl md:text-6xl">
          {t('pricing.titlePre')}
          <em className="italic text-ochre">{t('pricing.titleEm')}</em>
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-base text-stone sm:text-lg">
          {ui(
            'Select a plan, enter your Mobile Money or Bank/Card details, and activate immediately for 30 days.',
            'Chagua mpango, weka taarifa za Simu au Benki/Kadi, na uwashe papo hapo kwa siku 30.',
            'Elige tu plan, ingresa tus datos de Dinero Móvil o Banco/Tarjeta y actívalo de inmediato por 30 días.',
          )}
        </p>

        {/* Active / Dormant / Free Account Status Pill */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-ochre/30 bg-ochre/10 px-4 py-1.5 font-mono text-xs text-ochre">
            <Crown size={13} />
            {ui('Account Tier:', 'Mpango Wako:', 'Plan Actual:')}{' '}
            <strong>{activePlan.name}</strong>
            <span
              className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                accountState === 'active'
                  ? 'bg-moss text-paper'
                  : accountState === 'dormant'
                    ? 'bg-danger text-paper'
                    : 'bg-ink text-gold'
              }`}
            >
              {accountState}
            </span>
          </div>
        </div>
      </section>

      {/* 3-Tier Editorial Pricing Cards */}
      <section className="px-5 pb-16 lg:px-8">
        <div className="mx-auto grid max-w-6xl gap-6 md:grid-cols-3">
          {plans.map((p) => {
            const planSlug = normalizePlanId(p.id)
            const isHighlighted = planSlug === 'pro'
            const isCurrent =
              activePlanId === planSlug && (planSlug === 'free' || isPaidActive)
            const bullets = PLAN_FEATURE_BULLETS[planSlug]
            const priceLabel = formatPlanPrice(p.price_tzs, p.price_usd)

            return (
              <article
                key={p.id}
                id={p.id}
                className={`relative flex min-w-0 flex-col rounded-2xl border p-6 transition duration-200 sm:p-7 ${
                  isHighlighted
                    ? 'border-ink bg-ink text-paper shadow-lg'
                    : 'border-ink/15 bg-white shadow-xs hover:border-ochre/50'
                }`}
              >
                {isHighlighted && (
                  <span className="absolute -top-3 left-6 rounded-full bg-gold px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-ink">
                    {ui('Most Popular', 'Chaguo Bora', 'Más Popular')}
                  </span>
                )}
                {isCurrent && (
                  <span className="absolute -top-3 right-6 rounded-full bg-moss px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-paper">
                    {ui('Current Plan', 'Mpango Wako', 'Plan Actual')}
                  </span>
                )}

                <span
                  className={`font-mono text-[10px] font-semibold uppercase tracking-[0.16em] ${
                    isHighlighted ? 'text-gold' : 'text-ochre'
                  }`}
                >
                  {planSlug === 'free'
                    ? 'TIER 01 · FREE'
                    : planSlug === 'pro'
                      ? 'TIER 02 · OPERATOR'
                      : 'TIER 03 · INSTITUTIONAL'}
                </span>

                <h2 className="mt-1.5 font-display text-3xl font-medium">
                  {p.name}
                </h2>
                <p
                  className={`mt-1.5 text-sm leading-relaxed ${
                    isHighlighted ? 'text-paper/70' : 'text-stone'
                  }`}
                >
                  {p.tagline}
                </p>

                <div className="mt-6 flex items-baseline gap-1.5">
                  <span className="font-mono text-3xl font-bold tracking-tight tabular-nums sm:text-4xl">
                    {priceLabel}
                  </span>
                  {p.price_tzs > 0 && (
                    <span
                      className={`font-mono text-xs ${
                        isHighlighted ? 'text-paper/65' : 'text-stone'
                      }`}
                    >
                      {ui('/month', '/mwezi', '/mes')}
                    </span>
                  )}
                </div>

                {p.price_tzs > 0 && (
                  <p
                    className={`mt-1 font-mono text-[11px] tabular-nums ${
                      isHighlighted ? 'text-paper/55' : 'text-stone'
                    }`}
                  >
                    {currency === 'TZS'
                      ? `≈ US$${p.price_usd.toLocaleString('en-US')}/mo`
                      : `TSh ${p.price_tzs.toLocaleString('en-US')}/mo`}
                  </p>
                )}

                <dl
                  className={`mt-5 grid grid-cols-2 gap-2 rounded-xl border p-3 font-mono text-[11px] ${
                    isHighlighted
                      ? 'border-paper/12 bg-ink-2'
                      : 'border-ink/10 bg-paper-2/70'
                  }`}
                >
                  <div>
                    <dt
                      className={`text-[9.5px] uppercase ${
                        isHighlighted ? 'text-paper/55' : 'text-stone'
                      }`}
                    >
                      {ui('Project Listings', 'Miradi', 'Proyectos')}
                    </dt>
                    <dd className="mt-0.5 font-bold tabular-nums">
                      {p.max_active_listings < 0
                        ? ui('Unlimited', 'Bila Kikomo', 'Ilimitado')
                        : p.max_active_listings}
                    </dd>
                  </div>
                  <div
                    className={`border-l pl-2 ${
                      isHighlighted ? 'border-paper/12' : 'border-ink/10'
                    }`}
                  >
                    <dt
                      className={`text-[9.5px] uppercase ${
                        isHighlighted ? 'text-paper/55' : 'text-stone'
                      }`}
                    >
                      {ui('Monthly RFQs', 'Maombi / Mwezi', 'RFQs / Mes')}
                    </dt>
                    <dd className="mt-0.5 font-bold tabular-nums">
                      {p.max_monthly_rfqs < 0
                        ? ui('Unlimited', 'Bila Kikomo', 'Ilimitado')
                        : `${p.max_monthly_rfqs}/mo`}
                    </dd>
                  </div>
                </dl>

                <ul className="mt-5 flex-1 space-y-2.5 text-sm">
                  {bullets.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <Check
                        size={15}
                        className={`mt-0.5 shrink-0 ${
                          isHighlighted ? 'text-gold' : 'text-moss'
                        }`}
                      />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-7">
                  {planSlug === 'free' ? (
                    <Link
                      to={session ? '/dashboard' : '/signup'}
                      className="btn-ghost w-full justify-center"
                    >
                      {session
                        ? ui('Included Free', 'Imejumuishwa Bure', 'Incluido Gratis')
                        : ui('Create Free Account', 'Fungua Akaunti Bure', 'Crear Cuenta Gratis')}
                    </Link>
                  ) : (
                    <button
                      type="button"
                      onClick={() => openCheckoutSheet(planSlug)}
                      className={`${
                        isHighlighted ? 'btn-primary' : 'btn-ghost'
                      } w-full justify-center`}
                    >
                      <Zap size={14} />
                      {isCurrent
                        ? ui('Extend 30 Days', 'Ongeza Siku 30', 'Extender 30 Días')
                        : ui(`Select ${p.name}`, `Chagua ${p.name}`, `Elegir ${p.name}`)}
                      <ArrowRight size={14} />
                    </button>
                  )}
                </div>
              </article>
            )
          })}
        </div>
      </section>

      {/* Platform Fees & Statutory Distinction Table */}
      <section className="border-t border-ink/10 bg-paper-2 px-5 py-16 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="font-display text-3xl font-light sm:text-4xl">
                {t('pricing.feesTitle')}
              </h2>
              <p className="mt-2 text-stone">{t('pricing.feesSubtitle')}</p>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-ink/15 bg-white px-3.5 py-1.5 font-mono text-xs text-stone">
              <ShieldCheck size={14} className="text-moss" />
              {ui(
                'Platform Fees Separate from Mining Commission Statutory Fees',
                'Ada za Jukwaa ni Tofauti na Ada za Kisheria za Tume ya Madini',
                'Tarifas de Plataforma Separadas de Tasas Gubernamentales',
              )}
            </span>
          </div>

          <div className="mt-8 overflow-x-auto rounded-xl border border-ink/10 bg-white/70">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-ink/10 font-mono text-[11px] uppercase tracking-wider text-stone">
                  <th className="px-5 py-4 font-normal">{t('pricing.col.product')}</th>
                  <th className="px-5 py-4 font-normal">{t('pricing.col.price')}</th>
                  <th className="px-5 py-4 font-normal">{t('pricing.col.customer')}</th>
                  <th className="px-5 py-4 font-normal">{t('pricing.col.basis')}</th>
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
            className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-ochre hover:underline"
          >
            {t('pricing.faqLink')} <ArrowRight size={15} />
          </Link>
        </div>
      </section>

      {/* DIRECT 2-STEP SINGLE-SCREEN CHECKOUT SHEET (Select Plan -> Enter Details -> Pay & Activate Now) */}
      {selectedPlan && checkoutPlanId && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Activate ${selectedPlan.name}`}
          className="fixed inset-0 z-[80] flex items-end justify-center p-0 sm:items-center sm:p-4"
        >
          <div
            className="absolute inset-0 bg-ink/70 backdrop-blur-xs animate-fade"
            onClick={closeCheckoutSheet}
          />
          <div className="relative z-10 max-h-[92vh] w-full overflow-y-auto rounded-t-2xl border border-ink/15 bg-paper text-ink shadow-2xl animate-rise sm:max-w-lg sm:rounded-2xl">
            {/* Sheet Header */}
            <div className="flex items-start justify-between gap-3 border-b border-ink/10 bg-ink px-5 py-4 text-paper sm:px-6">
              <div className="min-w-0">
                <div className="flex items-center gap-2 font-mono text-[10px] font-semibold uppercase tracking-widest text-gold">
                  <Zap size={11} />
                  {ui('Direct Instant Activation', 'Uwezeshaji wa Papo Hapo', 'Activación Directa')}
                </div>
                <h2 className="mt-0.5 font-display text-2xl font-medium">
                  {selectedPlan.name}
                </h2>
                <p className="mt-0.5 font-mono text-xs text-paper/75 tabular-nums">
                  {formatPlanPrice(selectedPlan.price_tzs, selectedPlan.price_usd)}
                  {ui(' / 30 days', ' / siku 30', ' / 30 días')}
                  {currency !== 'TZS' &&
                    ` · TSh ${selectedPlan.price_tzs.toLocaleString('en-US')}`}
                </p>
              </div>
              <button
                type="button"
                onClick={closeCheckoutSheet}
                aria-label="Close checkout"
                className="rounded-full border border-paper/15 bg-paper/10 p-1.5 text-paper/80 transition hover:border-gold hover:text-gold"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-5 sm:p-6">
              {!session ? (
                <div className="py-4 text-center">
                  <Lock size={28} className="mx-auto text-ochre" />
                  <h3 className="mt-3 font-display text-2xl text-ink">
                    {ui('Sign In to Activate', 'Ingia ili Kuwezesha', 'Inicia Sesión')}
                  </h3>
                  <p className="mt-1.5 text-sm text-stone">
                    {ui(
                      'Sign in to your MineConnect account so your 30-day entitlements unlock immediately.',
                      'Ingia kwenye akaunti yako ya MineConnect ili haki zako zifunguliwe papo hapo.',
                      'Inicia sesión para activar tus permisos de 30 días al instante.',
                    )}
                  </p>
                  <Link
                    to="/login"
                    search={{
                      next: `/pricing?plan=${checkoutPlanId}&checkout=1`,
                      reason: 'membership_required',
                    } as unknown as undefined}
                    className="btn-primary mt-5 w-full justify-center"
                  >
                    {ui('Sign In & Continue', 'Ingia Kuendelea', 'Iniciar Sesión')}
                  </Link>
                </div>
              ) : receipt ? (
                /* Instant Activation Success Confirmation */
                <div className="py-2 text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-moss-light text-moss">
                    <CheckCircle2 size={28} />
                  </div>
                  <span className="mt-3 inline-block rounded-full bg-moss-light px-3 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-moss">
                    {ui('Subscription Active · 30 Days', 'Mpango Hai · Siku 30', 'Suscripción Activa · 30 Días')}
                  </span>
                  <h3 className="mt-2 font-display text-3xl font-medium text-ink">
                    {receipt.planName} {ui('Unlocked!', 'Imefunguliwa!', '¡Activado!')}
                  </h3>
                  <p className="mt-1 text-xs text-stone">
                    {ui(
                      'Your entitlements are live across MineConnect immediately.',
                      'Haki zako za mpango zinafanya kazi mara moja kwenye MineConnect.',
                      'Tus permisos ya están activos en toda la plataforma.',
                    )}
                  </p>

                  <dl className="mt-5 grid grid-cols-2 gap-3 rounded-xl border border-ink/10 bg-paper-2 p-4 text-left font-mono text-xs">
                    <div>
                      <dt className="text-[10px] uppercase text-stone">Reference</dt>
                      <dd className="mt-0.5 font-bold text-ink">{receipt.referenceCode}</dd>
                    </div>
                    <div>
                      <dt className="text-[10px] uppercase text-stone">Channel</dt>
                      <dd className="mt-0.5 truncate text-ink">{receipt.paymentMethod}</dd>
                    </div>
                    <div>
                      <dt className="text-[10px] uppercase text-stone">Amount</dt>
                      <dd className="mt-0.5 font-bold text-moss tabular-nums">
                        {receipt.currency} {receipt.amount.toLocaleString('en-US')}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[10px] uppercase text-stone">Valid Until</dt>
                      <dd className="mt-0.5 font-bold text-ink tabular-nums">
                        {new Date(receipt.expiresAt).toLocaleDateString()}
                      </dd>
                    </div>
                  </dl>

                  <div className="mt-6 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                    <Link
                      to="/list-a-project"
                      onClick={closeCheckoutSheet}
                      className="btn-primary justify-center text-xs"
                    >
                      {ui('List a Project', 'Sajili Mradi', 'Publicar Proyecto')}
                      <ArrowRight size={14} />
                    </Link>
                    <Link
                      to="/dashboard"
                      onClick={closeCheckoutSheet}
                      className="btn-ghost justify-center text-xs"
                    >
                      {ui('Open Workspace', 'Fungua Dashibodi', 'Abrir Panel')}
                    </Link>
                  </div>
                </div>
              ) : (
                /* Clean 2-Option Payment Form (No Receipt Uploads, Single Pay & Activate Button) */
                <form onSubmit={handlePayAndActivate} className="space-y-4">
                  {/* Switch between Option A (Mobile Money) and Option B (Bank / Card) */}
                  <div className="grid grid-cols-2 gap-2 rounded-xl border border-ink/12 bg-paper-2 p-1">
                    <button
                      type="button"
                      onClick={() => {
                        setChannel('mobile_money')
                        setAccountInput('')
                        setErrorMsg(null)
                      }}
                      className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 font-mono text-[11px] font-semibold transition ${
                        channel === 'mobile_money'
                          ? 'bg-ink text-gold shadow-xs'
                          : 'text-stone hover:text-ink'
                      }`}
                    >
                      <Smartphone size={13} />
                      {ui('Mobile Money', 'Pesa za Simu', 'Dinero Móvil')}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setChannel('bank_card')
                        setAccountInput('')
                        setErrorMsg(null)
                      }}
                      className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 font-mono text-[11px] font-semibold transition ${
                        channel === 'bank_card'
                          ? 'bg-ink text-gold shadow-xs'
                          : 'text-stone hover:text-ink'
                      }`}
                    >
                      <CreditCard size={13} />
                      {ui('Bank / Card', 'Benki / Kadi', 'Banco / Tarjeta')}
                    </button>
                  </div>

                  {channel === 'mobile_money' ? (
                    <>
                      <div>
                        <span className="label">
                          {ui('Select Network (Tanzania)', 'Chagua Mtandao', 'Seleccionar Red')}
                        </span>
                        <div className="grid grid-cols-2 gap-2">
                          {MOBILE_MONEY_NETWORKS.map((net) => {
                            const active = mobileNetwork === net
                            return (
                              <button
                                key={net}
                                type="button"
                                onClick={() => setMobileNetwork(net)}
                                className={`rounded-lg border px-3 py-2.5 text-left font-mono text-xs font-semibold transition ${
                                  active
                                    ? 'border-ochre bg-ochre/12 text-ink ring-1 ring-ochre/40'
                                    : 'border-ink/15 bg-white text-stone hover:border-ink/35 hover:text-ink'
                                }`}
                              >
                                {net}
                              </button>
                            )
                          })}
                        </div>
                      </div>

                      <div>
                        <label className="label" htmlFor="mm-phone">
                          {ui('Mobile Money Phone Number', 'Namba ya Simu ya Malipo', 'Número de Teléfono')}
                        </label>
                        <input
                          id="mm-phone"
                          type="tel"
                          required
                          autoComplete="tel"
                          value={accountInput}
                          onChange={(e) => setAccountInput(e.target.value)}
                          placeholder="07XX XXX XXX"
                          className="field font-mono text-sm"
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <span className="label">
                          {ui('Select Bank or Card', 'Chagua Benki au Kadi', 'Banco o Tarjeta')}
                        </span>
                        <div className="grid grid-cols-2 gap-2">
                          {BANK_CARD_PROVIDERS.map((prov) => {
                            const active = bankProvider === prov
                            return (
                              <button
                                key={prov}
                                type="button"
                                onClick={() => setBankProvider(prov)}
                                className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2.5 text-left font-mono text-xs font-semibold transition ${
                                  active
                                    ? 'border-ochre bg-ochre/12 text-ink ring-1 ring-ochre/40'
                                    : 'border-ink/15 bg-white text-stone hover:border-ink/35 hover:text-ink'
                                }`}
                              >
                                <Building2 size={12} className="shrink-0 text-ochre" />
                                <span className="truncate">{prov}</span>
                              </button>
                            )
                          })}
                        </div>
                      </div>

                      <div>
                        <label className="label" htmlFor="bank-ref">
                          {ui(
                            'Account, Card, or Transfer Reference',
                            'Namba ya Akaunti, Kadi, au Kumbukumbu',
                            'Cuenta, Tarjeta o Referencia',
                          )}
                        </label>
                        <input
                          id="bank-ref"
                          type="text"
                          required
                          minLength={4}
                          value={accountInput}
                          onChange={(e) => setAccountInput(e.target.value)}
                          placeholder="e.g. NMB-EFT-88412 or 4532 •••• 9910"
                          className="field font-mono text-sm"
                        />
                      </div>
                    </>
                  )}

                  {turnstileEnabled && (
                    <TurnstileWidget
                      ref={turnstileRef}
                      action="subscription-payment"
                      resetKey={turnstileResetKey}
                      onVerify={setCaptchaToken}
                      onExpire={() => setCaptchaToken('')}
                    />
                  )}

                  {errorMsg && (
                    <div
                      role="alert"
                      className="rounded-xl border border-danger/35 bg-danger/10 px-3.5 py-2.5 text-xs font-medium text-danger"
                    >
                      {errorMsg}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={submitting}
                    className="btn-primary w-full justify-center py-3 text-sm disabled:opacity-60"
                  >
                    <Zap size={15} />
                    {submitting
                      ? ui('Activating Subscription...', 'Inawasha Mpango...', 'Activando...')
                      : ui('Pay & Activate Now', 'Lipa na Uwashe Sasa', 'Pagar y Activar Ahora')}
                  </button>

                  <p className="flex items-center justify-center gap-1.5 text-center font-mono text-[10px] text-stone">
                    <ShieldCheck size={12} className="text-moss" />
                    {ui(
                      'Activates immediately for 30 days · Logged securely in Supabase',
                      'Inawashwa papo hapo kwa siku 30 · Inarekodiwa kwa usalama',
                      'Activación inmediata por 30 días · Registro seguro en Supabase',
                    )}
                  </p>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
