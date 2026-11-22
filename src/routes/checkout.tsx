import { createFileRoute, Link } from '@tanstack/react-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Lock,
  ShieldCheck,
} from 'lucide-react';
import { useLocalization } from '../context/LocalizationContext';
import CurrencySwitcher from '../components/CurrencySwitcher';
import LanguageSwitcher from '../components/LanguageSwitcher';
import ClickPesaGatewayPanel from '../components/ClickPesaGatewayPanel';
import {
  SUBSCRIPTION_TIER_LIST,
  normalizeBillingCycle,
  normalizeSubscriptionTier,
  resolveVerifiedTierPricing,
} from '../lib/subscriptions';
import { useAuthState } from '../lib/supabaseAuth';
import type {
  BillingCycle,
  PaymentTransactionRecord,
  SubscriptionTierName,
  UserSubscriptionRecord,
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
          'ClickPesa Subscription Checkout (Mobile Money, Banks & Cards) — MineConnect',
      },
    ],
  }),
  component: CheckoutPageComponent,
});

function CheckoutPageComponent() {
  const search = Route.useSearch();
  const { session } = useAuthState();
  const { currency, formatPrice, ui } = useLocalization();

  const [selectedTier, setSelectedTier] = useState<SubscriptionTierName>(() =>
    normalizeSubscriptionTier(search.tier)
  );
  const [billingCycle, setBillingCycle] = useState<BillingCycle>(() =>
    normalizeBillingCycle(search.billing)
  );

  useEffect(() => {
    setSelectedTier(normalizeSubscriptionTier(search.tier));
    setBillingCycle(normalizeBillingCycle(search.billing));
  }, [search.tier, search.billing]);

  const [settledReceipt, setSettledReceipt] = useState<{
    subscription: UserSubscriptionRecord;
    transaction: PaymentTransactionRecord;
    webhookSignature?: string;
  } | null>(null);

  const effectiveUserId = session?.user.id ?? '';

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

          <div className="mt-5 flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-gold/35 bg-ochre/20 px-3 py-1 font-mono text-[11px] font-semibold uppercase tracking-widest text-gold">
                <Lock size={12} />
                ClickPesa FinTech Gateway · Mobile Money, CRDB/NMB/NBC &amp; Cards
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
                  'Powered by ClickPesa: Pay via Tanzanian Mobile Money (M-Pesa, Airtel Money, Mixx by Yas/Tigo, HaloPesa, EzyPesa), Bank Payments (CRDB, NMB, NBC), or International Cards (Visa, Mastercard, UnionPay).',
                  'Inaendeshwa na ClickPesa: Lipia kupitia M-Pesa, Airtel Money, Mixx by Yas, HaloPesa, EzyPesa, Benki (CRDB, NMB, NBC), au Kadi (Visa, Mastercard, UnionPay).',
                  'Impulsado por ClickPesa: Dinero Móvil de Tanzania, Pagos Bancarios (CRDB, NMB, NBC) y Tarjetas Internacionales (Visa, Mastercard, UnionPay).'
                )}
              </p>
            </div>

            <div className="rounded-xl border border-gold/35 bg-ink-2 px-4 py-3 font-mono text-xs">
              <div className="text-[10px] uppercase tracking-wider text-gold">
                Idempotent &amp; Webhook Reconciled
              </div>
              <div className="mt-0.5 font-semibold text-paper">
                POST /api/payments/create
              </div>
              <div className="mt-0.5 text-[11px] text-paper/75">
                HMAC-SHA256 Signature Verified
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <section className="mx-auto max-w-6xl px-5 py-10 lg:px-8">
        {settledReceipt ? (
          <div className="mx-auto max-w-2xl overflow-hidden rounded-2xl border border-moss/40 bg-ink p-8 text-paper shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-moss/30 text-[#9de4b4]">
                <CheckCircle2 size={26} />
              </div>
              <div>
                <span className="font-mono text-[10px] font-semibold uppercase tracking-widest text-[#9de4b4]">
                  CLICKPESA WEBHOOK VERIFIED · STATE: SETTLED
                </span>
                <h2 className="font-display text-3xl text-paper">
                  {settledReceipt.subscription.tier_name} Tier Activated
                </h2>
              </div>
            </div>

            <dl className="mt-6 grid grid-cols-1 gap-4 rounded-xl border border-paper/12 bg-ink-2 p-5 font-mono text-xs sm:grid-cols-2">
              <div>
                <dt className="text-[10px] uppercase text-paper/50">
                  ClickPesa Order ID
                </dt>
                <dd className="mt-1 font-bold text-gold">
                  {settledReceipt.transaction.clickpesa_order_id}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase text-paper/50">
                  Payment Channel
                </dt>
                <dd className="mt-1 text-paper">
                  {settledReceipt.transaction.payment_method_label}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase text-paper/50">
                  Server-Verified Amount
                </dt>
                <dd className="mt-1 font-bold text-[#9de4b4]">
                  TSh{' '}
                  {settledReceipt.transaction.verified_amount_tzs.toLocaleString(
                    'en-US'
                  )}{' '}
                  ({formatPrice(settledReceipt.transaction.verified_amount_usd)})
                </dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase text-paper/50">
                  Active Until
                </dt>
                <dd className="mt-1 text-paper">
                  {new Date(
                    settledReceipt.subscription.expires_at
                  ).toLocaleDateString(undefined, {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </dd>
              </div>
            </dl>

            <div className="mt-4 rounded-xl border border-gold/30 bg-ochre/15 p-4 font-mono text-xs">
              <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-gold">
                <span className="inline-flex items-center gap-1.5 font-semibold">
                  <ShieldCheck size={13} />
                  HMAC-SHA256 Webhook Reconciliation
                </span>
                <span className="rounded bg-moss/40 px-2 py-0.5 text-[#9de4b4]">
                  SETTLED
                </span>
              </div>
              <div className="mt-2 truncate text-[11px] text-paper/75">
                Idempotency Key:{' '}
                <strong className="text-paper">
                  {settledReceipt.transaction.idempotency_key}
                </strong>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
              <Link to="/dashboard" className="btn-primary">
                Open Dashboard &amp; View Quotas <ArrowRight size={15} />
              </Link>
              <Link
                to="/list-a-project"
                className="inline-flex items-center gap-1.5 rounded-md border border-paper/20 bg-paper/10 px-4 py-2.5 text-xs font-semibold text-paper transition hover:bg-paper/20"
              >
                List a Mining Project
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Step 1: Plan & Billing Selector */}
            <div className="rounded-2xl border border-ink/12 bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-ochre">
                    Step 01 · Membership Plan &amp; Billing Cycle
                  </span>
                  <h2 className="mt-0.5 font-display text-2xl text-ink">
                    Select Tier to Subscribe
                  </h2>
                </div>

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
                    Monthly
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
                    Yearly (2 Months Free)
                  </button>
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

            {/* Step 2: ClickPesa Gateway Panel */}
            {effectiveUserId ? (
              <ClickPesaGatewayPanel
                userId={effectiveUserId}
                tierName={selectedTier}
                billingCycle={billingCycle}
                onSuccess={(res) => setSettledReceipt(res)}
              />
            ) : (
              <div className="rounded-2xl border border-ochre/30 bg-paper-2 p-8 text-center">
                <Lock size={28} className="mx-auto text-ochre" />
                <h3 className="mt-3 font-display text-2xl text-ink">
                  {ui('Sign In to Complete Subscription', 'Ingia ili Kukamilisha Usajili', 'Inicie Sesión para Completar la Suscripción')}
                </h3>
                <p className="mx-auto mt-2 max-w-md text-sm text-stone">
                  {ui(
                    'ClickPesa subscriptions are bound strictly to your verified Supabase member UUID.',
                    'Usajili wa ClickPesa unaunganishwa moja kwa moja na akaunti yako ya Supabase.',
                    'Las suscripciones de ClickPesa están vinculadas estrictamente a su cuenta verificada de Supabase.'
                  )}
                </p>
                <Link
                  to="/login"
                  search={{ next: '/checkout', reason: 'membership_required' } as unknown as undefined}
                  className="btn-primary mt-5 inline-flex"
                >
                  {ui('Sign In to Subscribe', 'Ingia Kujiunga', 'Iniciar Sesión')}
                </Link>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
