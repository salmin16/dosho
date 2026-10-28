import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import {
  ArrowRight,
  Search,
  FileCheck2,
  Landmark,
  Lock,
  Flag,
  ScrollText,
  Users,
  Pickaxe,
  BadgeCheck,
  Briefcase,
  HardHat,
  Compass,
  FileSpreadsheet,
  Wrench,
  CheckCircle2,
  ArrowUpRight,
} from 'lucide-react'
import {
  MINERALS,
  OPPORTUNITY_TYPES,
  PROJECTS,
  REGIONS,
  SERVICE_CATEGORIES,
  SERVICE_PROVIDERS,
  formatUsd,
} from '../data/fixtures'
import { img, imgSrcSet } from '../lib/img'
import { useSavedProjects } from '../lib/saved'
import { useAuthSession } from '../lib/supabaseAuth'
import { useI18n } from '../i18n'
import ProjectCard from '../components/ProjectCard'
import TanzaniaMap, { MapLegend } from '../components/TanzaniaMap'
import { levelTone } from '../components/VerificationBadge'

export const Route = createFileRoute('/')({
  component: Home,
})

function Home() {
  return (
    <>
      <Hero />
      <Stats />
      <OpportunityStreamsShowcase />
      <Featured />
      <HowItWorks />
      <VerificationLadder />
      <MapTeaser />
      <Audiences />
      <Services />
      <Trust />
      <Insights />
      <FinalCta />
    </>
  )
}

function Hero() {
  const { t, tv } = useI18n()
  const navigate = useNavigate()
  const [mineral, setMineral] = useState('')
  const [region, setRegion] = useState('')
  const [type, setType] = useState('')
  const [q, setQ] = useState('')

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    navigate({
      to: '/opportunities',
      search: {
        q: q || undefined,
        mineral: mineral || undefined,
        region: region || undefined,
        type: type || undefined,
      },
    })
  }

  return (
    <section className="grain relative isolate min-h-[100svh] overflow-hidden bg-ink text-paper">
      <img
        src={img('hero', 1920, 80)}
        srcSet={imgSrcSet('hero', [768, 1280, 1920, 2560])}
        sizes="100vw"
        alt={t('home.hero.imageAlt')}
        className="absolute inset-0 -z-10 h-full w-full object-cover animate-fade"
        fetchPriority="high"
      />
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(21,18,15,0.7)_0%,rgba(21,18,15,0.25)_35%,rgba(21,18,15,0.55)_65%,rgba(21,18,15,0.97)_100%)]" />

      <div className="mx-auto flex min-h-[100svh] max-w-7xl flex-col justify-end px-5 pb-14 pt-32 lg:px-8 lg:pb-20">
        <p className="eyebrow mb-6 text-gold animate-rise">{t('home.hero.eyebrow')}</p>
        <h1 className="font-display max-w-6xl break-words text-[clamp(2.6rem,7.8vw,7rem)] font-light leading-[0.95] animate-rise [animation-delay:120ms]">
          {t('home.hero.titleDiscover')} <em className="font-normal italic text-gold">{t('home.hero.titleVerify')}</em>{' '}
          {t('home.hero.titleConnect')}
        </h1>
        <p className="mt-7 max-w-2xl text-lg leading-relaxed text-paper/80 animate-rise [animation-delay:240ms]">
          {t('home.hero.subtitle')}
        </p>

        <form
          onSubmit={submit}
          className="mt-10 grid gap-2 rounded-xl border border-paper/15 bg-ink/60 p-2 shadow-2xl backdrop-blur-xl animate-rise [animation-delay:360ms] md:grid-cols-[1.4fr_1fr_1fr_1.2fr_auto]"
          role="search"
        >
          <label className="relative">
            <span className="sr-only">{t('home.hero.keywordLabel')}</span>
            <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-paper/50" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t('home.hero.searchPlaceholder')}
              className="h-12 w-full rounded-lg bg-paper/[0.06] pl-10 pr-3 text-sm text-paper outline-none placeholder:text-paper/45 focus:bg-paper/10"
            />
          </label>
          <HeroSelect
            label={t('home.hero.mineral')}
            allLabel={t('home.hero.allMinerals')}
            value={mineral}
            onChange={setMineral}
            options={MINERALS}
            renderOption={tv}
          />
          <HeroSelect
            label={t('home.hero.region')}
            allLabel={t('home.hero.allRegions')}
            value={region}
            onChange={setRegion}
            options={[...REGIONS]}
          />
          <HeroSelect
            label={t('home.hero.opportunityType')}
            allLabel={t('home.hero.allOpportunityTypes')}
            value={type}
            onChange={setType}
            options={OPPORTUNITY_TYPES}
            renderOption={tv}
          />
          <button type="submit" className="btn-primary h-12 whitespace-nowrap !px-6">
            {t('home.hero.searchBtn')} <ArrowRight size={16} />
          </button>
        </form>

        <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-paper/60 animate-rise [animation-delay:480ms]">
          <span className="eyebrow text-paper/40">{t('home.hero.popular')}</span>
          {(['Gold', 'Tanzanite', 'Graphite', 'Rare Earths'] as const).map((m) => (
            <Link key={m} to="/opportunities" search={{ mineral: m }} className="link-underline hover:text-paper">
              {tv(m)}
            </Link>
          ))}
          <span className="hidden h-4 w-px bg-paper/20 sm:block" />
          <Link to="/list-a-project" className="font-medium text-gold hover:text-paper">
            {t('home.hero.haveProject')}
          </Link>
        </div>

        {/* Grounded Auth & Due-Diligence Vault Banner */}
        <GroundedAuthHeroBanner />
      </div>
    </section>
  )
}

function GroundedAuthHeroBanner() {
  const session = useAuthSession()

  return (
    <div className="mt-8 flex flex-col items-start justify-between gap-4 rounded-xl border border-gold/30 bg-ink-2/90 p-5 shadow-xl backdrop-blur-md sm:flex-row sm:items-center">
      <div className="flex items-start gap-3.5">
        <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-ochre/20 text-gold">
          <Lock size={18} />
        </div>
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded bg-moss/30 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-gold">
              Supabase + PostgreSQL RLS
            </span>
            <h2 className="font-display text-base font-semibold text-paper">
              {session
                ? `Authenticated Vault Active — ${session.user.fullName} (${session.user.email})`
                : 'New: Private Investor & Operator Due-Diligence Vault'}
            </h2>
          </div>
          <p className="mt-1 text-xs text-paper/70">
            {session
              ? `Your session is grounded to UUID ${session.user.id}. Access or manage your private geological & tender dossiers.`
              : 'Sign in or provision an account to store confidential assay reports, license dossiers, and grounded notes enforced by Row-Level Security (auth.uid() = user_id).'}
          </p>
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2.5">
        {session ? (
          <Link to="/dashboard" className="btn-primary !py-2.5 !px-4 text-xs">
            Open Grounded Dashboard <ArrowRight size={14} />
          </Link>
        ) : (
          <>
            <Link
              to="/login"
              className="rounded-md border border-paper/25 bg-paper/10 px-4 py-2.5 text-xs font-semibold text-paper transition hover:bg-paper/20"
            >
              Sign In
            </Link>
            <Link to="/signup" className="btn-primary !py-2.5 !px-4 text-xs">
              Create Vault Account <ArrowRight size={14} />
            </Link>
          </>
        )}
      </div>
    </div>
  )
}

function HeroSelect({
  label,
  allLabel,
  value,
  onChange,
  options,
  renderOption,
}: {
  label: string
  allLabel: string
  value: string
  onChange: (v: string) => void
  options: readonly string[]
  renderOption?: (o: string) => string
}) {
  return (
    <label>
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-12 w-full cursor-pointer appearance-none rounded-lg bg-paper/[0.06] bg-[url('data:image/svg+xml,%3Csvg%20xmlns=%22http://www.w3.org/2000/svg%22%20width=%2212%22%20height=%2212%22%20fill=%22none%22%20stroke=%22%23f6f1e7%22%20stroke-opacity=%22.5%22%20stroke-width=%221.5%22%3E%3Cpath%20d=%22M2%204l4%204%204-4%22/%3E%3C/svg%3E')] bg-[length:12px] bg-[right_14px_center] bg-no-repeat px-3.5 pr-9 text-sm text-paper outline-none focus:bg-paper/10 [&>option]:text-ink"
      >
        <option value="">{allLabel}</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {renderOption ? renderOption(o) : o}
          </option>
        ))}
      </select>
    </label>
  )
}

function Stats() {
  const { fixtures } = useI18n()
  return (
    <section className="border-b border-ink/10 bg-ink text-paper">
      <div className="mx-auto grid max-w-7xl grid-cols-2 divide-paper/10 px-5 lg:grid-cols-4 lg:divide-x lg:px-8">
        {fixtures.platformStats.map((s) => (
          <div key={s.label} className="py-10 lg:px-8 first:lg:pl-0">
            <div className="font-display text-4xl font-light text-gold md:text-5xl">{s.value}</div>
            <div className="mt-2 text-sm text-paper/60">{s.label}</div>
          </div>
        ))}
      </div>
    </section>
  )
}

function SectionHead({
  eyebrow,
  title,
  body,
  action,
  dark,
}: {
  eyebrow: string
  title: React.ReactNode
  body?: string
  action?: React.ReactNode
  dark?: boolean
}) {
  return (
    <div className="mb-12 flex flex-col justify-between gap-6 md:flex-row md:items-end">
      <div className="max-w-2xl">
        <p className={`eyebrow mb-4 ${dark ? 'text-gold' : 'text-ochre'}`}>{eyebrow}</p>
        <h2 className="font-display text-4xl font-light leading-[1.05] md:text-5xl">{title}</h2>
        {body && <p className={`mt-5 text-lg leading-relaxed ${dark ? 'text-paper/65' : 'text-stone'}`}>{body}</p>}
      </div>
      {action}
    </div>
  )
}

function OpportunityStreamsShowcase() {
  const { t, tv, fixtures } = useI18n()

  const streamIcons = {
    tenders: FileSpreadsheet,
    services: Wrench,
    personnel: HardHat,
  } as const

  return (
    <section className="border-b border-ink/10 bg-paper-2 px-5 py-24 lg:px-8 lg:py-28">
      <div className="mx-auto max-w-7xl">
        <SectionHead
          eyebrow={t('opp.streams.eyebrow')}
          title={
            <>
              {t('opp.streams.titlePre')}
              <em className="italic text-ochre">{t('opp.streams.titleEm')}</em>
            </>
          }
          body={t('opp.streams.subtitle')}
          action={
            <Link to="/opportunities" className="btn-ghost shrink-0">
              {t('home.featured.browseAll', { count: PROJECTS.length })} <ArrowRight size={16} />
            </Link>
          }
        />

        <div className="grid gap-6 lg:grid-cols-3">
          {fixtures.opportunityStreams.map((stream) => {
            const Icon = streamIcons[stream.id]
            const matchingProjects = PROJECTS.filter((p) => p.type === stream.type)
            const totalPipelineUsd = matchingProjects.reduce((sum, p) => sum + p.investmentUsd, 0)

            return (
              <article
                key={stream.id}
                className="group flex flex-col justify-between rounded-2xl border border-ink/12 bg-white/85 p-7 transition duration-300 hover:-translate-y-1 hover:border-ochre/40 hover:bg-white hover:shadow-[0_24px_48px_-28px_rgba(21,18,15,0.4)]"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-2 rounded-full bg-ink px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-gold">
                      <span>{stream.code}</span>
                      <span className="text-paper/40">·</span>
                      <span>{stream.badge}</span>
                    </span>
                    <span className="rounded-full border border-moss/25 bg-moss-light px-2.5 py-1 font-mono text-[10px] font-medium uppercase tracking-wider text-moss">
                      {stream.complianceTag}
                    </span>
                  </div>

                  <div className="mt-5 flex items-start gap-3.5">
                    <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-ochre/20 bg-ochre/10 text-ochre">
                      <Icon size={22} />
                    </div>
                    <div>
                      <h3 className="font-display text-2xl font-medium leading-snug text-ink">{stream.title}</h3>
                      <p className="mt-1 font-mono text-[11px] text-stone">{stream.contractModel}</p>
                    </div>
                  </div>

                  <p className="mt-4 text-sm leading-relaxed text-stone">{stream.summary}</p>

                  {/* Analytical KPI strip */}
                  <dl className="mt-5 grid grid-cols-3 gap-2 rounded-xl border border-ink/10 bg-paper-2/70 p-3 text-center">
                    <div>
                      <dt className="font-mono text-[10px] uppercase tracking-wider text-stone">{t('opp.streams.activeListings')}</dt>
                      <dd className="font-display mt-0.5 text-2xl font-medium text-ink">{matchingProjects.length}</dd>
                    </div>
                    <div className="border-x border-ink/10 px-1">
                      <dt className="font-mono text-[10px] uppercase tracking-wider text-stone">{t('opp.streams.pipelineValue')}</dt>
                      <dd className="font-display mt-0.5 text-2xl font-medium text-ochre">{formatUsd(totalPipelineUsd)}</dd>
                    </div>
                    <div>
                      <dt className="font-mono text-[10px] uppercase tracking-wider text-stone">{t('opp.streams.typicalTicket')}</dt>
                      <dd className="mt-1.5 font-mono text-[11px] font-semibold text-ink">{stream.typicalValue}</dd>
                    </div>
                  </dl>

                  {/* Visual Demand Breakdown */}
                  <div className="mt-5">
                    <div className="mb-2.5 font-mono text-[10px] uppercase tracking-wider text-stone">
                      {t('opp.streams.demandBreakdown')}
                    </div>
                    <ul className="space-y-2.5">
                      {stream.subCategories.map((sub) => (
                        <li key={sub.name} className="text-xs">
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate font-medium text-ink/90">{sub.name}</span>
                            <span className="flex shrink-0 items-center gap-1.5 font-mono text-[10px]">
                              <span
                                className={`rounded px-1.5 py-0.5 ${
                                  sub.demand === 'High'
                                    ? 'bg-ochre/15 font-semibold text-ochre'
                                    : sub.demand === 'Active'
                                      ? 'bg-moss-light text-moss'
                                      : 'bg-paper-2 text-stone'
                                }`}
                              >
                                {tv(sub.demand)}
                              </span>
                              <span className="w-7 text-right text-stone">{sub.share}%</span>
                            </span>
                          </div>
                          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-ink/10">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-ochre to-gold"
                              style={{ width: `${sub.share * 2.2}%` }}
                            />
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Requirements */}
                  <div className="mt-5 border-t border-ink/10 pt-4">
                    <div className="font-mono text-[10px] uppercase tracking-wider text-stone">
                      {t('opp.streams.keyRequirements')}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {stream.requirements.map((req) => (
                        <span
                          key={req}
                          className="inline-flex items-center gap-1 rounded-md border border-sand bg-paper/60 px-2 py-1 text-[11px] text-ink/85"
                        >
                          <CheckCircle2 size={11} className="shrink-0 text-moss" />
                          {req}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <Link
                  to="/opportunities"
                  search={{ type: stream.type }}
                  className="mt-6 flex w-full items-center justify-between rounded-xl bg-ink px-4 py-3 text-sm font-semibold text-paper transition group-hover:bg-ochre"
                >
                  <span>{t('opp.streams.exploreStream')}</span>
                  <span className="inline-flex items-center gap-1 font-mono text-xs opacity-90">
                    {matchingProjects.length} <ArrowUpRight size={15} />
                  </span>
                </Link>
              </article>
            )
          })}
        </div>
      </div>
    </section>
  )
}

function Featured() {
  const { t } = useI18n()
  const { isSaved, toggle } = useSavedProjects()
  const featured = PROJECTS.filter((p) => p.featured)
  return (
    <section className="px-5 py-24 lg:px-8 lg:py-32">
      <div className="mx-auto max-w-7xl">
        <SectionHead
          eyebrow={t('home.featured.eyebrow')}
          title={
            <>
              {t('home.featured.titlePre')}
              <em className="italic text-ochre">{t('home.featured.titleEm')}</em>
              {t('home.featured.titlePost')}
            </>
          }
          body={t('home.featured.body')}
          action={
            <Link to="/opportunities" className="btn-ghost shrink-0">
              {t('home.featured.browseAll', { count: PROJECTS.length })} <ArrowRight size={16} />
            </Link>
          }
        />
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {featured.map((p) => (
            <ProjectCard key={p.id} project={p} saved={isSaved(p.id)} onToggleSave={toggle} />
          ))}
        </div>
      </div>
    </section>
  )
}

function HowItWorks() {
  const { t } = useI18n()
  const [tab, setTab] = useState<'investor' | 'owner'>('investor')

  const investorSteps = [
    { t: t('home.how.inv1.t'), d: t('home.how.inv1.d') },
    { t: t('home.how.inv2.t'), d: t('home.how.inv2.d') },
    { t: t('home.how.inv3.t'), d: t('home.how.inv3.d') },
    { t: t('home.how.inv4.t'), d: t('home.how.inv4.d') },
    { t: t('home.how.inv5.t'), d: t('home.how.inv5.d') },
    { t: t('home.how.inv6.t'), d: t('home.how.inv6.d') },
  ]
  const ownerSteps = [
    { t: t('home.how.own1.t'), d: t('home.how.own1.d') },
    { t: t('home.how.own2.t'), d: t('home.how.own2.d') },
    { t: t('home.how.own3.t'), d: t('home.how.own3.d') },
    { t: t('home.how.own4.t'), d: t('home.how.own4.d') },
    { t: t('home.how.own5.t'), d: t('home.how.own5.d') },
    { t: t('home.how.own6.t'), d: t('home.how.own6.d') },
  ]
  const steps = tab === 'investor' ? investorSteps : ownerSteps

  return (
    <section id="how-it-works" className="scroll-mt-20 border-y border-ink/10 bg-paper-2 px-5 py-24 lg:px-8 lg:py-32">
      <div className="mx-auto max-w-7xl">
        <SectionHead
          eyebrow={t('home.how.eyebrow')}
          title={t('home.how.title')}
          action={
            <div className="inline-flex flex-wrap rounded-lg border border-ink/15 bg-paper p-1" role="tablist">
              {(
                [
                  ['investor', t('home.how.forInvestors')],
                  ['owner', t('home.how.forOwners')],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  role="tab"
                  aria-selected={tab === id}
                  onClick={() => setTab(id)}
                  className={`rounded-md px-4 py-2 text-sm font-semibold transition ${
                    tab === id ? 'bg-ink text-paper' : 'text-stone hover:text-ink'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          }
        />
        <ol key={tab} className="grid gap-px overflow-hidden rounded-xl border border-ink/10 bg-ink/10 sm:grid-cols-2 lg:grid-cols-3">
          {steps.map((s, i) => (
            <li key={s.t} className="bg-paper p-7 animate-rise" style={{ animationDelay: `${i * 70}ms` }}>
              <span className="font-mono text-xs text-ochre">{String(i + 1).padStart(2, '0')}</span>
              <h3 className="font-display mt-4 text-2xl font-normal">{s.t}</h3>
              <p className="mt-2 text-sm leading-relaxed text-stone">{s.d}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

function VerificationLadder() {
  const { t, fixtures } = useI18n()
  return (
    <section className="px-5 py-24 lg:px-8 lg:py-32">
      <div className="mx-auto grid max-w-7xl gap-14 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="lg:sticky lg:top-28 lg:self-start">
          <p className="eyebrow mb-4 text-ochre">{t('home.ladder.eyebrow')}</p>
          <h2 className="font-display text-4xl font-light leading-[1.05] md:text-5xl">
            {t('home.ladder.title1')} <br />
            <em className="italic">{t('home.ladder.title2')}</em>
          </h2>
          <p className="mt-5 max-w-md text-lg leading-relaxed text-stone">{t('home.ladder.body')}</p>
          <Link to="/verification" className="btn-ghost mt-8">
            {t('home.ladder.cta')} <ArrowRight size={16} />
          </Link>
        </div>
        <ol className="space-y-3">
          {fixtures.verificationLevels.map((v) => (
            <li
              key={v.level}
              className="group grid grid-cols-[64px_1fr] items-start gap-5 rounded-xl border border-ink/10 bg-white/50 p-5 transition hover:border-ink/25 hover:bg-white"
            >
              <span className={`grid h-16 w-16 place-items-center rounded-lg border font-display text-2xl ${levelTone(v.level)}`}>
                L{v.level}
              </span>
              <div>
                <h3 className="font-display text-xl">{v.name}</h3>
                <p className="mt-1 text-sm leading-relaxed text-stone">{v.description}</p>
                <p className="mt-3 font-mono text-[11px] uppercase tracking-wider text-stone/80">
                  {t('home.ladder.notCovered')} <span className="normal-case tracking-normal">{v.notCovered}</span>
                </p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

function MapTeaser() {
  const { t } = useI18n()
  const zones = [
    t('home.mapTeaser.zone1'),
    t('home.mapTeaser.zone2'),
    t('home.mapTeaser.zone3'),
    t('home.mapTeaser.zone4'),
  ]
  return (
    <section className="relative overflow-hidden bg-ink px-5 py-24 text-paper lg:px-8 lg:py-32">
      <div className="contours absolute inset-0" aria-hidden />
      <div className="relative mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-2">
        <div>
          <p className="eyebrow mb-4 text-gold">{t('home.mapTeaser.eyebrow')}</p>
          <h2 className="font-display text-4xl font-light leading-[1.05] md:text-5xl">
            {t('home.mapTeaser.titlePre')}
            <em className="italic text-gold">{t('home.mapTeaser.titleEm')}</em>
          </h2>
          <p className="mt-5 max-w-lg text-lg leading-relaxed text-paper/65">{t('home.mapTeaser.body')}</p>
          <ul className="mt-8 grid max-w-md grid-cols-1 gap-4 text-sm text-paper/75 sm:grid-cols-2">
            {zones.map((x) => (
              <li key={x} className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-gold" /> {x}
              </li>
            ))}
          </ul>
          <Link to="/map" className="btn-primary mt-10">
            {t('home.mapTeaser.cta')} <Compass size={16} />
          </Link>
        </div>
        <div className="relative">
          <TanzaniaMap projects={PROJECTS} variant="dark" className="w-full" />
          <div className="mt-4">
            <MapLegend dark />
          </div>
        </div>
      </div>
    </section>
  )
}

function Audiences() {
  const { t } = useI18n()
  return (
    <section className="px-5 py-24 lg:px-8 lg:py-32">
      <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-2">
        <article className="relative isolate overflow-hidden rounded-2xl bg-ink p-10 text-paper md:p-14">
          <img
            src={img('field', 1200)}
            alt={t('home.audiences.fieldAlt')}
            loading="lazy"
            className="absolute inset-0 -z-10 h-full w-full object-cover opacity-55"
          />
          <div className="absolute inset-0 -z-10 bg-gradient-to-t from-ink via-ink/70 to-ink/20" />
          <Briefcase className="text-gold" />
          <h3 className="font-display mt-28 text-4xl font-light leading-tight md:mt-40">{t('home.audiences.investorsTitle')}</h3>
          <p className="mt-4 max-w-md leading-relaxed text-paper/75">{t('home.audiences.investorsBody')}</p>
          <Link to="/pricing" className="btn-primary mt-8">
            {t('home.audiences.investorsCta')} <ArrowRight size={16} />
          </Link>
        </article>
        <article className="relative overflow-hidden rounded-2xl border border-ink/10 bg-ochre p-10 text-paper md:p-14">
          <div className="contours absolute inset-0 opacity-80 mix-blend-overlay" aria-hidden />
          <div className="relative">
            <Pickaxe className="text-paper" />
            <h3 className="font-display mt-28 text-4xl font-light leading-tight md:mt-40">{t('home.audiences.ownersTitle')}</h3>
            <p className="mt-4 max-w-md leading-relaxed text-paper/85">{t('home.audiences.ownersBody')}</p>
            <Link to="/list-a-project" className="mt-8 inline-flex items-center gap-2 rounded-md bg-ink px-5 py-3 text-sm font-semibold text-paper transition hover:bg-ink-2">
              {t('home.audiences.ownersCta')} <ArrowRight size={16} />
            </Link>
          </div>
        </article>
      </div>
    </section>
  )
}

function Services() {
  const { t, tv } = useI18n()
  return (
    <section className="border-t border-ink/10 px-5 py-24 lg:px-8 lg:py-32">
      <div className="mx-auto max-w-7xl">
        <SectionHead
          eyebrow={t('home.services.eyebrow')}
          title={t('home.services.title')}
          body={t('home.services.body')}
          action={
            <Link to="/services" className="btn-ghost shrink-0">
              {t('home.services.cta')} <ArrowRight size={16} />
            </Link>
          }
        />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {SERVICE_CATEGORIES.map((c) => {
            const count = SERVICE_PROVIDERS.filter((s) => s.category === c).length
            return (
              <Link
                key={c}
                to="/services"
                search={{ category: c }}
                className="group flex items-center justify-between gap-2 rounded-xl border border-ink/10 bg-white/50 px-5 py-5 transition hover:border-ochre/40 hover:bg-white"
              >
                <span className="flex items-center gap-3">
                  <HardHat size={18} className="shrink-0 text-ochre" />
                  <span className="font-medium leading-tight">{tv(c)}</span>
                </span>
                <span className="shrink-0 font-mono text-xs text-stone group-hover:text-ochre">{count}</span>
              </Link>
            )
          })}
        </div>
      </div>
    </section>
  )
}

function Trust() {
  const { t } = useI18n()
  const trustItems = [
    { icon: FileCheck2, t: t('home.trust.t1'), d: t('home.trust.d1') },
    { icon: BadgeCheck, t: t('home.trust.t2'), d: t('home.trust.d2') },
    { icon: Lock, t: t('home.trust.t3'), d: t('home.trust.d3') },
    { icon: ScrollText, t: t('home.trust.t4'), d: t('home.trust.d4') },
    { icon: Landmark, t: t('home.trust.t5'), d: t('home.trust.d5') },
    { icon: Flag, t: t('home.trust.t6'), d: t('home.trust.d6') },
  ]
  return (
    <section className="bg-paper-2 px-5 py-24 lg:px-8 lg:py-32">
      <div className="mx-auto max-w-7xl">
        <SectionHead
          eyebrow={t('home.trust.eyebrow')}
          title={
            <>
              {t('home.trust.titlePre')}
              <em className="italic text-ochre">{t('home.trust.titleEm')}</em>
            </>
          }
          body={t('home.trust.body')}
        />
        <div className="grid gap-x-10 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
          {trustItems.map(({ icon: Icon, t: title, d }) => (
            <div key={title} className="border-t border-ink/15 pt-6">
              <Icon className="text-ochre" size={22} />
              <h3 className="font-display mt-5 text-2xl">{title}</h3>
              <p className="mt-2 leading-relaxed text-stone">{d}</p>
            </div>
          ))}
        </div>
        <div className="mt-16 flex flex-col gap-4 rounded-xl border border-danger/25 bg-danger/[0.05] p-6 sm:flex-row sm:items-center">
          <Users className="shrink-0 text-danger" />
          <p className="text-sm leading-relaxed text-ink/80">
            <strong>{t('home.trust.scamTitle')}</strong> {t('home.trust.scamBody')}
          </p>
        </div>
      </div>
    </section>
  )
}

function Insights() {
  const { t, fixtures } = useI18n()
  return (
    <section className="px-5 py-24 lg:px-8 lg:py-32">
      <div className="mx-auto max-w-7xl">
        <SectionHead eyebrow={t('home.insights.eyebrow')} title={t('home.insights.title')} />
        <div className="grid gap-6 md:grid-cols-3">
          {fixtures.insights.map((a, i) => (
            <article key={a.title} className="group flex flex-col rounded-xl border border-ink/10 p-7 transition hover:border-ink/25">
              <div className="flex items-center justify-between font-mono text-[11px] uppercase tracking-wider text-stone">
                <span className="text-ochre">{a.tag}</span>
                <span>{t('home.insights.minRead', { minutes: a.minutes })}</span>
              </div>
              <span className="font-display mt-10 text-6xl font-light text-ink/10">{String(i + 1).padStart(2, '0')}</span>
              <h3 className="font-display mt-4 text-2xl leading-snug group-hover:text-ochre">{a.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-stone">{a.excerpt}</p>
              <span className="mt-auto pt-8 text-sm font-semibold">{t('home.insights.comingSoon')}</span>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

function FinalCta() {
  const { t } = useI18n()
  return (
    <section className="relative overflow-hidden border-t border-ink/10 px-5 py-28 text-center lg:px-8">
      <p className="eyebrow mb-6 text-ochre">{t('home.finalCta.eyebrow')}</p>
      <h2 className="font-display mx-auto max-w-4xl text-5xl font-light leading-[1] md:text-7xl">
        {t('home.finalCta.titlePre')}
        <em className="italic text-ochre">{t('home.finalCta.titleEm')}</em>
      </h2>
      <div className="mt-10 flex flex-col justify-center gap-3 sm:flex-row">
        <Link to="/list-a-project" className="btn-primary">
          {t('home.finalCta.listBtn')} <ArrowRight size={16} />
        </Link>
        <Link to="/opportunities" className="btn-ghost">
          {t('home.finalCta.browseBtn')}
        </Link>
      </div>
    </section>
  )
}
