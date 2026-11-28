import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import {
  LayoutGrid,
  List,
  Map as MapIcon,
  Search,
  SlidersHorizontal,
  X,
  SearchX,
  CheckCircle2,
  Star,
  FileCheck2,
  Unlock,
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
  type OpportunityType,
  type Project,
} from '../data/fixtures'
import { useSavedProjects } from '../lib/saved'
import { fetchApprovedPublicOpportunities } from '../lib/supabaseAuth'
import { useI18n } from '../i18n'
import ProjectCard from '../components/ProjectCard'
import { ProjectListingSkeletonGrid } from '../components/Skeletons'
import TanzaniaMap, { MapLegend } from '../components/TanzaniaMap'
import TenementDossierGate from '../components/TenementDossierGate'
import VerificationBadge from '../components/VerificationBadge'
import {
  buildLiveOpportunityDossier,
  buildLiveProjectDossier,
  type CounterpartyDossierData,
} from '../lib/counterpartyDossier'
import { useSubscription } from '../lib/subscriptions'
import type { UserListedProject, UserOpportunityRecord } from '../types/database'

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

interface StreamFilterPill {
  id: string
  label: string
  type?: OpportunityType
  liveCategories?: readonly string[]
}

const STREAM_FILTER_PILLS: readonly StreamFilterPill[] = [
  { id: 'all', label: 'All' },
  {
    id: 'tenders',
    label: 'Tenders & Procurement',
    type: 'Tenders opportunity in mine sites',
    liveCategories: ['Tender'],
  },
  {
    id: 'services',
    label: 'Service Contracts',
    type: 'Service provision opportunities',
    liveCategories: ['Consultancy', 'Offtake / Supply'],
  },
  {
    id: 'personnel',
    label: 'Technical Personnel',
    type: 'Technical personnel (Engineers & Technicians)',
    liveCategories: ['Internship'],
  },
  {
    id: 'jv',
    label: 'Joint Ventures',
    type: 'Joint venture',
    liveCategories: ['Joint Venture'],
  },
  {
    id: 'exploration',
    label: 'Exploration',
    type: 'Exploration opportunity',
    liveCategories: ['Exploration Grant'],
  },
]

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
  const { isPaidActive, canAccessDataRoom } = useSubscription()
  const [drawer, setDrawer] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const [liveOpportunities, setLiveOpportunities] = useState<UserOpportunityRecord[]>([])
  const [liveProjects, setLiveProjects] = useState<UserListedProject[]>([])
  const [loadingLiveFeed, setLoadingLiveFeed] = useState(true)
  const [activeLiveDossier, setActiveLiveDossier] = useState<CounterpartyDossierData | null>(null)
  const hasDossierUnlocked = isPaidActive || canAccessDataRoom

  useEffect(() => {
    let active = true
    void fetchApprovedPublicOpportunities()
      .then((res) => {
        if (!active) return
        setLiveOpportunities(res.opportunities)
        setLiveProjects(res.projects)
      })
      .finally(() => {
        if (active) setLoadingLiveFeed(false)
      })
    return () => {
      active = false
    }
  }, [])

  const results = useMemo(
    () => applyFilters(PROJECTS, search, saved, localizeProject, tv),
    [search, saved, localizeProject, tv],
  )

  const filteredLiveOpportunities = useMemo(() => {
    const q = search.q?.toLowerCase().trim()
    const activePill = STREAM_FILTER_PILLS.find((p) => p.type && p.type === search.type)
    return liveOpportunities.filter((opp) => {
      if (activePill?.liveCategories) {
        const catLower = (opp.category || '').toLowerCase()
        const matched = activePill.liveCategories.some((c) =>
          catLower.includes(c.toLowerCase()),
        )
        if (!matched) return false
      } else if (search.type) {
        return false
      }
      if (q) {
        const hay = `${opp.title} ${opp.organization} ${opp.category} ${opp.location} ${opp.description}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      if (search.region && !opp.location.toLowerCase().includes(search.region.toLowerCase())) {
        return false
      }
      return true
    })
  }, [liveOpportunities, search.q, search.type, search.region])

  const filteredLiveProjects = useMemo(() => {
    const q = search.q?.toLowerCase().trim()
    return liveProjects.filter((proj) => {
      if (
        search.type &&
        search.type !== 'Joint venture' &&
        search.type !== 'Exploration opportunity' &&
        search.type !== 'Licence / rights opportunity' &&
        search.type !== 'Existing mine seeking investment'
      ) {
        return false
      }
      if (search.mineral && proj.mineral.toLowerCase() !== search.mineral.toLowerCase()) {
        return false
      }
      if (search.region && !proj.region.toLowerCase().includes(search.region.toLowerCase())) {
        return false
      }
      if (q) {
        const hay = `${proj.title} ${proj.mineral} ${proj.region} ${proj.licence_type} ${proj.licence_reference} ${proj.summary}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [liveProjects, search.q, search.type, search.mineral, search.region])

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
        <div className="mx-auto w-full max-w-[1920px] px-4 pb-7 pt-12 sm:px-6 lg:px-8 xl:px-10">
          <p className="eyebrow mb-3 text-ochre">{t('opp.eyebrow')}</p>
          <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
            <h1 className="font-display text-5xl font-light leading-none md:text-6xl">{t('opp.title')}</h1>
            <div className="w-full lg:max-w-md">
              <label htmlFor="opp-search-input" className="label">
                {t('opp.searchLabel')}
              </label>
              <div className="relative">
                <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-stone" />
                <input
                  id="opp-search-input"
                  type="search"
                  inputMode="search"
                  defaultValue={search.q}
                  onChange={(e) => set({ q: e.target.value || undefined })}
                  placeholder={t('opp.searchPlaceholder')}
                  className="field !h-12 !pl-10"
                />
              </div>
            </div>
          </div>

          {/* Compact High-Contrast Stream / Category Filter Pills */}
          <div
            role="group"
            aria-label="Filter by opportunity stream"
            className="mt-6 flex flex-nowrap items-center gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0"
          >
            {STREAM_FILTER_PILLS.map((pill) => {
              const isSelected = pill.type ? search.type === pill.type : !search.type
              const count = pill.type
                ? PROJECTS.filter((p) => p.type === pill.type).length
                : PROJECTS.length
              return (
                <button
                  key={pill.id}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() =>
                    set({
                      type: !pill.type
                        ? undefined
                        : search.type === pill.type
                          ? undefined
                          : pill.type,
                    })
                  }
                  className={`inline-flex min-h-[38px] shrink-0 items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                    isSelected
                      ? 'border-ink bg-ink text-paper shadow-2xs'
                      : 'border-ink/15 bg-white text-ink hover:border-ochre hover:text-ochre'
                  }`}
                >
                  <span>{pill.label}</span>
                  <span
                    className={`rounded-full px-1.5 py-0.5 font-mono text-[10px] tabular-nums ${
                      isSelected
                        ? 'bg-paper/15 text-gold'
                        : 'bg-paper-2 text-stone'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      </section>

      {loadingLiveFeed ? (
        <section className="mx-auto w-full max-w-[1920px] px-4 pt-8 sm:px-6 lg:px-8 xl:px-10">
          <div className="rounded-2xl border border-ink/10 bg-[#FCFBF8] p-6 shadow-xs">
            <div className="mb-4 h-6 w-64 animate-pulse rounded bg-ink/10" />
            <ProjectListingSkeletonGrid count={3} />
          </div>
        </section>
      ) : (filteredLiveOpportunities.length > 0 || filteredLiveProjects.length > 0) && (
        <section className="mx-auto w-full max-w-[1920px] px-4 pt-8 sm:px-6 lg:px-8 xl:px-10">
          <div className="rounded-2xl border border-moss/30 bg-[#FCFBF8] p-6 shadow-xs">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="inline-flex items-center gap-1.5 font-mono text-[11px] font-semibold uppercase tracking-wider text-moss">
                  <CheckCircle2 size={13} /> Live Verified Marketplace
                </span>
                <h2 className="mt-0.5 font-display text-2xl font-semibold text-ink">
                  Verified Member Opportunities &amp; Projects ({filteredLiveOpportunities.length + filteredLiveProjects.length})
                </h2>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
              {filteredLiveOpportunities.map((opp) => (
                <article key={`opp-${opp.id}`} className="flex flex-col rounded-xl border border-ink/12 bg-paper/60 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-1.5">
                    <span className="rounded bg-ink px-2 py-0.5 font-mono text-[10px] text-gold">{opp.category}</span>
                    {opp.is_featured && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-gold/25 px-2 py-0.5 font-mono text-[10px] font-semibold text-ochre">
                        <Star size={10} className="fill-gold text-gold" /> Featured
                      </span>
                    )}
                  </div>
                  <h3 className="mt-2 font-display text-lg font-semibold text-ink">{opp.title}</h3>
                  <p className="text-xs text-ochre">{opp.organization} · {opp.location}</p>
                  <p className="mt-2 line-clamp-3 text-xs text-stone">{opp.description}</p>
                  <div className="mt-auto space-y-2.5 border-t border-ink/10 pt-3">
                    <div className="flex items-center justify-between font-mono text-[11px] text-stone">
                      <span>{opp.compensation_usd > 0 ? formatUsd(opp.compensation_usd) : 'Schedule'}</span>
                      <span>Due {opp.deadline}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveLiveDossier(buildLiveOpportunityDossier(opp))}
                      className="btn-ghost w-full justify-center !py-2 text-xs"
                    >
                      {hasDossierUnlocked ? <Unlock size={13} className="text-moss" /> : <FileCheck2 size={13} className="text-ochre" />}
                      Tenement Dossier &amp; Contact
                    </button>
                  </div>
                </article>
              ))}
              {filteredLiveProjects.map((proj) => (
                <article key={`proj-${proj.id}`} className="flex flex-col rounded-xl border border-ink/12 bg-paper/60 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-1.5">
                    <span className="rounded bg-moss px-2 py-0.5 font-mono text-[10px] text-paper">VERIFIED PROJECT</span>
                    <span className="font-mono text-[10px] text-ochre">{proj.mineral} · {proj.region}</span>
                  </div>
                  <h3 className="mt-2 font-display text-lg font-semibold text-ink">{proj.title}</h3>
                  <p className="text-xs text-stone">{proj.licence_type} ({proj.licence_reference})</p>
                  <p className="mt-2 line-clamp-3 text-xs text-stone">{proj.summary}</p>
                  <div className="mt-auto space-y-2.5 border-t border-ink/10 pt-3">
                    <div className="flex items-center justify-between font-mono text-[11px] text-stone">
                      <span className="font-semibold text-ink">{formatUsd(proj.investment_usd)}</span>
                      <span>{new Date(proj.created_at).toLocaleDateString()}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveLiveDossier(buildLiveProjectDossier(proj))}
                      className="btn-ghost w-full justify-center !py-2 text-xs"
                    >
                      {hasDossierUnlocked ? <Unlock size={13} className="text-moss" /> : <FileCheck2 size={13} className="text-ochre" />}
                      Tenement Dossier &amp; Contact
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      )}

      <div className="mx-auto grid w-full max-w-[1920px] gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[280px_minmax(0,1fr)] lg:px-8 xl:px-10">
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
            <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
              <div className="min-w-0 max-w-full overflow-hidden rounded-xl border border-ink/10 bg-white/50 p-2.5 sm:p-4">
                <TanzaniaMap projects={results} selectedId={selectedProject?.id} onSelect={setSelected} className="w-full" />
                <div className="mt-2 px-1 sm:px-2">
                  <MapLegend />
                </div>
              </div>
              <div className="min-w-0 max-w-full space-y-4">
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
            <div className={view === 'grid' ? 'grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5' : 'grid gap-4'}>
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

      {activeLiveDossier && (
        <TenementDossierGate
          variant="modal"
          dossier={activeLiveDossier}
          onTriggerRfq={() => navigate({ to: '/services' })}
          rfqButtonLabel="Request Quote via Services Desk"
          onClose={() => setActiveLiveDossier(null)}
        />
      )}

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
