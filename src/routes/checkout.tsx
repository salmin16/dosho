import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  CreditCard,
  Crown,
  Landmark,
  Lock,
  ShieldCheck,
  Smartphone,
  Sparkles,
} from 'lucide-react';
import { useLocalization } from '../context/LocalizationContext';
import CurrencySwitcher from '../components/CurrencySwitcher';
import LanguageSwitcher from '../components/LanguageSwitcher';
import InternationalCheckout from '../components/InternationalCheckout';
import LocalMobileCheckout from '../components/LocalMobileCheckout';
import {
  MERCHANT_SETTLEMENT_ACCOUNT,
  type SettlementLedgerEntry,
} from '../lib/payments/settlement';
import {
  SUBSCRIPTION_TIER_LIST,
  normalizeBillingCycle,
  normalizeSubscriptionTier,
  resolveVerifiedTierPricing,
  useSubscription,
} from '../lib/subscriptions';
import { processVerifiedCheckoutSession } from '../app/api/checkout/route';
import { useAuthSession } from '../lib/supabaseAuth';
import type { BillingCycle, SubscriptionTierName } from '../types/database';

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
          'Dual-Rail Subscription Checkout (Mobile Money & International Cards) — MineConnect',
      },
    ],
  }),
  component: CheckoutPageComponent,
});

function CheckoutPageComponent() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const session = useAuthSession();
  const { subscription: currentSub } = useSubscription();
  const { currency, formatPrice, ui } = useLocalization();

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

  // Dual-rail tab: 'mobile_money' (Airtel, Mixx, Halopesa, Azampesa, M-Pesa, T-Pesa) vs 'international' (Apple Pay, Google Pay, Visa/MC/Discover)
  const [activeRail, setActiveRail] = useState<'mobile_money' | 'international'>(
    () => (currency === 'TZS' ? 'mobile_money' : 'international')
  );

  const [pdpaConsent, setPdpaConsent] = useState(true);
  const [processingFree, setProcessingFree] = useState(false);

  const [receipt, setReceipt] = useState<{
    reference: string;
    tierName: SubscriptionTierName;
    billingCycle: BillingCycle;
    gatewayLabel: string;
    amountTzs: number;
    amountUsd: number;
    expiresAt: string;
    settlement?: SettlementLedgerEntry;
  } | null>(null);

  // Server-side anti-tampering dictionary lookup
  const verifiedPricing = useMemo(
    () => resolveVerifiedTierPricing(selectedTier, billingCycle),
    [selectedTier, billingCycle]
  );

  const isFreeExplorer = verifiedPricing.verifiedAmountTzs === 0;

  const displayPrimaryAmount = useMemo(() => {
    if (isFreeExplorer)
      return ui('Free (TSh 0)', 'Bure (TSh 0)', 'Gratis (TSh 0)');
    if (currency === 'TZS') {
      return `TSh ${verifiedPricing.verifiedAmountTzs.toLocaleString('en-US')}`;
    }
    return formatPrice(verifiedPricing.verifiedAmountUsd);
  }, [isFreeExplorer, currency, verifiedPricing, formatPrice, ui]);

  const handleActivateFreeExplorer = async () => {
    if (!session) {
      navigate({
        to: '/login',
        search: {
          next: `/checkout?tier=explorer&billing=${billingCycle}`,
        } as never,
      });
      return;
    }

    setProcessingFree(true);
    try {
      const res = await processVerifiedCheckoutSession({
        userId: session.user.id,
        tier: 'Explorer',
        billing: billingCycle,
        gateway: 'FREE_TIER',
        paymentMethodLabel: 'Explorer Free Tier Activation',
        currency,
      });

      if (res.ok && res.subscription && res.transaction) {
        setReceipt({
          reference: res.transaction.external_reference,
          tierName: res.subscription.tier_name,
          billingCycle: res.subscription.billing_cycle,
          gatewayLabel: 'Explorer Free Tier',
          amountTzs: 0,
          amountUsd: 0,
          expiresAt: res.subscription.expires_at,
        });
      }
    } finally {
      setProcessingFree(false);
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
                  'Dual-Rail Payment Gateway · Direct NMB Bank Settlement (60510047212)',
                  'Mfumo wa Malipo wa Njia Mbili · NMB Bank (60510047212)',
                  'Pasarela de Pago de Doble Vía · Liquidación Directa NMB Bank'
                )}
              </span>
              <h1 className="mt-3 font-display text-4xl font-light text-paper md:text-5xl">
                {ui('Subscribe to', 'Jiunge na Mpango wa', 'Suscribirse a')}{' '}
                <em className="italic text-gold">{selectedTier}</em>
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-paper/70">
                {ui(
                  'Choose between Local Tanzania Mobile Money (Airtel Money, Mixx by Yas, Halopesa, Azampesa, M-Pesa, T-Pesa) or International Digital Wallets & Cards (Apple Pay, Google Pay, Visa, Mastercard, Discover).',
                  'Chagua kati ya Malipo ya Simu (Airtel Money, Mixx by Yas, Halopesa, Azampesa, M-Pesa, T-Pesa) au Kadi za Kimataifa (Apple Pay, Google Pay, Visa, Mastercard).',
                  'Elija entre Dinero Móvil de Tanzania o Billeteras y Tarjetas Internacionales (Apple Pay, Google Pay, Visa, Mastercard, Discover).'
                )}
              </p>
            </div>

            {session && (
              <div className="rounded-xl border border-paper/15 bg-ink-2 px-4 py-3 font-mono text-xs">
                <div className="text-[10px] uppercase tracking-wider text-paper/55">
                  {ui(
                    'Authenticated Member',
                    'Mwanachama Aliyeingia',
                    'Miembro Autenticado'
                  )}
                </div>
                <div className="mt-0.5 font-semibold text-gold">
                  {session.user.email}
                </div>
                <div className="mt-0.5 text-[11px] text-paper/65">
                  {ui('Active Tier:', 'Mpango wa Sasa:', 'Plan Actual:')}{' '}
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
                `Please sign in or create your MineConnect account to bind the ${selectedTier} (${billingCycle}) subscription to your profile.`,
                `Tafadhali ingia au fungua akaunti ili kuunganisha mpango wa ${selectedTier} (${billingCycle}) kwenye akaunti yako.`,
                `Inicie sesión o cree una cuenta para vincular el plan ${selectedTier} a su perfil.`
              )}
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link to="/login" className="btn-primary">
                {ui('Sign In to Continue', 'Ingia Kuendelea', 'Iniciar Sesión')}
                <ArrowRight size={15} />
              </Link>
              <Link to="/signup" className="btn-ghost">
                {ui('Create Account', 'Fungua Akaunti', 'Crear Cuenta')}
              </Link>
            </div>
          </div>
        ) : receipt ? (
          /* Verified Webhook & NMB Bank Settlement Receipt */
          <div className="mx-auto max-w-2xl overflow-hidden rounded-2xl border border-moss/40 bg-ink p-8 text-paper shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-moss/30 text-[#9de4b4]">
                <CheckCircle2 size={26} />
              </div>
              <div>
                <span className="font-mono text-[10px] font-semibold uppercase tracking-widest text-[#9de4b4]">
                  {ui(
                    'WEBHOOK VERIFIED · NMB BANK SETTLEMENT ROUTED',
                    'MALIPO YAMETHIBITISHWA · NMB BANK 60510047212',
                    'WEBHOOK VERIFICADO · LIQUIDACIÓN NMB BANK'
                  )}
                </span>
                <h2 className="font-display text-3xl text-paper">
                  {receipt.tierName}{' '}
                  {ui('Tier Activated', 'Imewashwa', 'Activado')}
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
                  {ui('Payment Gateway Channel', 'Njia ya Malipo', 'Canal de Pago')}
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

            {/* Merchant Bank Settlement Confirmation Card */}
            <div className="mt-4 rounded-xl border border-gold/30 bg-ochre/15 p-4 font-mono text-xs">
              <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-gold">
                <span className="inline-flex items-center gap-1.5 font-semibold">
                  <Landmark size={13} />
                  {ui(
                    'Designated Merchant Payout Destination',
                    'Akaunti Rasmi ya Mapato ya Jukwaa',
                    'Cuenta Bancaria de Liquidación'
                  )}
                </span>
                <span className="rounded bg-moss/40 px-2 py-0.5 text-[#9de4b4]">
                  {receipt.settlement?.settlementStatus.toUpperCase() ||
                    'SETTLED'}
                </span>
              </div>
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
                <div>
                  <span className="text-[10px] text-paper/55">Bank Name</span>
                  <div className="font-semibold text-paper">
                    {MERCHANT_SETTLEMENT_ACCOUNT.bankName}
                  </div>
                </div>
                <div>
                  <span className="text-[10px] text-paper/55">
                    Account Number
                  </span>
                  <div className="font-bold text-gold">
                    {MERCHANT_SETTLEMENT_ACCOUNT.accountNumber}
                  </div>
                </div>
                <div>
                  <span className="text-[10px] text-paper/55">
                    Beneficiary Name
                  </span>
                  <div className="font-semibold text-paper">
                    {MERCHANT_SETTLEMENT_ACCOUNT.accountName}
                  </div>
                </div>
              </div>
            </div>

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
                {ui(
                  'List a Mining Project',
                  'Sajili Mradi wa Madini',
                  'Publicar Proyecto'
                )}
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1.3fr_0.85fr]">
            {/* Left Column: Plan Selector + Dual-Rail Gateway Switcher + Active Checkout Component */}
            <div className="space-y-6">
              {/* Step 1: Plan & Billing Cycle Selection */}
              <div className="rounded-2xl border border-ink/12 bg-white p-6 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-ochre">
                      {ui(
                        'Step 01 · Plan & Billing Cycle',
                        'Hatua 01 · Mpango na Mzunguko',
                        'Paso 01 · Plan y Ciclo'
                      )}
                    </span>
                    <h2 className="mt-0.5 font-display text-2xl text-ink">
                      {ui(
                        'Select Membership Tier',
                        'Chagua Ngazi ya Uanachama',
                        'Seleccione Nivel'
                      )}
                    </h2>
                  </div>

                  {/* Monthly vs Yearly Toggle */}
                  <div className="inline-flex rounded-lg border border-ink/15 bg-paper p-1">
                    <button
                      type="button"
                      onClick={() => setBillingCycle('monthly')}
                      className={`rounded-md px-3.5 py-1.5 text-xs font-semibold transition ${
                        billingCycle === 'monthly'
                          ? 'bg-ink text-paper'
                          : 'text-stone hover:text-ink'
                      }`}
                    >
                      {ui('Monthly', 'Mwezi', 'Mensual')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setBillingCycle('yearly')}
                      className={`rounded-md px-3.5 py-1.5 text-xs font-semibold transition ${
                        billingCycle === 'yearly'
                          ? 'bg-ink text-paper'
                          : 'text-stone hover:text-ink'
                      }`}
                    >
                      {ui('Yearly', 'Mwaka', 'Anual')}{' '}
                      <span className="ml-1 font-mono text-[10px] text-gold">
                        (-17%)
                      </span>
                    </button>
                  </div>
                </div>

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
              </div>

              {/* Step 2: Dual-Rail Checkout Gateway Selector */}
              {isFreeExplorer ? (
                <div className="rounded-2xl border border-ink/15 bg-white p-6 shadow-sm">
                  <h3 className="font-display text-2xl text-ink">
                    {ui(
                      'Explorer Free Membership Activation',
                      'Washa Mpango wa Bure wa Explorer',
                      'Activación Gratuita del Plan Explorer'
                    )}
                  </h3>
                  <p className="mt-1 text-sm text-stone">
                    {ui(
                      'No payment required for the Explorer tier. Click below to activate immediately.',
                      'Hakuna malipo yanayohitajika kwa ngazi ya Explorer.',
                      'No se requiere pago para el nivel Explorer.'
                    )}
                  </p>
                  <button
                    type="button"
                    disabled={processingFree}
                    onClick={() => void handleActivateFreeExplorer()}
                    className="btn-primary mt-5 w-full justify-center !py-3.5 text-sm"
                  >
                    <ShieldCheck size={17} />
                    {processingFree
                      ? 'Activating...'
                      : ui(
                          'Activate Explorer Plan (Free)',
                          'Washa Mpango wa Explorer (Bure)',
                          'Activar Plan Explorer (Gratis)'
                        )}
                  </button>
                </div>
              ) : (
                <>
                  {/* Gateway Rail Tabs */}
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => setActiveRail('mobile_money')}
                      className={`flex items-center justify-between rounded-xl border p-4 text-left transition ${
                        activeRail === 'mobile_money'
                          ? 'border-ochre bg-ink text-paper shadow-md'
                          : 'border-ink/15 bg-white text-ink hover:border-ochre/45'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                            activeRail === 'mobile_money'
                              ? 'bg-ochre/25 text-gold'
                              : 'bg-ochre/10 text-ochre'
                          }`}
                        >
                          <Smartphone size={20} />
                        </div>
                        <div>
                          <div className="text-sm font-semibold">
                            {ui(
                              'Local Mobile Money Gateway',
                              'Malipo ya Simu (Tanzania)',
                              'Dinero Móvil Local (Tanzania)'
                            )}
                          </div>
                          <div
                            className={`text-[11px] ${
                              activeRail === 'mobile_money'
                                ? 'text-paper/65'
                                : 'text-stone'
                            }`}
                          >
                            Airtel, Mixx by Yas, Halopesa, Azampesa, M-Pesa, T-Pesa
                          </div>
                        </div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveRail('international')}
                      className={`flex items-center justify-between rounded-xl border p-4 text-left transition ${
                        activeRail === 'international'
                          ? 'border-ochre bg-ink text-paper shadow-md'
                          : 'border-ink/15 bg-white text-ink hover:border-ochre/45'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                            activeRail === 'international'
                              ? 'bg-ochre/25 text-gold'
                              : 'bg-ochre/10 text-ochre'
                          }`}
                        >
                          <CreditCard size={20} />
                        </div>
                        <div>
                          <div className="text-sm font-semibold">
                            {ui(
                              'International Cards & Wallets',
                              'Kadi za Kimataifa na Wallets',
                              'Tarjetas y Billeteras Internacionales'
                            )}
                          </div>
                          <div
                            className={`text-[11px] ${
                              activeRail === 'international'
                                ? 'text-paper/65'
                                : 'text-stone'
                            }`}
                          >
                            Apple Pay, Google Pay, Visa, Mastercard, Discover
                          </div>
                        </div>
                      </div>
                    </button>
                  </div>

                  {/* Active Checkout Component */}
                  {activeRail === 'mobile_money' ? (
                    <LocalMobileCheckout
                      userId={session.user.id}
                      tierName={selectedTier}
                      billingCycle={billingCycle}
                      formattedAmount={displayPrimaryAmount}
                      verifiedAmountTzs={verifiedPricing.verifiedAmountTzs}
                      pdpaConsent={pdpaConsent}
                      onSwitchToCardRail={() => setActiveRail('international')}
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
                          });
                        }
                      }}
                    />
                  ) : (
                    <InternationalCheckout
                      userId={session.user.id}
                      tierName={selectedTier}
                      billingCycle={billingCycle}
                      formattedAmount={displayPrimaryAmount}
                      pdpaConsent={pdpaConsent}
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
                          });
                        }
                      }}
                    />
                  )}
                </>
              )}

              {/* Regulatory & PDPA 2022 Consent */}
              <div className="rounded-xl border border-ink/12 bg-white p-4">
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
                      'Ninakubali kuwa ada za uanachama wa MineConnect ni ada za jukwaa pekee na ni tofauti kabisa na ada za kisheria za Tume ya Madini (PDPA 2022).',
                      'Reconozco que las tarifas de suscripción de MineConnect son tarifas de plataforma independientes de las tasas gubernamentales de la Comisión Minera (PDPA 2022).'
                    )}
                  </span>
                </label>
              </div>
            </div>

            {/* Right Column: Server-Verified Order Summary & NMB Settlement Destination */}
            <aside className="space-y-6">
              <div className="grain relative overflow-hidden rounded-2xl border border-ink/15 bg-ink p-6 text-paper shadow-xl lg:p-7">
                <div
                  className="contours absolute inset-0 -z-10"
                  aria-hidden="true"
                />
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-widest text-gold">
                    <Crown size={12} />
                    {ui(
                      'Order Summary',
                      'Muhtasari wa Mpango',
                      'Resumen del Plan'
                    )}
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
                      {ui(
                        'Statutory Base (TZS)',
                        'Bei ya Msingi (TZS)',
                        'Base (TZS)'
                      )}
                    </span>
                    <span className="font-semibold text-paper">
                      TSh{' '}
                      {verifiedPricing.verifiedAmountTzs.toLocaleString(
                        'en-US'
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between text-paper/70">
                    <span>
                      {ui(
                        'USD Parity Equivalent',
                        'Thamani kwa USD',
                        'Equivalente USD'
                      )}
                    </span>
                    <span>
                      US$
                      {verifiedPricing.verifiedAmountUsd.toLocaleString(
                        'en-US'
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between border-t border-paper/10 pt-2.5 text-sm font-bold text-gold">
                    <span>
                      {ui(
                        `Total in ${currency}`,
                        `Jumla kwa ${currency}`,
                        `Total en ${currency}`
                      )}
                    </span>
                    <span>{displayPrimaryAmount}</span>
                  </div>
                </div>

                {/* Designated Merchant Bank Routing Card */}
                <div className="mt-5 rounded-xl border border-gold/30 bg-ochre/15 p-4 font-mono text-xs">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-gold">
                    <Landmark size={13} />
                    {ui(
                      'Merchant Settlement Routing',
                      'Akaunti ya Mapato ya Jukwaa',
                      'Liquidación Bancaria Directa'
                    )}
                  </div>
                  <dl className="mt-2.5 space-y-1.5 text-[11px]">
                    <div className="flex justify-between gap-2">
                      <dt className="text-paper/60">Bank:</dt>
                      <dd className="text-right font-semibold text-paper">
                        NMB Bank (Tanzania)
                      </dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-paper/60">Account No:</dt>
                      <dd className="font-bold text-gold">
                        {MERCHANT_SETTLEMENT_ACCOUNT.accountNumber}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-paper/60">Beneficiary:</dt>
                      <dd className="font-semibold text-paper">
                        {MERCHANT_SETTLEMENT_ACCOUNT.accountName}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-paper/60">SWIFT / BIC:</dt>
                      <dd className="text-paper/80">
                        {MERCHANT_SETTLEMENT_ACCOUNT.swiftBic}
                      </dd>
                    </div>
                  </dl>
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
              </div>
            </aside>
          </div>
        )}
      </section>
    </div>
  );
}
