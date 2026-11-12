'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import { PROJECTS } from '@/data/fixtures';
import { TANZANIA_REGIONS_META, resolveRegionMetadata } from '@/data/tanzaniaRegionsGeoJson';

/**
 * Dynamic SSR-safe import (`ssr: false`) of the Leaflet Tanzania Regional Map ("Mikoa")
 * Prevents `window is not defined` mismatches during Next.js server-side rendering.
 */
const TanzaniaMap = dynamic(() => import('@/components/TanzaniaMap'), {
  ssr: false,
  loading: () => (
    <div className="flex h-[620px] w-full items-center justify-center rounded-2xl border border-amber-500/30 bg-slate-950 font-mono text-xs uppercase tracking-widest text-amber-400">
      Loading Interactive Tanzania Regional GIS Map (31 Mikoa ADM1)...
    </div>
  ),
});

export default function NextTanzaniaMapPage() {
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    PROJECTS[0]?.id ?? null
  );
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);

  const activeRegionMeta = selectedRegion
    ? resolveRegionMetadata(selectedRegion)
    : null;

  return (
    <div className="min-h-screen bg-ink text-paper">
      <div className="mx-auto max-w-7xl space-y-6 px-5 py-10 lg:px-8">
        <header className="flex flex-col justify-between gap-4 border-b border-paper/12 pb-6 sm:flex-row sm:items-end">
          <div>
            <span className="font-mono text-xs uppercase tracking-widest text-gold">
              Level-1 Administrative GIS · 31 Mikoa
            </span>
            <h1 className="font-display mt-2 text-4xl font-light text-paper">
              Tanzania Regional Mineral Intelligence Map
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2 font-mono text-xs text-paper/70">
            <span>Regions: {Object.keys(TANZANIA_REGIONS_META).length}</span>
            <span>·</span>
            <span>
              Active Selection: {selectedRegion ? `Mkoa wa ${selectedRegion}` : 'All Tanzania'}
            </span>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <TanzaniaMap
            projects={PROJECTS}
            selectedId={selectedProjectId}
            onSelect={setSelectedProjectId}
            selectedRegion={selectedRegion}
            onSelectRegion={setSelectedRegion}
            variant="dark"
            heightClass="h-[620px]"
          />

          <aside className="space-y-4 rounded-2xl border border-paper/12 bg-ink-2 p-5">
            <h2 className="font-display text-xl font-medium text-gold">
              {activeRegionMeta
                ? `Mkoa wa ${activeRegionMeta.shapeName}`
                : 'Select a Region (Mkoa)'}
            </h2>
            {activeRegionMeta ? (
              <div className="space-y-3 text-xs text-paper/80">
                <div>
                  <span className="text-paper/50">ISO Code:</span>{' '}
                  <strong className="font-mono text-gold">
                    {activeRegionMeta.regionCode}
                  </strong>
                </div>
                <div>
                  <span className="text-paper/50">Regional Capital:</span>{' '}
                  <strong>{activeRegionMeta.capital}</strong>
                </div>
                <div>
                  <span className="text-paper/50">Geological Belt:</span>{' '}
                  <strong>{activeRegionMeta.zone}</strong>
                </div>
                <div>
                  <span className="text-paper/50">Key Minerals:</span>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
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
              </div>
            ) : (
              <p className="text-xs leading-relaxed text-paper/65">
                Hover over any of the 31 Tanzanian regions on the map to inspect its geological belt and mineral profile, or click a region polygon to dynamically zoom into its bounding box.
              </p>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
