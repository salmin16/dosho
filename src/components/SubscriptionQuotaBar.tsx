'use client'

import { Link } from '@tanstack/react-router'
import {
  ArrowUpRight,
  CalendarClock,
  Crown,
  FileSpreadsheet,
  MessageSquareText,
  Zap,
} from 'lucide-react'
import { useLocalization } from '../context/LocalizationContext'
import { useSubscription } from '../lib/subscriptions'
import type { SubscriptionPlanId } from '../types/database'

export interface SubscriptionQuotaBarProps {
  /** Live Supabase project count from parent route (merged with get_user_entitlements) */
  projectsUsed?: number
  /** Live Supabase calendar-month quote count from parent route (merged with get_user_entitlements) */
  quotesUsedThisMonth?: number
  /** Optional context label (e.g. "User Workspace", "Opportunity Studio", "Service Studio") */
  contextLabel?: string
}

export default function SubscriptionQuotaBar({
  projectsUsed = 0,
  quotesUsedThisMonth = 0,
  contextLabel,
}: SubscriptionQuotaBarProps) {
  const { ui } = useLocalization()
  const {
    plan,
    planId,
    entitlements,
    accountState,
    isPaidActive,
    isExpired,
  } = useSubscription()

  const listingsUsed = Math.max(projectsUsed, entitlements.active_listings_count)
  const listingsLimit = entitlements.max_active_listings
  const listingsUnlimited = listingsLimit < 0 || listingsLimit >= 999
  const listingsRatio =
    listingsLimit === 0
      ? 1
      : listingsUnlimited
        ? Math.min(0.85, listingsUsed / 20)
        : Math.min(1, listingsUsed / Math.max(1, listingsLimit))
  const listingsNearOrAtCap =
    listingsLimit === 0 || (!listingsUnlimited && listingsUsed >= Math.ceil(listingsLimit * 0.8))

  const rfqsUsed = Math.max(quotesUsedThisMonth, entitlements.monthly_rfqs_count)
  const rfqsLimit = entitlements.max_monthly_rfqs
  const rfqsUnlimited = rfqsLimit < 0 || rfqsLimit >= 999
  const rfqsRatio =
    rfqsLimit === 0
      ? 1
      : rfqsUnlimited
        ? Math.min(0.85, rfqsUsed / 30)
        : Math.min(1, rfqsUsed / Math.max(1, rfqsLimit))
  const rfqsNearOrAtCap =
    rfqsLimit === 0 || (!rfqsUnlimited && rfqsUsed >= Math.ceil(rfqsLimit * 0.8))

  const expiryObj = entitlements.expires_at ? new Date(entitlements.expires_at) : null
  const expiryLabel =
    expiryObj && !Number.isNaN(expiryObj.getTime())
      ? expiryObj.toLocaleDateString(undefined, {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        })
      : null

  const isDormant = accountState === 'dormant' || isExpired
  const needsActionCta =
    isDormant || accountState === 'free' || listingsNearOrAtCap || rfqsNearOrAtCap
  const nextPlan: Exclude<SubscriptionPlanId, 'free'> =
    planId === 'pro' && isPaidActive ? 'enterprise' : 'pro'

  const stateBadgeText = isDormant
    ? ui('DORMANT · View-Only (Renew)', 'IMESIMAMA · Mtazamaji Pekee', 'INACTIVO · Solo Vista')
    : isPaidActive
      ? expiryLabel
        ? ui(
            `ACTIVE · ${plan.name} · Expires ${expiryLabel}`,
            `HAI · ${plan.name} · Inaisha ${expiryLabel}`,
            `ACTIVO · ${plan.name} · Vence ${expiryLabel}`,
          )
        : ui(`ACTIVE · ${plan.name}`, `HAI · ${plan.name}`, `ACTIVO · ${plan.name}`)
      : ui('FREE · Explorer (View-Only)', 'BURE · Explorer (Mtazamaji Pekee)', 'GRATIS · Solo Vista')

  return (
    <section
      aria-label={ui(
        'Subscription Plan and Live Quota Telemetry',
        'Hali ya Mpango na Vipimo vya Matumizi',
        'Estado del Plan y Cuotas en Vivo',
      )}
      className="min-w-0 max-w-full overflow-hidden rounded-xl border border-ink/15 bg-white/95 p-4 shadow-xs sm:p-5"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        {/* Left: Verified Account State Pill */}
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {contextLabel && (
              <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-stone">
                {contextLabel}
              </span>
            )}
            <span
              className={`inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[10.5px] font-bold uppercase tracking-wide ${
                isDormant
                  ? 'border-danger/45 bg-danger/10 text-danger'
                  : isPaidActive
                    ? 'border-moss/40 bg-moss-light text-moss'
                    : 'border-ink/20 bg-ink text-gold'
              }`}
            >
              <span
                className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                  isDormant ? 'bg-danger' : isPaidActive ? 'bg-moss' : 'bg-gold'
                }`}
              />
              <span className="truncate">{stateBadgeText}</span>
            </span>
          </div>

          <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-stone">
            <Crown size={12} className="shrink-0 text-ochre" />
            <span>
              {isDormant
                ? ui(
                    'View-only mode: 0 listings, 0 quote or information requests, no dossier/contact unlock until renewed.',
                    'Hali ya kutazama pekee: miradi 0, maombi 0 ya bei/taarifa hadi uhuishe mpango wako.',
                    'Modo solo vista: 0 listados, 0 cotizaciones ni solicitudes hasta renovar tu plan.',
                  )
                : isPaidActive
                  ? ui(
                      'Live quotas synced with Supabase get_user_entitlements().',
                      'Viwango hai vinaendana moja kwa moja na Supabase.',
                      'Cuotas sincronizadas en tiempo real con Supabase.',
                    )
                  : ui(
                      'View-only market, GIS & public listing access (0 listings · 0 quote/info requests · no dossier or contact unlock).',
                      'Mtazamaji pekee wa soko, GIS na matangazo ya wazi (miradi 0 · maombi 0 ya bei/taarifa · hakuna faili la leseni).',
                      'Acceso solo de vista al mercado y GIS (0 listados · 0 cotizaciones · sin acceso a expedientes).',
                    )}
            </span>
          </p>
        </div>

        {/* Center: Live Quota Meters */}
        <div className="grid min-w-0 flex-1 grid-cols-1 gap-3 sm:grid-cols-2 lg:max-w-lg">
          {/* Active Listings Meter */}
          <div className="min-w-0 rounded-lg border border-ink/10 bg-paper/80 px-3 py-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex min-w-0 items-center gap-1 truncate font-mono text-[10px] font-semibold uppercase tracking-wider text-stone">
                <FileSpreadsheet size={11} className="shrink-0 text-ochre" />
                <span className="truncate">
                  {ui('Active Listings', 'Miradi Hai', 'Listados Activos')}
                </span>
              </span>
              <span
                className={`shrink-0 font-mono text-xs font-bold tabular-nums ${
                  listingsNearOrAtCap && !listingsUnlimited ? 'text-danger' : 'text-ink'
                }`}
              >
                {listingsUsed} / {listingsUnlimited ? '∞' : listingsLimit}
              </span>
            </div>
            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-ink/10">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  listingsLimit === 0 || (!listingsUnlimited && listingsUsed >= listingsLimit)
                    ? 'bg-danger'
                    : listingsNearOrAtCap && !listingsUnlimited
                      ? 'bg-ochre'
                      : 'bg-moss'
                }`}
                style={{ width: `${Math.round(listingsRatio * 100)}%` }}
              />
            </div>
          </div>

          {/* Monthly Quote Requests Meter */}
          <div className="min-w-0 rounded-lg border border-ink/10 bg-paper/80 px-3 py-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex min-w-0 items-center gap-1 truncate font-mono text-[10px] font-semibold uppercase tracking-wider text-stone">
                <MessageSquareText size={11} className="shrink-0 text-ochre" />
                <span className="truncate">
                  {ui('Monthly RFQs', 'Maombi / Mwezi', 'RFQs Mensuales')}
                </span>
              </span>
              <span
                className={`shrink-0 font-mono text-xs font-bold tabular-nums ${
                  rfqsNearOrAtCap ? 'text-danger' : 'text-ink'
                }`}
              >
                {rfqsUsed} / {rfqsUnlimited ? '∞' : rfqsLimit}
              </span>
            </div>
            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-ink/10">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  rfqsLimit === 0 || (!rfqsUnlimited && rfqsUsed >= rfqsLimit)
                    ? 'bg-danger'
                    : rfqsNearOrAtCap
                      ? 'bg-ochre'
                      : 'bg-moss'
                }`}
                style={{ width: `${Math.round(rfqsRatio * 100)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Right: Upgrade / Renew / Manage CTA */}
        <div className="flex shrink-0 items-center gap-2">
          {needsActionCta ? (
            <Link
              to="/pricing"
              search={{ plan: nextPlan, checkout: '1' } as unknown as undefined}
              className="btn-primary w-full justify-center whitespace-nowrap !px-4 !py-2 text-xs lg:w-auto"
            >
              <Zap size={13} />
              {isDormant
                ? ui('Renew Plan', 'Huisha Mpango', 'Renovar Plan')
                : planId === 'pro' && isPaidActive
                  ? ui('Upgrade to Institutional', 'Pandisha Institutional', 'Subir a Institutional')
                  : ui('Upgrade Plan', 'Pandisha Mpango', 'Mejorar Plan')}
              <ArrowUpRight size={13} />
            </Link>
          ) : (
            <Link
              to="/pricing"
              className="inline-flex w-full items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-ink/15 bg-paper px-3.5 py-2 font-mono text-[11px] font-semibold text-ink transition hover:border-ochre hover:text-ochre lg:w-auto"
            >
              <CalendarClock size={12} className="text-ochre" />
              {ui('Manage Plan', 'Simamia Mpango', 'Gestionar Plan')}
            </Link>
          )}
        </div>
      </div>
    </section>
  )
}
