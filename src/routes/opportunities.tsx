import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Bookmark,
  CheckCircle2,
  FileCheck2,
  LayoutGrid,
  List,
  Map as MapIcon,
  Search,
  SearchX,
  SlidersHorizontal,
  Star,
  Unlock,
  X,
} from 'lucide-react'
import { PROJECTS, formatUsd } from '../data/fixtures'
import { useSavedProjects } from '../lib/saved'
import { fetchApprovedPublicOpportunities } from '../lib/supabaseAuth'
import { useI18n } from '../i18n'
import ProjectCard from '../components/ProjectCard'
import { ProjectListingSkeletonGrid } from '../components/Skeletons'
import TanzaniaMap, { MapLegend } from '../components/TanzaniaMap'
import TenementDossierGate from '../components/TenementDossierGate'
import {
  buildLiveOpportunityDossier,
  buildLiveProjectDossier,
  type CounterpartyDossierData,
} from '../lib/counterpartyDossier'
import { useSubscription } from '../lib/subscriptions'
import { formatOpportunityCategory } from '../lib/opportunityCategories'
import {
  DEFAULT_OPPORTUNITIES_FILTER,
  OPPORTUNITY_COMMODITIES,
  OPPORTUNITY_DEAL_STRUCTURES,
  OPPORTUNITY_FILTER_CATEGORIES,
  OPPORTUNITY_REGIONS,
  OPPORTUNITY_SORT_OPTIONS,
  OPPORTUNITY_STATUS_OPTIONS,
  OPPORTUNITY_TENEMENT_TYPES,
  OPPORTUNITY_VERIFICATION_TIERS,
  countSecondaryOpportunityFilters,
  filterAndSortLiveOpportunities,
  filterAndSortLiveProjects,
  filterAndSortProjects,
  normalizeCommodityParam,
  normalizeOpportunityCategoryParam,
  normalizeSortParam,
  normalizeTenementTypeParam,
  normalizeVerificationLevelParam,
  type OpportunitiesFilterState,
  type OpportunityCategorySelection,
  type OpportunityCommoditySelection,
  type OpportunityDealStructureSelection,
  type OpportunitySortSelection,
  type OpportunityStatusSelection,
  type OpportunityTenementSelection,
  type OpportunityVerificationSelection,
} from '../lib/opportunityFilters'
import type { UserListedProject, UserOpportunityRecord } from '../types/database'

type SearchParams = {
  q?: string
  mineral?: string
  region?: string
  type?: string
  stage?: string
  licence?: string
  level?: number
  band?: string
  sort?: string
  view?: 'grid' | 'list' | 'map'
  saved?: boolean
}

const str = (v: unknown) => (typeof v === 'string' && v ? v : undefined)

export const Route = createFileRoute('/opportunities')({
  validateSearch: (s: Record<string, unknown>): SearchParams => ({
    q: str(s.q),
    mineral: str(s.mineral),
    region: str(s.region),
    type: str(s.type),
    stage: str(s.stage),
    licence: str(s.licence),
    level: s.level !== undefined && !Number.isNaN(Number(s.level)) ? Number(s.level) : undefined,
    band: str(s.band),
    sort: str(s.sort),
    view: str(s.view) as SearchParams['view'],
    saved: s.saved === true || s.saved === 'true' ? true : undefined,
  }),
  head: () => ({ meta: [{ title: 'Mining opportunities — MineConnect' }] }),
  component: Opportunities,
})

function buildInitialFiltersFromSearch(search: SearchParams): OpportunitiesFilterState {
  const validRegion =
    search.region &&
    OPPORTUNITY_REGIONS.find(
      (r) => r.toLowerCase() === search.region?.trim().toLowerCase(),
    )
  return {
    ...DEFAULT_OPPORTUNITIES_FILTER,
    q: search.q ?? '',
    category: normalizeOpportunityCategoryParam(search.type),
    commodity: normalizeCommodityParam(search.mineral),
    region: validRegion ?? 'ALL',
    tenementType: normalizeTenementTypeParam(search.licence),
    verification: normalizeVerificationLevelParam(search.level),
    sort: normalizeSortParam(search.sort),
    savedOnly: Boolean(search.saved),
  }
}

function Opportunities() {
  const { t, tv, localizeProject } = useI18n()
  const search = Route.useSearch()
  const navigate = useNavigate({ from: '/opportunities' })
  const { saved, isSaved, toggle } = useSavedProjects()
  const { isPaidActive, canAccessDataRoom } = useSubscription()

  // Strictly local isolated filter, sort, and view states so live market/FX ticks never reset UI
  const [filters, setFilters] = useState<OpportunitiesFilterState>(() =>
    buildInitialFiltersFromSearch(search),
  )
  const [view, setView] = useState<'grid' | 'list' | 'map'>(() => search.view ?? 'grid')
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const [liveOpportunities, setLiveOpportunities] = useState<UserOpportunityRecord[]>([])
  const [liveProjects, setLiveProjects] = useState<UserListedProject[]>([])
  const [loadingLiveFeed, setLoadingLiveFeed] = useState(true)
  const [activeLiveDossier, setActiveLiveDossier] = useState<CounterpartyDossierData | null>(null)
  const hasDossierUnlocked = isPaidActive || canAccessDataRoom

  // Sync only if an external route link changes incoming search params
  const searchKey = JSON.stringify({
    q: search.q ?? '',
    mineral: search.mineral ?? '',
    region: search.region ?? '',
    type: search.type ?? '',
    licence: search.licence ?? '',
    level: search.level ?? '',
    saved: Boolean(search.saved),
  })
  const prevSearchKeyRef = useRef(searchKey)
  useEffect(() => {
    if (prevSearchKeyRef.current !== searchKey) {
      prevSearchKeyRef.current = searchKey
      setFilters(buildInitialFiltersFromSearch(search))
    }
  }, [searchKey, search])

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
    () => filterAndSortProjects(PROJECTS, filters, saved, localizeProject, tv),
    [filters, saved, localizeProject, tv],
  )

  const filteredLiveOpportunities = useMemo(
    () => filterAndSortLiveOpportunities(liveOpportunities, filters),
    [liveOpportunities, filters],
  )

  const filteredLiveProjects = useMemo(
    () => filterAndSortLiveProjects(liveProjects, filters),
    [liveProjects, filters],
  )

  const totalMatching =
    results.length + filteredLiveOpportunities.length + filteredLiveProjects.length

  const secondaryFilterCount = useMemo(
    () => countSecondaryOpportunityFilters(filters),
    [filters],
  )

  const activeChips = useMemo(() => {
    const chips: Array<{ key: string; label: string; clear: () => void }> = []
    if (filters.q.trim()) {
      chips.push({
        key: 'q',
        label: `Search: "${filters.q.trim()}"`,
        clear: () => setFilters((prev) => ({ ...prev, q: '' })),
      })
    }
    if (filters.category !== 'ALL') {
      chips.push({
        key: 'category',
        label: filters.category,
        clear: () => setFilters((prev) => ({ ...prev, category: 'ALL' })),
      })
    }
    if (filters.commodity !== 'ALL') {
      chips.push({
        key: 'commodity',
        label: filters.commodity,
        clear: () => setFilters((prev) => ({ ...prev, commodity: 'ALL' })),
      })
    }
    if (filters.region !== 'ALL') {
      chips.push({
        key: 'region',
        label: filters.region,
        clear: () => setFilters((prev) => ({ ...prev, region: 'ALL' })),
      })
    }
    if (filters.tenementType !== 'ALL') {
      chips.push({
        key: 'tenementType',
        label: filters.tenementType,
        clear: () => setFilters((prev) => ({ ...prev, tenementType: 'ALL' })),
      })
    }
    if (filters.dealStructure !== 'ALL') {
      chips.push({
        key: 'dealStructure',
        label: filters.dealStructure,
        clear: () => setFilters((prev) => ({ ...prev, dealStructure: 'ALL' })),
      })
    }
    if (filters.verification !== 'ALL') {
      const label =
        OPPORTUNITY_VERIFICATION_TIERS.find((v) => v.value === filters.verification)?.label ??
        filters.verification
      chips.push({
        key: 'verification',
        label,
        clear: () => setFilters((prev) => ({ ...prev, verification: 'ALL' })),
      })
    }
    if (filters.status !== DEFAULT_OPPORTUNITIES_FILTER.status) {
      const label =
        OPPORTUNITY_STATUS_OPTIONS.find((s) => s.value === filters.status)?.label ?? filters.status
      chips.push({
        key: 'status',
        label: `Status: ${label}`,
        clear: () =>
          setFilters((prev) => ({ ...prev, status: DEFAULT_OPPORTUNITIES_FILTER.status })),
      })
    }
    if (filters.sort !== DEFAULT_OPPORTUNITIES_FILTER.sort) {
      const label =
        OPPORTUNITY_SORT_OPTIONS.find((s) => s.value === filters.sort)?.label ?? filters.sort
      chips.push({
        key: 'sort',
        label: `Sort: ${label}`,
        clear: () =>
          setFilters((prev) => ({ ...prev, sort: DEFAULT_OPPORTUNITIES_FILTER.sort })),
      })
    }
    if (filters.savedOnly) {
      chips.push({
        key: 'savedOnly',
        label: t('opp.savedOnlyChip'),
        clear: () => setFilters((prev) => ({ ...prev, savedOnly: false })),
      })
    }
    return chips
  }, [filters, t])

  const clearAll = () => {
    setFilters(DEFAULT_OPPORTUNITIES_FILTER)
  }

  const selectedProject = results.find((p) => p.id === selected) ?? results[0]

  return (
    <div className="pt-[72px]">
      <section className="border-b border-ink/10 bg-paper-2">
        <div className="mx-auto w-full max-w-[1920px] px-4 pb-8 pt-12 sm:px-6 lg:px-8 xl:px-10">
          <p className="eyebrow mb-3 text-ochre">{t('opp.eyebrow')}</p>
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
            <h1 className="font-display text-5xl font-light leading-none md:text-6xl">
              {t('opp.title')}
            </h1>
            <p className="font-mono text-xs text-stone tabular-nums">
              Showing <strong className="text-ink">{totalMatching}</strong>{' '}
              {totalMatching === 1 ? 'opportunity' : 'opportunities'}
            </p>
          </div>

          {/* Purpose-Built Full-Width Opportunities Filtering Model */}
          <div className="mt-8 rounded-2xl border border-ink/12 bg-white/90 p-3.5 shadow-2xs sm:p-4">
            {/* Row 1: Primary Search + Category + Desktop Core Mining Selectors */}
            <div className="grid grid-cols-1 gap-2.5 md:grid-cols-12 md:items-center">
              {/* Real-time Search Input (16px / text-base) */}
              <div className="relative md:col-span-4 lg:col-span-4">
                <Search
                  size={16}
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-stone"
                />
                <input
                  id="opp-filter-search"
                  type="text"
                  aria-label="Search opportunities by title, organization, licence reference, district, or scope"
                  value={filters.q}
                  onChange={(e) => setFilters((prev) => ({ ...prev, q: e.target.value }))}
                  placeholder="Search title, issuer, PML/PL ref, district, or scope..."
                  className="min-h-[44px] w-full rounded-xl border border-ink/15 bg-paper pl-10 pr-9 text-base text-ink placeholder-stone/70 focus:border-ochre focus:bg-white focus:outline-none focus:ring-2 focus:ring-ochre/20"
                />
                {filters.q && (
                  <button
                    type="button"
                    aria-label="Clear search"
                    onClick={() => setFilters((prev) => ({ ...prev, q: '' }))}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-stone hover:bg-ink/5 hover:text-ink"
                  >
                    <X size={15} />
                  </button>
                )}
              </div>

              {/* Mobile inline row: Opportunity Category + Filters(N) toggle | Desktop: 4 selects */}
              <div className="flex items-center gap-2 md:col-span-8 md:grid md:grid-cols-4 md:gap-2.5 lg:col-span-8">
                <div className="min-w-0 flex-1">
                  <label htmlFor="opp-filter-category" className="sr-only">
                    Opportunity Category
                  </label>
                  <select
                    id="opp-filter-category"
                    value={filters.category}
                    onChange={(e) =>
                      setFilters((prev) => ({
                        ...prev,
                        category: e.target.value as OpportunityCategorySelection,
                      }))
                    }
                    className="min-h-[44px] w-full rounded-xl border border-ink/15 bg-paper px-3 py-2 text-base text-ink focus:border-ochre focus:bg-white focus:outline-none focus:ring-2 focus:ring-ochre/20 md:text-sm"
                  >
                    <option value="ALL">All Categories</option>
                    {OPPORTUNITY_FILTER_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Mobile secondary filters toggle */}
                <button
                  type="button"
                  aria-expanded={mobileFiltersOpen}
                  aria-controls="opp-mobile-filters"
                  onClick={() => setMobileFiltersOpen((v) => !v)}
                  className={`inline-flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-xl border px-3.5 py-2 text-sm font-semibold transition md:hidden ${
                    mobileFiltersOpen || secondaryFilterCount > 0
                      ? 'border-ink bg-ink text-paper'
                      : 'border-ink/15 bg-paper text-ink hover:border-ink/35'
                  }`}
                >
                  <SlidersHorizontal size={15} />
                  <span>
                    Filters{secondaryFilterCount > 0 ? ` (${secondaryFilterCount})` : ''}
                  </span>
                </button>

                {/* Desktop Primary Commodity */}
                <div className="hidden md:block">
                  <label htmlFor="opp-filter-commodity" className="sr-only">
                    Primary Commodity
                  </label>
                  <select
                    id="opp-filter-commodity"
                    value={filters.commodity}
                    onChange={(e) =>
                      setFilters((prev) => ({
                        ...prev,
                        commodity: e.target.value as OpportunityCommoditySelection,
                      }))
                    }
                    className="min-h-[44px] w-full rounded-xl border border-ink/15 bg-paper px-3 py-2 text-sm text-ink focus:border-ochre focus:bg-white focus:outline-none focus:ring-2 focus:ring-ochre/20"
                  >
                    <option value="ALL">All Commodities</option>
                    {OPPORTUNITY_COMMODITIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Desktop Region (Mkoa) */}
                <div className="hidden md:block">
                  <label htmlFor="opp-filter-region" className="sr-only">
                    Region (Mkoa)
                  </label>
                  <select
                    id="opp-filter-region"
                    value={filters.region}
                    onChange={(e) =>
                      setFilters((prev) => ({ ...prev, region: e.target.value }))
                    }
                    className="min-h-[44px] w-full rounded-xl border border-ink/15 bg-paper px-3 py-2 text-sm text-ink focus:border-ochre focus:bg-white focus:outline-none focus:ring-2 focus:ring-ochre/20"
                  >
                    <option value="ALL">All Regions</option>
                    {OPPORTUNITY_REGIONS.map((reg) => (
                      <option key={reg} value={reg}>
                        {reg}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Desktop Mineral Right / Tenement Type */}
                <div className="hidden md:block">
                  <label htmlFor="opp-filter-tenement" className="sr-only">
                    Mineral Right or Tenement Type
                  </label>
                  <select
                    id="opp-filter-tenement"
                    value={filters.tenementType}
                    onChange={(e) =>
                      setFilters((prev) => ({
                        ...prev,
                        tenementType: e.target.value as OpportunityTenementSelection,
                      }))
                    }
                    className="min-h-[44px] w-full rounded-xl border border-ink/15 bg-paper px-3 py-2 text-sm text-ink focus:border-ochre focus:bg-white focus:outline-none focus:ring-2 focus:ring-ochre/20"
                  >
                    <option value="ALL">All Right Types</option>
                    {OPPORTUNITY_TENEMENT_TYPES.map((rt) => (
                      <option key={rt} value={rt}>
                        {rt}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Row 2 (Desktop md+): Deal Structure, Verification Tier, Status, Sort, Saved & View Mode */}
            <div className="mt-2.5 hidden grid-cols-12 items-center gap-2.5 border-t border-ink/8 pt-2.5 md:grid">
              <div className="col-span-3 lg:col-span-3">
                <label htmlFor="opp-filter-structure" className="sr-only">
                  Deal Structure
                </label>
                <select
                  id="opp-filter-structure"
                  value={filters.dealStructure}
                  onChange={(e) =>
                    setFilters((prev) => ({
                      ...prev,
                      dealStructure: e.target.value as OpportunityDealStructureSelection,
                    }))
                  }
                  className="min-h-[40px] w-full rounded-xl border border-ink/15 bg-paper px-3 py-1.5 text-sm text-ink focus:border-ochre focus:bg-white focus:outline-none focus:ring-2 focus:ring-ochre/20"
                >
                  <option value="ALL">All Structures</option>
                  {OPPORTUNITY_DEAL_STRUCTURES.map((ds) => (
                    <option key={ds} value={ds}>
                      {ds}
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-span-3 lg:col-span-2">
                <label htmlFor="opp-filter-tier" className="sr-only">
                  Verification Tier
                </label>
                <select
                  id="opp-filter-tier"
                  value={filters.verification}
                  onChange={(e) =>
                    setFilters((prev) => ({
                      ...prev,
                      verification: e.target.value as OpportunityVerificationSelection,
                    }))
                  }
                  className="min-h-[40px] w-full rounded-xl border border-ink/15 bg-paper px-3 py-1.5 text-sm text-ink focus:border-ochre focus:bg-white focus:outline-none focus:ring-2 focus:ring-ochre/20"
                >
                  {OPPORTUNITY_VERIFICATION_TIERS.map((tier) => (
                    <option key={tier.value} value={tier.value}>
                      {tier.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-span-2 lg:col-span-2">
                <label htmlFor="opp-filter-status" className="sr-only">
                  Opportunity Timeline Status
                </label>
                <select
                  id="opp-filter-status"
                  value={filters.status}
                  onChange={(e) =>
                    setFilters((prev) => ({
                      ...prev,
                      status: e.target.value as OpportunityStatusSelection,
                    }))
                  }
                  className="min-h-[40px] w-full rounded-xl border border-ink/15 bg-paper px-3 py-1.5 text-sm text-ink focus:border-ochre focus:bg-white focus:outline-none focus:ring-2 focus:ring-ochre/20"
                >
                  {OPPORTUNITY_STATUS_OPTIONS.map((st) => (
                    <option key={st.value} value={st.value}>
                      {st.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-span-2 lg:col-span-2">
                <label htmlFor="opp-filter-sort" className="sr-only">
                  Sort Opportunities
                </label>
                <select
                  id="opp-filter-sort"
                  value={filters.sort}
                  onChange={(e) =>
                    setFilters((prev) => ({
                      ...prev,
                      sort: e.target.value as OpportunitySortSelection,
                    }))
                  }
                  className="min-h-[40px] w-full rounded-xl border border-ink/15 bg-paper px-3 py-1.5 text-sm text-ink focus:border-ochre focus:bg-white focus:outline-none focus:ring-2 focus:ring-ochre/20"
                >
                  {OPPORTUNITY_SORT_OPTIONS.map((s) => (
                    <option key={s.value} value={s.value}>
                      Sort: {s.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-span-2 flex items-center justify-end gap-2 lg:col-span-3">
                <button
                  type="button"
                  aria-pressed={filters.savedOnly}
                  onClick={() =>
                    setFilters((prev) => ({ ...prev, savedOnly: !prev.savedOnly }))
                  }
                  className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
                    filters.savedOnly
                      ? 'border-ink bg-ink text-paper'
                      : 'border-ink/15 bg-paper text-stone hover:border-ink/35 hover:text-ink'
                  }`}
                >
                  <Bookmark size={14} className={filters.savedOnly ? 'fill-gold text-gold' : ''} />
                  <span className="hidden xl:inline">Saved</span>
                </button>

                <div
                  className="flex rounded-xl border border-ink/15 bg-paper p-0.5"
                  role="group"
                  aria-label={t('opp.viewLabel')}
                >
                  {(
                    [
                      ['grid', LayoutGrid],
                      ['list', List],
                      ['map', MapIcon],
                    ] as const
                  ).map(([v, Icon]) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setView(v)}
                      aria-pressed={view === v}
                      aria-label={`${v} view`}
                      className={`rounded-lg p-2 transition ${
                        view === v ? 'bg-ink text-paper' : 'text-stone hover:text-ink'
                      }`}
                    >
                      <Icon size={15} />
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Mobile Collapsible Secondary Filters Panel (< 768px) */}
            {mobileFiltersOpen && (
              <div
                id="opp-mobile-filters"
                className="mt-3 grid grid-cols-1 gap-2.5 border-t border-ink/10 pt-3 md:hidden"
              >
                <div>
                  <label
                    htmlFor="opp-filter-commodity-mobile"
                    className="mb-1 block font-mono text-[10px] font-semibold uppercase tracking-wider text-stone"
                  >
                    Primary Commodity
                  </label>
                  <select
                    id="opp-filter-commodity-mobile"
                    value={filters.commodity}
                    onChange={(e) =>
                      setFilters((prev) => ({
                        ...prev,
                        commodity: e.target.value as OpportunityCommoditySelection,
                      }))
                    }
                    className="min-h-[44px] w-full rounded-xl border border-ink/15 bg-paper px-3 py-2 text-base text-ink focus:border-ochre focus:bg-white focus:outline-none"
                  >
                    <option value="ALL">All Commodities</option>
                    {OPPORTUNITY_COMMODITIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="opp-filter-region-mobile"
                    className="mb-1 block font-mono text-[10px] font-semibold uppercase tracking-wider text-stone"
                  >
                    Region (Mkoa)
                  </label>
                  <select
                    id="opp-filter-region-mobile"
                    value={filters.region}
                    onChange={(e) =>
                      setFilters((prev) => ({ ...prev, region: e.target.value }))
                    }
                    className="min-h-[44px] w-full rounded-xl border border-ink/15 bg-paper px-3 py-2 text-base text-ink focus:border-ochre focus:bg-white focus:outline-none"
                  >
                    <option value="ALL">All Regions</option>
                    {OPPORTUNITY_REGIONS.map((reg) => (
                      <option key={reg} value={reg}>
                        {reg}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="opp-filter-tenement-mobile"
                    className="mb-1 block font-mono text-[10px] font-semibold uppercase tracking-wider text-stone"
                  >
                    Mineral Right / Tenement Type
                  </label>
                  <select
                    id="opp-filter-tenement-mobile"
                    value={filters.tenementType}
                    onChange={(e) =>
                      setFilters((prev) => ({
                        ...prev,
                        tenementType: e.target.value as OpportunityTenementSelection,
                      }))
                    }
                    className="min-h-[44px] w-full rounded-xl border border-ink/15 bg-paper px-3 py-2 text-base text-ink focus:border-ochre focus:bg-white focus:outline-none"
                  >
                    <option value="ALL">All Right Types</option>
                    {OPPORTUNITY_TENEMENT_TYPES.map((rt) => (
                      <option key={rt} value={rt}>
                        {rt}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="opp-filter-structure-mobile"
                    className="mb-1 block font-mono text-[10px] font-semibold uppercase tracking-wider text-stone"
                  >
                    Deal Structure
                  </label>
                  <select
                    id="opp-filter-structure-mobile"
                    value={filters.dealStructure}
                    onChange={(e) =>
                      setFilters((prev) => ({
                        ...prev,
                        dealStructure: e.target.value as OpportunityDealStructureSelection,
                      }))
                    }
                    className="min-h-[44px] w-full rounded-xl border border-ink/15 bg-paper px-3 py-2 text-base text-ink focus:border-ochre focus:bg-white focus:outline-none"
                  >
                    <option value="ALL">All Structures</option>
                    {OPPORTUNITY_DEAL_STRUCTURES.map((ds) => (
                      <option key={ds} value={ds}>
                        {ds}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="opp-filter-tier-mobile"
                    className="mb-1 block font-mono text-[10px] font-semibold uppercase tracking-wider text-stone"
                  >
                    Verification Tier
                  </label>
                  <select
                    id="opp-filter-tier-mobile"
                    value={filters.verification}
                    onChange={(e) =>
                      setFilters((prev) => ({
                        ...prev,
                        verification: e.target.value as OpportunityVerificationSelection,
                      }))
                    }
                    className="min-h-[44px] w-full rounded-xl border border-ink/15 bg-paper px-3 py-2 text-base text-ink focus:border-ochre focus:bg-white focus:outline-none"
                  >
                    {OPPORTUNITY_VERIFICATION_TIERS.map((tier) => (
                      <option key={tier.value} value={tier.value}>
                        {tier.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label
                      htmlFor="opp-filter-status-mobile"
                      className="mb-1 block font-mono text-[10px] font-semibold uppercase tracking-wider text-stone"
                    >
                      Status
                    </label>
                    <select
                      id="opp-filter-status-mobile"
                      value={filters.status}
                      onChange={(e) =>
                        setFilters((prev) => ({
                          ...prev,
                          status: e.target.value as OpportunityStatusSelection,
                        }))
                      }
                      className="min-h-[44px] w-full rounded-xl border border-ink/15 bg-paper px-3 py-2 text-base text-ink focus:border-ochre focus:bg-white focus:outline-none"
                    >
                      {OPPORTUNITY_STATUS_OPTIONS.map((st) => (
                        <option key={st.value} value={st.value}>
                          {st.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="opp-filter-sort-mobile"
                      className="mb-1 block font-mono text-[10px] font-semibold uppercase tracking-wider text-stone"
                    >
                      Sort
                    </label>
                    <select
                      id="opp-filter-sort-mobile"
                      value={filters.sort}
                      onChange={(e) =>
                        setFilters((prev) => ({
                          ...prev,
                          sort: e.target.value as OpportunitySortSelection,
                        }))
                      }
                      className="min-h-[44px] w-full rounded-xl border border-ink/15 bg-paper px-3 py-2 text-base text-ink focus:border-ochre focus:bg-white focus:outline-none"
                    >
                      {OPPORTUNITY_SORT_OPTIONS.map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 pt-1">
                  <button
                    type="button"
                    aria-pressed={filters.savedOnly}
                    onClick={() =>
                      setFilters((prev) => ({ ...prev, savedOnly: !prev.savedOnly }))
                    }
                    className={`inline-flex min-h-[42px] items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-semibold transition ${
                      filters.savedOnly
                        ? 'border-ink bg-ink text-paper'
                        : 'border-ink/15 bg-paper text-stone'
                    }`}
                  >
                    <Bookmark size={14} className={filters.savedOnly ? 'fill-gold text-gold' : ''} />
                    {t('opp.filter.showSavedOnly')}
                  </button>

                  <div
                    className="flex rounded-xl border border-ink/15 bg-paper p-0.5"
                    role="group"
                    aria-label={t('opp.viewLabel')}
                  >
                    {(
                      [
                        ['grid', LayoutGrid],
                        ['list', List],
                        ['map', MapIcon],
                      ] as const
                    ).map(([v, Icon]) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setView(v)}
                        aria-pressed={view === v}
                        aria-label={`${v} view`}
                        className={`rounded-lg p-2 transition ${
                          view === v ? 'bg-ink text-paper' : 'text-stone hover:text-ink'
                        }`}
                      >
                        <Icon size={15} />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Active Filter Chips & Clear All */}
            {activeChips.length > 0 && (
              <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-ink/10 pt-3">
                {activeChips.map((chip) => (
                  <button
                    key={chip.key}
                    type="button"
                    onClick={chip.clear}
                    className="inline-flex items-center gap-1.5 rounded-full border border-ochre/35 bg-ochre/10 px-3 py-1 font-mono text-xs font-medium text-ink transition hover:border-ochre hover:bg-ochre/20"
                  >
                    <span>{chip.label}</span>
                    <X size={12} className="text-ochre" />
                  </button>
                ))}
                <button
                  type="button"
                  onClick={clearAll}
                  className="ml-auto font-mono text-xs font-semibold text-ochre hover:underline"
                >
                  Clear all
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      <div className="mx-auto w-full max-w-[1920px] px-4 py-10 sm:px-6 lg:px-8 xl:px-10">
        {loadingLiveFeed ? (
          <section className="mb-10">
            <div className="rounded-2xl border border-ink/10 bg-[#FCFBF8] p-6 shadow-xs">
              <div className="mb-4 h-6 w-64 animate-pulse rounded bg-ink/10" />
              <ProjectListingSkeletonGrid count={3} />
            </div>
          </section>
        ) : (
          (filteredLiveOpportunities.length > 0 || filteredLiveProjects.length > 0) && (
            <section className="mb-10">
              <div className="rounded-2xl border border-moss/30 bg-[#FCFBF8] p-6 shadow-xs">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="inline-flex items-center gap-1.5 font-mono text-[11px] font-semibold uppercase tracking-wider text-moss">
                      <CheckCircle2 size={13} /> Live Verified Marketplace
                    </span>
                    <h2 className="mt-0.5 font-display text-2xl font-semibold text-ink tabular-nums">
                      Verified Member Opportunities &amp; Projects (
                      {filteredLiveOpportunities.length + filteredLiveProjects.length})
                    </h2>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                  {filteredLiveOpportunities.map((opp) => (
                    <article
                      key={`opp-${opp.id}`}
                      className="flex flex-col rounded-xl border border-ink/12 bg-paper/60 p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-1.5">
                        <span className="rounded bg-ink px-2 py-0.5 font-mono text-[10px] text-gold">
                          {formatOpportunityCategory(opp)}
                        </span>
                        {opp.is_featured && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-gold/25 px-2 py-0.5 font-mono text-[10px] font-semibold text-ochre">
                            <Star size={10} className="fill-gold text-gold" /> Featured
                          </span>
                        )}
                      </div>
                      <h3 className="mt-2 font-display text-lg font-semibold text-ink">
                        {opp.title}
                      </h3>
                      <p className="text-xs text-ochre">
                        {opp.organization} · {opp.location}
                      </p>
                      <p className="mt-2 line-clamp-3 text-xs text-stone">{opp.description}</p>
                      <div className="mt-auto space-y-2.5 border-t border-ink/10 pt-3">
                        <div className="flex items-center justify-between font-mono text-[11px] text-stone tabular-nums">
                          <span>
                            {opp.compensation_usd > 0
                              ? formatUsd(opp.compensation_usd)
                              : 'Schedule'}
                          </span>
                          <span>Due {opp.deadline}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setActiveLiveDossier(buildLiveOpportunityDossier(opp))}
                          className="btn-ghost w-full justify-center !py-2 text-xs"
                        >
                          {hasDossierUnlocked ? (
                            <Unlock size={13} className="text-moss" />
                          ) : (
                            <FileCheck2 size={13} className="text-ochre" />
                          )}
                          Tenement Dossier &amp; Contact
                        </button>
                      </div>
                    </article>
                  ))}
                  {filteredLiveProjects.map((proj) => (
                    <article
                      key={`proj-${proj.id}`}
                      className="flex flex-col rounded-xl border border-ink/12 bg-paper/60 p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-1.5">
                        <span className="rounded bg-moss px-2 py-0.5 font-mono text-[10px] text-paper">
                          VERIFIED PROJECT
                        </span>
                        <span className="font-mono text-[10px] text-ochre">
                          {proj.mineral} · {proj.region}
                        </span>
                      </div>
                      <h3 className="mt-2 font-display text-lg font-semibold text-ink">
                        {proj.title}
                      </h3>
                      <p className="text-xs text-stone">
                        {proj.licence_type} ({proj.licence_reference})
                      </p>
                      <p className="mt-2 line-clamp-3 text-xs text-stone">{proj.summary}</p>
                      <div className="mt-auto space-y-2.5 border-t border-ink/10 pt-3">
                        <div className="flex items-center justify-between font-mono text-[11px] text-stone tabular-nums">
                          <span className="font-semibold text-ink">
                            {formatUsd(proj.investment_usd)}
                          </span>
                          <span>{new Date(proj.created_at).toLocaleDateString()}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setActiveLiveDossier(buildLiveProjectDossier(proj))}
                          className="btn-ghost w-full justify-center !py-2 text-xs"
                        >
                          {hasDossierUnlocked ? (
                            <Unlock size={13} className="text-moss" />
                          ) : (
                            <FileCheck2 size={13} className="text-ochre" />
                          )}
                          Tenement Dossier &amp; Contact
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            </section>
          )
        )}

        {totalMatching === 0 ? (
          <div className="grid place-items-center rounded-2xl border border-dashed border-ink/20 bg-white/60 px-6 py-24 text-center">
            <SearchX className="text-stone" size={32} />
            <h2 className="font-display mt-5 text-3xl">{t('opp.noResultsTitle')}</h2>
            <p className="mt-2 max-w-md text-sm text-stone">
              {filters.savedOnly ? t('opp.noResultsSaved') : t('opp.noResultsDefault')}
            </p>
            <button type="button" onClick={clearAll} className="btn-primary mt-8">
              {t('opp.resetFilters')}
            </button>
          </div>
        ) : results.length > 0 && view === 'map' ? (
          <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
            <div className="min-w-0 max-w-full overflow-hidden rounded-xl border border-ink/10 bg-white/50 p-2.5 sm:p-4">
              <TanzaniaMap
                projects={results}
                selectedId={selectedProject?.id}
                onSelect={setSelected}
                className="w-full"
              />
              <div className="mt-2 px-1 sm:px-2">
                <MapLegend />
              </div>
            </div>
            <div className="min-w-0 max-w-full space-y-4">
              {selectedProject && (
                <ProjectCard
                  project={selectedProject}
                  saved={isSaved(selectedProject.id)}
                  onToggleSave={toggle}
                />
              )}
              <ul className="divide-y divide-ink/10 rounded-xl border border-ink/10 bg-white/50">
                {results.map((raw) => {
                  const p = localizeProject(raw)
                  return (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => setSelected(p.id)}
                        className={`flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm transition hover:bg-white ${
                          p.id === selectedProject?.id ? 'bg-white font-semibold' : ''
                        }`}
                      >
                        <span className="truncate">{p.title}</span>
                        <span className="shrink-0 font-mono text-xs text-stone tabular-nums">
                          {formatUsd(p.investmentUsd)}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
          </div>
        ) : (
          results.length > 0 && (
            <div
              className={
                view === 'grid'
                  ? 'grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5'
                  : 'grid gap-4'
              }
            >
              {results.map((p) => (
                <ProjectCard
                  key={p.id}
                  project={p}
                  layout={view === 'list' ? 'row' : 'grid'}
                  saved={isSaved(p.id)}
                  onToggleSave={toggle}
                />
              ))}
            </div>
          )
        )}

        <p className="mt-12 rounded-lg border border-ink/10 bg-paper-2 p-4 text-xs leading-relaxed text-stone">
          {t('opp.disclaimer')}
        </p>
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
    </div>
  )
}
