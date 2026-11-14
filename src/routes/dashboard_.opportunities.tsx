import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useCallback, useEffect, useState } from 'react'
import {
  ArrowLeft,
  Briefcase,
  CheckCircle2,
  Clock,
  Coins,
  Compass,
  FileCheck2,
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
import { GuidedOpportunityWizard } from '../components/GuidedSubmissionWizards'
import type { UserOpportunityRecord } from '../types/database'

export const Route = createFileRoute('/dashboard_/opportunities')({
  component: DashboardOpportunitiesRouteComponent,
})

function DashboardOpportunitiesRouteComponent() {
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

  const [opportunities, setOpportunities] = useState<UserOpportunityRecord[]>([])

  const loadData = useCallback(async () => {
    const data = await fetchGroundedUserData()
    setOpportunities(data.userOpportunities)
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
                  public.opportunities · RLS: auth.uid() = user_id
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
                  'Guided Opportunity Publishing Studio',
                  'Studio ya Kuchapisha Fursa za Madini',
                  'Estudio Guiado de Publicación de Oportunidades',
                )}
              </h1>
              <p className="mt-1.5 max-w-2xl text-sm text-paper/75">
                {ui(
                  'Publish verified mining tenders, consultancies, exploration grants, JVs, and internships through a 3-step compliance workflow linked directly to the Admin Moderation Queue.',
                  'Chapisha zabuni za madini, ushauri, ruzuku za utafutaji, ubia (JV) na mafunzo kupitia hatua 3 zinazounganishwa moja kwa moja na Foleni ya Uhakiki wa Utawala.',
                  'Publique licitaciones mineras verificadas, consultorías, subvenciones, JVs y pasantías mediante un flujo de 3 pasos conectado a la Cola de Moderación.',
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
              className="inline-flex items-center gap-2 rounded-lg border border-gold bg-gold px-4 py-2 text-xs font-semibold text-ink shadow-sm"
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
              className="inline-flex items-center gap-2 rounded-lg border border-paper/15 bg-paper/5 px-4 py-2 text-xs font-semibold text-paper/80 transition hover:bg-paper/15 hover:text-paper"
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

        {/* Guided 3-Step Opportunity Wizard */}
        <div className="mt-8">
          <GuidedOpportunityWizard onSubmitted={loadData} />
        </div>

        {/* User's Submitted Opportunities Ledger */}
        <section className="mt-10 rounded-2xl border border-ink/12 bg-paper-2/70 p-6 lg:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink/10 pb-4">
            <div className="flex items-center gap-2.5">
              <Briefcase size={19} className="text-ochre" />
              <div>
                <h2 className="font-display text-xl font-semibold text-ink">
                  {ui(
                    `Your Opportunity Submissions (${opportunities.length})`,
                    `Fursa Ulizowasilisha (${opportunities.length})`,
                    `Sus Oportunidades Enviadas (${opportunities.length})`,
                  )}
                </h2>
                <p className="text-xs text-stone">
                  {ui('Live records from', 'Rekodi kutoka', 'Registros en vivo de')}{' '}
                  <code className="font-mono text-ink">public.opportunities</code>{' '}
                  {ui('scoped to', 'kwa', 'vinculados a')}{' '}
                  <code className="font-mono text-ochre">{session.user.email}</code>
                </p>
              </div>
            </div>
            <span className="rounded-full border border-ink/15 bg-paper px-3 py-1 font-mono text-[11px] text-stone">
              Default Status: status = &apos;pending&apos;
            </span>
          </div>

          {opportunities.length === 0 ? (
            <div className="mt-6 rounded-xl border border-dashed border-ink/15 bg-paper p-10 text-center">
              <Sparkles size={24} className="mx-auto text-ochre" />
              <p className="mt-2 font-display text-base font-semibold text-ink">
                {ui(
                  'No Opportunity Submissions Yet',
                  'Bado Hakuna Fursa Iliyowasilishwa',
                  'Aún No Hay Oportunidades Enviadas',
                )}
              </p>
              <p className="mx-auto mt-1 max-w-md text-xs text-stone">
                {ui(
                  'Complete the 3-step guided wizard above to publish your first mining tender, consultancy, grant, or internship for admin verification.',
                  'Kamilisha hatua 3 hapo juu ili kuchapisha zabuni, ushauri, ruzuku au mafunzo kwa ajili ya uhakiki.',
                  'Complete los 3 pasos anteriores para publicar su primera licitación, consultoría o subvención.',
                )}
              </p>
            </div>
          ) : (
            <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
              {opportunities.map((opp) => (
                <article
                  key={opp.id}
                  className="flex flex-col justify-between rounded-xl border border-ink/12 bg-paper p-5 shadow-2xs"
                >
                  <div>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-ink px-2 py-0.5 font-mono text-[10px] font-semibold text-gold">
                          {opp.reference_code}
                        </span>
                        <span className="rounded bg-ochre/15 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-ochre">
                          {opp.category}
                        </span>
                      </div>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase ${
                          opp.status === 'active'
                            ? 'border-moss/40 bg-moss-light text-moss'
                            : opp.status === 'pending'
                              ? 'border-gold/50 bg-gold/20 text-ochre'
                              : 'border-danger/40 bg-danger/15 text-danger'
                        }`}
                      >
                        {opp.status === 'active' ? (
                          <CheckCircle2 size={11} />
                        ) : (
                          <Clock size={11} />
                        )}
                        {opp.status}
                      </span>
                    </div>

                    <h3 className="mt-2.5 font-display text-lg font-semibold text-ink">
                      {convertText(opp.title)}
                    </h3>
                    <p className="mt-0.5 font-mono text-[11px] text-stone">
                      {opp.organization} · {opp.location} ·{' '}
                      {ui('Deadline:', 'Mwisho:', 'Fecha límite:')} {opp.deadline}
                    </p>
                    <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-ink-3">
                      {convertText(opp.description)}
                    </p>

                    {opp.requirements.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {opp.requirements.map((req, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1 rounded border border-ink/10 bg-paper-2 px-2 py-0.5 text-[11px] text-ink-2"
                          >
                            <FileCheck2 size={10} className="text-moss" />
                            {convertText(req)}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-ink/10 pt-3 font-mono text-[11px]">
                    <span className="font-semibold text-ink">
                      {ui('Value', 'Thamani', 'Valor')} ({currency}):{' '}
                      <span className="text-ochre">
                        {opp.compensation_usd > 0 ? (
                          <PriceDisplay amountInUSD={opp.compensation_usd} />
                        ) : (
                          ui('Per Tender Schedule', 'Kulingana na Zabuni', 'Según Licitación')
                        )}
                      </span>
                    </span>
                    <span className="text-stone">
                      {new Date(opp.created_at).toLocaleDateString()}
                    </span>
                  </div>

                  {opp.moderation_notes && (
                    <div className="mt-2.5 rounded border border-ink/10 bg-paper-2 px-3 py-1.5 font-mono text-[10px] text-stone">
                      {ui('Moderation Note:', 'Maelezo ya Uhakiki:', 'Nota de Moderación:')}{' '}
                      {convertText(opp.moderation_notes)}
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
