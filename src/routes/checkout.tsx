import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CheckCircle2,
  CreditCard,
  Crown,
  Globe,
  Lock,
  ShieldCheck,
  Smartphone,
  Sparkles,
} from 'lucide-react';
import { useLocalization } from '../context/LocalizationContext';
import CurrencySwitcher from '../components/CurrencySwitcher';
import LanguageSwitcher from '../components/LanguageSwitcher';
import {
  SUBSCRIPTION_TIER_LIST,
  normalizeBillingCycle,
  normalizeSubscriptionTier,
  resolveVerifiedTierPricing,
  useSubscription,
} from '../lib/subscriptions';
import { processVerifiedCheckoutSession } from '../app/api/checkout/route';
import { useAuthSession } from '../lib/supabaseAuth';
import type {
  BillingCycle,
  PaymentGatewayId,
  SubscriptionTierName,
} from '../types/database';

interface CheckoutSearch {
  tier?: string;
  billing?: string;
}

export const Route = createFileRoute('/checkout')({
  validateSearch: (raw: Record<string, unknown>): CheckoutSearch => ({
    tier: typeof raw.tier === 'string' ? raw.tier : 'professional',
    billing: typeof raw.billing === 'string' ? raw.billing : 'monthly',
  }),
  head: () => ({
    meta: [
      {
        title:
          'Secure Subscription Checkout (Stripe & Mobile Money) — MineConnect',
      },
    ],
  }),
  component: CheckoutPageComponent,
});

type LocalMobileProvider =
  | 'Vodacom M-Pesa'
  | 'Mixx by Yas (Tigo Pesa)'
  | 'Airtel Money'
  | 'CRDB / NMB Bank Rail';

function CheckoutPageComponent() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const session = useAuthSession();
  const { subscription: currentSub } = useSubscription();
  const { currency, currencyMeta, formatPrice, ui } = useLocalization();

  const [selectedTier, setSelectedTier] = useState<SubscriptionTierName>(() =>
    normalizeSubscriptionTier(search.tier)
  );
  const [billingCycle, setBillingCycle] = useState<BillingCycle>(() =>
    normalizeBillingCycle(search.billing)
  );

  // Sync URL params if user navigates with new query params
  useEffect(() => {
    setSelectedTier(normalizeSubscriptionTier(search.tier));
    setBillingCycle(normalizeBillingCycle(search.billing));
  }, [search.tier, search.billing]);

  // Default to local Mobile Money rail when TZS is active, or Stripe Global for international currencies
  const [selectedGateway, setSelectedGateway] = useState<PaymentGatewayId>(() =>
    currency === 'TZS' ? 'AZAMPAY_MPESA_TZS' : 'STRIPE_GLOBAL'
  );
  const [mobileProvider, setMobileProvider] =
    useState<LocalMobileProvider>('Vodacom M-Pesa');
  const [mobilePhone, setMobilePhone] = useState('+255 754 820 410');

  const [cardHolder, setCardHolder] = useState(
    session?.user.fullName || 'Salmin Mwenesi'
  );
  const [cardNumber, setCardNumber] = useState('4242 •••• •••• 4242');
  const [cardExpiry, setCardExpiry] = useState('08/29');
  const [cardCvc, setCardCvc] = useState('842');
  const [pdpaConsent, setPdpaConsent] = useState(true);

  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<{
    reference: string;
    tierName: SubscriptionTierName;
    billingCycle: BillingCycle;
    gatewayLabel: string;
    amountTzs: number;
    amountUsd: number;
    expiresAt: string;
  } | null>(null);

  // Server-side anti-tampering dictionary lookup
  const verifiedPricing = useMemo(
    () => resolveVerifiedTierPricing(selectedTier, billingCycle),
    [selectedTier, billingCycle]
  );

  const isFreeExplorer = verifiedPricing.verifiedAmountTzs === 0;

  const displayPrimaryAmount = useMemo(() => {
    if (isFreeExplorer) return ui('Free (TSh 0)', 'Bure (TSh 0)', 'Gratis (TSh 0)');
    if (currency === 'TZS') {
      return `TSh ${verifiedPricing.verifiedAmountTzs.toLocaleString('en-US')}`;
    }
    return formatPrice(verifiedPricing.verifiedAmountUsd);
  }, [isFreeExplorer, currency, verifiedPricing, formatPrice, ui]);

  const handleCheckoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!session) {
      navigate({
        to: '/login',
        search: {
          next: `/checkout?tier=${selectedTier.toLowerCase()}&billing=${billingCycle}`,
        } as never,
      });
      return;
    }

    if (!pdpaConsent) {
      setError(
        ui(
          'Please confirm PDPA 2022 billing consent & statutory fee separation acknowledgement.',
          'Tafadhali thibitisha ridhaa ya malipo na utenganishaji wa ada.',
          'Confirme el consentimiento de facturación PDPA 2022.'
        )
      );
      return;
    }

    setProcessing(true);
    try {
      const paymentMethodLabel = isFreeExplorer
        ? 'Explorer Free Tier Activation'
        : selectedGateway === 'STRIPE_GLOBAL'
          ? `Stripe Global Card (${cardNumber.slice(-4)})`
          : selectedGateway === 'AZAMPAY_MPESA_TZS'
            ? `${mobileProvider} (${mobilePhone})`
            : `Flutterwave Africa (${mobileProvider})`;

      const res = await processVerifiedCheckoutSession({
        userId: session.user.id,
        tier: selectedTier,
        billing: billingCycle,
        gateway: isFreeExplorer ? 'FREE_TIER' : selectedGateway,
        paymentMethodLabel,
        currency,
        mobilePhone:
          selectedGateway === 'AZAMPAY_MPESA_TZS' ||
          selectedGateway === 'FLUTTERWAVE_AFRICA'
            ? mobilePhone
            : undefined,
        cardLast4:
          selectedGateway === 'STRIPE_GLOBAL'
            ? cardNumber.slice(-4)
            : undefined,
      });

      if (!res.ok || !res.subscription || !res.transaction) {
        setError(res.error ?? 'Payment authorization failed.');
        return;
      }

      setReceipt({
        reference: res.transaction.external_reference,
        tierName: res.subscription.tier_name,
        billingCycle: res.subscription.billing_cycle,
        gatewayLabel: paymentMethodLabel,
        amountTzs: res.verifiedPricing.amountTzs,
        amountUsd: res.verifiedPricing.amountUsd,
        expiresAt: res.subscription.expires_at,
      });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-paper pt-[72px] text-ink">
      {/* Top Masthead */}
      <section className="grain relative overflow-hidden border-b border-ink/15 bg-ink py-12 text-paper">
        <div className="contours absolute inset-0 -z-10" aria-hidden="true" />
        <div className="mx-auto max-w-6xl px-5 lg:px-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <Link
              to="/pricing"
              className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-gold hover:underline"
            >
              <ArrowLeft size={14} />
              {ui('Back to Pricing Matrix', 'Rudi kwenye Bei', 'Volver a Precios')}
            </Link>

            <div className="flex flex-wrap items-center gap-3">
              <CurrencySwitcher dark />
              <LanguageSwitcher dark />
            </div>
          </div>

          <div className="mt-6 flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-gold/35 bg-ochre/20 px-3 py-1 font-mono text-[11px] font-semibold uppercase tracking-widest text-gold">
                <Lock size={12} />
                {ui(
                  'Anti-Tampering Server Price Verification · Multi-Gateway Checkout',
                  'Malipo Salama · M-Pesa / Tigo Pesa / Stripe Global',
                  'Verificación de Precios en Servidor · Checkout Multi-Pasarela'
                )}
              </span>
              <h1 className="mt-3 font-display text-4xl font-light text-paper md:text-5xl">
                {ui('Subscribe to', 'Jiunge na Mpango wa', 'Suscribirse a')}{' '}
                <em className="italic text-gold">{selectedTier}</em>
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-paper/70">
                {ui(
                  'Instant tier activation backed by Stripe Global Rails (USD/EUR/GBP) and AzamPay / Flutterwave Tanzania Mobile Money (M-Pesa, Mixx by Yas, Airtel Money).',
                  'Uwezeshaji wa papo hapo kupitia M-Pesa, Mixx by Yas (Tigo Pesa), Airtel Money au Kadi za Kimataifa (Stripe).',
                  'Activación inmediata mediante Stripe Global (USD/EUR/GBP) y dinero móvil local (M-Pesa, Tigo Pesa, Airtel Money).'
                )}
              </p>
            </div>

            {session && (
              <div className="rounded-xl border border-paper/15 bg-ink-2 px-4 py-3 font-mono text-xs">
                <div className="text-[10px] uppercase tracking-wider text-paper/55">
                  {ui('Authenticated Member', 'Mwanachama Aliyeingia', 'Miembro Autenticado')}
                </div>
                <div className="mt-0.5 font-semibold text-gold">
                  {session.user.email}
                </div>
                <div className="mt-0.5 text-[11px] text-paper/65">
                  {ui('Current Active Tier:', 'Mpango wa Sasa:', 'Plan Actual:')}{' '}
                  <strong className="text-paper">{currentSub.tier_name}</strong>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Main Content */}
      <section className="mx-auto max-w-6xl px-5 py-12 lg:px-8">
        {!session ? (
          <div className="mx-auto max-w-xl rounded-2xl border border-ink/15 bg-white p-8 text-center shadow-lg">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-ochre/15 text-ochre">
              <Lock size={22} />
            </div>
            <h2 className="mt-4 font-display text-3xl text-ink">
              {ui(
                'Sign In Required to Complete Subscription',
                'Ingia Kwanza Kukamilisha Usajili wa Mpango',
                'Inicie Sesión para Completar la Suscripción'
              )}
            </h2>
            <p className="mt-2 text-sm text-stone">
              {ui(
                `Please sign in or create your MineConnect account to bind the ${selectedTier} (${billingCycle}) subscription to your user profile.`,
                `Tafadhali ingia au fungua akaunti ili kuunganisha mpango wa ${selectedTier} (${billingCycle}) kwenye akaunti yako.`,
                `Inicie sesión o cree una cuenta para vincular el plan ${selectedTier} a su perfil.`
              )}
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link
                to="/login"
                className="btn-primary"
              >
                {ui('Sign In to Continue', 'Ingia Kuendelea', 'Iniciar Sesión')}
                <ArrowRight size={15} />
              </Link>
              <Link
                to="/signup"
                className="btn-ghost"
              >
                {ui('Create Account', 'Fungua Akaunti', 'Crear Cuenta')}
              </Link>
            </div>
          </div>
        ) : receipt ? (
          /* Verified Webhook Settlement Receipt */
          <div className="mx-auto max-w-2xl overflow-hidden rounded-2xl border border-moss/40 bg-ink p-8 text-paper shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-moss/30 text-[#9de4b4]">
                <CheckCircle2 size={26} />
              </div>
              <div>
                <span className="font-mono text-[10px] font-semibold uppercase tracking-widest text-[#9de4b4]">
                  {ui(
                    'WEBHOOK VERIFIED · SUBSCRIPTION ACTIVE',
                    'MALIPO YAMETHIBITISHWA · MPANGO UKO HAI',
                    'WEBHOOK VERIFICADO · SUSCRIPCIÓN ACTIVA'
                  )}
                </span>
                <h2 className="font-display text-3xl text-paper">
                  {receipt.tierName} {ui('Tier Activated', 'Imewashwa', 'Activado')}
                </h2>
              </div>
            </div>

            <dl className="mt-6 grid grid-cols-1 gap-4 rounded-xl border border-paper/12 bg-ink-2 p-5 font-mono text-xs sm:grid-cols-2">
              <div>
                <dt className="text-[10px] uppercase text-paper/50">
                  {ui('Transaction Reference', 'Kumbukumbu ya Malipo', 'Referencia')}
                </dt>
                <dd className="mt-1 font-bold text-gold">{receipt.reference}</dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase text-paper/50">
                  {ui('Payment Gateway Rail', 'Njia ya Malipo', 'Pasarela')}
                </dt>
                <dd className="mt-1 text-paper">{receipt.gatewayLabel}</dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase text-paper/50">
                  {ui('Server-Verified Amount', 'Kiasi Kilichothibitishwa', 'Monto Verificado')}
                </dt>
                <dd className="mt-1 font-bold text-[#9de4b4]">
                  TSh {receipt.amountTzs.toLocaleString('en-US')} (
                  {formatPrice(receipt.amountUsd)})
                </dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase text-paper/50">
                  {ui('Active Until / Renewal', 'Inaisha Tarehe', 'Válido Hasta')}
                </dt>
                <dd className="mt-1 text-paper">
                  {new Date(receipt.expiresAt).toLocaleDateString(undefined, {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </dd>
              </div>
            </dl>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
              <Link to="/dashboard" className="btn-primary">
                {ui(
                  'Open Dashboard & View Quotas',
                  'Fungua Dashibodi Yako',
                  'Ir al Panel de Control'
                )}
                <ArrowRight size={15} />
              </Link>
              <Link
                to="/list-a-project"
                className="inline-flex items-center gap-1.5 rounded-md border border-paper/20 bg-paper/10 px-4 py-2.5 text-xs font-semibold text-paper transition hover:bg-paper/20"
              >
                {ui('List a Mining Project', 'Sajili Mradi wa Madini', 'Publicar Proyecto')}
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1.25fr_0.9fr]">
            {/* Left Column: Tier Selection, Billing Cycle, & Multi-Gateway Payment Form */}
            <form
              onSubmit={handleCheckoutSubmit}
              className="space-y-6 rounded-2xl border border-ink/12 bg-white p-6 shadow-sm lg:p-8"
            >
              {/* 1. Plan & Billing Cycle Selection */}
              <div>
                <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-ochre">
                  {ui('Step 01 · Plan & Billing Cycle', 'Hatua 01 · Mpango na Mzunguko', 'Paso 01 · Plan y Ciclo')}
                </span>
                <h2 className="mt-1 font-display text-2xl text-ink">
                  {ui('Select Membership Tier', 'Chagua Ngazi ya Uanachama', 'Seleccione Nivel')}
                </h2>

                <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-5">
                  {SUBSCRIPTION_TIER_LIST.map((tItem) => {
                    const active = tItem.tierName === selectedTier;
                    return (
                      <button
                        key={tItem.id}
                        type="button"
                        onClick={() => setSelectedTier(tItem.tierName)}
                        className={`flex flex-col justify-between rounded-xl border p-3 text-left transition ${
                          active
                            ? 'border-ochre bg-ink text-paper shadow-sm'
                            : 'border-ink/12 bg-paper/60 text-ink hover:border-ochre/45'
                        }`}
                      >
                        <span className="font-display text-sm font-semibold">
                          {tItem.tierName}
                        </span>
                        <span
                          className={`mt-1 font-mono text-[10px] ${
                            active ? 'text-gold' : 'text-stone'
                          }`}
                        >
                          {tItem.monthlyTzs === 0
                            ? 'Free'
                            : currency === 'TZS'
                              ? `TSh ${(tItem.monthlyTzs / 1000).toFixed(0)}k`
                              : formatPrice(tItem.monthlyUsd)}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Monthly vs Yearly Toggle */}
                <div className="mt-4 inline-flex rounded-lg border border-ink/15 bg-paper p-1">
                  <button
                    type="button"
                    onClick={() => setBillingCycle('monthly')}
                    className={`rounded-md px-4 py-1.5 text-xs font-semibold transition ${
                      billingCycle === 'monthly'
                        ? 'bg-ink text-paper'
                        : 'text-stone hover:text-ink'
                    }`}
                  >
                    {ui('Monthly Billing', 'Kila Mwezi', 'Mensual')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setBillingCycle('yearly')}
                    className={`rounded-md px-4 py-1.5 text-xs font-semibold transition ${
                      billingCycle === 'yearly'
                        ? 'bg-ink text-paper'
                        : 'text-stone hover:text-ink'
                    }`}
                  >
                    {ui('Yearly Billing', 'Kila Mwaka', 'Anual')}{' '}
                    <span className="ml-1 font-mono text-[10px] text-ochre">
                      ({ui('2 Months Free', 'Miezi 2 Bure', '2 Meses Gratis')})
                    </span>
                  </button>
                </div>
              </div>

              {/* 2. Payment Gateway Selection (Hidden if Explorer Free) */}
              {!isFreeExplorer && (
                <div className="border-t border-ink/10 pt-6">
                  <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-ochre">
                    {ui(
                      'Step 02 · Payment Rail Selection',
                      'Hatua 02 · Chagua Njia ya Malipo',
                      'Paso 02 · Seleccionar Pasarela de Pago'
                    )}
                  </span>
                  <h3 className="mt-1 font-display text-2xl text-ink">
                    {ui(
                      'Global Card or Tanzania Mobile Money',
                      'Malipo ya Simu (TZS) au Kadi za Kimataifa',
                      'Tarjeta Internacional o Dinero Móvil Local'
                    )}
                  </h3>

                  <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <button
                      type="button"
                      onClick={() => setSelectedGateway('AZAMPAY_MPESA_TZS')}
                      className={`flex flex-col justify-between rounded-xl border p-4 text-left transition ${
                        selectedGateway === 'AZAMPAY_MPESA_TZS'
                          ? 'border-ochre bg-ochre/10 ring-1 ring-ochre'
                          : 'border-ink/15 bg-white hover:border-ochre/40'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <Smartphone size={18} className="text-ochre" />
                        <span className="rounded bg-ink px-2 py-0.5 font-mono text-[9px] uppercase text-gold">
                          TZS Local Rail
                        </span>
                      </div>
                      <div className="mt-3 font-semibold text-ink">
                        AzamPay Mobile Money
                      </div>
                      <p className="mt-0.5 text-[11px] text-stone">
                        M-Pesa, Mixx by Yas (Tigo Pesa), Airtel Money
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSelectedGateway('STRIPE_GLOBAL')}
                      className={`flex flex-col justify-between rounded-xl border p-4 text-left transition ${
                        selectedGateway === 'STRIPE_GLOBAL'
                          ? 'border-ochre bg-ochre/10 ring-1 ring-ochre'
                          : 'border-ink/15 bg-white hover:border-ochre/40'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <CreditCard size={18} className="text-ochre" />
                        <span className="rounded bg-ink px-2 py-0.5 font-mono text-[9px] uppercase text-gold">
                          USD / EUR / GBP
                        </span>
                      </div>
                      <div className="mt-3 font-semibold text-ink">
                        Stripe Checkout
                      </div>
                      <p className="mt-0.5 text-[11px] text-stone">
                        Visa, Mastercard, Amex & International Cards
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSelectedGateway('FLUTTERWAVE_AFRICA')}
                      className={`flex flex-col justify-between rounded-xl border p-4 text-left transition ${
                        selectedGateway === 'FLUTTERWAVE_AFRICA'
                          ? 'border-ochre bg-ochre/10 ring-1 ring-ochre'
                          : 'border-ink/15 bg-white hover:border-ochre/40'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <Building2 size={18} className="text-ochre" />
                        <span className="rounded bg-ink px-2 py-0.5 font-mono text-[9px] uppercase text-gold">
                          Pan-African
                        </span>
                      </div>
                      <div className="mt-3 font-semibold text-ink">
                        Flutterwave / DPO
                      </div>
                      <p className="mt-0.5 text-[11px] text-stone">
                        CRDB, NMB, Stanbic & East African Mobile Rails
                      </p>
                    </button>
                  </div>

                  {/* Dynamic Gateway Form Inputs */}
                  {selectedGateway === 'STRIPE_GLOBAL' ? (
                    <div className="mt-5 space-y-4 rounded-xl border border-ink/12 bg-paper/70 p-5">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-semibold text-ink">
                          Stripe Global Card Authorization ({currencyMeta.flag}{' '}
                          {currency})
                        </span>
                        <Globe size={15} className="text-ochre" />
                      </div>

                      <div>
                        <label className="label">Cardholder Name</label>
                        <input
                          type="text"
                          required
                          value={cardHolder}
                          onChange={(e) => setCardHolder(e.target.value)}
                          className="field"
                        />
                      </div>

                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <div className="sm:col-span-2">
                          <label className="label">Card Number</label>
                          <input
                            type="text"
                            required
                            value={cardNumber}
                            onChange={(e) => setCardNumber(e.target.value)}
                            className="field font-mono"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="label">Expiry</label>
                            <input
                              type="text"
                              required
                              value={cardExpiry}
                              onChange={(e) => setCardExpiry(e.target.value)}
                              className="field font-mono"
                            />
                          </div>
                          <div>
                            <label className="label">CVC</label>
                            <input
                              type="text"
                              required
                              value={cardCvc}
                              onChange={(e) => setCardCvc(e.target.value)}
                              className="field font-mono"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-5 space-y-4 rounded-xl border border-ink/12 bg-paper/70 p-5">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-semibold text-ink">
                          Tanzania Mobile Money / Local Bank STK Push (TSh{' '}
                          {verifiedPricing.verifiedAmountTzs.toLocaleString(
                            'en-US'
                          )}
                          )
                        </span>
                        <Smartphone size={15} className="text-ochre" />
                      </div>

                      <div>
                        <label className="label">
                          Select Mobile Network / Bank Operator
                        </label>
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                          {(
                            [
                              'Vodacom M-Pesa',
                              'Mixx by Yas (Tigo Pesa)',
                              'Airtel Money',
                              'CRDB / NMB Bank Rail',
                            ] as const
                          ).map((operator) => (
                            <button
                              key={operator}
                              type="button"
                              onClick={() => setMobileProvider(operator)}
                              className={`rounded-lg border px-3 py-2 text-xs font-semibold transition ${
                                mobileProvider === operator
                                  ? 'border-ink bg-ink text-gold'
                                  : 'border-ink/15 bg-white text-ink hover:border-ochre'
                              }`}
                            >
                              {operator}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="label">
                          Registered Mobile Money Number (Tanzania +255)
                        </label>
                        <input
                          type="tel"
                          required
                          value={mobilePhone}
                          onChange={(e) => setMobilePhone(e.target.value)}
                          placeholder="+255 754 XXX XXX"
                          className="field font-mono"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Regulatory & PDPA 2022 Consent */}
              <div className="border-t border-ink/10 pt-5">
                <label className="flex cursor-pointer items-start gap-3 text-xs leading-relaxed text-stone">
                  <input
                    type="checkbox"
                    checked={pdpaConsent}
                    onChange={(e) => setPdpaConsent(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-ink/30 accent-ochre"
                  />
                  <span>
                    {ui(
                      'I acknowledge that MineConnect subscription fees are platform membership fees only and are strictly separate from Mining Commission statutory application, annual rent, or transfer fees. Personal billing data is processed in accordance with the Tanzania Personal Data Protection Act (PDPA 2022).',
                      'Ninakubali kuwa ada za uanachama wa MineConnect ni ada za jukwaa pekee na ni tofauti kabisa na ada za kisheria za Tume ya Madini. Taarifa binafsi zinalindwa chini ya Sheria ya Ulinzi wa Taarifa Binafsi (PDPA 2022).',
                      'Reconozco que las tarifas de suscripción de MineConnect son tarifas de plataforma independientes de las tasas gubernamentales de la Comisión Minera (PDPA 2022).'
                    )}
                  </span>
                </label>
              </div>

              {error && (
                <div className="rounded-lg border border-danger/40 bg-danger/10 p-3.5 text-xs font-medium text-danger">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={processing}
                className="btn-primary w-full justify-center !py-3.5 text-sm"
              >
                <ShieldCheck size={17} />
                {processing
                  ? ui(
                      'Verifying Server Price & Settling Webhook...',
                      'Inathibitisha Malipo...',
                      'Verificando Precio en Servidor...'
                    )
                  : isFreeExplorer
                    ? ui(
                        'Activate Explorer Plan (Free)',
                        'Washa Mpango wa Explorer (Bure)',
                        'Activar Plan Explorer (Gratis)'
                      )
                    : ui(
                        `Authorize & Subscribe to ${selectedTier} (${displayPrimaryAmount})`,
                        `Lipia na Uwezeshe ${selectedTier} (${displayPrimaryAmount})`,
                        `Suscribirse a ${selectedTier} (${displayPrimaryAmount})`
                      )}
              </button>
            </form>

            {/* Right Column: Anti-Tampering Server Price Breakdown & Feature Entitlements */}
            <aside className="space-y-6">
              <div className="grain relative overflow-hidden rounded-2xl border border-ink/15 bg-ink p-6 text-paper shadow-xl lg:p-7">
                <div
                  className="contours absolute inset-0 -z-10"
                  aria-hidden="true"
                />
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-widest text-gold">
                    <Crown size={12} />
                    {ui('Order Summary', 'Muhtasari wa Mpango', 'Resumen del Plan')}
                  </span>
                  <span className="rounded-full border border-moss/40 bg-moss/25 px-2.5 py-0.5 font-mono text-[10px] text-[#9de4b4]">
                    Server-Verified
                  </span>
                </div>

                <h3 className="mt-3 font-display text-3xl text-paper">
                  {verifiedPricing.tierName}{' '}
                  <span className="text-lg font-normal text-gold">
                    ({billingCycle === 'yearly' ? 'Annual' : 'Monthly'})
                  </span>
                </h3>
                <p className="mt-1 text-xs text-paper/65">
                  {verifiedPricing.tierConfig.tagline}
                </p>

                <div className="mt-6 space-y-2.5 rounded-xl border border-paper/12 bg-ink-2 p-4 font-mono text-xs">
                  <div className="flex justify-between text-paper/70">
                    <span>
                      {ui('Statutory Base (TZS)', 'Bei ya Msingi (TZS)', 'Base (TZS)')}
                    </span>
                    <span className="font-semibold text-paper">
                      TSh{' '}
                      {verifiedPricing.verifiedAmountTzs.toLocaleString('en-US')}
                    </span>
                  </div>
                  <div className="flex justify-between text-paper/70">
                    <span>
                      {ui('USD Parity Equivalent', 'Thamani kwa USD', 'Equivalente USD')}
                    </span>
                    <span>
                      US${verifiedPricing.verifiedAmountUsd.toLocaleString('en-US')}
                    </span>
                  </div>
                  <div className="flex justify-between border-t border-paper/10 pt-2.5 text-sm font-bold text-gold">
                    <span>
                      {ui(`Total in ${currency}`, `Jumla kwa ${currency}`, `Total en ${currency}`)}
                    </span>
                    <span>{displayPrimaryAmount}</span>
                  </div>
                </div>

                {/* Quota & Feature Breakdown */}
                <div className="mt-6">
                  <div className="font-mono text-[10px] uppercase tracking-wider text-gold">
                    <Sparkles size={11} className="mr-1 inline" />
                    {ui(
                      'Unlocked Quotas & Capabilities',
                      'Huduma Zinazofunguliwa',
                      'Cuotas y Permisos Incluidos'
                    )}
                  </div>
                  <ul className="mt-3 space-y-2 text-xs text-paper/85">
                    {verifiedPricing.tierConfig.features.map((feat) => (
                      <li key={feat} className="flex items-start gap-2">
                        <CheckCircle2
                          size={14}
                          className="mt-0.5 shrink-0 text-[#9de4b4]"
                        />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-6 border-t border-paper/10 pt-4 font-mono text-[10px] leading-relaxed text-paper/55">
                  {ui(
                    'Anti-Tampering Guarantee: Checkout totals are resolved strictly on the server from `SUBSCRIPTION_TIERS` before dispatching Stripe or AzamPay webhook settlements.',
                    'Usalama wa Bei: Viwango vya malipo vinahakikiwa moja kwa moja kwenye seva ili kuzuia udanganyifu.',
                    'Garantía Anti-Manipulación: Los totales se validan estrictamente en el servidor.'
                  )}
                </div>
              </div>
            </aside>
          </div>
        )}
      </section>
    </div>
  );
}
