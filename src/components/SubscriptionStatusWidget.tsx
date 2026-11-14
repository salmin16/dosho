'use client';

import { Link } from '@tanstack/react-router';
import {
  ArrowUpRight,
  CalendarClock,
  CheckCircle2,
  CreditCard,
  Crown,
  Lock,
  ShieldCheck,
  Sparkles,
  Zap,
} from 'lucide-react';
import { useLocalization } from '../context/LocalizationContext';
import {
  SUBSCRIPTION_TIERS,
  useSubscription,
} from '../lib/subscriptions';
import CurrencySwitcher from './CurrencySwitcher';
import type { SubscriptionTierName } from '../types/database';

export interface SubscriptionStatusWidgetProps {
  projectsUsed: number;
  documentsUsed: number;
  opportunitiesUsed: number;
  servicesUsed: number;
}

export default function SubscriptionStatusWidget({
  projectsUsed,
  documentsUsed,
  opportunitiesUsed,
  servicesUsed,
}: SubscriptionStatusWidgetProps) {
  const { currency, formatPrice, ui } = useLocalization();
  const { subscription, tierConfig, tierName, checkQuota, transactions } =
    useSubscription();

  const projectQuota = checkQuota('maxProjectListings', projectsUsed);
  const documentQuota = checkQuota('maxVaultDocuments', documentsUsed);
  const opportunityQuota = checkQuota(
    'maxOpportunityListings',
    opportunitiesUsed + servicesUsed
  );

  const activeTierUsd =
    subscription.billing_cycle === 'yearly'
      ? tierConfig.yearlyUsd
      : tierConfig.monthlyUsd;

  const activeTierTzs =
    subscription.billing_cycle === 'yearly'
      ? tierConfig.yearlyTzs
      : tierConfig.monthlyTzs;

  const formattedTierPrice =
    activeTierTzs === 0
      ? ui('Free', 'Bure', 'Gratis')
      : currency === 'TZS'
        ? `TSh ${activeTierTzs.toLocaleString('en-US')}`
        : formatPrice(activeTierUsd);

  const renewalDateFormatted = new Date(
    subscription.expires_at
  ).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  const daysRemaining = Math.max(
    1,
    Math.ceil(
      (new Date(subscription.expires_at).getTime() - Date.now()) /
        (1000 * 60 * 60 * 24)
    )
  );

  const nextRecommendedTier: SubscriptionTierName =
    tierName === 'Explorer'
      ? 'Miner'
      : tierName === 'Miner'
        ? 'Professional'
        : tierName === 'Professional'
          ? 'Investor'
          : 'Corporate';

  const nextTierConfig = SUBSCRIPTION_TIERS[nextRecommendedTier];

  return (
    <section
      aria-label="Active Subscription & Quota Governance"
      className="grain relative overflow-hidden rounded-2xl border border-ink/15 bg-ink p-6 text-paper shadow-xl lg:p-8"
    >
      <div className="contours absolute inset-0 -z-10" aria-hidden="true" />

      {/* Top Row: Active Plan Badge, Renewal Date, & Upgrade Actions */}
      <div className="flex flex-col justify-between gap-6 border-b border-paper/12 pb-6 lg:flex-row lg:items-center">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-gold/45 bg-ochre/25 px-3 py-1 font-mono text-[11px] font-bold uppercase tracking-wider text-gold">
              <Crown size={13} />
              {ui('Active Plan:', 'Mpango Hai:', 'Plan Activo:')} {tierName}
            </span>

            <span className="inline-flex items-center gap-1.5 rounded-full border border-moss/50 bg-moss/30 px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-wider text-[#9de4b4]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#9de4b4]" />
              {subscription.status.toUpperCase()} ·{' '}
              {subscription.billing_cycle === 'yearly'
                ? ui('Yearly Billing', 'Malipo ya Mwaka', 'Anual')
                : ui('Monthly Billing', 'Malipo ya Mwezi', 'Mensual')}
            </span>

            {subscription.payment_reference && (
              <span className="inline-flex items-center gap-1 rounded-md border border-paper/15 bg-paper/5 px-2.5 py-1 font-mono text-[10px] text-paper/65">
                <CreditCard size={11} className="text-gold" />
                Ref: {subscription.payment_reference}
              </span>
            )}
          </div>

          <h2 className="mt-3 font-display text-3xl font-light text-paper md:text-4xl">
            {tierName}{' '}
            <em className="italic text-gold">
              {ui('Membership Tier', 'Ngazi ya Uanachama', 'Nivel de Membresía')}
            </em>{' '}
            <span className="font-mono text-lg font-normal text-paper/75">
              ({formattedTierPrice}
              {activeTierTzs > 0
                ? subscription.billing_cycle === 'yearly'
                  ? ui('/yr', '/mwaka', '/año')
                  : ui('/mo', '/mwezi', '/mes')
                : ''}
              )
            </span>
          </h2>

          <p className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-paper/70">
            <span className="inline-flex items-center gap-1.5">
              <CalendarClock size={13} className="text-gold" />
              {ui('Renews / Expires:', 'Inaisha:', 'Vence:')}{' '}
              <strong className="font-mono text-paper">
                {renewalDateFormatted}
              </strong>{' '}
              ({daysRemaining} {ui('days remaining', 'siku zimebaki', 'días restantes')})
            </span>
            <span>·</span>
            <span>{tierConfig.tagline}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <CurrencySwitcher dark />

          {tierName !== 'Corporate' && (
            <Link
              to="/checkout"
              search={{
                tier: nextRecommendedTier.toLowerCase(),
                billing: subscription.billing_cycle,
              }}
              className="btn-primary !py-2.5 !px-4 text-xs"
            >
              <Zap size={14} />
              {ui(
                `Upgrade to ${nextRecommendedTier}`,
                `Pandisha hadi ${nextRecommendedTier}`,
                `Mejorar a ${nextRecommendedTier}`
              )}
              <ArrowUpRight size={14} />
            </Link>
          )}

          <Link
            to="/pricing"
            className="inline-flex items-center gap-1.5 rounded-md border border-paper/20 bg-paper/10 px-4 py-2.5 text-xs font-semibold text-paper transition hover:bg-paper/20"
          >
            {ui('Compare All 5 Tiers', 'Linganisha Ngazi 5', 'Comparar 5 Planes')}
          </Link>
        </div>
      </div>

      {/* Middle Row: Real-Time Quota Usage Meters */}
      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        {/* Meter 1: Project Listings */}
        <div className="rounded-xl border border-paper/12 bg-ink-2/90 p-4">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-wider text-paper/60">
              {ui('Project Listings Quota', 'Kikomo cha Miradi', 'Cuota de Proyectos')}
            </span>
            <span
              className={`font-mono text-xs font-bold ${
                projectQuota.allowed ? 'text-gold' : 'text-[#f59c8a]'
              }`}
            >
              {projectQuota.used} /{' '}
              {projectQuota.limit >= 999
                ? ui('Unlimited', 'Bila Kikomo', 'Ilimitado')
                : projectQuota.limit}
            </span>
          </div>

          <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-paper/10">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                projectQuota.allowed ? 'bg-gold' : 'bg-danger'
              }`}
              style={{ width: `${projectQuota.usagePercent}%` }}
            />
          </div>

          <p className="mt-2 text-[11px] text-paper/65">
            {projectQuota.limit === 0 ? (
              <span className="text-[#f59c8a]">
                {ui(
                  'Explorer tier cannot list projects. Upgrade to Miner (TSh 50,000/mo) for 3 listings.',
                  'Mpango wa Explorer hauruhusu kusajili miradi. Pandisha hadi Miner (TSh 50,000/mwezi).',
                  'El nivel Explorer no permite listar proyectos. Mejore a Miner.'
                )}
              </span>
            ) : projectQuota.allowed ? (
              ui(
                `${projectQuota.remaining >= 900 ? 'Unlimited' : projectQuota.remaining} project listing slots available on ${tierName}.`,
                `Nafasi ${projectQuota.remaining >= 900 ? 'zote' : projectQuota.remaining} za miradi zinapatikana kwenye ${tierName}.`,
                `${projectQuota.remaining} espacios disponibles en ${tierName}.`
              )
            ) : (
              <span className="text-[#f59c8a]">
                {ui(
                  `Quota reached (${projectQuota.limit}/${projectQuota.limit}). Upgrade tier to publish more projects.`,
                  `Kikomo kimefikiwa (${projectQuota.limit}/${projectQuota.limit}). Pandisha ngazi kuongeza miradi.`,
                  `Límite alcanzado (${projectQuota.limit}/${projectQuota.limit}).`
                )}
              </span>
            )}
          </p>
        </div>

        {/* Meter 2: Document Hosting Vault */}
        <div className="rounded-xl border border-paper/12 bg-ink-2/90 p-4">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-wider text-paper/60">
              {ui('Vault Document Hosting', 'Nyaraka za Hifadhi', 'Documentos en Bóveda')}
            </span>
            <span
              className={`font-mono text-xs font-bold ${
                documentQuota.allowed ? 'text-[#9de4b4]' : 'text-[#f59c8a]'
              }`}
            >
              {documentQuota.used} /{' '}
              {documentQuota.limit >= 999
                ? ui('Unlimited', 'Bila Kikomo', 'Ilimitado')
                : documentQuota.limit}
            </span>
          </div>

          <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-paper/10">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                documentQuota.allowed ? 'bg-[#9de4b4]' : 'bg-danger'
              }`}
              style={{ width: `${documentQuota.usagePercent}%` }}
            />
          </div>

          <p className="mt-2 text-[11px] text-paper/65">
            {ui(
              `${documentQuota.remaining >= 900 ? 'Unlimited' : documentQuota.remaining} encrypted dossier slots remaining.`,
              `Nafasi ${documentQuota.remaining >= 900 ? 'zote' : documentQuota.remaining} za nyaraka za siri zimesalia.`,
              `${documentQuota.remaining} espacios de documentos restantes.`
            )}
          </p>
        </div>

        {/* Meter 3: Guided Opportunities & Services */}
        <div className="rounded-xl border border-paper/12 bg-ink-2/90 p-4">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-wider text-paper/60">
              {ui('Opportunities & Services', 'Fursa na Huduma', 'Oportunidades y Servicios')}
            </span>
            <span
              className={`font-mono text-xs font-bold ${
                opportunityQuota.allowed ? 'text-gold' : 'text-[#f59c8a]'
              }`}
            >
              {opportunityQuota.used} /{' '}
              {opportunityQuota.limit >= 999
                ? ui('Unlimited', 'Bila Kikomo', 'Ilimitado')
                : opportunityQuota.limit}
            </span>
          </div>

          <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-paper/10">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                opportunityQuota.allowed ? 'bg-ochre-light' : 'bg-danger'
              }`}
              style={{ width: `${opportunityQuota.usagePercent}%` }}
            />
          </div>

          <p className="mt-2 text-[11px] text-paper/65">
            {ui(
              `Active tenders, consultancies & technical service listings (${opportunitiesUsed} opp, ${servicesUsed} srv).`,
              `Zabuni, ushauri na huduma za kitaalamu (${opportunitiesUsed} fursa, ${servicesUsed} huduma).`,
              `Licitaciones y servicios publicados (${opportunitiesUsed} op, ${servicesUsed} srv).`
            )}
          </p>
        </div>
      </div>

      {/* Bottom Row: Tier Feature Entitlements & Quick Upgrade Matrix */}
      <div className="mt-6 flex flex-col justify-between gap-4 rounded-xl border border-paper/10 bg-paper/[0.04] p-4 lg:flex-row lg:items-center">
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <span className="font-mono text-[10px] uppercase tracking-wider text-gold">
            <Sparkles size={12} className="mr-1 inline" />
            {ui('Tier Entitlements:', 'Haki za Mpango:', 'Permisos del Nivel:')}
          </span>

          {[
            {
              label: ui('Project Publishing', 'Kusajili Miradi', 'Publicar Proyectos'),
              enabled: tierConfig.permissions.canListProject,
            },
            {
              label: ui('Document Hosting', 'Uhifadhi wa Nyaraka', 'Alojamiento Docs'),
              enabled: tierConfig.permissions.canHostDocuments,
            },
            {
              label: ui('Listing Analytics', 'Takwimu za Miradi', 'Analítica'),
              enabled: tierConfig.permissions.canViewAnalytics,
            },
            {
              label: ui('Deal-Room Access', 'Chumba cha Mikataba', 'Sala de Acuerdos'),
              enabled: tierConfig.permissions.canAccessDealRoom,
            },
            {
              label: ui('Advanced GIS Map Filters', 'Vichujio vya Ramani', 'Filtros GIS Avanzados'),
              enabled: tierConfig.permissions.canUseAdvancedMapFilters,
            },
          ].map((item) => (
            <span
              key={item.label}
              className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 font-mono text-[10px] ${
                item.enabled
                  ? 'border-moss/40 bg-moss/25 text-[#9de4b4]'
                  : 'border-paper/12 bg-paper/5 text-paper/45'
              }`}
            >
              {item.enabled ? <CheckCircle2 size={11} /> : <Lock size={11} />}
              {item.label}
            </span>
          ))}
        </div>

        <div className="flex shrink-0 items-center gap-2 font-mono text-[11px] text-paper/70">
          <ShieldCheck size={13} className="text-gold" />
          {transactions.length > 0 ? (
            <span>
              {ui('Last Verified Payment:', 'Malipo ya Mwisho:', 'Último Pago:')}{' '}
              <strong className="text-gold">
                {transactions[0].external_reference}
              </strong>
            </span>
          ) : (
            <span>
              {ui('Next Tier:', 'Ngazi Inayofuata:', 'Siguiente Nivel:')}{' '}
              <strong className="text-gold">
                {nextRecommendedTier} (
                {currency === 'TZS'
                  ? `TSh ${nextTierConfig.monthlyTzs.toLocaleString('en-US')}`
                  : formatPrice(nextTierConfig.monthlyUsd)}
                /mo)
              </strong>
            </span>
          )}
        </div>
      </div>
    </section>
  );
}
