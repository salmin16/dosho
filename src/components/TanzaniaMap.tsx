import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CircleMarker,
  GeoJSON as LeafletGeoJSON,
  MapContainer,
  TileLayer,
  Tooltip,
  useMap,
} from 'react-leaflet';
import L from 'leaflet';
import type { Feature, GeoJsonObject } from 'geojson';
import 'leaflet/dist/leaflet.css';
import {
   Compass,
  Layers,
  Maximize2,
  MapPin,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import type { Project } from '../data/fixtures';
import { PROJECTS, formatUsd } from '../data/fixtures';
import {
  TANZANIA_ADM1_FALLBACK_GEOJSON,
  TANZANIA_GEOBOUNDARIES_ADM1_URL,
  resolveRegionMetadata,
  type TanzaniaRegionProperties,
  type TanzaniaRegionsFeatureCollection,
} from '../data/tanzaniaRegionsGeoJson';
import { useI18n } from '../i18n';

const LEVEL_COLOR = ['#9a8f82', '#c9a35c', '#d6a443', '#c0612b', '#3e5c49'];

const TANZANIA_CENTER: [number, number] = [-6.369, 34.8888];
const TANZANIA_BOUNDS: L.LatLngBoundsExpression = [
  [-11.85, 29.25],
  [-0.85, 40.65],
];

/**
 * Internal controller that syncs external region/project selection with Leaflet camera bounds
 */
function MapViewportController({
  selectedProject,
  activeRegionName,
  geoJsonData,
  resetTrigger,
}: {
  selectedProject?: Project | null;
  activeRegionName: string | null;
  geoJsonData: TanzaniaRegionsFeatureCollection;
  resetTrigger: number;
}) {
  const map = useMap();

  useEffect(() => {
    if (resetTrigger > 0) {
      map.flyToBounds(TANZANIA_BOUNDS, {
        padding: [20, 20],
        duration: 0.9,
      });
    }
  }, [resetTrigger, map]);

  useEffect(() => {
    if (!activeRegionName) return;
    const match = geoJsonData.features.find(
      (f) =>
        f.properties.shapeName.toLowerCase() === activeRegionName.toLowerCase()
    );
    if (match) {
      try {
        const geoLayer = L.geoJSON(match as unknown as GeoJsonObject);
        const bounds = geoLayer.getBounds();
        if (bounds.isValid()) {
          map.flyToBounds(bounds, {
            padding: [36, 36],
            maxZoom: 8,
            duration: 0.85,
          });
        }
      } catch {
        // Ignore invalid bounds
      }
    }
  }, [activeRegionName, geoJsonData, map]);

  useEffect(() => {
    if (!selectedProject) return;
    map.flyTo([selectedProject.lat, selectedProject.lng], Math.max(map.getZoom(), 7), {
      duration: 0.75,
    });
  }, [selectedProject, map]);

  return null;
}

export interface TanzaniaMapProps {
  projects?: Project[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  selectedRegion?: string | null;
  onSelectRegion?: (regionName: string | null) => void;
  variant?: 'light' | 'dark';
  className?: string;
  heightClass?: string;
}

export default function TanzaniaMap({
  projects = PROJECTS,
  selectedId,
  onSelect,
  selectedRegion = null,
  onSelectRegion,
  variant = 'dark',
  className = '',
  heightClass = 'h-[580px]',
}: TanzaniaMapProps) {
  const { t, localizeProject } = useI18n();
  const [isMounted, setIsMounted] = useState(false);
  const [geoJsonData, setGeoJsonData] =
    useState<TanzaniaRegionsFeatureCollection>(TANZANIA_ADM1_FALLBACK_GEOJSON);
  const [boundarySource, setBoundarySource] = useState<
    'ADM1 Embedded' | 'geoBoundaries ADM1 High-Res'
  >('ADM1 Embedded');
  const [hoveredRegion, setHoveredRegion] =
    useState<TanzaniaRegionProperties | null>(null);
  const [activeRegion, setActiveRegion] = useState<string | null>(
    selectedRegion
  );
  const [showRegionLabels, setShowRegionLabels] = useState<boolean>(true);
  const [resetCounter, setResetCounter] = useState(0);
  const geoJsonLayerRef = useRef<L.GeoJSON | null>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (selectedRegion !== undefined) {
      setActiveRegion(selectedRegion);
    }
  }, [selectedRegion]);

  // Fetch high-precision official Level-1 administrative GeoJSON boundaries for Tanzania
  useEffect(() => {
    let cancelled = false;

    async function loadOfficialAdm1Boundaries() {
      try {
        const res = await fetch(TANZANIA_GEOBOUNDARIES_ADM1_URL);
        if (!res.ok) return;
        const raw = (await res.json()) as {
          type?: string;
          features?: Array<{
            type: 'Feature';
            properties?: Record<string, unknown>;
            geometry: TanzaniaRegionsFeatureCollection['features'][number]['geometry'];
          }>;
        };

        if (
          !cancelled &&
          raw &&
          Array.isArray(raw.features) &&
          raw.features.length >= 20
        ) {
          const enrichedFeatures = raw.features.map((feat) => {
            const rawName = String(
              feat.properties?.shapeName ||
                feat.properties?.NAME_1 ||
                feat.properties?.name ||
                'Dodoma'
            );
            return {
              type: 'Feature' as const,
              properties: resolveRegionMetadata(rawName),
              geometry: feat.geometry,
            };
          });

          setGeoJsonData({
            type: 'FeatureCollection',
            features: enrichedFeatures,
          });
          setBoundarySource('geoBoundaries ADM1 High-Res');
        }
      } catch {
        // Fallback 31-region ADM1 GeoJSON remains active
      }
    }

    void loadOfficialAdm1Boundaries();
    return () => {
      cancelled = true;
    };
  }, []);

  // Count active listings per region
  const projectCountsByRegion = useMemo(() => {
    const map = new Map<string, number>();
    projects.forEach((p) => {
      map.set(p.region, (map.get(p.region) ?? 0) + 1);
    });
    return map;
  }, [projects]);

  const selectedProjectObj = useMemo(
    () => projects.find((p) => p.id === selectedId) ?? null,
    [projects, selectedId]
  );

  const activeRegionMeta = useMemo(() => {
    if (!activeRegion) return null;
    return resolveRegionMetadata(activeRegion);
  }, [activeRegion]);

  const handleResetView = useCallback(() => {
    setActiveRegion(null);
    setHoveredRegion(null);
    onSelectRegion?.(null);
    setResetCounter((c) => c + 1);
  }, [onSelectRegion]);

  // Dynamic polygon styling matching classic dark engineering & gold/amber borders (#d97706)
  const styleFeature = useCallback(
    (feature?: Feature): L.PathOptions => {
      const regionName = String(
        (feature?.properties as TanzaniaRegionProperties | undefined)
          ?.shapeName ?? ''
      );
      const isSelected =
        activeRegion !== null &&
        activeRegion.toLowerCase() === regionName.toLowerCase();
      const isHovered =
        hoveredRegion !== null &&
        hoveredRegion.shapeName.toLowerCase() === regionName.toLowerCase();
      const regionProjects = projectCountsByRegion.get(regionName) ?? 0;

      if (isSelected) {
        return {
          fillColor: '#d97706', // Rich amber-600 highlight
          fillOpacity: 0.42,
          color: '#fbbf24', // Gold border highlight
          weight: 2.6,
          opacity: 1,
        };
      }

      if (isHovered) {
        return {
          fillColor: '#d97706',
          fillOpacity: 0.3,
          color: '#fbbf24',
          weight: 2.2,
          opacity: 1,
        };
      }

      return {
        fillColor: regionProjects > 0 ? '#1e293b' : '#151922', // Slate-800 / deep basalt fill
        fillOpacity: regionProjects > 0 ? 0.62 : 0.45,
        color: '#d97706', // Classic gold/amber regional border (#d97706)
        weight: 1.35,
        opacity: 0.82,
      };
    },
    [activeRegion, hoveredRegion, projectCountsByRegion]
  );

  // Bind hover tooltip, highlight states, and click-to-zoom bounding box per region ("Mkoa")
  const onEachRegionFeature = useCallback(
    (feature: Feature, layer: L.Layer) => {
      const props = feature.properties as TanzaniaRegionProperties;
      if (!props || !props.shapeName) return;

      const projectCount = projectCountsByRegion.get(props.shapeName) ?? 0;
      const mineralsList = (props.keyMinerals || []).slice(0, 3).join(' · ');

      const tooltipHtml = `
        <div style="min-width: 190px;">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
            <span style="font-family:var(--font-mono);font-size:10px;text-transform:uppercase;letter-spacing:0.12em;color:#d6a443;">
              MKOA WA ${props.shapeName.toUpperCase()} (${props.regionCode})
            </span>
          </div>
          <div style="font-family:var(--font-display);font-size:16px;font-weight:600;color:#f6f1e7;margin-top:2px;">
            ${props.shapeName} Region
          </div>
          <div style="font-size:11px;color:rgba(246,241,231,0.75);margin-top:2px;">
            Capital: <strong style="color:#f6f1e7;">${props.capital}</strong> · ${props.zone}
          </div>
          <div style="margin-top:6px;padding-top:6px;border-top:1px solid rgba(214,164,67,0.25);font-family:var(--font-mono);font-size:10px;color:#d6a443;">
            Minerals: ${mineralsList}
          </div>
          <div style="margin-top:3px;font-family:var(--font-mono);font-size:10px;color:rgba(246,241,231,0.7);">
            ${projectCount} Active Platform Listing${projectCount === 1 ? '' : 's'} · Click to Zoom
          </div>
        </div>
      `;

      layer.bindTooltip(tooltipHtml, {
        sticky: true,
        direction: 'top',
        offset: [0, -10],
        className: 'mineconnect-leaflet-tooltip',
      });

      layer.on({
        mouseover: (e: L.LeafletEvent) => {
          const target = e.target as L.Path;
          setHoveredRegion(props);
          target.setStyle({
            fillColor: '#d97706',
            fillOpacity: 0.34,
            color: '#fbbf24',
            weight: 2.4,
            opacity: 1,
          });
          target.bringToFront();
        },
        mouseout: (e: L.LeafletEvent) => {
          setHoveredRegion((prev) =>
            prev?.shapeName === props.shapeName ? null : prev
          );
          const target = e.target as L.Path;
          target.setStyle(styleFeature(feature));
        },
        click: (e: L.LeafletEvent) => {
          const target = e.target as L.Polygon;
          const nextRegion =
            activeRegion?.toLowerCase() === props.shapeName.toLowerCase()
              ? null
              : props.shapeName;
          setActiveRegion(nextRegion);
          onSelectRegion?.(nextRegion);

          const mapInstance = (target as unknown as { _map?: L.Map })._map;
          if (mapInstance && nextRegion) {
            const bounds = target.getBounds();
            if (bounds.isValid()) {
              mapInstance.fitBounds(bounds, {
                padding: [36, 36],
                maxZoom: 8,
                animate: true,
              });
            }
          }
        },
      });
    },
    [activeRegion, onSelectRegion, projectCountsByRegion, styleFeature]
  );

  // Re-key GeoJSON layer when data or active state updates so styles refresh cleanly
  const geoJsonKey = useMemo(
    () =>
      `${boundarySource}-${geoJsonData.features.length}-${activeRegion ?? 'all'}-${projects.length}`,
    [boundarySource, geoJsonData.features.length, activeRegion, projects.length]
  );

  const displayedRegionInfo = hoveredRegion ?? activeRegionMeta;

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-gold/25 bg-ink text-paper shadow-2xl ${className}`}
      role="region"
      aria-label={t('map.ariaLabel')}
    >
      {/* Top Glassmorphism GIS Status & Regional Telemetry Overlay */}
      <div className="pointer-events-none absolute inset-x-3 top-3 z-[500] flex flex-wrap items-start justify-between gap-2.5">
        <div className="pointer-events-auto flex flex-wrap items-center gap-2 rounded-xl border border-gold/35 bg-ink/85 px-3.5 py-2 shadow-lg backdrop-blur-md">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-gold opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-gold" />
          </span>
          <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-gold">
            Interactive GIS · 31 Mikoa ADM1
          </span>
          <span className="hidden text-paper/30 sm:inline">|</span>
          <span className="hidden font-mono text-[10px] text-paper/75 sm:inline">
            {boundarySource}
          </span>
        </div>

        {/* Interactive Region Quick-Select & Reset Controls */}
        <div className="pointer-events-auto flex flex-wrap items-center gap-2">
          <select
            aria-label="Jump to Tanzanian Region (Mkoa)"
            value={activeRegion ?? ''}
            onChange={(e) => {
              const val = e.target.value || null;
              setActiveRegion(val);
              onSelectRegion?.(val);
              if (!val) {
                setResetCounter((c) => c + 1);
              }
            }}
            className="h-8 rounded-lg border border-gold/35 bg-ink/90 px-2.5 font-mono text-[11px] text-paper outline-none backdrop-blur-md transition focus:border-gold"
          >
            <option value="">All 31 Regions (Mikoa)</option>
            {geoJsonData.features
              .map((f) => f.properties.shapeName)
              .sort((a, b) => a.localeCompare(b))
              .map((name) => (
                <option key={name} value={name}>
                  {name} ({projectCountsByRegion.get(name) ?? 0})
                </option>
              ))}
          </select>

          <button
            type="button"
            onClick={() => setShowRegionLabels((s) => !s)}
            className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 font-mono text-[10px] font-semibold uppercase tracking-wider backdrop-blur-md transition ${
              showRegionLabels
                ? 'border-gold/45 bg-ochre/30 text-gold'
                : 'border-paper/20 bg-ink/85 text-paper/70 hover:text-paper'
            }`}
            title="Toggle Regional Labels"
          >
            <Layers size={12} />
            <span className="hidden sm:inline">Labels</span>
          </button>

          <button
            type="button"
            onClick={handleResetView}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-gold/35 bg-ink/90 px-2.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-gold backdrop-blur-md transition hover:bg-ochre/30 hover:text-paper"
            title="Reset Tanzania Bounds"
          >
            <RotateCcw size={12} />
            <span>Reset View</span>
          </button>
        </div>
      </div>

      {/* Bottom-Left Live Region Telemetry Pill */}
      {displayedRegionInfo && (
        <div className="pointer-events-none absolute bottom-4 left-3 z-[500] max-w-xs sm:max-w-sm">
          <div className="pointer-events-auto rounded-xl border border-gold/40 bg-ink/90 p-3.5 shadow-xl backdrop-blur-md">
            <div className="flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-1 font-mono text-[10px] font-semibold uppercase tracking-wider text-gold">
                <Sparkles size={11} />
                {displayedRegionInfo.regionCode} · {displayedRegionInfo.zone}
              </span>
              {activeRegion && (
                <button
                  type="button"
                  onClick={handleResetView}
                  className="font-mono text-[10px] text-paper/60 underline hover:text-gold"
                >
                  Clear Zoom
                </button>
              )}
            </div>
            <div className="mt-1 flex items-baseline justify-between gap-3">
              <h4 className="font-display text-lg font-medium text-paper">
                Mkoa wa {displayedRegionInfo.shapeName}
              </h4>
              <span className="font-mono text-[11px] text-paper/70">
                HQ: {displayedRegionInfo.capital}
              </span>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {displayedRegionInfo.keyMinerals.map((m) => (
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
      )}

      {/* Main Interactive Leaflet Map Canvas (SSR-safe) */}
      <div className={`w-full ${heightClass}`}>
        {!isMounted ? (
          <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-ink-2 p-8 text-center">
            <Compass size={28} className="animate-spin text-gold" />
            <div className="font-mono text-xs uppercase tracking-widest text-gold">
              Initializing Tanzania Regional GIS Engine (31 Mikoa)...
            </div>
          </div>
        ) : (
          <MapContainer
            center={TANZANIA_CENTER}
            zoom={6}
            minZoom={5}
            maxZoom={12}
            scrollWheelZoom={true}
            zoomControl={false}
            className="h-full w-full"
            style={{
              height: '100%',
              width: '100%',
              background: variant === 'dark' ? '#0f141c' : '#15120f',
            }}
          >
            {/* Classic CartoDB Dark Matter Basemap Tile Layer */}
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a> · geoBoundaries ADM1'
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              subdomains="abcd"
              maxZoom={19}
            />

            {/* Level-1 Administrative Boundaries ("Mikoa") GeoJSON Polygon Layer */}
            <LeafletGeoJSON
              key={geoJsonKey}
              ref={(ref) => {
                geoJsonLayerRef.current = ref;
              }}
              data={geoJsonData as unknown as GeoJsonObject}
              style={styleFeature}
              onEachFeature={onEachRegionFeature}
            />

            {/* Regional Name Labels at Each Mkoa Centroid */}
            {showRegionLabels &&
              geoJsonData.features.map((feat) => {
                const { shapeName, center } = feat.properties;
                if (!center || center.length < 2) return null;
                return (
                  <CircleMarker
                    key={`label-${shapeName}`}
                    center={center}
                    radius={1}
                    pathOptions={{
                      opacity: 0,
                      fillOpacity: 0,
                    }}
                    interactive={false}
                  >
                    <Tooltip
                      permanent
                      direction="center"
                      className="mineconnect-region-label"
                    >
                      {shapeName}
                    </Tooltip>
                  </CircleMarker>
                );
              })}

            {/* Verified Opportunity Project Markers */}
            {projects.map((raw) => {
              const p = localizeProject(raw);
              const isSelected = p.id === selectedId;
              const color = LEVEL_COLOR[p.verification.level] ?? '#d6a443';

              return (
                <CircleMarker
                  key={p.id}
                  center={[p.lat, p.lng]}
                  radius={isSelected ? 10 : 7}
                  pathOptions={{
                    fillColor: color,
                    fillOpacity: 0.95,
                    color: isSelected ? '#ffffff' : '#15120f',
                    weight: isSelected ? 3 : 2,
                  }}
                  eventHandlers={{
                    click: () => {
                      onSelect?.(p.id);
                      setActiveRegion(p.region);
                      onSelectRegion?.(p.region);
                    },
                  }}
                >
                  <Tooltip
                    direction="top"
                    offset={[0, -8]}
                    className="mineconnect-leaflet-tooltip"
                  >
                    <div className="space-y-1">
                      <div className="font-mono text-[10px] uppercase tracking-wider text-gold">
                        {p.id} · Level L{p.verification.level} · {p.region}
                      </div>
                      <div className="font-display text-sm font-semibold text-paper">
                        {p.title}
                      </div>
                      <div className="font-mono text-[11px] text-paper/80">
                        {p.minerals.join(', ')} · Seeking{' '}
                        <strong className="text-gold">
                          {formatUsd(p.investmentUsd)}
                        </strong>
                      </div>
                    </div>
                  </Tooltip>
                </CircleMarker>
              );
            })}

            <MapViewportController
              selectedProject={selectedProjectObj}
              activeRegionName={activeRegion}
              geoJsonData={geoJsonData}
              resetTrigger={resetCounter}
            />
          </MapContainer>
        )}
      </div>

      {/* Bottom Interactive Status Strip */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gold/20 bg-ink-2 px-4 py-2.5 font-mono text-[11px] text-paper/70">
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-1.5 text-gold">
            <MapPin size={12} />
            {activeRegion
              ? `Filtered Region: Mkoa wa ${activeRegion}`
              : 'All 31 Tanzanian Regions (Mikoa) Active'}
          </span>
          <span className="text-paper/30">·</span>
          <span>
            {projects.length} Mapped Opportunities
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-paper/55">
          <Maximize2 size={11} className="text-gold" />
          <span>Scroll to zoom · Hover region for dossier · Click region to fit bounds</span>
        </div>
      </div>
    </div>
  );
}

export function MapLegend({ dark = false }: { dark?: boolean }) {
  const { t } = useI18n();
  const labels = [
    t('map.legend.l0'),
    t('map.legend.l1'),
    t('map.legend.l2'),
    t('map.legend.l3'),
    t('map.legend.l4'),
  ];
  return (
    <ul
      className={`flex flex-wrap items-center gap-x-4 gap-y-2 font-mono text-[10px] uppercase tracking-wider ${
        dark ? 'text-paper/70' : 'text-stone'
      }`}
    >
      <li className="flex items-center gap-1.5">
        <span
          className="h-2.5 w-3.5 shrink-0 rounded-xs border border-[#d97706] bg-[#1e293b]"
          aria-hidden="true"
        />
        <span>ADM1 Mkoa Boundary (#d97706)</span>
      </li>
      {labels.map((l, i) => (
        <li key={l} className="flex items-center gap-1.5">
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ background: LEVEL_COLOR[i] }}
          />
          {l}
        </li>
      ))}
    </ul>
  );
}
