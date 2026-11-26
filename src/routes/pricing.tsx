import { createFileRoute, Link } from '@tanstack/react-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  AlertCircle,
  ArrowRight,
  Building2,
  Check,
  CheckCircle2,
  CreditCard,
  Crown,
  Loader2,
  Lock,
  RefreshCw,
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
  fetchAzamPayTransactionStatus,
  initiateAzamPayCheckout,
  normalizePlanId,
  resolveForcedTzsAmountForPlan,
  subscribeToAzamPayTransaction,
  syncSubscriptionAfterPayment,
  useSubscription,
  type AzamPayProviderCode,
} from '../lib/subscriptions'
import { useAuthState } from '../lib/supabaseAuth'
import { formatTanzaniaPhoneDisplay } from '../lib/phoneFormat'
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

const MOBILE_MONEY_NETWORKS: ReadonlyArray<{
  code: AzamPayProviderCode
  label: string
  sublabel: string
}> = [
  { code: 'Mpesa', label: 'Vodacom', sublabel: 'M-Pesa' },
  { code: 'Tigo', label: 'Yas / Mixx', sublabel: 'Tigo Pesa' },
  { code: 'Airtel', label: 'Airtel', sublabel: 'Airtel Money' },
  { code: 'Halopesa', label: 'Halotel', sublabel: 'Halopesa' },
  { code: 'Azampesa', label: 'AzamPesa', sublabel: 'Azam Wallet' },
] as const

const BANK_PROVIDERS: ReadonlyArray<{
  code: AzamPayProviderCode
  label: string
  sublabel: string
}> = [
  { code: 'CRDB', label: 'CRDB Bank', sublabel: 'Direct Transfer' },
  { code: 'NMB', label: 'NMB Bank', sublabel: 'Direct Transfer' },
  { code: 'NBC', label: 'NBC Bank', sublabel: 'Direct Transfer' },
] as const

interface PendingAzamPaySession {
  externalId: string
  azampayTransactionId: string | null
  provider: AzamPayProviderCode
  providerLabel: string
  recipientContact: string
  channel: 'mno' | 'bank'
  planName: string
  amountTzs: number
  environment: 'sandbox' | 'production'
  promptMessage: string
  status: 'pending' | 'failed'
}

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
    refreshSubscription,
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

  const [channel, setChannel] = useState<'mobile_money' | 'bank_transfer'>(
    'mobile_money',
  )
  const [mobileProvider, setMobileProvider] =
    useState<AzamPayProviderCode>('Mpesa')
  const [bankProvider, setBankProvider] =
    useState<AzamPayProviderCode>('CRDB')
  const [accountInput, setAccountInput] = useState('')
  const [bankMobileInput, setBankMobileInput] = useState('')
  const [bankOtpInput, setBankOtpInput] = useState('')
  const [captchaToken, setCaptchaToken] = useState('')
  const [turnstileBypassReason, setTurnstileBypassReason] = useState<
    'timeout_or_mobile_challenge' | null
  >(null)
  const [checkoutModalKey, setCheckoutModalKey] = useState(1)
  const [submitting, setSubmitting] = useState(false)
  const [checkingStatus, setCheckingStatus] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [pendingTx, setPendingTx] = useState<PendingAzamPaySession | null>(null)
  const [receipt, setReceipt] = useState<ActivationReceipt | null>(null)

  const turnstileRef = useRef<TurnstileWidgetHandle | null>(null)
  const turnstileEnabled = isTurnstileEnabled()

  const handleTurnstileVerify = useCallback((token: string) => {
    setCaptchaToken(token)
    setTurnstileBypassReason(null)
  }, [])

  const handleTurnstileExpire = useCallback(() => {
    setCaptchaToken('')
  }, [])

  const handleTurnstileFallback = useCallback(
    (reason: 'timeout_or_mobile_challenge') => {
      setTurnstileBypassReason(reason)
    },
    [],
  )

  useEffect(() => {
    if (initialPlanParam === 'pro' || initialPlanParam === 'enterprise') {
      setCheckoutPlanId(initialPlanParam)
      setCheckoutModalKey((k) => k + 1)
      setCaptchaToken('')
      setTurnstileBypassReason(null)
      setPendingTx(null)
      setReceipt(null)
      setErrorMsg(null)
    }
  }, [initialPlanParam])

  const handleTransactionSettled = async (
    tx: PendingAzamPaySession,
    azampayTxId?: string | null,
  ) => {
    await syncSubscriptionAfterPayment()
    await refreshSubscription()
    setPendingTx(null)
    setReceipt({
      planName: tx.planName,
      referenceCode: azampayTxId || tx.azampayTransactionId || tx.externalId,
      paymentMethod: `AzamPay · ${tx.providerLabel}`,
      amount: tx.amountTzs,
      currency: 'TZS',
      expiresAt: new Date(Date.now() + 30 * 86_400_000).toISOString(),
    })
  }

  // Subscribe via Supabase Realtime + 3s poll on `payment_transactions` while awaiting AzamPay webhook
  useEffect(() => {
    if (!pendingTx || pendingTx.status !== 'pending') return

    let active = true

    const applyUpdate = async (
      status: 'pending' | 'completed' | 'failed',
      azampayTxId?: string | null,
    ) => {
      if (!active) return
      if (status === 'completed') {
        await handleTransactionSettled(pendingTx, azampayTxId)
      } else if (status === 'failed') {
        setPendingTx((prev) => (prev ? { ...prev, status: 'failed' } : null))
        setErrorMsg(
          ui(
            'Payment was declined or cancelled on your device. You can retry right away.',
            'Malipo yamekataliwa au kughairiwa kwenye simu yako. Unaweza kujaribu tena sasa.',
            'El pago fue rechazado o cancelado. Puedes intentarlo de nuevo.',
          ),
        )
      }
    }

    const unsubscribe = subscribeToAzamPayTransaction(
      pendingTx.externalId,
      (updated) => {
        void applyUpdate(updated.status, updated.azampay_transaction_id)
      },
    )

    const pollOnce = async () => {
      const latest = await fetchAzamPayTransactionStatus(pendingTx.externalId)
      if (latest && latest.status !== 'pending') {
        await applyUpdate(latest.status, latest.azampay_transaction_id)
      }
    }

    const intervalId = window.setInterval(() => {
      void pollOnce()
    }, 3000)

    return () => {
      active = false
      unsubscribe()
      window.clearInterval(intervalId)
    }
  }, [pendingTx?.externalId, pendingTx?.status])

  const selectedPlan = checkoutPlanId
    ? (plans.find((p) => p.id === checkoutPlanId) ??
      plans.find((p) => p.id === 'pro') ??
      plans[0])
    : null

  const billedAmountTzs =
    checkoutPlanId && selectedPlan
      ? resolveForcedTzsAmountForPlan(
          checkoutPlanId,
          selectedPlan.price_tzs,
          selectedPlan.price_usd,
        )
      : 0

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
    setCheckoutModalKey((k) => k + 1)
    setCaptchaToken('')
    setTurnstileBypassReason(null)
    setErrorMsg(null)
    setPendingTx(null)
    setReceipt(null)
    setAccountInput('')
    setBankMobileInput('')
    setBankOtpInput('')
  }

  const closeCheckoutSheet = () => {
    setCheckoutPlanId(null)
    setCaptchaToken('')
    setTurnstileBypassReason(null)
    setErrorMsg(null)
    setPendingTx(null)
    setReceipt(null)
  }

  const handleManualStatusCheck = async () => {
    if (!pendingTx) return
    setCheckingStatus(true)
    try {
      const latest = await fetchAzamPayTransactionStatus(pendingTx.externalId)
      if (latest?.status === 'completed') {
        await handleTransactionSettled(pendingTx, latest.azampay_transaction_id)
      } else if (latest?.status === 'failed') {
        setPendingTx((prev) => (prev ? { ...prev, status: 'failed' } : null))
        setErrorMsg(
          ui(
            'Payment was declined or expired. Please retry below.',
            'Malipo yamekataliwa au muda umeisha. Tafadhali jaribu tena.',
            'El pago fue rechazado o expiró. Inténtalo nuevamente.',
          ),
        )
      }
    } finally {
      setCheckingStatus(false)
    }
  }

  const handleStartAzamPayCheckout = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!checkoutPlanId || !selectedPlan) return
    setErrorMsg(null)

    if (turnstileEnabled && !captchaToken && !turnstileBypassReason) {
      setErrorMsg(
        ui(
          'Security check is still initializing — please wait a second or click Retry Verification.',
          'Uthibitisho wa usalama unaendelea — subiri sekunde chache au bonyeza Jaribu Tena.',
          'Verificación de seguridad en curso — espera un segundo o pulsa Reintentar.',
        ),
      )
      return
    }

    const consumedToken = captchaToken
    setSubmitting(true)
    try {
      const activeProvider: AzamPayProviderCode =
        channel === 'mobile_money' ? mobileProvider : bankProvider
      const providerMeta =
        channel === 'mobile_money'
          ? MOBILE_MONEY_NETWORKS.find((n) => n.code === activeProvider)
          : BANK_PROVIDERS.find((b) => b.code === activeProvider)

      const res = await initiateAzamPayCheckout({
        planId: checkoutPlanId,
        provider: activeProvider,
        phoneOrAccount: accountInput,
        amountTzs: billedAmountTzs,
        displayCurrency: currency,
        merchantMobileNumber:
          channel === 'bank_transfer' ? bankMobileInput : undefined,
        otp: channel === 'bank_transfer' ? bankOtpInput : undefined,
        turnstileToken: consumedToken || undefined,
        turnstileBypassReason: !consumedToken
          ? (turnstileBypassReason ?? undefined)
          : undefined,
      })

      if (!res.ok) {
        setErrorMsg(
          res.error ||
            'Could not initiate AzamPay payment prompt. Please check your details and try again.',
        )
        return
      }

      const confirmedPhone = accountInput.trim()

      setPendingTx({
        externalId: res.externalId || res.transactionId || `MC-${Date.now()}`,
        azampayTransactionId: res.azampayTransactionId ?? null,
        provider: activeProvider,
        providerLabel: providerMeta
          ? `${providerMeta.label} (${providerMeta.sublabel})`
          : activeProvider,
        recipientContact: confirmedPhone,
        channel: res.channel ?? (channel === 'bank_transfer' ? 'bank' : 'mno'),
        planName: res.planName || selectedPlan.name,
        amountTzs: res.amountTzs ?? billedAmountTzs,
        environment: res.environment ?? 'sandbox',
        promptMessage:
          res.message ||
          (channel === 'mobile_money'
            ? `STK Push Sent to ${confirmedPhone} — Enter your mobile money PIN to complete payment. Your plan activates automatically once confirmed.`
            : `Complete your ${activeProvider} bank authorization to unlock your subscription.`),
        status: 'pending',
      })
    } finally {
      setSubmitting(false)
      if (consumedToken) {
        setCaptchaToken('')
        turnstileRef.current?.reset()
      }
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
          <div className="inline-flex max-w-full flex-wrap items-center justify-center gap-2 rounded-full border border-ochre/30 bg-ochre/10 px-4 py-1.5 font-mono text-xs text-ochre">
            <Crown size={13} className="shrink-0" />
            <span>
              {ui('Account Tier:', 'Mpango Wako:', 'Plan Actual:')}{' '}
              <strong>{activePlan.name}</strong>
            </span>
            <span
              className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${
                accountState === 'active'
                  ? 'bg-moss text-paper'
                  : accountState === 'dormant'
                    ? 'bg-danger text-paper'
                    : 'bg-ink text-gold'
              }`}
            >
              {accountState === 'dormant'
                ? ui('DORMANT · Renew to Unlock', 'IMESIMAMA · Huisha', 'INACTIVO · Renovar')
                : accountState}
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
                    ? 'TIER 01 · VIEW-ONLY (FREE)'
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
                  className={`mt-5 grid grid-cols-2 gap-2.5 rounded-xl border p-3 font-mono text-[11px] ${
                    isHighlighted
                      ? 'border-paper/12 bg-ink-2'
                      : 'border-ink/10 bg-paper-2/70'
                  }`}
                >
                  <div className="min-w-0">
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
                    className={`min-w-0 border-l pl-2.5 ${
                      isHighlighted ? 'border-paper/12' : 'border-ink/10'
                    }`}
                  >
                    <dt
                      className={`text-[9.5px] uppercase ${
                        isHighlighted ? 'text-paper/55' : 'text-stone'
                      }`}
                    >
                      {ui('Quote / Info RFQs', 'Maombi / Mwezi', 'RFQs / Mes')}
                    </dt>
                    <dd className="mt-0.5 font-bold tabular-nums">
                      {p.max_monthly_rfqs < 0
                        ? ui('Unlimited', 'Bila Kikomo', 'Ilimitado')
                        : p.max_monthly_rfqs === 0
                          ? ui('0 (View-Only)', '0 (Mtazamaji)', '0 (Solo Vista)')
                          : `${p.max_monthly_rfqs}/mo`}
                    </dd>
                  </div>
                  <div
                    className={`min-w-0 border-t pt-2 ${
                      isHighlighted ? 'border-paper/12' : 'border-ink/10'
                    }`}
                  >
                    <dt
                      className={`text-[9.5px] uppercase ${
                        isHighlighted ? 'text-paper/55' : 'text-stone'
                      }`}
                    >
                      {ui('Dossier & NDA', 'Faili & NDA', 'Expediente')}
                    </dt>
                    <dd
                      className={`mt-0.5 truncate font-bold ${
                        p.can_access_data_room || planSlug === 'pro'
                          ? isHighlighted
                            ? 'text-gold'
                            : 'text-moss'
                          : isHighlighted
                            ? 'text-paper/45'
                            : 'text-stone'
                      }`}
                    >
                      {p.can_access_data_room
                        ? ui('Full NDA Room', 'NDA Kamili', 'Sala NDA')
                        : planSlug === 'pro'
                          ? ui('Dossier + Direct', 'Faili + Simu', 'Expediente')
                          : ui('Preview Only', 'Muhtasari', 'Vista Previa')}
                    </dd>
                  </div>
                  <div
                    className={`min-w-0 border-l border-t pl-2.5 pt-2 ${
                      isHighlighted ? 'border-paper/12' : 'border-ink/10'
                    }`}
                  >
                    <dt
                      className={`text-[9.5px] uppercase ${
                        isHighlighted ? 'text-paper/55' : 'text-stone'
                      }`}
                    >
                      {ui('Markets CSV', 'Pakua CSV', 'CSV Mercado')}
                    </dt>
                    <dd
                      className={`mt-0.5 truncate font-bold ${
                        p.can_export_markets
                          ? isHighlighted
                            ? 'text-[#9de4b4]'
                            : 'text-moss'
                          : isHighlighted
                            ? 'text-paper/45'
                            : 'text-stone'
                      }`}
                    >
                      {p.can_export_markets
                        ? ui('Included', 'Imejumuishwa', 'Incluido')
                        : ui('Locked', 'Imefungwa', 'Bloqueado')}
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
            onClick={() => {
              if (!submitting && pendingTx?.status !== 'pending') {
                closeCheckoutSheet()
              }
            }}
          />
          <div className="relative z-10 max-h-[88dvh] w-full overflow-y-auto overscroll-contain rounded-t-2xl border border-ink/15 bg-paper text-ink shadow-2xl animate-rise sm:max-w-lg sm:rounded-2xl">
            {/* Sheet Header */}
            <div className="flex items-start justify-between gap-3 border-b border-ink/10 bg-ink px-5 py-4 text-paper sm:px-6">
              <div className="min-w-0">
                <div className="flex items-center gap-2 font-mono text-[10px] font-semibold uppercase tracking-widest text-gold">
                  <Zap size={11} />
                  {ui('AzamPay Instant Checkout', 'Malipo ya Papo Hapo · AzamPay', 'Pago Instantáneo · AzamPay')}
                </div>
                <h2 className="mt-0.5 font-display text-2xl font-medium">
                  {selectedPlan.name}
                </h2>
                <p className="mt-0.5 font-mono text-xs text-paper/75 tabular-nums">
                  TSh {billedAmountTzs.toLocaleString('en-US')}
                  {ui(' / 30 days', ' / siku 30', ' / 30 días')}
                  {currency !== 'TZS' &&
                    ` · ≈ ${formatPlanPrice(billedAmountTzs, selectedPlan.price_usd)} (billed in TZS)`}
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

            <div className="p-5 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:p-6">
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
                /* Instant Webhook Activation Success Confirmation */
                <div className="py-2 text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-moss-light text-moss">
                    <CheckCircle2 size={28} />
                  </div>
                  <span className="mt-3 inline-block rounded-full bg-moss-light px-3 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-moss">
                    {ui('Payment Confirmed · Active 30 Days', 'Malipo Yamethibitishwa · Siku 30', 'Pago Confirmado · 30 Días')}
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
                    <div className="min-w-0">
                      <dt className="text-[10px] uppercase text-stone">Reference</dt>
                      <dd className="mt-0.5 truncate font-bold text-ink">{receipt.referenceCode}</dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="text-[10px] uppercase text-stone">Channel</dt>
                      <dd className="mt-0.5 truncate text-ink">{receipt.paymentMethod}</dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="text-[10px] uppercase text-stone">Amount</dt>
                      <dd className="mt-0.5 font-bold text-moss tabular-nums">
                        {receipt.currency} {receipt.amount.toLocaleString('en-US')}
                      </dd>
                    </div>
                    <div className="min-w-0">
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
              ) : pendingTx ? (
                /* STK Push / Bank Authorization Confirmation & Live Webhook Listener Screen */
                <div className="py-2 text-center">
                  <div
                    className={`mx-auto flex h-14 w-14 items-center justify-center rounded-full ${
                      pendingTx.status === 'failed'
                        ? 'bg-danger/15 text-danger'
                        : 'bg-moss-light text-moss'
                    }`}
                  >
                    {pendingTx.status === 'failed' ? (
                      <AlertCircle size={30} />
                    ) : (
                      <CheckCircle2 size={30} />
                    )}
                  </div>

                  <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider ${
                        pendingTx.status === 'failed'
                          ? 'bg-danger/15 text-danger'
                          : 'bg-moss-light text-moss'
                      }`}
                    >
                      {pendingTx.status === 'pending' && (
                        <Loader2 size={11} className="animate-spin" />
                      )}
                      {pendingTx.status === 'failed'
                        ? ui('Payment Not Completed', 'Malipo Hayajakamilika', 'Pago No Completado')
                        : pendingTx.channel === 'mno'
                          ? ui('STK Push Sent', 'Ombi la PIN Limetumwa', 'STK Push Enviado')
                          : ui('Authorization Sent', 'Ombi la Benki Limetumwa', 'Autorización Enviada')}
                    </span>
                    {pendingTx.environment === 'sandbox' && (
                      <span className="rounded-full border border-ink/15 bg-paper-2 px-2 py-0.5 font-mono text-[9.5px] font-semibold uppercase text-stone">
                        AzamPay Sandbox
                      </span>
                    )}
                  </div>

                  <h3 className="mt-3 font-display text-2xl font-medium text-ink sm:text-3xl">
                    {pendingTx.status === 'failed'
                      ? ui('Payment Declined or Cancelled', 'Malipo Yamekataliwa', 'Pago Rechazado')
                      : pendingTx.channel === 'mno'
                        ? ui(
                            `STK Push Sent to ${pendingTx.recipientContact}`,
                            `Ombi la PIN Limetumwa kwa ${pendingTx.recipientContact}`,
                            `STK Push Enviado a ${pendingTx.recipientContact}`,
                          )
                        : ui(
                            `Complete ${pendingTx.provider} Bank Authorization`,
                            `Kamilisha Uthibitisho wa Benki (${pendingTx.provider})`,
                            `Completa la Autorización Bancaria (${pendingTx.provider})`,
                          )}
                  </h3>

                  <p className="mt-2.5 rounded-xl border border-moss/25 bg-moss-light/40 px-3.5 py-2.5 text-xs leading-relaxed text-ink">
                    {pendingTx.status === 'failed'
                      ? errorMsg ||
                        ui(
                          'No charge was settled. You can retry with the same or another network.',
                          'Hakuna malipo yaliyokatwa. Unaweza kujaribu tena.',
                          'No se realizó ningún cobro. Puedes intentarlo de nuevo.',
                        )
                      : pendingTx.channel === 'mno'
                        ? ui(
                            `STK Push Sent to ${pendingTx.recipientContact} — Enter your mobile money PIN to complete payment. Your plan activates automatically once confirmed.`,
                            `Ombi la PIN limetumwa kwa ${pendingTx.recipientContact} — Weka namba yako ya siri (PIN) kukamilisha malipo. Mpango wako utawashwa kiotomatiki ukithibitishwa.`,
                            `STK Push enviado a ${pendingTx.recipientContact} — Ingresa tu PIN de dinero móvil para completar el pago. Tu plan se activará automáticamente al confirmarse.`,
                          )
                        : ui(
                            `Authorization sent for ${pendingTx.recipientContact} (${pendingTx.provider}). Complete approval to activate your plan automatically.`,
                            `Ombi limetumwa kwa ${pendingTx.recipientContact} (${pendingTx.provider}). Kamilisha uthibitisho ili mpango wako uwashe kiotomatiki.`,
                            `Autorización enviada para ${pendingTx.recipientContact} (${pendingTx.provider}). Completa la aprobación para activar tu plan automáticamente.`,
                          )}
                  </p>

                  <dl className="mt-4 grid grid-cols-2 gap-3 rounded-xl border border-ink/10 bg-paper-2 p-4 text-left font-mono text-xs">
                    <div className="min-w-0">
                      <dt className="text-[10px] uppercase text-stone">
                        {pendingTx.channel === 'mno' ? 'Phone' : 'Account'}
                      </dt>
                      <dd className="mt-0.5 truncate font-bold text-ink tabular-nums">
                        {pendingTx.recipientContact}
                      </dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="text-[10px] uppercase text-stone">Provider</dt>
                      <dd className="mt-0.5 truncate text-ink">{pendingTx.providerLabel}</dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="text-[10px] uppercase text-stone">Reference</dt>
                      <dd className="mt-0.5 truncate font-semibold text-ink">{pendingTx.externalId}</dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="text-[10px] uppercase text-stone">Amount</dt>
                      <dd className="mt-0.5 font-bold text-ochre tabular-nums">
                        TSh {pendingTx.amountTzs.toLocaleString('en-US')}
                      </dd>
                    </div>
                  </dl>

                  <div className="mt-5 flex flex-col gap-2.5 sm:flex-row">
                    {pendingTx.status === 'pending' ? (
                      <>
                        <button
                          type="button"
                          onClick={closeCheckoutSheet}
                          className="btn-primary flex-1 justify-center text-xs"
                        >
                          <Check size={14} />
                          {ui('Done', 'Nimemaliza', 'Listo')}
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleManualStatusCheck()}
                          disabled={checkingStatus}
                          className="btn-ghost flex-1 justify-center text-xs disabled:opacity-60"
                        >
                          <RefreshCw
                            size={13}
                            className={checkingStatus ? 'animate-spin' : ''}
                          />
                          {checkingStatus
                            ? ui('Checking Status...', 'Inaangalia Hali...', 'Verificando...')
                            : ui('Check Payment Status', 'Angalia Hali ya Malipo', 'Verificar Estado')}
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setPendingTx(null)
                            setErrorMsg(null)
                          }}
                          className="btn-primary flex-1 justify-center text-xs"
                        >
                          {ui('Try Again', 'Jaribu Tena', 'Intentar de Nuevo')}
                        </button>
                        <button
                          type="button"
                          onClick={closeCheckoutSheet}
                          className="btn-ghost flex-1 justify-center text-xs"
                        >
                          {ui('Done', 'Funga', 'Listo')}
                        </button>
                      </>
                    )}
                  </div>

                  {pendingTx.status === 'pending' && (
                    <button
                      type="button"
                      onClick={() => {
                        setPendingTx(null)
                        setErrorMsg(null)
                      }}
                      className="mt-3 font-mono text-[11px] text-stone underline decoration-stone/40 underline-offset-4 transition hover:text-ink"
                    >
                      {ui('Wrong number? Change number or method', 'Namba si sahihi? Badili namba au njia', '¿Número incorrecto? Cambiar método')}
                    </button>
                  )}
                </div>
              ) : (
                /* Clean AzamPay Mobile Money & Bank Transfer Checkout Form (Law of Proximity + Unified Active Style) */
                <form onSubmit={handleStartAzamPayCheckout} className="space-y-5">
                  {/* Switch between Option A (Mobile Money STK) and Option B (Bank Transfer) */}
                  <div className="grid grid-cols-2 gap-1.5 rounded-xl border border-ink/15 bg-paper-2 p-1" role="tablist" aria-label="AzamPay payment channel">
                    <button
                      type="button"
                      role="tab"
                      aria-selected={channel === 'mobile_money'}
                      onClick={() => {
                        setChannel('mobile_money')
                        setAccountInput('')
                        setErrorMsg(null)
                      }}
                      className={`inline-flex min-h-[48px] sm:min-h-[44px] items-center justify-center gap-1.5 rounded-lg border px-3 py-2 font-mono text-[11px] font-semibold transition-colors ${
                        channel === 'mobile_money'
                          ? 'border-ink bg-ink text-paper shadow-xs'
                          : 'border-transparent text-stone hover:text-ink'
                      }`}
                    >
                      <Smartphone size={14} className={channel === 'mobile_money' ? 'text-gold' : ''} />
                      {ui('Mobile Money', 'Pesa za Simu', 'Dinero Móvil')}
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={channel === 'bank_transfer'}
                      onClick={() => {
                        setChannel('bank_transfer')
                        setAccountInput('')
                        setBankMobileInput('')
                        setBankOtpInput('')
                        setErrorMsg(null)
                      }}
                      className={`inline-flex min-h-[48px] sm:min-h-[44px] items-center justify-center gap-1.5 rounded-lg border px-3 py-2 font-mono text-[11px] font-semibold transition-colors ${
                        channel === 'bank_transfer'
                          ? 'border-ink bg-ink text-paper shadow-xs'
                          : 'border-transparent text-stone hover:text-ink'
                      }`}
                    >
                      <CreditCard size={14} className={channel === 'bank_transfer' ? 'text-gold' : ''} />
                      {ui('Bank Transfer', 'Benki (CRDB/NMB)', 'Transferencia Bancaria')}
                    </button>
                  </div>

                  {channel === 'mobile_money' ? (
                    <>
                      <div className="field-group">
                        <span className="label">
                          {ui('Select Network (Tanzania · AzamPay)', 'Chagua Mtandao (AzamPay)', 'Seleccionar Red (AzamPay)')}
                        </span>
                        <div className="grid grid-cols-2 gap-2.5">
                          {MOBILE_MONEY_NETWORKS.map((net, idx) => {
                            const active = mobileProvider === net.code
                            const isSpanFull =
                              idx === MOBILE_MONEY_NETWORKS.length - 1 &&
                              MOBILE_MONEY_NETWORKS.length % 2 === 1
                            return (
                              <button
                                key={net.code}
                                type="button"
                                aria-pressed={active}
                                onClick={() => setMobileProvider(net.code)}
                                className={`flex min-h-[56px] min-w-0 items-center justify-between gap-2 rounded-lg border px-3.5 py-2.5 text-left transition-colors ${
                                  isSpanFull ? 'col-span-2' : ''
                                } ${
                                  active
                                    ? 'border-ink bg-ink text-paper shadow-xs'
                                    : 'border-sand bg-[#FCFBF8] text-ink hover:border-ink/45'
                                }`}
                              >
                                <span className="min-w-0">
                                  <span
                                    className={`block truncate font-mono text-xs font-bold ${
                                      active ? 'text-paper' : 'text-ink'
                                    }`}
                                  >
                                    {net.label}
                                  </span>
                                  <span
                                    className={`block truncate font-mono text-[10px] ${
                                      active ? 'text-paper/75' : 'text-stone'
                                    }`}
                                  >
                                    {net.sublabel}
                                  </span>
                                </span>
                                {active && (
                                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gold text-ink" aria-hidden="true">
                                    <Check size={12} />
                                  </span>
                                )}
                              </button>
                            )
                          })}
                        </div>
                      </div>

                      <div className="field-group">
                        <label className="label" htmlFor="mm-phone">
                          {ui('Mobile Money Phone Number', 'Namba ya Simu ya Malipo', 'Número de Teléfono')}
                        </label>
                        <input
                          id="mm-phone"
                          type="tel"
                          inputMode="tel"
                          required
                          autoComplete="tel"
                          value={accountInput}
                          onChange={(e) => setAccountInput(e.target.value)}
                          onBlur={() =>
                            setAccountInput((prev) => formatTanzaniaPhoneDisplay(prev))
                          }
                          placeholder="0712 345 678 or 255712345678"
                          className="field font-mono text-base tabular-nums"
                        />
                        <p className="font-mono text-[10.5px] text-stone">
                          {ui(
                            'An STK PIN prompt will be sent directly to this number via AzamPay.',
                            'Ombi la kuweka PIN litatumwa moja kwa moja kwenye namba hii kupitia AzamPay.',
                            'Se enviará una solicitud de PIN directamente a este número vía AzamPay.',
                          )}
                        </p>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="field-group">
                        <span className="label">
                          {ui('Select Tanzania Bank (AzamPay)', 'Chagua Benki (AzamPay)', 'Seleccionar Banco (AzamPay)')}
                        </span>
                        <div className="grid grid-cols-3 gap-2.5">
                          {BANK_PROVIDERS.map((prov) => {
                            const active = bankProvider === prov.code
                            return (
                              <button
                                key={prov.code}
                                type="button"
                                aria-pressed={active}
                                onClick={() => setBankProvider(prov.code)}
                                className={`flex min-h-[56px] min-w-0 flex-col justify-between rounded-lg border px-2.5 py-2.5 text-left transition-colors ${
                                  active
                                    ? 'border-ink bg-ink text-paper shadow-xs'
                                    : 'border-sand bg-[#FCFBF8] text-ink hover:border-ink/45'
                                }`}
                              >
                                <span className={`flex w-full items-center justify-between gap-1 font-mono text-xs font-bold ${active ? 'text-paper' : 'text-ink'}`}>
                                  <span className="inline-flex min-w-0 items-center gap-1">
                                    <Building2 size={12} className={`shrink-0 ${active ? 'text-gold' : 'text-ochre'}`} />
                                    <span className="truncate">{prov.code}</span>
                                  </span>
                                  {active && <Check size={12} className="shrink-0 text-gold" />}
                                </span>
                                <span className={`mt-0.5 truncate font-mono text-[9.5px] ${active ? 'text-paper/75' : 'text-stone'}`}>
                                  {prov.label}
                                </span>
                              </button>
                            )
                          })}
                        </div>
                      </div>

                      <div className="field-group">
                        <label className="label" htmlFor="bank-acct">
                          {ui('Bank Account Number', 'Namba ya Akaunti ya Benki', 'Número de Cuenta Bancaria')}
                        </label>
                        <input
                          id="bank-acct"
                          type="text"
                          inputMode="numeric"
                          required
                          minLength={4}
                          value={accountInput}
                          onChange={(e) => setAccountInput(e.target.value)}
                          placeholder="e.g. 0152001234500"
                          className="field font-mono text-base tabular-nums"
                        />
                      </div>

                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div className="field-group">
                          <label className="label" htmlFor="bank-mobile">
                            {ui('Registered Phone', 'Namba ya Simu', 'Teléfono')}
                          </label>
                          <input
                            id="bank-mobile"
                            type="tel"
                            inputMode="tel"
                            autoComplete="tel"
                            value={bankMobileInput}
                            onChange={(e) => setBankMobileInput(e.target.value)}
                            onBlur={() =>
                              setBankMobileInput((prev) => formatTanzaniaPhoneDisplay(prev))
                            }
                            placeholder="0712 345 678"
                            className="field font-mono text-base tabular-nums"
                          />
                        </div>
                        <div className="field-group">
                          <label className="label" htmlFor="bank-otp">
                            {ui('Bank OTP (if prompted)', 'OTP ya Benki (hiari)', 'OTP Bancario (opcional)')}
                          </label>
                          <input
                            id="bank-otp"
                            type="text"
                            inputMode="numeric"
                            autoComplete="one-time-code"
                            value={bankOtpInput}
                            onChange={(e) => setBankOtpInput(e.target.value)}
                            placeholder="e.g. 123456"
                            className="field font-mono text-base tabular-nums"
                          />
                        </div>
                      </div>
                    </>
                  )}

                  {turnstileEnabled && (
                    <div key={`checkout-ts-${checkoutModalKey}`} className="w-full min-w-0">
                      <TurnstileWidget
                        ref={turnstileRef}
                        action="subscription-payment"
                        appearance="interaction-only"
                        execution="render"
                        timeoutMs={5000}
                        allowMobileFallback
                        fallbackLabel="Verified via signed-in session"
                        onVerify={handleTurnstileVerify}
                        onExpire={handleTurnstileExpire}
                        onFallbackReady={handleTurnstileFallback}
                      />
                    </div>
                  )}

                  {errorMsg && (
                    <div
                      role="alert"
                      className="rounded-xl border border-danger/35 bg-danger/10 px-3.5 py-2.5 text-xs font-medium text-danger"
                    >
                      {errorMsg}
                    </div>
                  )}

                  {currency !== 'TZS' && (
                    <div className="rounded-lg border border-ochre/25 bg-ochre/8 px-3 py-2 font-mono text-[10.5px] leading-relaxed text-ink tabular-nums">
                      {ui(
                        `AzamPay settles in Tanzanian Shillings (TZS). Your ${formatPlanPrice(billedAmountTzs, selectedPlan.price_usd)} plan will be charged at TSh ${billedAmountTzs.toLocaleString('en-US')}.`,
                        `AzamPay inatoza kwa Shilingi za Tanzania (TZS). Utalipa TSh ${billedAmountTzs.toLocaleString('en-US')}.`,
                        `AzamPay liquida en chelines tanzanos (TZS). Se cobrarán TSh ${billedAmountTzs.toLocaleString('en-US')}.`,
                      )}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={submitting}
                    className="btn-primary w-full justify-center py-3 text-sm disabled:opacity-60"
                  >
                    {submitting ? (
                      <Loader2 size={15} className="animate-spin" />
                    ) : (
                      <Zap size={15} />
                    )}
                    {submitting
                      ? ui('Sending AzamPay Prompt...', 'Inatuma Ombi la AzamPay...', 'Enviando Solicitud...')
                      : channel === 'mobile_money'
                        ? ui(
                            `Pay TSh ${billedAmountTzs.toLocaleString('en-US')} via AzamPay`,
                            `Lipa TSh ${billedAmountTzs.toLocaleString('en-US')} kwa AzamPay`,
                            `Pagar TSh ${billedAmountTzs.toLocaleString('en-US')} vía AzamPay`,
                          )
                        : ui(
                            `Authorize ${bankProvider} · TSh ${billedAmountTzs.toLocaleString('en-US')}`,
                            `Thibitisha ${bankProvider} · TSh ${billedAmountTzs.toLocaleString('en-US')}`,
                            `Autorizar ${bankProvider} · TSh ${billedAmountTzs.toLocaleString('en-US')}`,
                          )}
                  </button>

                  <p className="flex items-center justify-center gap-1.5 text-center font-mono text-[10px] text-stone">
                    <ShieldCheck size={12} className="text-moss" />
                    {ui(
                      'Secured by AzamPay · Auto-activates for 30 days upon webhook confirmation',
                      'Inalindwa na AzamPay · Inawasha mpango papo hapo baada ya uthibitisho',
                      'Protegido por AzamPay · Activación automática por 30 días al confirmar',
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
