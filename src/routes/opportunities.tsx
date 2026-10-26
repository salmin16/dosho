import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import {
  LayoutGrid,
  List,
  Map as MapIcon,
  Search,
  SlidersHorizontal,
  X,
  SearchX,
  FileSpreadsheet,
  Wrench,
  HardHat,
  BarChart3,
  CheckCircle2,
  ArrowUpRight,
} from 'lucide-react'
import {
  INVESTMENT_BANDS,
  MINERALS,
  OPPORTUNITY_TYPES,
  PROJECTS,
  REGIONS,
  STAGES,
  VERIFICATION_LEVELS,
  formatUsd,
  type Project,
} from '../data/fixtures'
import { useSavedProjects } from '../lib/saved'
import { useI18n } from '../i18n'
import ProjectCard from '../components/ProjectCard'
import TanzaniaMap, { MapLegend } from '../components/TanzaniaMap'
import VerificationBadge from '../components/VerificationBadge'

type Search = {
  q?: string
  mineral?: string
  region?: string
  type?: string
  stage?: string
  licence?: string
  level?: number
  band?: string
  sort?: 'updated' | 'listed' | 'investment-asc' | 'investment-desc' | 'verification'
  view?: 'grid' | 'list' | 'map'
  saved?: boolean
}

const str = (v: unknown) => (typeof v === 'string' && v ? v : undefined)

export const Route = createFileRoute('/opportunities')({
  validateSearch: (s: Record<string, unknown>): Search => ({
    q: str(s.q),
    mineral: str(s.mineral),
    region: str(s.region),
    type: str(s.type),
    stage: str(s.stage),
    licence: str(s.licence),
    level: s.level !== undefined && !Number.isNaN(Number(s.level)) ? Number(s.level) : undefined,
    band: str(s.band),
    sort: str(s.sort) as Search['sort'],
    view: str(s.view) as Search['view'],
    saved: s.saved === true || s.saved === 'true' ? true : undefined,
  }),
  head: () => ({ meta: [{ title: 'Mining opportunities — MineConnect' }] }),
  component: Opportunities,
})

function applyFilters(
  projects: Project[],
  s: Search,
  saved: string[],
  localizeProject: (p: Project) => Project,
  tv: (val: string) => string,
) {
  const q = s.q?.toLowerCase().trim()
  const band = INVESTMENT_BANDS.find((b) => b.id === s.band)
  const list = projects.filter((p) => {
    if (q) {
      const loc = localizeProject(p)
      const haystack = [
        p.title,
        loc.title,
        p.id,
        p.region,
        p.district,
        p.summary,
        loc.summary,
        ...p.minerals,
        ...p.minerals.map(tv),
      ]
        .join(' ')
        .toLowerCase()
      if (!haystack.includes(q)) return false
    }
    if (s.mineral && !p.minerals.includes(s.mineral as never)) return false
    if (s.region && p.region !== s.region) return false
    if (s.type && p.type !== s.type) return false
    if (s.stage && p.stage !== s.stage) return false
    if (s.licence && p.licence.type !== s.licence) return false
    if (s.level !== undefined && p.verification.level < s.level) return false
    if (band && (p.investmentUsd < band.min || p.investmentUsd >= band.max)) return false
    if (s.saved && !saved.includes(p.id)) return false
    return true
  })
  const sort = s.sort ?? 'updated'
  return [...list].sort((a, b) => {
    switch (sort) {
      case 'listed':
        return b.listedOn.localeCompare(a.listedOn)
      case 'investment-asc':
        return a.investmentUsd - b.investmentUsd
      case 'investment-desc':
        return b.investmentUsd - a.investmentUsd
      case 'verification':
        return b.verification.level - a.verification.level
      default:
        return b.updatedOn.localeCompare(a.updatedOn)
    }
  })
}

function Opportunities() {
  const { t, tv, localizeProject, fixtures } = useI18n()
  const search = Route.useSearch()
  const navigate = useNavigate({ from: '/opportunities' })
  const { saved, isSaved, toggle } = useSavedProjects()
  const [drawer, setDrawer] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)

  const results = useMemo(
    () => applyFilters(PROJECTS, search, saved, localizeProject, tv),
    [search, saved, localizeProject, tv],
  )
  const view = search.view ?? 'grid'

  const set = (patch: Partial<Search>) => navigate({ search: (prev) => ({ ...prev, ...patch }), replace: true, resetScroll: false })

  const active = (
    [
      ['mineral', search.mineral ? tv(search.mineral) : undefined],
      ['region', search.region],
      ['type', search.type ? tv(search.type) : undefined],
      ['stage', search.stage ? tv(search.stage) : undefined],
      ['licence', search.licence ? tv(search.licence) : undefined],
      ['level', search.level !== undefined ? t('opp.levelPlus', { level: search.level }) : undefined],
      ['band', fixtures.investmentBands.find((b) => b.id === search.band)?.label],
      ['saved', search.saved ? t('opp.savedOnlyChip') : undefined],
    ] as const
  ).filter(([, v]) => v !== undefined) as [keyof Search, string][]

  const clearAll = () => navigate({ search: { view: search.view, sort: search.sort }, replace: true })
  const selectedProject = results.find((p) => p.id === selected) ?? results[0]

  const filters = <Filters search={search} set={set} />

  return (
    <div className="pt-[72px]">
      <section className="border-b border-ink/10 bg-paper-2">
        <div className="mx-auto max-w-7xl px-5 pb-10 pt-14 lg:px-8">
          <p className="eyebrow mb-3 text-ochre">{t('opp.eyebrow')}</p>
          <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
            <h1 className="font-display text-5xl font-light leading-none md:text-6xl">{t('opp.title')}</h1>
            <label className="relative w-full lg:max-w-md">
              <span className="sr-only">{t('opp.searchLabel')}</span>
              <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-stone" />
              <input
                defaultValue={search.q}
                onChange={(e) => set({ q: e.target.value || undefined })}
                placeholder={t('opp.searchPlaceholder')}
                className="field !h-12 !pl-10"
              />
            </label>
          </div>
        </div>
      </section>

      <OpportunityStreamsHub activeType={search.type} onSelectType={(type) => set({ type: search.type === type ? undefined : type })} />

      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-10 lg:grid-cols-[260px_1fr] lg:px-8">
        <aside className="hidden lg:block">
          <div className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto pb-6 pr-2">{filters}</div>
        </aside>

        <div className="min-w-0">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button onClick={() => setDrawer(true)} className="btn-ghost !py-2 lg:hidden">
                <SlidersHorizontal size={15} /> {t('opp.filtersBtn')} {active.length > 0 && `(${active.length})`}
              </button>
              <p className="text-sm text-stone">
                {t('opp.showingCount', { count: results.length, total: PROJECTS.length })}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={search.sort ?? 'updated'}
                onChange={(e) => set({ sort: e.target.value as Search['sort'] })}
                className="field !w-auto !py-2"
                aria-label={t('opp.sortLabel')}
              >
                <option value="updated">{t('opp.sort.updated')}</option>
                <option value="listed">{t('opp.sort.listed')}</option>
                <option value="verification">{t('opp.sort.verification')}</option>
                <option value="investment-desc">{t('opp.sort.investmentDesc')}</option>
                <option value="investment-asc">{t('opp.sort.investmentAsc')}</option>
              </select>
              <div className="flex rounded-md border border-sand bg-white/60 p-0.5" role="group" aria-label={t('opp.viewLabel')}>
                {(
                  [
                    ['grid', LayoutGrid],
                    ['list', List],
                    ['map', MapIcon],
                  ] as const
                ).map(([v, Icon]) => (
                  <button
                    key={v}
                    onClick={() => set({ view: v })}
                    aria-pressed={view === v}
                    aria-label={`${v} view`}
                    className={`rounded p-2 transition ${view === v ? 'bg-ink text-paper' : 'text-stone hover:text-ink'}`}
                  >
                    <Icon size={16} />
                  </button>
                ))}
              </div>
            </div>
          </div>

          {active.length > 0 && (
            <div className="mb-6 flex flex-wrap items-center gap-2">
              {active.map(([k, v]) => (
                <button
                  key={k}
                  onClick={() => set({ [k]: undefined } as Partial<Search>)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-ink/15 bg-white px-3 py-1.5 text-xs font-medium hover:border-ochre hover:text-ochre"
                >
                  {v} <X size={12} />
                </button>
              ))}
              <button onClick={clearAll} className="px-2 text-xs font-semibold text-ochre hover:underline">
                {t('opp.clearAll')}
              </button>
            </div>
          )}

          {results.length === 0 ? (
            <div className="grid place-items-center rounded-xl border border-dashed border-ink/20 px-6 py-24 text-center">
              <SearchX className="text-stone" size={32} />
              <h2 className="font-display mt-5 text-3xl">{t('opp.noResultsTitle')}</h2>
              <p className="mt-2 max-w-md text-stone">
                {search.saved ? t('opp.noResultsSaved') : t('opp.noResultsDefault')}
              </p>
              <button onClick={clearAll} className="btn-primary mt-8">
                {t('opp.resetFilters')}
              </button>
            </div>
          ) : view === 'map' ? (
            <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
              <div className="rounded-xl border border-ink/10 bg-white/50 p-4">
                <TanzaniaMap projects={results} selectedId={selectedProject?.id} onSelect={setSelected} className="w-full" />
                <div className="mt-2 px-2">
                  <MapLegend />
                </div>
              </div>
              <div className="space-y-4">
                {selectedProject && <ProjectCard project={selectedProject} saved={isSaved(selectedProject.id)} onToggleSave={toggle} />}
                <ul className="divide-y divide-ink/10 rounded-xl border border-ink/10 bg-white/50">
                  {results.map((raw) => {
                    const p = localizeProject(raw)
                    return (
                      <li key={p.id}>
                        <button
                          onClick={() => setSelected(p.id)}
                          className={`flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm transition hover:bg-white ${
                            p.id === selectedProject?.id ? 'bg-white font-semibold' : ''
                          }`}
                        >
                          <span className="truncate">{p.title}</span>
                          <span className="shrink-0 font-mono text-xs text-stone">{formatUsd(p.investmentUsd)}</span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </div>
            </div>
          ) : (
            <div className={view === 'grid' ? 'grid gap-6 sm:grid-cols-2 xl:grid-cols-3' : 'grid gap-4'}>
              {results.map((p) => (
                <ProjectCard key={p.id} project={p} layout={view === 'list' ? 'row' : 'grid'} saved={isSaved(p.id)} onToggleSave={toggle} />
              ))}
            </div>
          )}

          <p className="mt-12 rounded-lg border border-ink/10 bg-paper-2 p-4 text-xs leading-relaxed text-stone">
            {t('opp.disclaimer')}
          </p>
        </div>
      </div>

      {drawer && (
        <div className="fixed inset-0 z-[60] lg:hidden" role="dialog" aria-modal aria-label={t('opp.filtersBtn')}>
          <div className="absolute inset-0 bg-ink/50 animate-fade" onClick={() => setDrawer(false)} />
          <div className="absolute inset-y-0 left-0 w-[86%] max-w-sm overflow-y-auto bg-paper p-6 shadow-2xl">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="font-display text-2xl">{t('opp.filtersBtn')}</h2>
              <button onClick={() => setDrawer(false)} aria-label={t('opp.closeFilters')}>
                <X />
              </button>
            </div>
            {filters}
            <button onClick={() => setDrawer(false)} className="btn-primary mt-6 w-full">
              {t('opp.showResultsBtn', { count: results.length })}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function OpportunityStreamsHub({
  activeType,
  onSelectType,
}: {
  activeType?: string
  onSelectType: (type: string) => void
}) {
  const { t, tv, fixtures } = useI18n()
  const [showMatrix, setShowMatrix] = useState(false)

  const streamIcons = {
    tenders: FileSpreadsheet,
    services: Wrench,
    personnel: HardHat,
  } as const

  return (
    <section className="border-b border-ink/10 bg-gradient-to-b from-paper-2/70 to-paper px-5 py-12 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div className="max-w-3xl">
            <p className="eyebrow mb-2.5 text-ochre">{t('opp.streams.eyebrow')}</p>
            <h2 className="font-display text-3xl font-light leading-tight md:text-4xl">
              {t('opp.streams.titlePre')}
              <em className="italic text-ochre">{t('opp.streams.titleEm')}</em>
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-stone md:text-base">{t('opp.streams.subtitle')}</p>
          </div>
          <button
            type="button"
            onClick={() => setShowMatrix((v) => !v)}
            className="btn-ghost shrink-0 self-start lg:self-auto"
            aria-expanded={showMatrix}
          >
            <BarChart3 size={16} className="text-ochre" />
            {showMatrix ? t('opp.streams.matrixToggleClose') : t('opp.streams.matrixToggleOpen')}
          </button>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-3">
          {fixtures.opportunityStreams.map((stream) => {
            const Icon = streamIcons[stream.id]
            const isSelected = activeType === stream.type
            const matchingProjects = PROJECTS.filter((p) => p.type === stream.type)
            const totalPipelineUsd = matchingProjects.reduce((sum, p) => sum + p.investmentUsd, 0)

            return (
              <article
                key={stream.id}
                className={`group relative flex flex-col justify-between rounded-2xl border p-6 transition duration-300 ${
                  isSelected
                    ? 'border-ochre bg-white shadow-[0_20px_50px_-24px_rgba(192,97,43,0.35)] ring-2 ring-ochre/25'
                    : 'border-ink/12 bg-white/75 hover:-translate-y-0.5 hover:border-ink/25 hover:bg-white hover:shadow-[0_24px_48px_-28px_rgba(21,18,15,0.35)]'
                }`}
              >
                <div>
                  {/* Top bar */}
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

                  {/* Title & Summary */}
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

                  {/* Visual Demand Breakdown Bars */}
                  <div className="mt-5">
                    <div className="mb-2.5 flex items-center justify-between">
                      <span className="font-mono text-[10px] uppercase tracking-wider text-stone">
                        {t('opp.streams.demandBreakdown')}
                      </span>
                    </div>
                    <ul className="space-y-2.5">
                      {stream.subCategories.map((sub) => (
                        <li key={sub.name} className="text-xs">
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate font-medium text-ink/90">{sub.name}</span>
                            <span className=" flex shrink-0 items-center gap-1.5 font-mono text-[10px]">
                              <span
                                className={`rounded px-1.5 py-0.5 ${
                                  sub.demand === 'High'
                                    ? 'bg-ochre/15 text-ochre font-semibold'
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
                              className="h-full rounded-full bg-gradient-to-r from-ochre to-gold transition-all duration-500"
                              style={{ width: `${sub.share * 2.2}%` }}
                            />
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Requirements & Target Audience */}
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
                    <p className="mt-3 text-xs text-stone">
                      <strong className="font-semibold text-ink">{t('opp.streams.targetAudience')}:</strong> {stream.targetAudience}
                    </p>
                  </div>
                </div>

                {/* Action button */}
                <button
                  type="button"
                  onClick={() => onSelectType(stream.type)}
                  aria-pressed={isSelected}
                  className={`mt-6 flex w-full items-center justify-between rounded-xl px-4 py-3 text-sm font-semibold transition ${
                    isSelected
                      ? 'bg-ochre text-paper shadow-sm'
                      : 'bg-ink text-paper hover:bg-ink-2'
                  }`}
                >
                  <span>{isSelected ? t('opp.streams.showingStream') : t('opp.streams.filterStream')}</span>
                  <span className="inline-flex items-center gap-1 font-mono text-xs opacity-90">
                    {matchingProjects.length} <ArrowUpRight size={15} />
                  </span>
                </button>
              </article>
            )
          })}
        </div>

        {/* Comparative Analysis Matrix Table */}
        {showMatrix && (
          <div className="mt-8 overflow-hidden rounded-2xl border border-ink/15 bg-white shadow-lg animate-rise">
            <div className="border-b border-ink/10 bg-ink px-6 py-4 text-paper">
              <h3 className="font-display text-xl font-light text-gold">{t('opp.streams.matrixTitle')}</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead>
                  <tr className="border-b border-ink/10 bg-paper-2 font-mono text-[10px] uppercase tracking-wider text-stone">
                    <th className="px-5 py-3.5">{t('opp.streams.colStream')}</th>
                    <th className="px-5 py-3.5">{t('opp.streams.colAudience')}</th>
                    <th className="px-5 py-3.5">{t('opp.streams.colModel')}</th>
                    <th className="px-5 py-3.5">{t('opp.streams.colRange')}</th>
                    <th className="px-5 py-3.5">{t('opp.streams.colCompliance')}</th>
                    <th className="px-5 py-3.5 text-right">{t('opp.streams.colAction')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink/10">
                  {fixtures.opportunityStreams.map((s) => {
                    const isSelected = activeType === s.type
                    return (
                      <tr key={s.id} className={isSelected ? 'bg-ochre/[0.06]' : 'hover:bg-paper/50'}>
                        <td className="px-5 py-4">
                          <div className="font-mono text-[10px] text-ochre">{s.code}</div>
                          <div className="font-display text-lg font-medium text-ink">{s.title}</div>
                        </td>
                        <td className="max-w-xs px-5 py-4 text-xs leading-relaxed text-stone">{s.targetAudience}</td>
                        <td className="px-5 py-4 font-mono text-xs text-ink">{s.contractModel}</td>
                        <td className="px-5 py-4 font-mono text-xs font-semibold text-ochre">{s.typicalValue}</td>
                        <td className="px-5 py-4">
                          <span className="inline-flex rounded-full bg-moss-light px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-moss">
                            {s.complianceTag}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-right">
                          <button
                            type="button"
                            onClick={() => onSelectType(s.type)}
                            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                              isSelected ? 'bg-ochre text-paper' : 'border border-ink/20 bg-white hover:border-ink'
                            }`}
                          >
                            {isSelected ? t('opp.streams.showingStream') : t('opp.streams.filterStream')}
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

function Filters({ search, set }: { search: Search; set: (p: Partial<Search>) => void }) {
  const { t, tv, fixtures } = useI18n()
  return (
    <div className="space-y-7">
      <FilterSelect
        label={t('opp.filter.mineral')}
        anyLabel={t('opp.filter.any')}
        value={search.mineral}
        options={MINERALS}
        renderOption={tv}
        onChange={(v) => set({ mineral: v })}
      />
      <FilterSelect
        label={t('opp.filter.region')}
        anyLabel={t('opp.filter.any')}
        value={search.region}
        options={[...REGIONS].sort()}
        onChange={(v) => set({ region: v })}
      />
      <FilterSelect
        label={t('opp.filter.type')}
        anyLabel={t('opp.filter.any')}
        value={search.type}
        options={OPPORTUNITY_TYPES}
        renderOption={tv}
        onChange={(v) => set({ type: v })}
      />
      <FilterSelect
        label={t('opp.filter.stage')}
        anyLabel={t('opp.filter.any')}
        value={search.stage}
        options={STAGES}
        renderOption={tv}
        onChange={(v) => set({ stage: v })}
      />

      <fieldset>
        <legend className="label">{t('opp.filter.licenceType')}</legend>
        <div className="flex flex-wrap gap-1.5">
          {(['PML', 'PL', 'ML', 'SML', 'Processing Licence'] as const).map((l) => (
            <button
              key={l}
              onClick={() => set({ licence: search.licence === l ? undefined : l })}
              aria-pressed={search.licence === l}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                search.licence === l ? 'border-ink bg-ink text-paper' : 'border-sand bg-white/60 hover:border-ink/40'
              }`}
            >
              {l === 'Processing Licence' ? t('opp.filter.processingShort') : l}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="label">{t('opp.filter.minVerification')}</legend>
        <div className="space-y-1.5">
          {VERIFICATION_LEVELS.map((v) => (
            <label key={v.level} className="flex cursor-pointer items-center gap-2.5 rounded-md px-1 py-1 hover:bg-white/60">
              <input
                type="radio"
                name="level"
                checked={(search.level ?? 0) === v.level}
                onChange={() => set({ level: v.level === 0 ? undefined : v.level })}
                className="accent-ochre"
              />
              <VerificationBadge level={v.level} />
              {v.level > 0 && <span className="text-xs text-stone">{t('opp.filter.andAbove')}</span>}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="label">{t('opp.filter.investmentSought')}</legend>
        <div className="space-y-1.5">
          {fixtures.investmentBands.map((b) => (
            <label key={b.id} className="flex cursor-pointer items-center gap-2.5 text-sm">
              <input
                type="checkbox"
                checked={search.band === b.id}
                onChange={() => set({ band: search.band === b.id ? undefined : b.id })}
                className="accent-ochre"
              />
              {b.label}
            </label>
          ))}
        </div>
      </fieldset>

      <label className="flex cursor-pointer items-center gap-2.5 border-t border-ink/10 pt-5 text-sm font-medium">
        <input type="checkbox" checked={!!search.saved} onChange={() => set({ saved: search.saved ? undefined : true })} className="accent-ochre" />
        {t('opp.filter.showSavedOnly')}
      </label>

      <Link to="/map" className="block text-sm font-semibold text-ochre hover:underline">
        {t('opp.filter.preferMap')}
      </Link>
    </div>
  )
}

function FilterSelect({
  label,
  anyLabel,
  value,
  options,
  renderOption,
  onChange,
}: {
  label: string
  anyLabel: string
  value?: string
  options: readonly string[]
  renderOption?: (o: string) => string
  onChange: (v: string | undefined) => void
}) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <select value={value ?? ''} onChange={(e) => onChange(e.target.value || undefined)} className="field">
        <option value="">{anyLabel}</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {renderOption ? renderOption(o) : o}
          </option>
        ))}
      </select>
    </label>
  )
}
