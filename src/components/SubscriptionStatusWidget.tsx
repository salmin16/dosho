'use client';

import { Link } from '@tanstack/react-router';
import {
  ArrowUpRight,
  CalendarClock,
  CheckCircle2,
  Clock,
  Crown,
  Download,
  Lock,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { useLocalization } from '../context/LocalizationContext';
import { useSubscription } from '../lib/subscriptions';
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
    plan,
    planId,
    entitlements,
    accountState,
    pendingPayment,
    payments,
    isPaidActive,
    isExpired,
  } = useSubscription();

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

  const formattedPlanPrice =
    plan.price_tzs === 0
      ? ui('Free', 'Bure', 'Gratis')
      : currency === 'TZS'
        ? `TSh ${plan.price_tzs.toLocaleString('en-US')}`
        : formatPrice(plan.price_usd);

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

  return (
    <section
      aria-label="Active Subscription & Quota Governance"
      className="grain relative overflow-hidden rounded-2xl border border-ink/15 bg-ink p-5 text-paper shadow-xl sm:p-6 lg:p-8"
    >
      <div className="contours absolute inset-0 -z-10" aria-hidden="true" />

      {/* Top Row: Compact Active Plan Status, Expiry & Pricing Page Links */}
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
          {planId !== 'enterprise' && (
            <Link
              to="/pricing"
              search={{ plan: nextRecommendedPlan, checkout: '1' } as unknown as undefined}
              className="btn-primary !py-2.5 !px-4 text-xs"
            >
              <Zap size={14} />
              {planId === 'pro'
                ? ui('Upgrade to Institutional', 'Pandisha hadi Institutional', 'Mejorar a Institucional')
                : ui('Upgrade to Operator Pro', 'Pandisha hadi Operator Pro', 'Mejorar a Operator Pro')}
              <ArrowUpRight size={14} />
            </Link>
          )}
          <Link
            to="/pricing"
            className="inline-flex min-h-[44px] sm:min-h-[38px] items-center gap-1.5 rounded-md border border-paper/20 bg-paper/10 px-4 py-2 text-xs font-semibold text-paper transition hover:bg-paper/20"
          >
            {ui('Manage Billing & Plans', 'Simamia Malipo na Mipango', 'Gestionar Planes')}
          </Link>
        </div>
      </div>

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

      {/* Recent Payment Verification Log */}
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
    </section>
  );
}
