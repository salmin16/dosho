import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import {
  ArrowRight,
  Building2,
  Check,
  CheckCircle2,
  Clock,
  CreditCard,
  Crown,
  Lock,
  ShieldCheck,
  Smartphone,
  Zap,
} from 'lucide-react'
import { useLocalization } from '../context/LocalizationContext'
import TurnstileWidget, {
  isTurnstileEnabled,
  type TurnstileWidgetHandle,
} from '../components/TurnstileWidget'
import {
  PLAN_FEATURE_BULLETS,
  initiateInstantSubscriptionCheckout,
  normalizePlanId,
  submitManualSubscriptionPayment,
  useSubscription,
} from '../lib/subscriptions'
import { useAuthState } from '../lib/supabaseAuth'
import type { SubscriptionPlanId } from '../types/database'

export const Route = createFileRoute('/pricing')({
  validateSearch: (
    s: Record<string, unknown>,
  ): { plan?: SubscriptionPlanId } => {
    const raw = typeof s.plan === 'string' ? s.plan.toLowerCase() : ''
    if (raw === 'free' || raw === 'pro' || raw === 'enterprise') {
      return { plan: raw }
    }
    return {}
  },
  head: () => ({ meta: [{ title: 'Membership & pricing — MineConnect' }] }),
  component: Pricing,
})

const MANUAL_PAYMENT_METHODS = [
  'M-Pesa Tanzania (Vodacom)',
  'Airtel Money Tanzania',
  'Mixx by Yas (Tigo Pesa)',
  'NMB Bank Corporate EFT',
  'CRDB Bank Corporate EFT',
] as const

function Pricing() {
  const { plan: initialPlanParam } = Route.useSearch()
  const { session } = useAuthState()
  const {
    plans,
    plan: activePlan,
    planId: activePlanId,
    isPaidActive,
    isExpired,
    pendingPayment,
    refreshSubscription,
  } = useSubscription()
  const { t, fixtures, currency, formatPrice, convertText, ui } =
    useLocalization()

  const [selectedPlanId, setSelectedPlanId] = useState<
    Exclude<SubscriptionPlanId, 'free'>
  >(() => (initialPlanParam === 'enterprise' ? 'enterprise' : 'pro'))
  const [activationMode, setActivationMode] = useState<'manual' | 'instant'>(
    'manual',
  )

  // Instant Gateway Hook State (AzamPay / Stripe -> verify-subscription Edge Function)
  const [instantProvider, setInstantProvider] = useState<'azampay' | 'stripe'>(
    'azampay',
  )
  const [instantContact, setInstantContact] = useState('')
  const [instantBusy, setInstantBusy] = useState(false)
  const [instantResult, setInstantResult] = useState<{
    referenceCode?: string
    message: string
    gatewayReady?: boolean
  } | null>(null)

  // Manual Corporate Mobile Money / NMB-CRDB EFT Verification Form State
  const [paymentMethod, setPaymentMethod] = useState<string>(
    MANUAL_PAYMENT_METHODS[0],
  )
  const [referenceCode, setReferenceCode] = useState('')
  const [receiptUrl, setReceiptUrl] = useState('')
  const [payerNotes, setPayerNotes] = useState('')
  const [captchaToken, setCaptchaToken] = useState('')
  const [turnstileResetKey, setTurnstileResetKey] = useState(0)
  const [submittingManual, setSubmittingManual] = useState(false)
  const [manualFeedback, setManualFeedback] = useState<{
    type: 'success' | 'error'
    message: string
  } | null>(null)

  const checkoutSectionRef = useRef<HTMLDivElement | null>(null)
  const turnstileRef = useRef<TurnstileWidgetHandle | null>(null)
  const turnstileEnabled = isTurnstileEnabled()

  useEffect(() => {
    if (initialPlanParam === 'pro' || initialPlanParam === 'enterprise') {
      setSelectedPlanId(initialPlanParam)
    }
  }, [initialPlanParam])

  const selectedPlan =
    plans.find((p) => p.id === selectedPlanId) ??
    plans.find((p) => p.id === 'pro') ??
    plans[0]

  const formatPlanPrice = (priceTzs: number, priceUsd: number) => {
    if (priceTzs === 0 && priceUsd === 0) {
      return ui('Free', 'Bure', 'Gratis')
    }
    if (currency === 'TZS') {
      return `TSh ${priceTzs.toLocaleString('en-US')}`
    }
    return formatPrice(priceUsd)
  }

  const handleSelectPlan = (id: SubscriptionPlanId) => {
    if (id === 'free') return
    setSelectedPlanId(id)
    setManualFeedback(null)
    setInstantResult(null)
    window.setTimeout(() => {
      checkoutSectionRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      })
    }, 50)
  }

  const handleInstantInitiate = async (e: React.FormEvent) => {
    e.preventDefault()
    setInstantBusy(true)
    setInstantResult(null)
    try {
      const res = await initiateInstantSubscriptionCheckout({
        planId: selectedPlanId,
        provider: instantProvider,
        phoneOrEmail: instantContact,
      })
      if (!res.ok) {
        setInstantResult({
          message: res.error || 'Unable to initiate checkout right now.',
        })
        return
      }
      if (res.referenceCode) {
        setReferenceCode(res.referenceCode)
      }
      setInstantResult({
        referenceCode: res.referenceCode,
        gatewayReady: res.gatewayReady,
        message:
          res.message ||
          'Checkout reference prepared. Complete settlement and verify below.',
      })
    } finally {
      setInstantBusy(false)
    }
  }

  const handleSubmitManualPayment = async (e: React.FormEvent) => {
    e.preventDefault()
    setManualFeedback(null)

    if (turnstileEnabled && !captchaToken) {
      setManualFeedback({
        type: 'error',
        message:
          'Please complete the security verification check before submitting your payment reference.',
      })
      return
    }

    setSubmittingManual(true)
    try {
      const amount =
        currency === 'TZS' ? selectedPlan.price_tzs : selectedPlan.price_usd
      const payCurrency = currency === 'TZS' ? 'TZS' : 'USD'

      const res = await submitManualSubscriptionPayment({
        planId: selectedPlanId,
        currency: payCurrency,
        amount,
        paymentMethod,
        referenceCode,
        receiptUrl,
        notes: payerNotes,
        turnstileToken: captchaToken,
      })

      if (!res.ok) {
        setManualFeedback({
          type: 'error',
          message:
            res.error || 'Could not record your payment reference. Please retry.',
        })
        return
      }

      setManualFeedback({
        type: 'success',
        message: `Payment reference ${referenceCode.trim()} received for ${selectedPlan.name}. Status: Pending Admin Verification — your tier will activate immediately once verified.`,
      })
      setReferenceCode('')
      setReceiptUrl('')
      setPayerNotes('')
      await refreshSubscription()
    } finally {
      setSubmittingManual(false)
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
            'Database-enforced quotas and verified membership access across Tanzania’s mineral markets, tenement listings, and JV deal rooms.',
            'Viwango vilivyothibitishwa vya ufikiaji wa soko la madini, usajili wa miradi, na vyumba vya nyaraka za uwekezaji.',
            'Cuotas verificadas y acceso institucional a los mercados minerales, proyectos y salas de datos de Tanzania.',
          )}
        </p>

        {/* Active Plan Status Pill */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-ochre/30 bg-ochre/10 px-4 py-1.5 font-mono text-xs text-ochre">
            <Crown size={13} />
            {ui('Your Active Plan:', 'Mpango Wako wa Sasa:', 'Tu Plan Activo:')}{' '}
            <strong>{activePlan.name}</strong>
            {isPaidActive && (
              <span className="rounded bg-moss px-1.5 py-0.5 text-[10px] font-bold text-paper">
                ACTIVE
              </span>
            )}
            {isExpired && (
              <span className="rounded bg-danger px-1.5 py-0.5 text-[10px] font-bold text-paper">
                EXPIRED
              </span>
            )}
          </div>

          {pendingPayment && (
            <div className="inline-flex items-center gap-1.5 rounded-full border border-gold/50 bg-ink px-3.5 py-1.5 font-mono text-[11px] text-gold">
              <Clock size={12} />
              {ui(
                `Pending Verification: Ref ${pendingPayment.reference_code}`,
                `Inasubiri Uhakiki: Ref ${pendingPayment.reference_code}`,
                `Pendiente: Ref ${pendingPayment.reference_code}`,
              )}
            </div>
          )}
        </div>
      </section>

      {/* 3-Tier Editorial Pricing Grid */}
      <section className="px-5 pb-14 lg:px-8">
        <div className="mx-auto grid max-w-6xl gap-6 md:grid-cols-3">
          {plans.map((p) => {
            const planSlug = normalizePlanId(p.id)
            const isHighlighted = planSlug === 'pro'
            const isSelected = selectedPlanId === planSlug
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
                    : isSelected
                      ? 'border-ochre bg-white shadow-md ring-1 ring-ochre/40'
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

                {/* Key Quotas Summary */}
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
                        ? ui('Included with Account', 'Imejumuishwa', 'Incluido')
                        : ui('Create Free Account', 'Fungua Akaunti Bure', 'Crear Cuenta Gratis')}
                    </Link>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleSelectPlan(planSlug)}
                      className={`${
                        isHighlighted || isSelected
                          ? 'btn-primary'
                          : 'btn-ghost'
                      } w-full justify-center`}
                    >
                      {isCurrent
                        ? ui('Renew / Extend Plan', 'Huisha Mpango', 'Renovar Plan')
                        : ui(`Activate ${p.name}`, `Washa ${p.name}`, `Activar ${p.name}`)}
                      <ArrowRight size={14} />
                    </button>
                  )}
                </div>
              </article>
            )
          })}
        </div>
      </section>

      {/* Dual Activation Checkout Section */}
      <section
        ref={checkoutSectionRef}
        id="subscription-checkout"
        className="scroll-mt-24 border-y border-ink/15 bg-paper-2 px-5 py-14 lg:px-8"
      >
        <div className="mx-auto max-w-5xl">
          <div className="flex flex-col justify-between gap-4 border-b border-ink/10 pb-6 sm:flex-row sm:items-end">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-ochre/30 bg-ochre/10 px-3 py-1 font-mono text-[10.5px] font-semibold uppercase tracking-wider text-ochre">
                <Lock size={11} />
                {ui(
                  'Verified Subscription Activation',
                  'Uwezeshaji wa Mpango Uliohakikiwa',
                  'Activación Verificada de Suscripción',
                )}
              </span>
              <h2 className="mt-2 font-display text-3xl font-light text-ink">
                {ui('Activate', 'Washa', 'Activar')}{' '}
                <em className="italic text-ochre">{selectedPlan.name}</em>{' '}
                <span className="font-mono text-lg font-semibold text-ink tabular-nums">
                  ({formatPlanPrice(selectedPlan.price_tzs, selectedPlan.price_usd)}
                  {ui('/mo', '/mwezi', '/mes')})
                </span>
              </h2>
            </div>

            {/* Plan Switcher Pill */}
            <div className="inline-flex rounded-lg border border-ink/15 bg-white p-1">
              {(['pro', 'enterprise'] as const).map((pid) => {
                const candidate = plans.find((x) => x.id === pid)
                if (!candidate) return null
                const active = selectedPlanId === pid
                return (
                  <button
                    key={pid}
                    type="button"
                    onClick={() => {
                      setSelectedPlanId(pid)
                      setManualFeedback(null)
                      setInstantResult(null)
                    }}
                    className={`rounded-md px-3.5 py-1.5 font-mono text-xs font-semibold transition ${
                      active ? 'bg-ink text-gold' : 'text-stone hover:text-ink'
                    }`}
                  >
                    {candidate.name}
                  </button>
                )
              })}
            </div>
          </div>

          {!session ? (
            <div className="mt-6 rounded-2xl border border-ochre/30 bg-white p-8 text-center shadow-xs">
              <Lock size={26} className="mx-auto text-ochre" />
              <h3 className="mt-3 font-display text-2xl text-ink">
                {ui(
                  'Sign In to Activate Your Subscription',
                  'Ingia ili Kuwezesha Mpango Wako',
                  'Inicia Sesión para Activar tu Suscripción',
                )}
              </h3>
              <p className="mx-auto mt-2 max-w-md text-sm text-stone">
                {ui(
                  'Sign in to bind verified entitlements, project listing quotas, and monthly RFQs directly to your MineConnect account.',
                  'Ingia kwenye akaunti yako ili kuunganisha haki za mpango na kikomo cha miradi moja kwa moja.',
                  'Inicia sesión para vincular los permisos y cuotas directamente a tu cuenta de MineConnect.',
                )}
              </p>
              <Link
                to="/login"
                search={{ next: '/pricing', reason: 'membership_required' } as unknown as undefined}
                className="btn-primary mt-5 inline-flex"
              >
                {ui('Sign In to Continue', 'Ingia Kuendelea', 'Iniciar Sesión')}
              </Link>
            </div>
          ) : (
            <div className="mt-6 space-y-5">
              {/* Two Clean Activation Paths Switcher */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setActivationMode('manual')}
                  className={`flex items-start gap-3 rounded-xl border p-4 text-left transition ${
                    activationMode === 'manual'
                      ? 'border-ink bg-ink text-paper shadow-sm'
                      : 'border-ink/15 bg-white text-ink hover:border-ochre/50'
                  }`}
                >
                  <Building2
                    size={18}
                    className={
                      activationMode === 'manual'
                        ? 'mt-0.5 shrink-0 text-gold'
                        : 'mt-0.5 shrink-0 text-ochre'
                    }
                  />
                  <div>
                    <div className="font-semibold text-sm">
                      {ui(
                        'Corporate Mobile Money / NMB-CRDB EFT',
                        'Simu (M-Pesa / Airtel) au Benki (NMB / CRDB)',
                        'Dinero Móvil / Transferencia NMB-CRDB',
                      )}
                    </div>
                    <p
                      className={`mt-0.5 text-xs ${
                        activationMode === 'manual' ? 'text-paper/70' : 'text-stone'
                      }`}
                    >
                      {ui(
                        'Submit transfer reference + receipt (Turnstile-verified) for immediate Admin approval.',
                        'Wasilisha kumbukumbu ya malipo na risiti kwa uhakiki wa haraka wa Utawala.',
                        'Envía tu referencia y recibo para activación rápida por el administrador.',
                      )}
                    </p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setActivationMode('instant')}
                  className={`flex items-start gap-3 rounded-xl border p-4 text-left transition ${
                    activationMode === 'instant'
                      ? 'border-ink bg-ink text-paper shadow-sm'
                      : 'border-ink/15 bg-white text-ink hover:border-ochre/50'
                  }`}
                >
                  <Zap
                    size={18}
                    className={
                      activationMode === 'instant'
                        ? 'mt-0.5 shrink-0 text-gold'
                        : 'mt-0.5 shrink-0 text-ochre'
                    }
                  />
                  <div>
                    <div className="font-semibold text-sm">
                      {ui(
                        'Instant Gateway Hook (AzamPay / Stripe)',
                        'Malipo ya Papo Hapo (AzamPay / Stripe)',
                        'Pasarela Instantánea (AzamPay / Stripe)',
                      )}
                    </div>
                    <p
                      className={`mt-0.5 text-xs ${
                        activationMode === 'instant' ? 'text-paper/70' : 'text-stone'
                      }`}
                    >
                      {ui(
                        'Automated webhook verification via Supabase verify-subscription Edge Function.',
                        'Uthibitishaji wa moja kwa moja kupitia Edge Function ya verify-subscription.',
                        'Verificación automática mediante la función Edge verify-subscription.',
                      )}
                    </p>
                  </div>
                </button>
              </div>

              {/* Path A: Corporate Mobile Money / NMB-CRDB EFT Verification Form */}
              {activationMode === 'manual' ? (
                <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
                  {/* Official Tanzania Settlement Instructions */}
                  <div className="rounded-2xl border border-ink/12 bg-ink p-5 text-paper sm:p-6">
                    <span className="font-mono text-[10px] font-semibold uppercase tracking-widest text-gold">
                      {ui('Settlement Accounts', 'Akaunti za Malipo', 'Cuentas de Liquidación')}
                    </span>
                    <h3 className="mt-1.5 font-display text-2xl font-light">
                      {ui(
                        'Tanzania Corporate Settlement Desk',
                        'Dawati la Malipo Tanzania',
                        'Mesa de Liquidación Tanzania',
                      )}
                    </h3>

                    <div className="mt-4 space-y-3 font-mono text-xs">
                      <div className="rounded-xl border border-paper/12 bg-ink-2 p-3.5">
                        <div className="flex items-center gap-1.5 text-[10px] uppercase text-gold">
                          <Smartphone size={12} /> Mobile Money Lipa / Paybill
                        </div>
                        <div className="mt-1.5 text-paper">
                          M-Pesa / Airtel Money / Mixx by Yas
                        </div>
                        <div className="mt-0.5 text-paper/75">
                          Merchant: <strong className="text-paper">MineConnect Tanzania Ltd</strong>
                        </div>
                        <div className="mt-0.5 text-paper/75">
                          Amount:{' '}
                          <strong className="text-gold">
                            TSh {selectedPlan.price_tzs.toLocaleString('en-US')}
                          </strong>{' '}
                          (US${selectedPlan.price_usd})
                        </div>
                      </div>

                      <div className="rounded-xl border border-paper/12 bg-ink-2 p-3.5">
                        <div className="flex items-center gap-1.5 text-[10px] uppercase text-gold">
                          <Building2 size={12} /> NMB / CRDB Corporate EFT
                        </div>
                        <div className="mt-1.5 text-paper/80">
                          Bank: <strong className="text-paper">NMB Bank Plc / CRDB Bank Plc</strong>
                        </div>
                        <div className="mt-0.5 text-paper/75">
                          Beneficiary: <strong className="text-paper">MineConnect Mining Desk</strong>
                        </div>
                        <div className="mt-0.5 text-paper/75">
                          Narrative:{' '}
                          <strong className="text-gold">
                            {selectedPlan.id.toUpperCase()} · {session.user.email}
                          </strong>
                        </div>
                      </div>
                    </div>

                    <p className="mt-4 flex items-start gap-2 text-[11px] leading-relaxed text-paper/65">
                      <ShieldCheck size={14} className="mt-0.5 shrink-0 text-gold" />
                      <span>
                        {ui(
                          'Once submitted, your payment enters Pending Verification in our Admin Billing Console. Verified transfers activate immediately for 30 days.',
                          'Ukishawasilisha, malipo yako yanaingia kwenye foleni ya Uhakiki wa Utawala na kuwashwa mara moja kwa siku 30.',
                          'Al enviar, el pago pasa a verificación administrativa y se activa de inmediato por 30 días.',
                        )}
                      </span>
                    </p>
                  </div>

                  {/* Turnstile-Protected Verification Submission Form */}
                  <form
                    onSubmit={handleSubmitManualPayment}
                    className="rounded-2xl border border-ink/15 bg-white p-5 shadow-xs sm:p-6"
                  >
                    <h3 className="font-display text-2xl text-ink">
                      {ui(
                        'Submit Payment Reference for Activation',
                        'Wasilisha Kumbukumbu ya Malipo',
                        'Enviar Referencia de Pago',
                      )}
                    </h3>
                    <p className="mt-1 text-xs text-stone">
                      {ui(
                        'Enter your M-Pesa/Airtel transaction ID or NMB/CRDB bank EFT reference code.',
                        'Weka namba ya muamala wa M-Pesa/Airtel au kumbukumbu ya benki NMB/CRDB.',
                        'Ingresa el código de transacción móvil o referencia bancaria.',
                      )}
                    </p>

                    <div className="mt-4 space-y-3.5">
                      <div>
                        <label className="label" htmlFor="pay-method">
                          {ui('Payment Channel', 'Njia ya Malipo', 'Canal de Pago')}
                        </label>
                        <select
                          id="pay-method"
                          value={paymentMethod}
                          onChange={(e) => setPaymentMethod(e.target.value)}
                          className="field"
                        >
                          {MANUAL_PAYMENT_METHODS.map((m) => (
                            <option key={m} value={m}>
                              {m}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="label" htmlFor="pay-ref">
                          {ui(
                            'Transaction Reference / EFT Slip Code *',
                            'Namba ya Muamala / Kumbukumbu *',
                            'Código de Referencia *',
                          )}
                        </label>
                        <input
                          id="pay-ref"
                          type="text"
                          required
                          minLength={4}
                          value={referenceCode}
                          onChange={(e) => setReferenceCode(e.target.value)}
                          placeholder="e.g. QK82M94X21 or NMB-EFT-2026-8841"
                          className="field font-mono text-xs"
                        />
                      </div>

                      <div>
                        <label className="label" htmlFor="pay-receipt">
                          {ui(
                            'Receipt / Bank Slip URL (Optional)',
                            'Kiungo cha Risiti (Si Lazima)',
                            'URL del Comprobante (Opcional)',
                          )}
                        </label>
                        <input
                          id="pay-receipt"
                          type="url"
                          value={receiptUrl}
                          onChange={(e) => setReceiptUrl(e.target.value)}
                          placeholder="https://..."
                          className="field text-xs"
                        />
                      </div>

                      <div>
                        <label className="label" htmlFor="pay-notes">
                          {ui('Payer Name / Company Note (Optional)', 'Jina la Mlipaji / Kampuni', 'Nombre / Empresa (Opcional)')}
                        </label>
                        <input
                          id="pay-notes"
                          type="text"
                          value={payerNotes}
                          onChange={(e) => setPayerNotes(e.target.value)}
                          placeholder={session.user.fullName || 'Company or sender phone'}
                          className="field text-xs"
                        />
                      </div>

                      {turnstileEnabled && (
                        <TurnstileWidget
                          ref={turnstileRef}
                          action="subscription-payment"
                          resetKey={turnstileResetKey}
                          onVerify={setCaptchaToken}
                          onExpire={() => setCaptchaToken('')}
                        />
                      )}

                      {manualFeedback && (
                        <div
                          role="status"
                          className={`flex items-start gap-2 rounded-xl border px-3.5 py-2.5 text-xs font-medium ${
                            manualFeedback.type === 'success'
                              ? 'border-moss/40 bg-moss-light text-moss'
                              : 'border-danger/40 bg-danger/10 text-danger'
                          }`}
                        >
                          {manualFeedback.type === 'success' && (
                            <CheckCircle2 size={15} className="mt-0.5 shrink-0" />
                          )}
                          <span>{manualFeedback.message}</span>
                        </div>
                      )}

                      <button
                        type="submit"
                        disabled={submittingManual}
                        className="btn-primary w-full justify-center disabled:opacity-60"
                      >
                        {submittingManual
                          ? ui('Submitting Verification...', 'Inawasilisha...', 'Enviando...')
                          : ui(
                              `Submit ${selectedPlan.name} Payment Reference`,
                              `Wasilisha Malipo ya ${selectedPlan.name}`,
                              `Enviar Referencia (${selectedPlan.name})`,
                            )}
                      </button>
                    </div>
                  </form>
                </div>
              ) : (
                /* Path B: Instant AzamPay / Stripe Webhook Hook */
                <form
                  onSubmit={handleInstantInitiate}
                  className="rounded-2xl border border-ink/15 bg-white p-6 shadow-xs"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="font-display text-2xl text-ink">
                        {ui(
                          'Instant Gateway Activation (AzamPay / Stripe)',
                          'Malipo ya Papo Hapo (AzamPay / Stripe)',
                          'Activación Instantánea (AzamPay / Stripe)',
                        )}
                      </h3>
                      <p className="mt-1 text-xs text-stone">
                        {ui(
                          'Connected to the Supabase verify-subscription Edge Function for cryptographic webhook activation.',
                          'Imeunganishwa na Supabase verify-subscription Edge Function kwa uthibitishaji wa kiotomatiki.',
                          'Conectado a la función Edge verify-subscription para activación automática por webhook.',
                        )}
                      </p>
                    </div>
                    <div className="inline-flex rounded-lg border border-ink/15 bg-paper-2 p-1">
                      <button
                        type="button"
                        onClick={() => setInstantProvider('azampay')}
                        className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 font-mono text-xs font-semibold transition ${
                          instantProvider === 'azampay'
                            ? 'bg-ink text-gold'
                            : 'text-stone hover:text-ink'
                        }`}
                      >
                        <Smartphone size={12} /> AzamPay (TZS)
                      </button>
                      <button
                        type="button"
                        onClick={() => setInstantProvider('stripe')}
                        className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 font-mono text-xs font-semibold transition ${
                          instantProvider === 'stripe'
                            ? 'bg-ink text-gold'
                            : 'text-stone hover:text-ink'
                        }`}
                      >
                        <CreditCard size={12} /> Stripe (USD/EUR)
                      </button>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
                    <div>
                      <label className="label" htmlFor="instant-contact">
                        {instantProvider === 'azampay'
                          ? ui('Tanzania Mobile Money Number (+255)', 'Namba ya Simu (+255)', 'Teléfono Móvil (+255)')
                          : ui('Billing Email for Card Receipt', 'Barua Pepe ya Risiti', 'Correo de Facturación')}
                      </label>
                      <input
                        id="instant-contact"
                        type={instantProvider === 'azampay' ? 'tel' : 'email'}
                        required
                        value={instantContact}
                        onChange={(e) => setInstantContact(e.target.value)}
                        placeholder={
                          instantProvider === 'azampay'
                            ? '+255 7XX XXX XXX'
                            : session.user.email
                        }
                        className="field"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={instantBusy}
                      className="btn-primary h-11 px-6 disabled:opacity-60"
                    >
                      <Zap size={14} />
                      {instantBusy
                        ? ui('Connecting...', 'Inaunganisha...', 'Conectando...')
                        : ui('Initialize Checkout', 'Anza Malipo', 'Iniciar Pago')}
                    </button>
                  </div>

                  {instantResult && (
                    <div className="mt-4 rounded-xl border border-ochre/30 bg-paper p-4 text-xs text-ink">
                      <p className="font-medium">{instantResult.message}</p>
                      {instantResult.referenceCode && !instantResult.gatewayReady && (
                        <button
                          type="button"
                          onClick={() => setActivationMode('manual')}
                          className="mt-2.5 inline-flex items-center gap-1 font-mono text-[11px] font-semibold text-ochre underline"
                        >
                          {ui(
                            `Continue with Reference ${instantResult.referenceCode} via Mobile Money / Bank EFT`,
                            `Endelea na Kumbukumbu ${instantResult.referenceCode}`,
                            `Continuar con Referencia ${instantResult.referenceCode}`,
                          )}
                          <ArrowRight size={12} />
                        </button>
                      )}
                    </div>
                  )}
                </form>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Platform Fees & Statutory Distinction Table */}
      <section className="bg-paper px-5 py-16 lg:px-8">
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
    </div>
  )
}
