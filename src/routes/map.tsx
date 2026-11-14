import { createFileRoute, Link } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { ArrowRight, Database, Info, MapPin, UserRound } from 'lucide-react'
import { MINERALS, OPPORTUNITY_TYPES, PROJECTS, STAGES } from '../data/fixtures'
import TanzaniaMap, { MapLegend } from '../components/TanzaniaMap'
import VerificationBadge from '../components/VerificationBadge'
import { TANZANIA_REGIONS_META, resolveRegionMetadata } from '../data/tanzaniaRegionsGeoJson'
import { img } from '../lib/img'
import { useLocalization } from '../context/LocalizationContext'

export const Route = createFileRoute('/map')({
  head: () => ({ meta: [{ title: 'Tanzania Regional GIS Map (Mikoa) — MineConnect' }] }),
  component: MapPage,
})

function MapPage() {
  const { t, tv, localizeProject, formatUsd } = useLocalization()
  const [mineral, setMineral] = useState('')
  const [type, setType] = useState('')
  const [stage, setStage] = useState('')
  const [minLevel, setMinLevel] = useState(0)
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(PROJECTS[0].id)

  const results = useMemo(
    () =>
      PROJECTS.filter(
        (p) =>
          (!mineral || p.minerals.includes(mineral as never)) &&
          (!type || p.type === type) &&
          (!stage || p.stage === stage) &&
          (!selectedRegion || p.region.toLowerCase() === selectedRegion.toLowerCase()) &&
          p.verification.level >= minLevel,
      ),
    [mineral, type, stage, selectedRegion, minLevel],
  )
  const currentRaw = results.find((p) => p.id === selected) ?? results[0]
  const current = currentRaw ? localizeProject(currentRaw) : undefined

  const byRegion = useMemo(() => {
    const m = new Map<string, number>()
    PROJECTS.forEach((p) => m.set(p.region, (m.get(p.region) ?? 0) + 1))
    return [...m.entries()].sort((a, b) => b[1] - a[1])
  }, [])

  const activeRegionMeta = useMemo(
    () => (selectedRegion ? resolveRegionMetadata(selectedRegion) : null),
    [selectedRegion],
  )

  return (
    <div className="relative min-h-screen overflow-hidden bg-ink pt-[72px] text-paper">
      <div className="contours absolute inset-0" aria-hidden />
      <div className="relative mx-auto max-w-[1440px] px-5 py-10 lg:px-8">
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div>
            <p className="eyebrow mb-3 text-gold">{t('mapPage.eyebrow')} · 31 MIKOA ADM1 GIS</p>
            <h1 className="font-display text-5xl font-light leading-none md:text-6xl">{t('mapPage.title')}</h1>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <DarkSelect value={mineral} onChange={setMineral} label={t('mapPage.allMinerals')} options={MINERALS} renderOption={tv} />
            <DarkSelect value={type} onChange={setType} label={t('mapPage.allTypes')} options={OPPORTUNITY_TYPES} renderOption={tv} />
            <DarkSelect value={stage} onChange={setStage} label={t('mapPage.allStages')} options={STAGES} renderOption={tv} />
            <select
              value={minLevel}
              onChange={(e) => setMinLevel(Number(e.target.value))}
              className="h-11 rounded-md border border-paper/15 bg-ink-2 px-3 text-sm text-paper outline-none focus:border-gold"
              aria-label={t('mapPage.minVerification')}
            >
              {[0, 1, 2, 3, 4].map((l) => (
                <option key={l} value={l}>
                  {l === 0 ? t('mapPage.anyVerification') : t('mapPage.levelPlus', { level: l })}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[270px_1fr_360px]">
          {/* Region ("Mikoa") interactive directory */}
          <aside className="order-3 rounded-xl border border-paper/10 bg-paper/[0.03] p-5 lg:order-1">
            <div className="mb-4 flex items-center justify-between">
              <div className="eyebrow text-paper/50">{t('mapPage.resultsByRegion')}</div>
              {selectedRegion && (
                <button
                  type="button"
                  onClick={() => setSelectedRegion(null)}
                  className="font-mono text-[10px] text-gold underline hover:text-paper"
                >
                  All 31 Mikoa
                </button>
              )}
            </div>
            {byRegion.length === 0 ? (
              <p className="text-sm text-paper/50">{t('mapPage.noMatches')}</p>
            ) : (
              <ul className="space-y-2.5">
                {byRegion.map(([r, n]) => {
                  const isActive = selectedRegion?.toLowerCase() === r.toLowerCase()
                  return (
                    <li key={r}>
                      <button
                        type="button"
                        onClick={() => setSelectedRegion(isActive ? null : r)}
                        className={`w-full rounded-lg border px-3 py-2 text-left transition ${
                          isActive
                            ? 'border-gold/50 bg-ochre/25 text-gold'
                            : 'border-transparent hover:border-paper/15 hover:bg-paper/5'
                        }`}
                      >
                        <div className="flex justify-between text-sm">
                          <span className="font-medium">{r}</span>
                          <span className="font-mono text-xs text-paper/60">{n}</span>
                        </div>
                        <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-paper/10">
                          <div className="h-full rounded-full bg-gold" style={{ width: `${(n / byRegion[0][1]) * 100}%` }} />
                        </div>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}

            <div className="mt-6 border-t border-paper/10 pt-4">
              <div className="font-mono text-[10px] uppercase tracking-wider text-gold">
                All 31 ADM1 Regions ({Object.keys(TANZANIA_REGIONS_META).length} Mikoa)
              </div>
              <div className="mt-2 flex max-h-36 flex-wrap gap-1 overflow-y-auto pr-1">
                {Object.keys(TANZANIA_REGIONS_META)
                  .sort()
                  .map((regionName) => {
                    const active = selectedRegion?.toLowerCase() === regionName.toLowerCase()
                    return (
                      <button
                        key={regionName}
                        type="button"
                        onClick={() => setSelectedRegion(active ? null : regionName)}
                        className={`rounded border px-2 py-0.5 font-mono text-[10px] transition ${
                          active
                            ? 'border-gold bg-gold text-ink font-semibold'
                            : 'border-paper/15 bg-ink-2 text-paper/70 hover:border-gold/40 hover:text-paper'
                        }`}
                      >
                        {regionName}
                      </button>
                    )
                  })}
              </div>
            </div>

            <div className="mt-6 space-y-3 border-t border-paper/10 pt-5 text-xs leading-relaxed text-paper/55">
              <p className="flex gap-2">
                <UserRound size={14} className="shrink-0 text-gold" /> {t('mapPage.markerNote')}
              </p>
              <p className="flex gap-2">
                <Database size={14} className="shrink-0 text-gold" /> {t('mapPage.datasetNote')}
              </p>
            </div>
          </aside>

          <div className="order-1 rounded-xl border border-paper/10 bg-paper/[0.02] p-4 lg:order-2">
            <TanzaniaMap
              projects={results}
              selectedId={current?.id}
              onSelect={setSelected}
              selectedRegion={selectedRegion}
              onSelectRegion={setSelectedRegion}
              variant="dark"
              className="w-full"
              heightClass="h-[620px]"
            />
            <div className="flex flex-wrap items-center justify-between gap-3 px-2 pt-3">
              <MapLegend dark />
              <span className="flex items-center gap-1.5 text-[11px] text-paper/40">
                <Info size={12} /> {t('mapPage.outlineNote')}
              </span>
            </div>
          </div>

          <aside className="order-2 space-y-4 lg:order-3">
            {activeRegionMeta && (
              <div className="rounded-xl border border-gold/35 bg-ink-2 p-5">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-gold">
                    {activeRegionMeta.regionCode} · {activeRegionMeta.zone}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedRegion(null)}
                    className="font-mono text-[10px] text-paper/60 underline hover:text-gold"
                  >
                    Reset Mkoa
                  </button>
                </div>
                <h3 className="font-display mt-1 text-2xl font-medium text-paper">
                  Mkoa wa {activeRegionMeta.shapeName}
                </h3>
                <p className="mt-1 font-mono text-xs text-paper/70">
                  Regional HQ: {activeRegionMeta.capital} · Est. Active Licences: ~{activeRegionMeta.activeLicencesEstimate}
                </p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {activeRegionMeta.keyMinerals.map((m) => (
                    <span
                      key={m}
                      className="rounded border border-gold/30 bg-ochre/20 px-2 py-0.5 font-mono text-[10px] text-gold"
                    >
                      {m}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {current ? (
              <div key={current.id} className="overflow-hidden rounded-xl border border-paper/10 bg-ink-2 animate-rise">
                <img src={img(current.image, 720)} alt="" className="aspect-[16/9] w-full object-cover" />
                <div className="p-6">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[10px] tracking-[0.14em] text-paper/50">{current.id}</span>
                    <VerificationBadge level={current.verification.level} />
                  </div>
                  <h2 className="font-display mt-3 text-2xl leading-snug">{current.title}</h2>
                  <p className="mt-2 flex items-center gap-1.5 text-sm text-paper/60">
                    <MapPin size={14} /> {current.district}, {current.region}
                  </p>
                  <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-paper/10 pt-4 text-sm">
                    <div className="min-w-0">
                      <dt className="eyebrow !text-[10px] text-paper/40">{t('mapPage.mineral')}</dt>
                      <dd className="mt-1 break-words">{current.minerals.map(tv).join(', ')}</dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="eyebrow !text-[10px] text-paper/40">{t('mapPage.seeking')}</dt>
                      <dd className="mt-1 font-semibold text-gold">{formatUsd(current.investmentUsd)}</dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="eyebrow !text-[10px] text-paper/40">{t('mapPage.licence')}</dt>
                      <dd className="mt-1 break-words">{tv(current.licence.type)}</dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="eyebrow !text-[10px] text-paper/40">{t('mapPage.stage')}</dt>
                      <dd className="mt-1 break-words">{tv(current.stage)}</dd>
                    </div>
                  </dl>
                  <Link to="/opportunities/$projectId" params={{ projectId: current.id }} className="btn-primary mt-6 w-full">
                    {t('mapPage.viewProject')} <ArrowRight size={16} />
                  </Link>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-paper/20 p-8 text-center text-sm text-paper/60">
                {t('mapPage.adjustFilters')}
              </div>
            )}
            <ul className="max-h-72 divide-y divide-paper/10 overflow-y-auto rounded-xl border border-paper/10">
              {results.map((raw) => {
                const p = localizeProject(raw)
                return (
                  <li key={p.id}>
                    <button
                      onClick={() => {
                        setSelected(p.id)
                        setSelectedRegion(p.region)
                      }}
                      className={`flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm transition hover:bg-paper/5 ${
                        p.id === current?.id ? 'bg-paper/[0.07] text-gold' : 'text-paper/80'
                      }`}
                    >
                      <span className="truncate">{p.title}</span>
                      <span className="shrink-0 font-mono text-[11px] text-paper/40">{p.region}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </aside>
        </div>
      </div>
    </div>
  )
}

function DarkSelect({
  value,
  onChange,
  label,
  options,
  renderOption,
}: {
  value: string
  onChange: (v: string) => void
  label: string
  options: readonly string[]
  renderOption?: (o: string) => string
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={label}
      className="h-11 rounded-md border border-paper/15 bg-ink-2 px-3 text-sm text-paper outline-none focus:border-gold"
    >
      <option value="">{label}</option>
      {options.map((o) => (
        <option key={o} value={o}>
          {renderOption ? renderOption(o) : o}
        </option>
      ))}
    </select>
  )
}
