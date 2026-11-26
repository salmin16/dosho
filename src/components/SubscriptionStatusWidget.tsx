'use client';

import { useState } from 'react';
import {
  CalendarClock,
  Check,
  CheckCircle2,
  Clock,
  Crown,
  Download,
  Lock,
  ShieldCheck,
  Sparkles,
  Zap,
} from 'lucide-react';
import { useLocalization } from '../context/LocalizationContext';
import {
  resolveForcedTzsAmountForPlan,
  useSubscription,
} from '../lib/subscriptions';
import AzamPayCheckoutModal from './AzamPayCheckoutModal';
import type { SubscriptionPlanId } from '../types/database';

export interface SubscriptionStatusWidgetProps {
  projectsUsed: number;
  quotesUsedThisMonth?: number;
  documentsUsed: number;
  opportunitiesUsed: number;
  servicesUsed: number;
}

export default function SubscriptionStatusWidget({
  projectsUsed,
  quotesUsedThisMonth,
}: SubscriptionStatusWidgetProps) {
  const { currency, formatPrice, ui } = useLocalization();
  const {
    plans,
    plan,
    planId,
    entitlements,
    accountState,
    pendingPayment,
    payments,
    isPaidActive,
    isExpired,
  } = useSubscription();

  const [checkoutPlanId, setCheckoutPlanId] = useState<
    Exclude<SubscriptionPlanId, 'free'> | null
  >(null);
  const [showAllPlans, setShowAllPlans] = useState(true);

  const listingsUsed = Math.max(projectsUsed, entitlements.active_listings_count);
  const listingsLimit = entitlements.max_active_listings;
  const listingsUnlimited = listingsLimit < 0 || listingsLimit >= 999;
  const listingsAllowed =
    isPaidActive && (listingsUnlimited || listingsUsed < listingsLimit);
  const listingsPct =
    listingsLimit === 0
      ? 100
      : listingsUnlimited
        ? Math.min(100, Math.round((listingsUsed / 20) * 100))
        : Math.min(100, Math.round((listingsUsed / Math.max(1, listingsLimit)) * 100));

  const rfqsUsed =
    quotesUsedThisMonth !== undefined
      ? Math.max(quotesUsedThisMonth, entitlements.monthly_rfqs_count)
      : entitlements.monthly_rfqs_count;
  const rfqsLimit = entitlements.max_monthly_rfqs;
  const rfqsUnlimited = rfqsLimit < 0 || rfqsLimit >= 999;
  const rfqsAllowed =
    isPaidActive && (rfqsUnlimited || rfqsUsed < rfqsLimit);
  const rfqsPct =
    rfqsLimit === 0
      ? 100
      : rfqsUnlimited
        ? Math.min(100, Math.round((rfqsUsed / 30) * 100))
        : Math.min(100, Math.round((rfqsUsed / Math.max(1, rfqsLimit)) * 100));

  const formatTierPrice = (priceTzs: number, priceUsd: number) => {
    if (priceTzs === 0 && priceUsd === 0) {
      return ui('Free', 'Bure', 'Gratis');
    }
    if (currency === 'TZS') {
      return `TSh ${priceTzs.toLocaleString('en-US')}`;
    }
    return formatPrice(priceUsd);
  };

  const formattedPlanPrice = formatTierPrice(plan.price_tzs, plan.price_usd);

  const expiryDateObj = entitlements.expires_at
    ? new Date(entitlements.expires_at)
    : null;
  const hasValidExpiry =
    expiryDateObj !== null && !Number.isNaN(expiryDateObj.getTime());

  const renewalDateFormatted = hasValidExpiry
    ? expiryDateObj.toLocaleDateString(undefined, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : ui('No expiry (Free tier)', 'Haina mwisho (Bure)', 'Sin vencimiento');

  const daysRemaining = hasValidExpiry
    ? Math.max(
        0,
        Math.ceil((expiryDateObj.getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
      )
    : 0;

  const nextRecommendedPlan: Exclude<SubscriptionPlanId, 'free'> =
    planId === 'pro' ? 'enterprise' : 'pro';

  const orderedPlans = [...plans].sort((a, b) => {
    const order: Record<SubscriptionPlanId, number> = {
      free: 0,
      pro: 1,
      enterprise: 2,
    };
    return (order[a.id] ?? 9) - (order[b.id] ?? 9);
  });

  return (
    <section
      aria-label="Active Subscription & Quota Governance"
      className="grain relative overflow-hidden rounded-2xl border border-ink/15 bg-ink p-5 text-paper shadow-xl sm:p-6 lg:p-8"
    >
      <div className="contours absolute inset-0 -z-10" aria-hidden="true" />

      {/* Top Row: Plan Status, Expiry & Direct AzamPay Actions */}
      <div className="flex flex-col justify-between gap-5 border-b border-paper/12 pb-6 lg:flex-row lg:items-center">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-gold/45 bg-ochre/25 px-3 py-1 font-mono text-[11px] font-bold uppercase tracking-wider text-gold">
              <Crown size={13} />
              {ui('Active Plan:', 'Mpango Hai:', 'Plan Activo:')} {plan.name}
            </span>

            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-wider ${
                accountState === 'dormant' || isExpired
                  ? 'border-danger/50 bg-danger/25 text-[#f59c8a]'
                  : accountState === 'active' || isPaidActive
                    ? 'border-moss/50 bg-moss/30 text-[#9de4b4]'
                    : 'border-paper/20 bg-paper/10 text-paper/80'
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  accountState === 'dormant' || isExpired
                    ? 'bg-[#f59c8a]'
                    : accountState === 'active' || isPaidActive
                      ? 'bg-[#9de4b4]'
                      : 'bg-gold'
                }`}
              />
              {accountState === 'dormant' || isExpired
                ? ui('DORMANT · EXPIRED', 'IMEISHA MUDA (DORMANT)', 'INACTIVO · EXPIRADO')
                : accountState === 'active' || isPaidActive
                  ? ui('ACTIVE SUBSCRIPTION', 'MPANGO HAI (ACTIVE)', 'ACTIVO')
                  : ui('FREE ACCOUNT', 'AKAUNTI BURE (FREE)', 'CUENTA GRATUITA')}
            </span>

            {pendingPayment && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-gold/45 bg-gold/15 px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-wider text-gold">
                <Clock size={11} />
                {ui(
                  'Payment Pending Verification',
                  'Malipo Yanasubiri Uhakiki',
                  'Pago Pendiente de Revisión',
                )}
              </span>
            )}
          </div>

          <h2 className="mt-3 font-display text-2xl font-light text-paper sm:text-3xl md:text-4xl">
            {plan.name}{' '}
            <span className="font-mono text-base font-normal text-paper/75 tabular-nums sm:text-lg">
              ({formattedPlanPrice}
              {plan.price_tzs > 0 ? ui('/mo', '/mwezi', '/mes') : ''})
            </span>
          </h2>

          <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-paper/70">
            <span className="inline-flex items-center gap-1.5">
              <CalendarClock size={13} className="text-gold" />
              {isPaidActive ? (
                <>
                  {ui('Expires:', 'Inaisha:', 'Vence:')}{' '}
                  <strong className="font-mono text-paper">
                    {renewalDateFormatted}
                  </strong>{' '}
                  ({daysRemaining} {ui('days left', 'siku zimebaki', 'días restantes')})
                </>
              ) : isExpired ? (
                <span className="text-[#f59c8a]">
                  {ui(
                    `Expired on ${renewalDateFormatted} — renew to restore paid entitlements`,
                    `Iliisha ${renewalDateFormatted} — huisha ili kurejesha huduma`,
                    `Expiró el ${renewalDateFormatted} — renueva para restaurar acceso`,
                  )}
                </span>
              ) : (
                <span>{plan.tagline}</span>
              )}
            </span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() =>
              setCheckoutPlanId(
                planId === 'enterprise' ? 'enterprise' : nextRecommendedPlan,
              )
            }
            className="btn-primary !py-2.5 !px-4 text-xs"
          >
            <Zap size={14} />
            {planId === 'enterprise'
              ? ui('Renew Institutional via AzamPay', 'Huisha Institutional · AzamPay', 'Renovar Institucional')
              : planId === 'pro'
                ? ui('Upgrade to Institutional', 'Pandisha hadi Institutional', 'Mejorar a Institucional')
                : ui('Upgrade to Operator Pro', 'Pandisha hadi Operator Pro', 'Mejorar a Operator Pro')}
          </button>
          <button
            type="button"
            onClick={() => setShowAllPlans((v) => !v)}
            aria-expanded={showAllPlans}
            className="inline-flex min-h-[44px] sm:min-h-[38px] items-center gap-1.5 rounded-md border border-paper/25 bg-paper/10 px-4 py-2 text-xs font-semibold text-paper transition hover:bg-paper/20"
          >
            <Sparkles size={13} className="text-gold" />
            {showAllPlans
              ? ui('Hide Plan Selector', 'Ficha Mipango', 'Ocultar Planes')
              : ui('Manage Billing & Plans', 'Simamia Malipo na Mipango', 'Gestionar Planes')}
          </button>
        </div>
      </div>

      {/* Inline Subscription Tier Selector (Explorer, Operator Pro, Institutional) */}
      {showAllPlans && orderedPlans.length > 0 && (
        <div className="mt-6 border-b border-paper/12 pb-6">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-mono text-[10.5px] font-semibold uppercase tracking-widest text-gold">
                {ui('Inline Plan Selector · Instant AzamPay Activation', 'Chagua Mpango · Malipo ya AzamPay', 'Selector de Planes · AzamPay')}
              </p>
              <p className="mt-0.5 text-xs text-paper/70">
                {ui(
                  `Compare tiers in ${currency} and activate or renew directly via AzamPay Mobile Money or Bank Transfer.`,
                  `Linganisha mipango kwa ${currency} na uwashe au huisha moja kwa moja kupitia AzamPay.`,
                  `Compara planes en ${currency} y activa o renueva directamente con AzamPay.`,
                )}
              </p>
            </div>
            <span className="rounded-full border border-paper/15 bg-paper/10 px-2.5 py-1 font-mono text-[10px] font-semibold text-paper/80 tabular-nums">
              {ui('Display Currency:', 'Sarafu:', 'Moneda:')} {currency}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {orderedPlans.map((tier) => {
              const isCurrent = tier.id === planId;
              const isPaidTier = tier.id !== 'free';
              const forcedTzs = isPaidTier
                ? resolveForcedTzsAmountForPlan(
                    tier.id as Exclude<SubscriptionPlanId, 'free'>,
                    tier.price_tzs,
                    tier.price_usd,
                  )
                : 0;
              const tierListingsUnlimited =
                tier.max_active_listings < 0 || tier.max_active_listings >= 999;
              const tierRfqsUnlimited =
                tier.max_monthly_rfqs < 0 || tier.max_monthly_rfqs >= 999;

              return (
                <div
                  key={tier.id}
                  className={`flex flex-col justify-between rounded-xl border p-4 transition ${
                    isCurrent
                      ? 'border-gold/70 bg-paper/10 shadow-md ring-1 ring-gold/40'
                      : tier.id === 'pro'
                        ? 'border-ochre/45 bg-ink-2/95 hover:border-gold/60'
                        : 'border-paper/15 bg-ink-2/85 hover:border-paper/35'
                  }`}
                >
                  <div>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="font-display text-xl font-medium text-paper">
                        {tier.name}
                      </h3>
                      {isCurrent ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-gold/60 bg-gold/20 px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-gold">
                          <Check size={11} />
                          {isExpired && isPaidTier
                            ? ui('Expired', 'Imeisha', 'Expirado')
                            : ui('Active Plan', 'Mpango Hai', 'Plan Activo')}
                        </span>
                      ) : tier.id === 'pro' ? (
                        <span className="rounded-full border border-ochre/45 bg-ochre/20 px-2 py-0.5 font-mono text-[9.5px] font-semibold uppercase tracking-wider text-gold">
                          {ui('Recommended', 'Inapendekezwa', 'Recomendado')}
                        </span>
                      ) : tier.id === 'enterprise' ? (
                        <span className="rounded-full border border-paper/20 bg-paper/10 px-2 py-0.5 font-mono text-[9.5px] font-semibold uppercase tracking-wider text-paper/80">
                          {ui('Full Desk', 'Taasisi', 'Institucional')}
                        </span>
                      ) : null}
                    </div>

                    <p className="mt-1 text-[11.5px] leading-relaxed text-paper/70">
                      {tier.tagline}
                    </p>

                    <div className="mt-3 flex items-baseline gap-1.5 border-y border-paper/10 py-2.5">
                      <span className="font-display text-2xl font-semibold text-paper tabular-nums">
                        {formatTierPrice(forcedTzs || tier.price_tzs, tier.price_usd)}
                      </span>
                      {isPaidTier && (
                        <span className="font-mono text-[11px] text-paper/65">
                          {ui('/ 30 days', '/ siku 30', '/ 30 días')}
                        </span>
                      )}
                    </div>

                    {isPaidTier && currency !== 'TZS' && (
                      <p className="mt-1.5 font-mono text-[10px] text-paper/55 tabular-nums">
                        AzamPay settlement: TSh {forcedTzs.toLocaleString('en-US')}
                      </p>
                    )}

                    <ul className="mt-3 space-y-1.5 text-[11.5px] text-paper/85">
                      <li className="flex items-center justify-between gap-2">
                        <span className="text-paper/65">
                          {ui('Active Listings', 'Miradi Hai', 'Listados Activos')}
                        </span>
                        <span className="font-mono font-semibold text-paper tabular-nums">
                          {tierListingsUnlimited
                            ? ui('Unlimited', 'Bila Kikomo', 'Ilimitado')
                            : tier.max_active_listings}
                        </span>
                      </li>
                      <li className="flex items-center justify-between gap-2">
                        <span className="text-paper/65">
                          {ui('Monthly RFQs', 'Maombi / Mwezi', 'RFQs / Mes')}
                        </span>
                        <span className="font-mono font-semibold text-paper tabular-nums">
                          {tierRfqsUnlimited
                            ? ui('Unlimited', 'Bila Kikomo', 'Ilimitado')
                            : `${tier.max_monthly_rfqs}/mo`}
                        </span>
                      </li>
                      <li className="flex items-center justify-between gap-2">
                        <span className="text-paper/65">
                          {ui('NDA Data Room', 'Nyaraka za NDA', 'Sala NDA')}
                        </span>
                        <span
                          className={`font-mono text-[10.5px] font-semibold ${
                            tier.can_access_data_room ? 'text-[#9de4b4]' : 'text-paper/45'
                          }`}
                        >
                          {tier.can_access_data_room
                            ? ui('Included', 'Imejumuishwa', 'Incluido')
                            : '—'}
                        </span>
                      </li>
                      <li className="flex items-center justify-between gap-2">
                        <span className="text-paper/65">
                          {ui('Markets CSV Export', 'Pakua CSV', 'Exportar CSV')}
                        </span>
                        <span
                          className={`font-mono text-[10.5px] font-semibold ${
                            tier.can_export_markets ? 'text-[#9de4b4]' : 'text-paper/45'
                          }`}
                        >
                          {tier.can_export_markets
                            ? ui('Included', 'Imejumuishwa', 'Incluido')
                            : '—'}
                        </span>
                      </li>
                    </ul>
                  </div>

                  <div className="mt-4 pt-2">
                    {isPaidTier ? (
                      <button
                        type="button"
                        onClick={() =>
                          setCheckoutPlanId(
                            tier.id as Exclude<SubscriptionPlanId, 'free'>,
                          )
                        }
                        className={`inline-flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-lg px-3.5 py-2.5 text-xs font-semibold transition ${
                          isCurrent
                            ? 'border border-gold/60 bg-gold/20 text-gold hover:bg-gold/30'
                            : 'bg-ochre text-paper shadow-sm hover:bg-ochre-dark'
                        }`}
                      >
                        <Zap size={13} />
                        {isCurrent
                          ? ui('Renew via AzamPay', 'Huisha kupitia AzamPay', 'Renovar vía AzamPay')
                          : ui('Select / Renew via AzamPay', 'Chagua · Lipa AzamPay', 'Seleccionar vía AzamPay')}
                      </button>
                    ) : (
                      <div className="inline-flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-lg border border-paper/15 bg-paper/5 px-3.5 py-2 font-mono text-[11px] font-medium text-paper/65">
                        {isCurrent
                          ? ui('Current Free Tier', 'Mpango wa Bure wa Sasa', 'Plan Gratuito Actual')
                          : ui('Included Base Tier', 'Mpango Msingi wa Bure', 'Nivel Base Incluido')}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Middle Row: Remaining Active Listings Quota, Monthly RFQ Quota & Entitlements */}
      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        {/* Quota 1: Active Project Listings */}
        <div className="rounded-xl border border-paper/12 bg-ink-2/90 p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-[10px] uppercase tracking-wider text-paper/60">
              {ui('Active Project Listings', 'Miradi Iliyochapishwa', 'Proyectos Activos')}
            </span>
            <span
              className={`font-mono text-xs font-bold tabular-nums ${
                listingsAllowed ? 'text-gold' : 'text-[#f59c8a]'
              }`}
            >
              {listingsUsed} /{' '}
              {listingsUnlimited ? ui('Unlimited', 'Bila Kikomo', 'Ilimitado') : listingsLimit}
            </span>
          </div>

          <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-paper/10">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                listingsAllowed ? 'bg-gold' : 'bg-danger'
              }`}
              style={{ width: `${listingsPct}%` }}
            />
          </div>

          <p className="mt-2 text-[11px] text-paper/65">
            {listingsLimit === 0 ? (
              <span className="text-[#f59c8a]">
                {ui(
                  'Explorer tier includes 0 listings. Upgrade to Operator Pro for up to 3 active listings.',
                  'Mpango wa Explorer hauruhusu kusajili miradi. Pandisha hadi Operator Pro kupata nafasi 3.',
                  'Explorer incluye 0 listados. Mejora a Operator Pro para publicar hasta 3 proyectos.',
                )}
              </span>
            ) : listingsUnlimited ? (
              ui(
                'Unlimited verified project listings unlocked on Institutional / JV Desk.',
                'Miradi isiyo na kikomo imefunguliwa kwenye Institutional / JV Desk.',
                'Proyectos ilimitados desbloqueados en Institutional / JV Desk.',
              )
            ) : (
              ui(
                `${Math.max(0, listingsLimit - listingsUsed)} listing slot(s) remaining on ${plan.name}.`,
                `Nafasi ${Math.max(0, listingsLimit - listingsUsed)} za miradi zimesalia kwenye ${plan.name}.`,
                `${Math.max(0, listingsLimit - listingsUsed)} espacios restantes en ${plan.name}.`,
              )
            )}
          </p>
        </div>

        {/* Quota 2: Monthly Quote Requests (RFQs) */}
        <div className="rounded-xl border border-paper/12 bg-ink-2/90 p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-[10px] uppercase tracking-wider text-paper/60">
              {ui('Monthly Quote Requests (RFQs)', 'Maombi ya Bei (Mwezi)', 'Cotizaciones Mensuales')}
            </span>
            <span
              className={`font-mono text-xs font-bold tabular-nums ${
                rfqsAllowed ? 'text-[#9de4b4]' : 'text-[#f59c8a]'
              }`}
            >
              {rfqsUsed} /{' '}
              {rfqsUnlimited ? ui('Unlimited', 'Bila Kikomo', 'Ilimitado') : rfqsLimit}
            </span>
          </div>

          <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-paper/10">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                rfqsAllowed ? 'bg-[#9de4b4]' : 'bg-danger'
              }`}
              style={{ width: `${rfqsPct}%` }}
            />
          </div>

          <p className="mt-2 text-[11px] text-paper/65">
            {rfqsLimit === 0 || !isPaidActive ? (
              <span className="text-[#f59c8a]">
                {ui(
                  'View-only mode: 0 quote, information, or due-diligence requests. Upgrade to Operator Pro for 25/mo.',
                  'Mtazamaji pekee: maombi 0 ya bei au taarifa. Pandisha hadi Operator Pro kupata 25 kwa mwezi.',
                  'Solo vista: 0 cotizaciones ni solicitudes. Actualiza a Operator Pro para 25/mes.',
                )}
              </span>
            ) : rfqsUnlimited
              ? ui(
                  'Unlimited monthly RFQs across verified service providers.',
                  'Maombi ya bei bila kikomo kila mwezi.',
                  'Solicitudes de cotización ilimitadas cada mes.',
                )
              : rfqsAllowed
                ? ui(
                    `${Math.max(0, rfqsLimit - rfqsUsed)} monthly RFQ(s) remaining this billing cycle.`,
                    `Maombi ${Math.max(0, rfqsLimit - rfqsUsed)} ya bei yamesalia mwezi huu.`,
                    `${Math.max(0, rfqsLimit - rfqsUsed)} cotizaciones restantes este mes.`,
                  )
                : ui(
                    `Monthly RFQ cap reached (${rfqsUsed}/${rfqsLimit}). Upgrade to Institutional / JV Desk for unlimited RFQs.`,
                    `Kikomo cha maombi ya bei kimefikiwa (${rfqsUsed}/${rfqsLimit}). Pandisha mpango wako.`,
                    `Límite mensual alcanzado (${rfqsUsed}/${rfqsLimit}). Actualiza tu plan.`,
                  )}
          </p>
        </div>

        {/* Entitlements 3: Data Room & Markets Exports */}
        <div className="rounded-xl border border-paper/12 bg-ink-2/90 p-4">
          <span className="font-mono text-[10px] uppercase tracking-wider text-paper/60">
            {ui('Premium Access Rights', 'Haki za Ufikiaji', 'Permisos Premium')}
          </span>
          <ul className="mt-2.5 space-y-2 text-xs">
            <li className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-paper/80">
                <ShieldCheck size={13} className="text-gold" />
                {ui('Tenement Dossier & Contacts', 'Faili la Leseni & Simu', 'Expediente y Contactos')}
              </span>
              {isPaidActive || entitlements.can_access_data_room ? (
                <span className="inline-flex items-center gap-1 font-mono text-[10px] font-semibold text-[#9de4b4]">
                  <CheckCircle2 size={11} /> {ui('UNLOCKED', 'IMEFUNGULIWA', 'ACTIVO')}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 font-mono text-[10px] text-paper/50">
                  <Lock size={11} /> Operator Pro+
                </span>
              )}
            </li>
            <li className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-paper/80">
                <ShieldCheck size={13} className="text-gold" />
                {ui('NDA Data Room Docs', 'Nyaraka za NDA', 'Sala de Datos NDA')}
              </span>
              {entitlements.can_access_data_room ? (
                <span className="inline-flex items-center gap-1 font-mono text-[10px] font-semibold text-[#9de4b4]">
                  <CheckCircle2 size={11} /> {ui('UNLOCKED', 'IMEFUNGULIWA', 'ACTIVO')}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 font-mono text-[10px] text-paper/50">
                  <Lock size={11} /> Institutional
                </span>
              )}
            </li>
            <li className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-paper/80">
                <Download size={13} className="text-gold" />
                {ui('Markets CSV Export', 'Pakua Takwimu (CSV)', 'Exportación CSV')}
              </span>
              {entitlements.can_export_markets ? (
                <span className="inline-flex items-center gap-1 font-mono text-[10px] font-semibold text-[#9de4b4]">
                  <CheckCircle2 size={11} /> {ui('UNLOCKED', 'IMEFUNGULIWA', 'ACTIVO')}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 font-mono text-[10px] text-paper/50">
                  <Lock size={11} /> Operator Pro+
                </span>
              )}
            </li>
          </ul>
        </div>
      </div>

      {/* Recent Payment Verification Log (when user has submitted transfers/payments) */}
      {payments.length > 0 && (
        <div className="mt-5 border-t border-paper/10 pt-4">
          <div className="font-mono text-[10px] uppercase tracking-wider text-paper/55">
            {ui('Recent Subscription Payments', 'Malipo ya Hivi Karibuni', 'Pagos Recientes')}
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {payments.slice(0, 3).map((pay) => (
              <div
                key={pay.id}
                className="inline-flex flex-wrap items-center gap-2 rounded-lg border border-paper/12 bg-ink-2 px-3 py-1.5 font-mono text-[10.5px]"
              >
                <span className="font-bold text-gold uppercase">{pay.plan_id}</span>
                <span className="text-paper/75">
                  {pay.currency} {Number(pay.amount).toLocaleString('en-US')}
                </span>
                <span className="text-paper/50">Ref: {pay.reference_code}</span>
                <span
                  className={`rounded px-1.5 py-0.5 text-[9.5px] font-semibold uppercase ${
                    pay.status === 'approved' || pay.status === 'settled'
                      ? 'bg-moss/30 text-[#9de4b4]'
                      : pay.status === 'rejected' || pay.status === 'failed'
                        ? 'bg-danger/25 text-[#f59c8a]'
                        : 'bg-ochre/30 text-gold'
                  }`}
                >
                  {pay.status.replace('_', ' ')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <AzamPayCheckoutModal
        planId={checkoutPlanId}
        onClose={() => setCheckoutPlanId(null)}
      />
    </section>
  );
}
