import { createFileRoute, Link } from '@tanstack/react-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  CreditCard,
  Crown,
  Landmark,
  Columns2,
  Lock,
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
import { ensureAdminDemoSession, useAuthSession } from '../lib/supabaseAuth';
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

  // Display mode: 'both' shows Local Mobile Money AND International Checkout side-by-side
  const [viewMode, setViewMode] = useState<
    'both' | 'mobile_money' | 'international'
  >('both');

  const [pdpaConsent, setPdpaConsent] = useState(true);

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

  // Ensure an active member/guest session id is always available so payment options never block
  const effectiveUserId = useMemo(() => {
    if (session?.user.id) return session.user.id;
    const fallback = ensureAdminDemoSession();
    return fallback.user.id;
  }, [session?.user.id]);

  // Server-side anti-tampering dictionary lookup
  const verifiedPricing = useMemo(
    () => resolveVerifiedTierPricing(selectedTier, billingCycle),
    [selectedTier, billingCycle]
  );

  const displayPrimaryAmount = useMemo(() => {
    if (verifiedPricing.verifiedAmountTzs === 0) {
      return ui('Free (TSh 0)', 'Bure (TSh 0)', 'Gratis (TSh 0)');
    }
    if (currency === 'TZS') {
      return `TSh ${verifiedPricing.verifiedAmountTzs.toLocaleString('en-US')}`;
    }
    return formatPrice(verifiedPricing.verifiedAmountUsd);
  }, [currency, verifiedPricing, formatPrice, ui]);

  return (
    <div className="min-h-screen bg-paper pt-[72px] text-ink">
      {/* Top Masthead */}
      <section className="grain relative overflow-hidden border-b border-ink/15 bg-ink py-10 text-paper">
        <div className="contours absolute inset-0 -z-10" aria-hidden="true" />
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
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

          <div className="mt-5 flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
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
                <em className="italic text-gold">{selectedTier}</em>{' '}
                <span className="font-mono text-2xl text-paper/80">
                  ({displayPrimaryAmount}
                  {verifiedPricing.verifiedAmountTzs > 0
                    ? billingCycle === 'yearly'
                      ? '/yr'
                      : '/mo'
                    : ''}
                  )
                </span>
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-paper/70">
                {ui(
                  'Pay via Local Tanzania Mobile Money (Airtel Money, Mixx by Yas, Halopesa, Azampesa, M-Pesa, T-Pesa) or International Digital Wallets & Cards (Apple Pay, Google Pay, Visa, Mastercard, Discover).',
                  'Lipia kupitia Malipo ya Simu (Airtel Money, Mixx by Yas, Halopesa, Azampesa, M-Pesa, T-Pesa) au Kadi za Kimataifa (Apple Pay, Google Pay, Visa, Mastercard).',
                  'Pague mediante Dinero Móvil de Tanzania o Billeteras y Tarjetas Internacionales (Apple Pay, Google Pay, Visa, Mastercard, Discover).'
                )}
              </p>
            </div>

            <div className="rounded-xl border border-gold/35 bg-ink-2 px-4 py-3 font-mono text-xs">
              <div className="text-[10px] uppercase tracking-wider text-gold">
                {ui(
                  'Direct Merchant Bank Settlement',
                  'Akaunti ya Mapato ya Jukwaa',
                  'Cuenta Bancaria de Liquidación'
                )}
              </div>
              <div className="mt-0.5 font-semibold text-paper">
                {MERCHANT_SETTLEMENT_ACCOUNT.bankName}
              </div>
              <div className="mt-0.5 text-[11px] text-paper/75">
                Acc:{' '}
                <strong className="text-gold">
                  {MERCHANT_SETTLEMENT_ACCOUNT.accountNumber}
                </strong>{' '}
                · {MERCHANT_SETTLEMENT_ACCOUNT.accountName}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <section className="mx-auto max-w-7xl px-5 py-10 lg:px-8">
        {receipt ? (
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
                  {ui(
                    'Transaction Reference',
                    'Kumbukumbu ya Malipo',
                    'Referencia'
                  )}
                </dt>
                <dd className="mt-1 font-bold text-gold">{receipt.reference}</dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase text-paper/50">
                  {ui(
                    'Payment Gateway Channel',
                    'Njia ya Malipo',
                    'Canal de Pago'
                  )}
                </dt>
                <dd className="mt-1 text-paper">{receipt.gatewayLabel}</dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase text-paper/50">
                  {ui(
                    'Server-Verified Amount',
                    'Kiasi Kilichothibitishwa',
                    'Monto Verificado'
                  )}
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
          <div className="space-y-8">
            {/* Step 1: Plan & Billing Cycle Bar */}
            <div className="rounded-2xl border border-ink/12 bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-ochre">
                    {ui(
                      'Step 01 · Membership Plan & Billing Cycle',
                      'Hatua 01 · Mpango na Mzunguko wa Malipo',
                      'Paso 01 · Plan y Ciclo de Facturación'
                    )}
                  </span>
                  <h2 className="mt-0.5 font-display text-2xl text-ink">
                    {ui(
                      'Select Tier to Subscribe',
                      'Chagua Ngazi ya Uanachama',
                      'Seleccione Nivel de Suscripción'
                    )}
                  </h2>
                </div>

                <div className="flex flex-wrap items-center gap-3">
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
                      {ui('Yearly (2 Months Free)', 'Mwaka (Miezi 2 Bure)', 'Anual (-17%)')}
                    </button>
                  </div>

                  {/* Layout Switcher */}
                  <div className="inline-flex rounded-lg border border-ink/15 bg-paper p-1 text-xs">
                    <button
                      type="button"
                      onClick={() => setViewMode('both')}
                      className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 font-semibold transition ${
                        viewMode === 'both'
                          ? 'bg-ochre text-paper'
                          : 'text-stone hover:text-ink'
                      }`}
                    >
                      <Columns2 size={13} />
                      {ui('Both Gateways', 'Njia Zote Mbili', 'Ambas Pasarelas')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode('mobile_money')}
                      className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 font-semibold transition ${
                        viewMode === 'mobile_money'
                          ? 'bg-ochre text-paper'
                          : 'text-stone hover:text-ink'
                      }`}
                    >
                      <Smartphone size={13} />
                      {ui('Mobile Money', 'Malipo ya Simu', 'Dinero Móvil')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode('international')}
                      className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 font-semibold transition ${
                        viewMode === 'international'
                          ? 'bg-ochre text-paper'
                          : 'text-stone hover:text-ink'
                      }`}
                    >
                      <CreditCard size={13} />
                      {ui('Cards / Apple & Google Pay', 'Kadi / Wallets', 'Tarjetas / Wallets')}
                    </button>
                  </div>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-5">
                {SUBSCRIPTION_TIER_LIST.map((tItem) => {
                  const active = tItem.tierName === selectedTier;
                  const priceTzs =
                    billingCycle === 'yearly'
                      ? tItem.yearlyTzs
                      : tItem.monthlyTzs;
                  const priceUsd =
                    billingCycle === 'yearly'
                      ? tItem.yearlyUsd
                      : tItem.monthlyUsd;
                  return (
                    <button
                      key={tItem.id}
                      type="button"
                      onClick={() => setSelectedTier(tItem.tierName)}
                      className={`flex flex-col justify-between rounded-xl border p-3.5 text-left transition ${
                        active
                          ? 'border-ochre bg-ink text-paper shadow-md ring-2 ring-ochre/40'
                          : 'border-ink/12 bg-paper/60 text-ink hover:border-ochre/45'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-display text-base font-semibold">
                          {tItem.tierName}
                        </span>
                        {active && (
                          <span className="rounded bg-gold px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase text-ink">
                            Selected
                          </span>
                        )}
                      </div>
                      <span
                        className={`mt-1.5 font-mono text-xs font-bold ${
                          active ? 'text-gold' : 'text-ochre'
                        }`}
                      >
                        {priceTzs === 0
                          ? 'Free (TSh 0)'
                          : currency === 'TZS'
                            ? `TSh ${priceTzs.toLocaleString('en-US')}`
                            : formatPrice(priceUsd)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Step 2: Dual-Rail Payment Gateways (Local Mobile Money + International Cards/Wallets) */}
            <div
              className={`grid grid-cols-1 gap-8 ${
                viewMode === 'both' ? ' lg:grid-cols-2' : 'mx-auto max-w-2xl'
              }`}
            >
              {(viewMode === 'both' || viewMode === 'mobile_money') && (
                <LocalMobileCheckout
                  userId={effectiveUserId}
                  tierName={selectedTier}
                  billingCycle={billingCycle}
                  formattedAmount={displayPrimaryAmount}
                  verifiedAmountTzs={verifiedPricing.verifiedAmountTzs}
                  pdpaConsent={pdpaConsent}
                  onSwitchToCardRail={() => setViewMode('international')}
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

              {(viewMode === 'both' || viewMode === 'international') && (
                <InternationalCheckout
                  userId={effectiveUserId}
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
            </div>

            {/* Step 3: Order Summary, NMB Bank Settlement Routing & PDPA 2022 Consent */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.3fr_1fr]">
              <div className="rounded-2xl border border-ink/12 bg-white p-5">
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

                <div className="mt-4 flex flex-wrap gap-2 border-t border-ink/10 pt-4">
                  <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-ochre">
                    <Sparkles size={11} className="mr-1 inline" />
                    {selectedTier} Entitlements:
                  </span>
                  {verifiedPricing.tierConfig.features.map((feat) => (
                    <span
                      key={feat}
                      className="inline-flex items-center gap-1 rounded-md border border-ink/12 bg-paper px-2.5 py-1 text-[11px] font-medium text-ink"
                    >
                      <CheckCircle2 size={12} className="text-moss" />
                      {feat}
                    </span>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-ink/15 bg-ink p-5 font-mono text-xs text-paper">
                <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-gold">
                  <span className="inline-flex items-center gap-1.5">
                    <Crown size={12} />
                    {ui(
                      'Merchant Payout Settlement Summary',
                      'Muhtasari wa Akaunti ya Mapato',
                      'Resumen de Liquidación Bancaria'
                    )}
                  </span>
                  <span className="rounded bg-moss/30 px-2 py-0.5 text-[#9de4b4]">
                    Active Routing
                  </span>
                </div>
                <dl className="mt-3 space-y-1.5 text-[11px]">
                  <div className="flex justify-between">
                    <dt className="text-paper/60">Destination Bank:</dt>
                    <dd className="font-semibold text-paper">
                      {MERCHANT_SETTLEMENT_ACCOUNT.bankName}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-paper/60">NMB Account Number:</dt>
                    <dd className="font-bold text-gold">
                      {MERCHANT_SETTLEMENT_ACCOUNT.accountNumber}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-paper/60">Beneficiary Name:</dt>
                    <dd className="font-semibold text-paper">
                      {MERCHANT_SETTLEMENT_ACCOUNT.accountName}
                    </dd>
                  </div>
                  <div className="flex justify-between border-t border-paper/10 pt-2">
                    <dt className="text-paper/60">Your Current Tier:</dt>
                    <dd className="text-gold">{currentSub.tier_name}</dd>
                  </div>
                </dl>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
