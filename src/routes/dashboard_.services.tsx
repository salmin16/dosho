import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useCallback, useEffect, useState } from 'react'
import {
  ArrowLeft,
  Award,
  CheckCircle2,
  Clock,
  Coins,
  Compass,
  ExternalLink,
  LayoutDashboard,
  ShieldCheck,
  Sparkles,
  Wrench,
} from 'lucide-react'
import {
  fetchGroundedUserData,
  getSession,
  useAuthSession,
} from '../lib/supabaseAuth'
import { useLocalization } from '../context/LocalizationContext'
import CurrencySwitcher from '../components/CurrencySwitcher'
import LanguageSwitcher from '../components/LanguageSwitcher'
import PriceDisplay from '../components/PriceDisplay'
import { GuidedServiceWizard } from '../components/GuidedSubmissionWizards'
import type { UserServiceRecord } from '../types/database'

export const Route = createFileRoute('/dashboard_/services')({
  component: DashboardServicesRouteComponent,
})

function DashboardServicesRouteComponent() {
  const navigate = useNavigate()
  const session = useAuthSession()
  const {
    currency,
    language,
    currencyMeta,
    rateForSelected,
    convertText,
    ui,
  } = useLocalization()

  const [services, setServices] = useState<UserServiceRecord[]>([])

  const loadData = useCallback(async () => {
    const data = await fetchGroundedUserData()
    setServices(data.userServices)
  }, [])

  useEffect(() => {
    const current = getSession()
    if (!current) {
      navigate({ to: '/login' })
      return
    }
    loadData()
  }, [navigate, loadData])

  if (!session) {
    return null
  }

  return (
    <div
      data-currency={currency}
      data-language={language}
      className="min-h-screen bg-paper pb-24 pt-28 text-ink"
    >
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        {/* Top Engineering Header & Guided Publishing Switcher */}
        <div className="rounded-2xl border border-ink/15 bg-ink p-6 text-paper shadow-xl contours lg:p-8">
          <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-gold/40 bg-moss/30 px-3 py-1 font-mono text-[11px] uppercase tracking-wider text-gold">
                  <ShieldCheck size={13} />
                  public.services · RLS: auth.uid() = user_id
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-paper/10 px-3 py-1 font-mono text-[11px] text-paper/80">
                  <Coins size={12} className="text-gold" />
                  {currencyMeta.flag} {currency} (1 USD ={' '}
                  {rateForSelected.toLocaleString('en-US', {
                    maximumFractionDigits: 2,
                  })}{' '}
                  {currency})
                </span>
              </div>
              <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight text-paper sm:text-4xl">
                {ui(
                  'Guided Technical Service Publishing Studio',
                  'Studio ya Kuchapisha Huduma za Kitaalamu',
                  'Estudio Guiado de Publicación de Servicios Técnicos',
                )}
              </h1>
              <p className="mt-1.5 max-w-2xl text-sm text-paper/75">
                {ui(
                  'Register accredited geological, drilling, assay, legal, and environmental services through a 3-step verification flow connected to the Admin Moderation Queue.',
                  'Sajili huduma za jiolojia, uchorongaji, maabara, sheria na mazingira kupitia hatua 3 za uthibitisho zinazounganishwa na Foleni ya Uhakiki wa Utawala.',
                  'Registre servicios acreditados de geología, perforación, ensayo, legales y ambientales mediante un flujo de 3 pasos conectado a la Cola de Moderación.',
                )}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 self-start lg:self-auto">
              <CurrencySwitcher dark />
              <LanguageSwitcher dark />
              <Link
                to="/dashboard"
                className="inline-flex items-center gap-1.5 rounded-lg border border-paper/20 bg-paper/10 px-3.5 py-2 text-xs font-semibold text-paper transition hover:bg-paper/20"
              >
                <ArrowLeft size={14} />
                {ui('Back to Vault', 'Rudi kwenye Hifadhi', 'Volver a la Bóveda')}
              </Link>
            </div>
          </div>

          {/* Dashboard Module Navigation Tabs */}
          <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-paper/10 pt-5">
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-2 rounded-lg border border-paper/15 bg-paper/5 px-4 py-2 text-xs font-semibold text-paper/80 transition hover:bg-paper/15 hover:text-paper"
            >
              <LayoutDashboard size={14} />
              {ui('Vault Overview', 'Muhtasari wa Hifadhi', 'Resumen de Bóveda')}
            </Link>
            <Link
              to="/dashboard/opportunities"
              className="inline-flex items-center gap-2 rounded-lg border border-paper/15 bg-paper/5 px-4 py-2 text-xs font-semibold text-paper/80 transition hover:bg-paper/15 hover:text-paper"
            >
              <Compass size={14} />
              {ui(
                'Publish Opportunity (/dashboard/opportunities)',
                'Chapisha Fursa (/dashboard/opportunities)',
                'Publicar Oportunidad (/dashboard/opportunities)',
              )}
            </Link>
            <Link
              to="/dashboard/services"
              className="inline-flex items-center gap-2 rounded-lg border border-gold bg-gold px-4 py-2 text-xs font-semibold text-ink shadow-sm"
            >
              <Wrench size={14} />
              {ui(
                'Publish Service (/dashboard/services)',
                'Chapisha Huduma (/dashboard/services)',
                'Publicar Servicio (/dashboard/services)',
              )}
            </Link>
            {session.user.role === 'admin' && (
              <Link
                to="/admin/approvals"
                className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-gold/40 bg-moss/30 px-3.5 py-2 font-mono text-[11px] font-semibold uppercase tracking-wider text-gold transition hover:bg-moss/40"
              >
                <ShieldCheck size={14} />
                {ui('Review Queue (/admin/approvals)', 'Foleni ya Uhakiki (/admin/approvals)', 'Cola de Revisión (/admin/approvals)')}
              </Link>
            )}
          </div>
        </div>

        {/* Guided 3-Step Service Wizard */}
        <div className="mt-8">
          <GuidedServiceWizard onSubmitted={loadData} />
        </div>

        {/* User's Submitted Services Ledger */}
        <section className="mt-10 rounded-2xl border border-ink/12 bg-paper-2/70 p-6 lg:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink/10 pb-4">
            <div className="flex items-center gap-2.5">
              <Wrench size={19} className="text-ochre" />
              <div>
                <h2 className="font-display text-xl font-semibold text-ink">
                  {ui(
                    `Your Technical Service Listings (${services.length})`,
                    `Huduma za Kitaalamu Ulizosajili (${services.length})`,
                    `Sus Servicios Técnicos Registrados (${services.length})`,
                  )}
                </h2>
                <p className="text-xs text-stone">
                  {ui('Live records from', 'Rekodi kutoka', 'Registros en vivo de')}{' '}
                  <code className="font-mono text-ink">public.services</code>{' '}
                  {ui('scoped to', 'kwa', 'vinculados a')}{' '}
                  <code className="font-mono text-ochre">{session.user.email}</code>
                </p>
              </div>
            </div>
            <span className="rounded-full border border-ink/15 bg-paper px-3 py-1 font-mono text-[11px] text-stone">
              Default Status: status = &apos;pending&apos;
            </span>
          </div>

          {services.length === 0 ? (
            <div className="mt-6 rounded-xl border border-dashed border-ink/15 bg-paper p-10 text-center">
              <Sparkles size={24} className="mx-auto text-ochre" />
              <p className="mt-2 font-display text-base font-semibold text-ink">
                No Service Profiles Submitted Yet
              </p>
              <p className="mx-auto mt-1 max-w-md text-xs text-stone">
                Complete the 3-step guided wizard above to submit your technical service profile
                and rate model for admin verification.
              </p>
            </div>
          ) : (
            <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
              {services.map((srv) => (
                <article
                  key={srv.id}
                  className="flex flex-col justify-between rounded-xl border border-ink/12 bg-paper p-5 shadow-2xs"
                >
                  <div>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-ink px-2 py-0.5 font-mono text-[10px] font-semibold text-gold">
                          {srv.reference_code}
                        </span>
                        <span className="rounded bg-ochre/15 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-ochre">
                          {srv.expertise_area}
                        </span>
                      </div>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase ${
                          srv.status === 'active'
                            ? 'border-moss/40 bg-moss-light text-moss'
                            : srv.status === 'pending'
                              ? 'border-gold/50 bg-gold/20 text-ochre'
                              : 'border-danger/40 bg-danger/15 text-danger'
                        }`}
                      >
                        {srv.status === 'active' ? (
                          <CheckCircle2 size={11} />
                        ) : (
                          <Clock size={11} />
                        )}
                        {srv.status}
                      </span>
                    </div>

                    <h3 className="mt-2.5 font-display text-lg font-semibold text-ink">
                      {convertText(srv.service_name)}
                    </h3>
                    <p className="mt-0.5 font-mono text-[11px] text-stone">
                      {srv.provider_organization} · {ui('Coverage:', 'Eneo:', 'Cobertura:')} {srv.regional_coverage}
                    </p>
                    <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-ink-3">
                      {convertText(srv.scope_description)}
                    </p>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {srv.certifications && (
                        <span className="inline-flex items-center gap-1 rounded border border-moss/30 bg-moss-light/60 px-2 py-0.5 font-mono text-[10px] text-moss">
                          <Award size={11} />
                          {convertText(srv.certifications)}
                        </span>
                      )}
                      {srv.portfolio_links
                        .split(',')
                        .map((s) => s.trim())
                        .filter(Boolean)
                        .map((link, idx) => (
                          <a
                            key={idx}
                            href={link}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 rounded border border-ink/15 bg-paper-2 px-2 py-0.5 font-mono text-[10px] text-ochre hover:underline"
                          >
                            <ExternalLink size={10} />
                            Portfolio #{idx + 1}
                          </a>
                        ))}
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-ink/10 pt-3 font-mono text-[11px]">
                    <span className="font-semibold text-ink">
                      {ui('Rate', 'Gharama', 'Tarifa')} ({currency}):{' '}
                      <span className="text-ochre">
                        {convertText(srv.rate_or_pricing_model)} (
                        <PriceDisplay amountInUSD={srv.estimated_rate_usd} />)
                      </span>
                    </span>
                    <span className="text-stone">
                      {new Date(srv.created_at).toLocaleDateString()}
                    </span>
                  </div>

                  {srv.moderation_notes && (
                    <div className="mt-2.5 rounded border border-ink/10 bg-paper-2 px-3 py-1.5 font-mono text-[10px] text-stone">
                      {ui('Moderation Note:', 'Maelezo ya Uhakiki:', 'Nota de Moderación:')}{' '}
                      {convertText(srv.moderation_notes)}
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
