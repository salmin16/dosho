import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  BadgeCheck,
  Clock,
  FileCheck2,
  Globe,
  Lock,
  MapPin,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Star,
  CheckCircle2,
  Unlock,
  X,
} from 'lucide-react'
import { SERVICE_CATEGORIES, type ServiceProvider } from '../data/fixtures'
import { TANZANIA_REGION_LIST } from '../data/tanzaniaDistricts'
import { useI18n } from '../i18n'
import { ServiceListingSkeletonGrid } from '../components/Skeletons'
import TenementDossierGate from '../components/TenementDossierGate'
import TurnstileWidget, {
  isTurnstileEnabled,
  type TurnstileWidgetHandle,
} from '../components/TurnstileWidget'
import UpgradeRequiredGate from '../components/UpgradeRequiredGate'
import {
  buildLiveServiceDossier,
  buildServiceProviderDossier,
  type CounterpartyDossierData,
} from '../lib/counterpartyDossier'
import {
  DEFAULT_SERVICES_FILTER,
  SERVICE_FILTER_CATEGORIES,
  SERVICE_RATE_MODELS,
  SERVICE_VERIFICATION_TIERS,
  formatServiceCategory,
  getLiveServiceRateModel,
  getLiveServiceVerificationTier,
  getProviderRateModel,
  getProviderVerificationTier,
  getRateModelLabel,
  isLiveServiceNationwide,
  isProviderNationwide,
  matchesLiveServiceFilters,
  matchesProviderFilters,
  normalizeServiceCategoryParam,
  type ServiceCategorySelection,
  type ServiceRateModelFilter,
  type ServiceVerificationFilter,
  type ServicesFilterState,
} from '../lib/serviceCategories'
import { useSubscription } from '../lib/subscriptions'
import {
  createGroundedQuoteRequest,
  fetchApprovedPublicServices,
  getSession,
  useAuthSession,
} from '../lib/supabaseAuth'
import {
  formatSafeUserError,
  verifyTurnstileForForm,
} from '../lib/verifyTurnstileClient'
import { useCurrency } from '../lib/currency'
import type { UserServiceRecord } from '../types/database'

export const Route = createFileRoute('/services')({
  validateSearch: (s: Record<string, unknown>): { category?: string } => ({
    category: typeof s.category === 'string' && s.category ? s.category : undefined,
  }),
  head: () => ({ meta: [{ title: 'Mining services marketplace — MineConnect' }] }),
  component: Services,
})

function Services() {
  const { t, tv, fixtures } = useI18n()
  const { category } = Route.useSearch()
  const session = useAuthSession()
  const {
    plan,
    planId,
    accountState,
    entitlements,
    isPaidActive,
    canAccessDataRoom,
    canSubmitRfq,
    refreshSubscription,
  } = useSubscription()

  const [filters, setFilters] = useState<ServicesFilterState>(() => ({
    ...DEFAULT_SERVICES_FILTER,
    category: normalizeServiceCategoryParam(category),
  }))
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)
  const [quoteFor, setQuoteFor] = useState<ServiceProvider | null>(null)
  const [activeDossier, setActiveDossier] = useState<{
    dossier: CounterpartyDossierData
    provider: ServiceProvider
  } | null>(null)
  const [showRfqUpgrade, setShowRfqUpgrade] = useState(false)
  const [liveApprovedServices, setLiveApprovedServices] = useState<UserServiceRecord[]>([])
  const [loadingLiveServices, setLoadingLiveServices] = useState(true)
  const hasDossierUnlocked = isPaidActive || canAccessDataRoom
  const canRequestQuoteNow = Boolean(session) && isPaidActive && canSubmitRfq

  // Sync only when an external route link supplies a ?category= search param
  useEffect(() => {
    if (category) {
      setFilters((prev) => ({
        ...prev,
        category: normalizeServiceCategoryParam(category),
      }))
    }
  }, [category])

  useEffect(() => {
    let active = true
    void fetchApprovedPublicServices()
      .then((rows) => {
        if (active) setLiveApprovedServices(rows)
      })
      .finally(() => {
        if (active) setLoadingLiveServices(false)
      })
    return () => {
      active = false
    }
  }, [])

  const filteredLiveServices = useMemo(
    () => liveApprovedServices.filter((srv) => matchesLiveServiceFilters(srv, filters)),
    [liveApprovedServices, filters],
  )

  const filteredProviders = useMemo(
    () => fixtures.serviceProviders.filter((p) => matchesProviderFilters(p, filters)),
    [fixtures.serviceProviders, filters],
  )

  const totalMatching = filteredLiveServices.length + filteredProviders.length
  const totalCatalog = liveApprovedServices.length + fixtures.serviceProviders.length

  const secondaryFilterCount =
    (filters.region !== 'ALL' ? 1 : 0) +
    (filters.verification !== 'ALL' ? 1 : 0) +
    (filters.rateModel !== 'ALL' ? 1 : 0)

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
    if (filters.region !== 'ALL') {
      chips.push({
        key: 'region',
        label: filters.region === 'NATIONWIDE' ? 'Nationwide' : filters.region,
        clear: () => setFilters((prev) => ({ ...prev, region: 'ALL' })),
      })
    }
    if (filters.verification !== 'ALL') {
      const tierLabel =
        SERVICE_VERIFICATION_TIERS.find((tier) => tier.value === filters.verification)?.label ??
        filters.verification
      chips.push({
        key: 'verification',
        label: tierLabel,
        clear: () => setFilters((prev) => ({ ...prev, verification: 'ALL' })),
      })
    }
    if (filters.rateModel !== 'ALL') {
      const rateLabel =
        SERVICE_RATE_MODELS.find((m) => m.value === filters.rateModel)?.label ?? filters.rateModel
      chips.push({
        key: 'rateModel',
        label: rateLabel,
        clear: () => setFilters((prev) => ({ ...prev, rateModel: 'ALL' })),
      })
    }
    return chips
  }, [filters])

  const clearAllFilters = () => {
    setFilters(DEFAULT_SERVICES_FILTER)
  }

  const handleRequestQuoteClick = (provider: ServiceProvider) => {
    const activeSession = getSession()
    if (!activeSession || !isPaidActive || !canSubmitRfq) {
      setShowRfqUpgrade(true)
      return
    }
    setQuoteFor(provider)
  }

  return (
    <div className="pt-[72px]">
      <section className="border-b border-ink/10 bg-paper-2">
        <div className="mx-auto w-full max-w-[1920px] px-4 pb-8 pt-14 sm:px-6 lg:px-8 xl:px-10">
          <p className="eyebrow mb-3 text-ochre">{t('services.eyebrow')}</p>
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
            <div>
              <h1 className="font-display max-w-3xl text-5xl font-light leading-none md:text-6xl">
                {t('services.title')}
              </h1>
            </div>
            <p className="font-mono text-xs text-stone tabular-nums">
              Showing <strong className="text-ink">{totalMatching}</strong> of{' '}
              <strong className="text-ink">{totalCatalog}</strong> technical providers
            </p>
          </div>

          {/* Domain-Tailored Compact Services Filter Bar */}
          <div className="mt-8 rounded-2xl border border-ink/12 bg-white/85 p-3.5 shadow-2xs sm:p-4">
            {/* Primary Row: Always visible on Mobile & Desktop */}
            <div className="grid grid-cols-1 gap-2.5 md:grid-cols-12 md:items-center">
              {/* Search input */}
              <div className="relative md:col-span-4 lg:col-span-4">
                <Search
                  size={16}
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-stone"
                />
                <input
                  id="services-filter-search"
                  type="text"
                  aria-label="Search services, providers, capabilities, certifications, or districts"
                  value={filters.q}
                  onChange={(e) =>
                    setFilters((prev) => ({ ...prev, q: e.target.value }))
                  }
                  placeholder="Search provider, capability, certification, or district..."
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

              {/* Mobile row: Category + Filters(N) toggle */}
              <div className="flex items-center gap-2 md:col-span-8 md:grid md:grid-cols-4 md:gap-2.5 lg:col-span-8">
                <div className="min-w-0 flex-1">
                  <label htmlFor="services-filter-category" className="sr-only">
                    Service Category
                  </label>
                  <select
                    id="services-filter-category"
                    value={filters.category}
                    onChange={(e) =>
                      setFilters((prev) => ({
                        ...prev,
                        category: e.target.value as ServiceCategorySelection,
                      }))
                    }
                    className="min-h-[44px] w-full rounded-xl border border-ink/15 bg-paper px-3 py-2 text-base text-ink focus:border-ochre focus:bg-white focus:outline-none focus:ring-2 focus:ring-ochre/20 md:text-sm"
                  >
                    <option value="ALL">All Services</option>
                    {SERVICE_FILTER_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Mobile secondary filters toggle button */}
                <button
                  type="button"
                  aria-expanded={mobileFiltersOpen}
                  aria-controls="services-mobile-filters"
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

                {/* Desktop secondary selectors (always visible on md+) */}
                <div className="hidden md:block">
                  <label htmlFor="services-filter-region" className="sr-only">
                    Region or Mobilization Coverage
                  </label>
                  <select
                    id="services-filter-region"
                    value={filters.region}
                    onChange={(e) =>
                      setFilters((prev) => ({ ...prev, region: e.target.value }))
                    }
                    className="min-h-[44px] w-full rounded-xl border border-ink/15 bg-paper px-3 py-2 text-sm text-ink focus:border-ochre focus:bg-white focus:outline-none focus:ring-2 focus:ring-ochre/20"
                  >
                    <option value="ALL">All Regions</option>
                    <option value="NATIONWIDE">Nationwide</option>
                    {TANZANIA_REGION_LIST.map((reg) => (
                      <option key={reg} value={reg}>
                        {reg}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="hidden md:block">
                  <label htmlFor="services-filter-tier" className="sr-only">
                    Verification Tier
                  </label>
                  <select
                    id="services-filter-tier"
                    value={filters.verification}
                    onChange={(e) =>
                      setFilters((prev) => ({
                        ...prev,
                        verification: e.target.value as ServiceVerificationFilter,
                      }))
                    }
                    className="min-h-[44px] w-full rounded-xl border border-ink/15 bg-paper px-3 py-2 text-sm text-ink focus:border-ochre focus:bg-white focus:outline-none focus:ring-2 focus:ring-ochre/20"
                  >
                    {SERVICE_VERIFICATION_TIERS.map((tier) => (
                      <option key={tier.value} value={tier.value}>
                        {tier.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="hidden md:block">
                  <label htmlFor="services-filter-rate" className="sr-only">
                    Engagement or Rate Model
                  </label>
                  <select
                    id="services-filter-rate"
                    value={filters.rateModel}
                    onChange={(e) =>
                      setFilters((prev) => ({
                        ...prev,
                        rateModel: e.target.value as ServiceRateModelFilter,
                      }))
                    }
                    className="min-h-[44px] w-full rounded-xl border border-ink/15 bg-paper px-3 py-2 text-sm text-ink focus:border-ochre focus:bg-white focus:outline-none focus:ring-2 focus:ring-ochre/20"
                  >
                    {SERVICE_RATE_MODELS.map((model) => (
                      <option key={model.value} value={model.value}>
                        {model.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Mobile Collapsible Secondary Filters Panel */}
            {mobileFiltersOpen && (
              <div
                id="services-mobile-filters"
                className="mt-3 grid grid-cols-1 gap-2.5 border-t border-ink/10 pt-3 md:hidden"
              >
                <div>
                  <label
                    htmlFor="services-filter-region-mobile"
                    className="mb-1 block font-mono text-[10px] font-semibold uppercase tracking-wider text-stone"
                  >
                    Region / Mobilization Coverage
                  </label>
                  <select
                    id="services-filter-region-mobile"
                    value={filters.region}
                    onChange={(e) =>
                      setFilters((prev) => ({ ...prev, region: e.target.value }))
                    }
                    className="min-h-[44px] w-full rounded-xl border border-ink/15 bg-paper px-3 py-2 text-base text-ink focus:border-ochre focus:bg-white focus:outline-none"
                  >
                    <option value="ALL">All Regions</option>
                    <option value="NATIONWIDE">Nationwide</option>
                    {TANZANIA_REGION_LIST.map((reg) => (
                      <option key={reg} value={reg}>
                        {reg}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="services-filter-tier-mobile"
                    className="mb-1 block font-mono text-[10px] font-semibold uppercase tracking-wider text-stone"
                  >
                    Verification Tier
                  </label>
                  <select
                    id="services-filter-tier-mobile"
                    value={filters.verification}
                    onChange={(e) =>
                      setFilters((prev) => ({
                        ...prev,
                        verification: e.target.value as ServiceVerificationFilter,
                      }))
                    }
                    className="min-h-[44px] w-full rounded-xl border border-ink/15 bg-paper px-3 py-2 text-base text-ink focus:border-ochre focus:bg-white focus:outline-none"
                  >
                    {SERVICE_VERIFICATION_TIERS.map((tier) => (
                      <option key={tier.value} value={tier.value}>
                        {tier.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="services-filter-rate-mobile"
                    className="mb-1 block font-mono text-[10px] font-semibold uppercase tracking-wider text-stone"
                  >
                    Engagement / Rate Model
                  </label>
                  <select
                    id="services-filter-rate-mobile"
                    value={filters.rateModel}
                    onChange={(e) =>
                      setFilters((prev) => ({
                        ...prev,
                        rateModel: e.target.value as ServiceRateModelFilter,
                      }))
                    }
                    className="min-h-[44px] w-full rounded-xl border border-ink/15 bg-paper px-3 py-2 text-base text-ink focus:border-ochre focus:bg-white focus:outline-none"
                  >
                    {SERVICE_RATE_MODELS.map((model) => (
                      <option key={model.value} value={model.value}>
                        {model.label}
                      </option>
                    ))}
                  </select>
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
                  onClick={clearAllFilters}
                  className="ml-auto font-mono text-xs font-semibold text-ochre hover:underline"
                >
                  Clear all
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      <div className="mx-auto w-full max-w-[1920px] px-4 py-12 sm:px-6 lg:px-8 xl:px-10">
        {loadingLiveServices ? (
          <section className="mb-10">
            <div className="mb-4 h-6 w-64 animate-pulse rounded bg-ink/10" />
            <ServiceListingSkeletonGrid count={2} />
          </section>
        ) : filteredLiveServices.length > 0 && (
          <section className="mb-10">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-moss">
                  Live Verified Services Directory
                </span>
                <h2 className="font-display text-2xl font-semibold text-ink tabular-nums">
                  Verified Member Service Listings ({filteredLiveServices.length})
                </h2>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredLiveServices.map((srv) => {
                const tierNum = getLiveServiceVerificationTier(srv)
                const rateLabel = getRateModelLabel(getLiveServiceRateModel(srv))
                const nationwide = isLiveServiceNationwide(srv)
                const displayCat = formatServiceCategory(srv)
                return (
                  <article
                    key={srv.id}
                    className="flex flex-col rounded-2xl border border-moss/30 bg-white p-6 shadow-xs"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="inline-flex items-center gap-1 rounded-full bg-moss-light px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase text-moss">
                          <BadgeCheck size={12} /> L{tierNum} Verified
                        </span>
                        <span className="rounded-full border border-ink/12 bg-paper px-2 py-0.5 font-mono text-[10px] text-stone">
                          {rateLabel}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {srv.is_featured && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-gold/25 px-2 py-0.5 font-mono text-[10px] font-semibold text-ochre">
                            <Star size={11} className="fill-gold text-gold" /> Featured
                          </span>
                        )}
                        <span className="rounded bg-ink px-2 py-0.5 font-mono text-[10px] text-gold">
                          {srv.reference_code}
                        </span>
                      </div>
                    </div>
                    <h3 className="mt-3 font-display text-2xl leading-tight">{srv.service_name}</h3>
                    <p className="mt-1 text-sm text-ochre">
                      {srv.provider_organization} · {displayCat}
                    </p>
                    <p className="mt-3 text-sm leading-relaxed text-stone">{srv.scope_description}</p>
                    {srv.certifications && (
                      <p className="mt-3 font-mono text-[11px] text-moss">
                        {srv.certifications}
                      </p>
                    )}
                    <div className="mt-auto flex flex-wrap items-center justify-between gap-2.5 border-t border-ink/10 pt-4 text-xs">
                      <span className="min-w-0 font-mono text-stone tabular-nums">
                        {nationwide ? 'Nationwide · ' : ''}
                        {srv.regional_coverage} · <strong className="text-ink">{srv.rate_or_pricing_model}</strong>
                      </span>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            const mappedProvider: ServiceProvider = {
                              id: srv.id,
                              name: srv.provider_organization,
                              initials: srv.provider_organization.slice(0, 2).toUpperCase(),
                              category: displayCat || SERVICE_CATEGORIES[0],
                              location: srv.regional_coverage,
                              verified: true,
                              rating: 5.0,
                              reviews: 1,
                              responseTime: '24h',
                              summary: srv.scope_description,
                              services: [srv.service_name],
                            }
                            setActiveDossier({
                              dossier: buildLiveServiceDossier(srv),
                              provider: mappedProvider,
                            })
                          }}
                          className="btn-ghost !py-2 !px-3 text-xs"
                        >
                          {hasDossierUnlocked ? <Unlock size={13} className="text-moss" /> : <FileCheck2 size={13} className="text-ochre" />}
                          Dossier &amp; Contact
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            handleRequestQuoteClick({
                              id: srv.id,
                              name: srv.provider_organization,
                              initials: srv.provider_organization.slice(0, 2).toUpperCase(),
                              category: displayCat || SERVICE_CATEGORIES[0],
                              location: srv.regional_coverage,
                              verified: true,
                              rating: 5.0,
                              reviews: 1,
                              responseTime: '24h',
                              summary: srv.scope_description,
                              services: [srv.service_name],
                            })
                          }
                          className="btn-primary !py-2"
                        >
                          {!canRequestQuoteNow && <Lock size={13} />}
                          {t('services.requestQuote')}
                        </button>
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          </section>
        )}

        {totalMatching === 0 ? (
          <div className="rounded-2xl border border-dashed border-ink/20 bg-white/60 px-6 py-20 text-center">
            <h2 className="font-display text-3xl">{t('services.emptyTitle')}</h2>
            <p className="mt-2 text-sm text-stone">{t('services.emptyBody')}</p>
            {activeChips.length > 0 && (
              <button
                type="button"
                onClick={clearAllFilters}
                className="btn-primary mt-5 !py-2.5 text-xs"
              >
                Clear all filters
              </button>
            )}
          </div>
        ) : filteredProviders.length > 0 && (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredProviders.map((s) => {
              const tierNum = getProviderVerificationTier(s)
              const rateLabel = getRateModelLabel(getProviderRateModel(s))
              const nationwide = isProviderNationwide(s)
              return (
                <article
                  key={s.id}
                  className="flex flex-col rounded-2xl border border-ink/10 bg-white/75 p-6 transition hover:border-ink/25 hover:bg-white"
                >
                  <div className="flex items-start gap-4">
                    <span className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-ink font-display text-lg text-gold">
                      {s.initials}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <h2 className="font-display text-2xl leading-tight">{s.name}</h2>
                      </div>
                      <p className="mt-1 text-sm text-ochre">{tv(s.category)}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        {tierNum > 0 && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-moss-light px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-moss tabular-nums">
                            <ShieldCheck size={11} /> L{tierNum} {s.verified ? t('services.verifiedBadge') : 'Registered'}
                          </span>
                        )}
                        <span className="rounded-full border border-ink/12 bg-paper px-2 py-0.5 font-mono text-[10px] text-stone">
                          {rateLabel}
                        </span>
                      </div>
                    </div>
                  </div>
                  <p className="mt-4 text-sm leading-relaxed text-stone">{s.summary}</p>
                  <div className="mb-6 mt-4 flex flex-wrap gap-1.5">
                    {s.services.map((x) => (
                      <span key={x} className="rounded-full border border-sand px-2.5 py-1 text-xs">
                        {x}
                      </span>
                    ))}
                  </div>
                  <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-ink/10 pt-5 text-sm">
                    <div className="flex flex-wrap gap-3 text-xs text-stone tabular-nums sm:text-sm">
                      <span className="flex items-center gap-1">
                        <Star size={14} className="fill-gold text-gold" />{' '}
                        <strong className="text-ink">{s.rating}</strong> ({s.reviews})
                      </span>
                      <span className="flex items-center gap-1">
                        {nationwide ? <Globe size={13} className="text-ochre" /> : <MapPin size={14} />}
                        {nationwide ? `${s.location} · Nationwide` : s.location}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock size={14} /> {s.responseTime}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setActiveDossier({
                            dossier: buildServiceProviderDossier(s),
                            provider: s,
                          })
                        }
                        className="btn-ghost !py-2 !px-3 text-xs"
                      >
                        {hasDossierUnlocked ? <Unlock size={13} className="text-moss" /> : <FileCheck2 size={13} className="text-ochre" />}
                        Dossier &amp; Contact
                      </button>
                      <button
                        onClick={() => handleRequestQuoteClick(s)}
                        className="btn-primary !py-2 text-xs sm:text-sm"
                      >
                        {!canRequestQuoteNow && <Lock size={13} />}
                        {t('services.requestQuote')}
                      </button>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        )}
        <p className="mt-10 text-xs text-stone">{t('services.footnote')}</p>
      </div>

      {activeDossier && (
        <TenementDossierGate
          variant="modal"
          dossier={activeDossier.dossier}
          onTriggerRfq={() => handleRequestQuoteClick(activeDossier.provider)}
          rfqButtonLabel={t('services.requestQuote')}
          onClose={() => setActiveDossier(null)}
        />
      )}

      {quoteFor && (
        <QuoteModal
          provider={quoteFor}
          onClose={() => setQuoteFor(null)}
          onQuoteSubmitted={() => void refreshSubscription()}
          onQuotaExceeded={() => {
            setQuoteFor(null)
            setShowRfqUpgrade(true)
          }}
        />
      )}

      {showRfqUpgrade && (
        <UpgradeRequiredGate
          variant="modal"
          requiredPlan={isPaidActive && planId === 'pro' ? 'enterprise' : 'pro'}
          currentPlanLabel={session ? plan.name : 'Guest (View-Only)'}
          accountStateOverride={session ? accountState : 'free'}
          quotaSummary={
            isPaidActive
              ? `${entitlements.monthly_rfqs_count} / ${
                  entitlements.max_monthly_rfqs < 0 ? '∞' : entitlements.max_monthly_rfqs
                } Monthly RFQs`
              : '0 / 0 Quote Requests (View-Only)'
          }
          featureTitle={
            isPaidActive && planId === 'pro'
              ? 'Monthly RFQ Limit Reached — Upgrade to Institutional / JV Desk'
              : accountState === 'dormant'
                ? 'Dormant Account — Renew Operator Pro to Request Quotes'
                : 'Upgrade to Operator Pro to Request a Quote'
          }
          reason={
            isPaidActive && planId === 'pro'
              ? 'You have used all 25 monthly quote requests on Operator Pro. Upgrade to Institutional / JV Desk for unlimited monthly RFQs and NDA Data Room access.'
              : accountState === 'dormant'
                ? 'Your paid period has expired and your account is currently view-only (0 quote or information requests). Renew Operator Pro in 2 steps to restore 25 monthly RFQs and direct provider contacts.'
                : 'Explorer (Free) accounts and guest visitors are strictly view-only (0 quote, information, or due-diligence requests). Upgrade to Operator Pro to submit up to 25 monthly RFQs and unlock full provider dossiers.'
          }
          onClose={() => setShowRfqUpgrade(false)}
        />
      )}
    </div>
  )
}

function QuoteModal({
  provider,
  onClose,
  onQuoteSubmitted,
  onQuotaExceeded,
}: {
  provider: ServiceProvider
  onClose: () => void
  onQuoteSubmitted: () => void
  onQuotaExceeded: () => void
}) {
  const { t, tv } = useI18n()
  const navigate = useNavigate()
  const session = useAuthSession()
  const { currency, currencyMeta, toUsd, formatExactUsd } = useCurrency()

  const [budgetInput, setBudgetInput] = useState('25000')
  const [acceptedInvestorTerms, setAcceptedInvestorTerms] = useState(false)
  const [captchaToken, setCaptchaToken] = useState('')
  const [turnstileResetKey, setTurnstileResetKey] = useState(0)
  const [sent, setSent] = useState(false)
  const [err, setErr] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const turnstileRef = useRef<TurnstileWidgetHandle | null>(null)
  const turnstileEnabled = isTurnstileEnabled()

  const numericBudget = parseFloat(budgetInput) || 0
  const normalizedUsd = toUsd(numericBudget)

  return (
    <div
      className="fixed inset-0 z-[70] grid place-items-end sm:place-items-center"
      role="dialog"
      aria-modal
    >
      <div
        className="absolute inset-0 bg-ink/60 backdrop-blur-sm animate-fade"
        onClick={onClose}
      />
      <div className="relative max-h-[88dvh] w-full overflow-y-auto overscroll-contain rounded-t-2xl bg-paper p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] shadow-2xl animate-rise sm:max-w-md sm:rounded-2xl sm:p-8">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-full text-stone transition-colors hover:bg-ink/5 hover:text-ink"
          aria-label={t('modal.close')}
        >
          <X size={18} />
        </button>
        {sent ? (
          <div className="py-6 text-center">
            <CheckCircle2 size={44} className="mx-auto text-moss" />
            <h2 className="font-display mt-4 text-3xl">
              {t('services.modal.quoteRequested')}
            </h2>
            <p className="mt-2 text-stone">
              {t('services.modal.respondsIn', {
                name: provider.name,
                time: provider.responseTime,
              })}
            </p>
            <p className="mt-2 font-mono text-xs text-moss">
              Grounded to your Vault ({formatExactUsd(normalizedUsd)})
            </p>
            <div className="mt-8 flex gap-3">
              <button
                type="button"
                onClick={() => {
                  onClose()
                  navigate({ to: '/dashboard' })
                }}
                className="btn-ghost flex-1"
              >
                View in Vault
              </button>
              <button onClick={onClose} className="btn-primary flex-1">
                {t('modal.done')}
              </button>
            </div>
          </div>
        ) : (
          <form
            noValidate
            onSubmit={async (e) => {
              e.preventDefault()
              if (!getSession()) {
                onClose()
                navigate({
                  to: '/signup',
                  search: { next: '/services', reason: 'request_quote' } as unknown as undefined,
                })
                return
              }
              const d = new FormData(e.currentTarget)
              const emailVal = String(d.get('email') || session?.user.email || '').trim()
              const scopeVal = String(d.get('scope') || '').trim()
              const serviceVal = String(d.get('service') || provider.services[0] || '')

              if (!/^\S+@\S+\.\S+$/.test(emailVal) || !scopeVal) {
                setErr(t('services.modal.err'))
                return
              }
              if (!acceptedInvestorTerms) {
                setErr('Please acknowledge the Investor Terms and Facilitation & Success-Fee Terms before submitting.')
                return
              }
              if (turnstileEnabled && !captchaToken) {
                setErr('Please complete the security verification check before submitting.')
                return
              }

              setSubmitting(true)
              setErr('')
              try {
                const verification = await verifyTurnstileForForm(
                  captchaToken,
                  'request-quote',
                )
                if (!verification.ok) {
                  setErr(
                    verification.error ||
                      'Security verification failed or expired. Please complete the challenge again.',
                  )
                  return
                }
                const res = await createGroundedQuoteRequest({
                  providerId: provider.id,
                  providerName: provider.name,
                  serviceRequested: serviceVal,
                  estimatedBudgetUsd: normalizedUsd,
                  currencyCode: currency,
                  scopeNotes: scopeVal,
                })
                if (res.error) {
                  if (/row-level security|policy|42501|quota|rfq/i.test(res.error)) {
                    onQuotaExceeded()
                    return
                  }
                  setErr(
                    formatSafeUserError(
                      res.error,
                      'Unable to submit your quote request right now. Please try again.',
                    ),
                  )
                  return
                }
                onQuoteSubmitted()
                setSent(true)
              } catch (submitErr) {
                setErr(
                  formatSafeUserError(
                    submitErr instanceof Error ? submitErr.message : undefined,
                    'Unable to submit your quote request right now. Please try again.',
                  ),
                )
              } finally {
                setSubmitting(false)
                setCaptchaToken('')
                setTurnstileResetKey((k) => k + 1)
                turnstileRef.current?.reset()
              }
            }}
          >
            <p className="eyebrow text-ochre">{tv(provider.category)}</p>
            <h2 className="font-display mt-2 text-3xl">
              {t('services.modal.requestTitle')}
            </h2>
            <p className="mt-1 text-sm text-stone">
              {t('services.modal.fromProvider', { name: provider.name })}
            </p>
            <div className="mt-6 space-y-5">
              <div className="field-group">
                <label htmlFor="quote-email" className="label">
                  {t('services.modal.email')}
                </label>
                <input
                  id="quote-email"
                  name="email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  defaultValue={session?.user.email ?? ''}
                  placeholder="operator@miningcorp.co.tz"
                  className="field"
                />
              </div>
              <div className="field-group">
                <label htmlFor="quote-service" className="label">
                  {t('services.modal.serviceNeeded')}
                </label>
                <select id="quote-service" name="service" className="field">
                  {provider.services.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div className="field-group">
                <label htmlFor="quote-budget" className="label">
                  Estimated Budget ({currencyMeta.flag} {currency})
                </label>
                <input
                  id="quote-budget"
                  name="budget"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="any"
                  value={budgetInput}
                  onChange={(e) => setBudgetInput(e.target.value)}
                  placeholder="25000"
                  className="field tabular-nums"
                />
                {currency !== 'USD' && (
                  <span className="block font-mono text-[11px] text-stone tabular-nums">
                    Normalized USD Equivalent: US${normalizedUsd.toLocaleString('en-US')}
                  </span>
                )}
              </div>
              <div className="field-group">
                <label htmlFor="quote-scope" className="label">
                  {t('services.modal.scopeLocation')}
                </label>
                <textarea
                  id="quote-scope"
                  name="scope"
                  rows={3}
                  className="field resize-none"
                  placeholder={t('services.modal.scopePlaceholder')}
                />
              </div>
              <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-ink/12 bg-white p-3 text-xs leading-relaxed text-ink-3">
                <input
                  type="checkbox"
                  required
                  checked={acceptedInvestorTerms}
                  onChange={(e) => setAcceptedInvestorTerms(e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-ochre"
                />
                <span>
                  I acknowledge the{' '}
                  <a
                    href="/legal/investor-terms"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-ochre underline hover:text-ochre-dark"
                  >
                    Investor Terms
                  </a>{' '}
                  and agree to the{' '}
                  <a
                    href="/legal/facilitation-success-fee-terms"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-ochre underline hover:text-ochre-dark"
                  >
                    Facilitation &amp; Success-Fee Terms
                  </a>{' '}
                  (including non-circumvention).
                </span>
              </label>
              {turnstileEnabled && (
                <TurnstileWidget
                  ref={turnstileRef}
                  resetKey={turnstileResetKey}
                  theme="light"
                  action="request-quote"
                  onVerify={(token) => {
                    setCaptchaToken(token)
                    setErr('')
                  }}
                  onExpire={() => setCaptchaToken('')}
                  onError={(msg) => {
                    setCaptchaToken('')
                    if (msg) setErr(msg)
                  }}
                />
              )}
              {err && <p className="text-xs text-danger">{err}</p>}
            </div>
            <button
              disabled={
                submitting ||
                !acceptedInvestorTerms ||
                (turnstileEnabled && !captchaToken)
              }
              className="btn-primary mt-6 w-full disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? 'Submitting Quote Request...' : t('services.modal.sendRequest')}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
