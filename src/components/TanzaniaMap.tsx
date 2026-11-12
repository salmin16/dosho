import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  TANZANIA_ADM1_GEOJSON,
  resolveRegionMetadata,
  type TanzaniaRegionProperties,
} from '../data/tanzaniaRegionsGeoJson';
import { useI18n } from '../i18n';

const LEVEL_COLOR = ['#9a8f82', '#c9a35c', '#d6a443', '#c0612b', '#3e5c49'];

const TANZANIA_BOUNDS: L.LatLngBoundsExpression = [
  [-11.75, 29.3],
  [-0.95, 40.55],
];

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
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const geoJsonLayerRef = useRef<L.GeoJSON | null>(null);
  const labelsLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const markersLayerGroupRef = useRef<L.LayerGroup | null>(null);

  const [isMounted, setIsMounted] = useState(false);
  const [hoveredRegion, setHoveredRegion] =
    useState<TanzaniaRegionProperties | null>(null);
  const [activeRegion, setActiveRegion] = useState<string | null>(
    selectedRegion
  );
  const [showRegionLabels, setShowRegionLabels] = useState<boolean>(true);

  // Keep latest callbacks in refs so Leaflet event listeners never go stale
  const activeRegionRef = useRef<string | null>(activeRegion);
  activeRegionRef.current = activeRegion;
  const onSelectRegionRef = useRef(onSelectRegion);
  onSelectRegionRef.current = onSelectRegion;
  const onSelectProjectRef = useRef(onSelect);
  onSelectProjectRef.current = onSelect;

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Count active listings per region
  const projectCountsByRegion = useMemo(() => {
    const map = new Map<string, number>();
    projects.forEach((p) => {
      map.set(p.region, (map.get(p.region) ?? 0) + 1);
    });
    return map;
  }, [projects]);

  const projectCountsRef = useRef(projectCountsByRegion);
  projectCountsRef.current = projectCountsByRegion;

  const getRegionStyle = useCallback(
    (regionName: string, isHovered = false): L.PathOptions => {
      const currentActive = activeRegionRef.current;
      const isSelected =
        currentActive !== null &&
        currentActive.toLowerCase() === regionName.toLowerCase();
      const regionProjects = projectCountsRef.current.get(regionName) ?? 0;

      if (isSelected) {
        return {
          fillColor: '#d97706',
          fillOpacity: 0.44,
          color: '#fbbf24',
          weight: 2.6,
          opacity: 1,
        };
      }

      if (isHovered) {
        return {
          fillColor: '#d97706',
          fillOpacity: 0.32,
          color: '#fbbf24',
          weight: 2.2,
          opacity: 1,
        };
      }

      return {
        fillColor: regionProjects > 0 ? '#1e293b' : '#131822',
        fillOpacity: regionProjects > 0 ? 0.65 : 0.48,
        color: '#d97706', // Classic gold/amber regional border (#d97706)
        weight: 1.35,
        opacity: 0.85,
      };
    },
    []
  );

  // Initialize Leaflet Map instance once on client mount
  useEffect(() => {
    if (!isMounted || !mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [-6.369, 34.8888],
      zoom: 6,
      minZoom: 5,
      maxZoom: 12,
      scrollWheelZoom: true,
      zoomControl: false,
      attributionControl: true,
    });

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // Classic CartoDB Dark Matter basemap tiles
    L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
      {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a> · Tanzania ADM1 GIS',
        subdomains: 'abcd',
        maxZoom: 19,
      }
    ).addTo(map);

    // Create Official 31-Region ("Mikoa") GeoJSON Polygon Layer
    const geoLayer = L.geoJSON(
      TANZANIA_ADM1_GEOJSON as unknown as GeoJsonObject,
      {
        style: (feature?: Feature) => {
          const name = String(
            (feature?.properties as TanzaniaRegionProperties | undefined)
              ?.shapeName ?? ''
          );
          return getRegionStyle(name, false);
        },
        onEachFeature: (feature: Feature, layer: L.Layer) => {
          const props = feature.properties as TanzaniaRegionProperties;
          if (!props || !props.shapeName) return;

          const count = projectCountsRef.current.get(props.shapeName) ?? 0;
          const mineralsList = (props.keyMinerals || []).slice(0, 3).join(' · ');

          const tooltipHtml = `
            <div style="min-width: 195px;">
              <div style="font-family:var(--font-mono);font-size:10px;text-transform:uppercase;letter-spacing:0.12em;color:#d6a443;">
                MKOA WA ${props.shapeName.toUpperCase()} (${props.regionCode})
              </div>
              <div style="font-family:var(--font-display);font-size:16px;font-weight:600;color:#f6f1e7;margin-top:2px;">
                ${props.shapeName} Region
              </div>
              <div style="font-size:11px;color:rgba(246,241,231,0.78);margin-top:2px;">
                Capital: <strong style="color:#f6f1e7;">${props.capital}</strong> · ${props.zone}
              </div>
              <div style="margin-top:6px;padding-top:6px;border-top:1px solid rgba(214,164,67,0.28);font-family:var(--font-mono);font-size:10px;color:#d6a443;">
                Minerals: ${mineralsList}
              </div>
              <div style="margin-top:3px;font-family:var(--font-mono);font-size:10px;color:rgba(246,241,231,0.7);">
                ${count} Active Platform Listing${count === 1 ? '' : 's'} · Click to Zoom
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
              const pathLayer = e.target as L.Path;
              setHoveredRegion(props);
              pathLayer.setStyle(getRegionStyle(props.shapeName, true));
              pathLayer.bringToFront();
              markersLayerGroupRef.current?.eachLayer((m) => {
                if ('bringToFront' in m && typeof m.bringToFront === 'function') {
                  m.bringToFront();
                }
              });
            },
            mouseout: (e: L.LeafletEvent) => {
              const pathLayer = e.target as L.Path;
              setHoveredRegion((prev) =>
                prev?.shapeName === props.shapeName ? null : prev
              );
              pathLayer.setStyle(getRegionStyle(props.shapeName, false));
            },
            click: (e: L.LeafletEvent) => {
              const polyLayer = e.target as L.Polygon;
              const currentlyActive = activeRegionRef.current;
              const isSame =
                currentlyActive !== null &&
                currentlyActive.toLowerCase() === props.shapeName.toLowerCase();
              const nextRegion = isSame ? null : props.shapeName;

              activeRegionRef.current = nextRegion;
              setActiveRegion(nextRegion);
              onSelectRegionRef.current?.(nextRegion);

              if (nextRegion) {
                const bounds = polyLayer.getBounds();
                if (bounds.isValid()) {
                  map.flyToBounds(bounds, {
                    padding: [40, 40],
                    maxZoom: 8,
                    duration: 0.85,
                  });
                }
              } else {
                map.flyToBounds(TANZANIA_BOUNDS, {
                  padding: [20, 20],
                  duration: 0.85,
                });
              }
            },
          });
        },
      }
    ).addTo(map);

    const labelsGroup = L.layerGroup().addTo(map);
    const markersGroup = L.layerGroup().addTo(map);

    geoJsonLayerRef.current = geoLayer;
    labelsLayerGroupRef.current = labelsGroup;
    markersLayerGroupRef.current = markersGroup;
    mapInstanceRef.current = map;

    // Fit full Tanzania bounds on initial mount
    map.fitBounds(TANZANIA_BOUNDS, { padding: [18, 18] });

    // Ensure container size is recalculated cleanly after layout
    const timer = window.setTimeout(() => {
      map.invalidateSize();
    }, 150);

    return () => {
      window.clearTimeout(timer);
      map.remove();
      mapInstanceRef.current = null;
      geoJsonLayerRef.current = null;
      labelsLayerGroupRef.current = null;
      markersLayerGroupRef.current = null;
    };
  }, [isMounted, getRegionStyle]);

  // Sync external `selectedRegion` prop changes and fly to that region's polygon bounds
  useEffect(() => {
    setActiveRegion(selectedRegion ?? null);
    activeRegionRef.current = selectedRegion ?? null;

    const map = mapInstanceRef.current;
    const geoLayer = geoJsonLayerRef.current;
    if (!map || !geoLayer) return;

    // Update all polygon styles
    geoLayer.eachLayer((layer) => {
      const feat = (layer as L.Layer & { feature?: Feature }).feature;
      const name = String(
        (feat?.properties as TanzaniaRegionProperties | undefined)?.shapeName ??
          ''
      );
      if ('setStyle' in layer && typeof layer.setStyle === 'function') {
        (layer as L.Path).setStyle(getRegionStyle(name, false));
      }
    });

    if (selectedRegion) {
      geoLayer.eachLayer((layer) => {
        const feat = (layer as L.Layer & { feature?: Feature }).feature;
        const name = String(
          (feat?.properties as TanzaniaRegionProperties | undefined)
            ?.shapeName ?? ''
        );
        if (
          name.toLowerCase() === selectedRegion.toLowerCase() &&
          'getBounds' in layer &&
          typeof (layer as L.Polygon).getBounds === 'function'
        ) {
          const bounds = (layer as L.Polygon).getBounds();
          if (bounds.isValid()) {
            map.flyToBounds(bounds, {
              padding: [40, 40],
              maxZoom: 8,
              duration: 0.85,
            });
          }
        }
      });
    }
  }, [selectedRegion, getRegionStyle]);

  // Refresh polygon styles whenever activeRegion or project counts change
  useEffect(() => {
    const geoLayer = geoJsonLayerRef.current;
    if (!geoLayer) return;
    geoLayer.eachLayer((layer) => {
      const feat = (layer as L.Layer & { feature?: Feature }).feature;
      const name = String(
        (feat?.properties as TanzaniaRegionProperties | undefined)?.shapeName ??
          ''
      );
      if ('setStyle' in layer && typeof layer.setStyle === 'function') {
        (layer as L.Path).setStyle(getRegionStyle(name, false));
      }
    });
  }, [activeRegion, projectCountsByRegion, getRegionStyle]);

  // Render crisp regional name labels using lightweight L.divIcon markers
  useEffect(() => {
    const labelsGroup = labelsLayerGroupRef.current;
    if (!labelsGroup) return;
    labelsGroup.clearLayers();

    if (!showRegionLabels) return;

    TANZANIA_ADM1_GEOJSON.features.forEach((feat) => {
      const { shapeName, center } = feat.properties;
      if (!center || center.length < 2) return;
      const isSelected =
        activeRegion !== null &&
        activeRegion.toLowerCase() === shapeName.toLowerCase();

      const icon = L.divIcon({
        className: 'mineconnect-region-divicon',
        html: `<span style="
          display:inline-block;
          transform:translate(-50%, -50%);
          font-family:var(--font-mono);
          font-size:${isSelected ? '11px' : '9.5px'};
          font-weight:${isSelected ? '700' : '600'};
          letter-spacing:0.06em;
          text-transform:uppercase;
          white-space:nowrap;
          color:${isSelected ? '#fbbf24' : 'rgba(246, 241, 231, 0.78)'};
          text-shadow:0 1px 3px rgba(0,0,0,0.95), 0 0 6px rgba(0,0,0,0.9);
          pointer-events:none;
        ">${shapeName}</span>`,
        iconSize: [0, 0],
      });

      L.marker(center, { icon, interactive: false }).addTo(labelsGroup);
    });
  }, [isMounted, showRegionLabels, activeRegion]);

  // Render verified project markers (`L.circleMarker`)
  useEffect(() => {
    const markersGroup = markersLayerGroupRef.current;
    if (!markersGroup) return;
    markersGroup.clearLayers();

    projects.forEach((raw) => {
      const p = localizeProject(raw);
      const isSelected = p.id === selectedId;
      const color = LEVEL_COLOR[p.verification.level] ?? '#d6a443';

      const marker = L.circleMarker([p.lat, p.lng], {
        radius: isSelected ? 10 : 7,
        fillColor: color,
        fillOpacity: 0.95,
        color: isSelected ? '#ffffff' : '#15120f',
        weight: isSelected ? 3 : 2,
      });

      const tooltipHtml = `
        <div style="min-width: 180px;">
          <div style="font-family:var(--font-mono);font-size:10px;text-transform:uppercase;letter-spacing:0.1em;color:#d6a443;">
            ${p.id} · Level L${p.verification.level} · ${p.region}
          </div>
          <div style="font-family:var(--font-display);font-size:14px;font-weight:600;color:#f6f1e7;margin-top:2px;">
            ${p.title}
          </div>
          <div style="font-family:var(--font-mono);font-size:11px;color:rgba(246,241,231,0.82);margin-top:3px;">
            ${p.minerals.join(', ')} · Seeking <strong style="color:#d6a443;">${formatUsd(
              p.investmentUsd
            )}</strong>
          </div>
        </div>
      `;

      marker.bindTooltip(tooltipHtml, {
        direction: 'top',
        offset: [0, -8],
        className: 'mineconnect-leaflet-tooltip',
      });

      marker.on('click', () => {
        onSelectProjectRef.current?.(p.id);
        activeRegionRef.current = p.region;
        setActiveRegion(p.region);
        onSelectRegionRef.current?.(p.region);
        mapInstanceRef.current?.flyTo([p.lat, p.lng], 8, { duration: 0.75 });
      });

      marker.addTo(markersGroup);
    });
  }, [isMounted, projects, selectedId, localizeProject]);

  const activeRegionMeta = useMemo(() => {
    if (!activeRegion) return null;
    return resolveRegionMetadata(activeRegion);
  }, [activeRegion]);

  const handleResetView = useCallback(() => {
    activeRegionRef.current = null;
    setActiveRegion(null);
    setHoveredRegion(null);
    onSelectRegionRef.current?.(null);
    mapInstanceRef.current?.flyToBounds(TANZANIA_BOUNDS, {
      padding: [20, 20],
      duration: 0.85,
    });
  }, []);

  const handleSelectRegionFromDropdown = (val: string | null) => {
    activeRegionRef.current = val;
    setActiveRegion(val);
    onSelectRegionRef.current?.(val);

    const map = mapInstanceRef.current;
    const geoLayer = geoJsonLayerRef.current;
    if (!map || !geoLayer) return;

    if (!val) {
      map.flyToBounds(TANZANIA_BOUNDS, { padding: [20, 20], duration: 0.85 });
      return;
    }

    geoLayer.eachLayer((layer) => {
      const feat = (layer as L.Layer & { feature?: Feature }).feature;
      const name = String(
        (feat?.properties as TanzaniaRegionProperties | undefined)?.shapeName ??
          ''
      );
      if (
        name.toLowerCase() === val.toLowerCase() &&
        'getBounds' in layer &&
        typeof (layer as L.Polygon).getBounds === 'function'
      ) {
        const bounds = (layer as L.Polygon).getBounds();
        if (bounds.isValid()) {
          map.flyToBounds(bounds, {
            padding: [40, 40],
            maxZoom: 8,
            duration: 0.85,
          });
        }
      }
    });
  };

  const displayedRegionInfo = hoveredRegion ?? activeRegionMeta;

  return (
    <div
      className={`relative isolate z-0 overflow-hidden rounded-2xl border border-gold/25 bg-ink text-paper shadow-2xl ${className}`}
      role="region"
      aria-label={t('map.ariaLabel')}
    >
      {/* Top Glassmorphism GIS Status & Regional Telemetry Overlay */}
      <div className="pointer-events-none absolute inset-x-3 top-3 z-[500] flex flex-wrap items-start justify-between gap-2.5">
        <div className="pointer-events-auto flex flex-wrap items-center gap-2 rounded-xl border border-gold/35 bg-ink/90 px-3.5 py-2 shadow-lg backdrop-blur-md">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-gold opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-gold" />
          </span>
          <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-gold">
            Interactive GIS · 31 Mikoa ADM1
          </span>
          <span className="hidden text-paper/30 sm:inline">|</span>
          <span className="hidden font-mono text-[10px] text-paper/75 sm:inline">
            GADM 4.1 Official Boundaries
          </span>
        </div>

        {/* Interactive Region Quick-Select & Reset Controls */}
        <div className="pointer-events-auto flex flex-wrap items-center gap-2">
          <select
            aria-label="Jump to Tanzanian Region (Mkoa)"
            value={activeRegion ?? ''}
            onChange={(e) =>
              handleSelectRegionFromDropdown(e.target.value || null)
            }
            className="h-8 rounded-lg border border-gold/35 bg-ink/90 px-2.5 font-mono text-[11px] text-paper outline-none backdrop-blur-md transition focus:border-gold"
          >
            <option value="">All 31 Regions (Mikoa)</option>
            {TANZANIA_ADM1_GEOJSON.features
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
        <div className="pointer-events-none absolute bottom-12 left-3 z-[500] max-w-xs sm:max-w-sm">
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

      {/* Main Interactive Leaflet Map Canvas */}
      <div className={`relative w-full ${heightClass}`}>
        {!isMounted && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-ink-2 p-8 text-center">
            <Compass size={28} className="animate-spin text-gold" />
            <div className="font-mono text-xs uppercase tracking-widest text-gold">
              Initializing Tanzania Regional GIS Engine (31 Mikoa)...
            </div>
          </div>
        )}
        <div
          ref={mapContainerRef}
          className="h-full w-full"
          style={{
            height: '100%',
            width: '100%',
            background: variant === 'dark' ? '#0f141c' : '#15120f',
          }}
        />
      </div>

      {/* Bottom Interactive Status Strip */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gold/20 bg-ink-2 px-4 py-2.5 font-mono text-[11px] text-paper/70">
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-1.5 text-gold">
            <MapPin size={12} />
            {activeRegion
              ? `Active Region: Mkoa wa ${activeRegion}`
              : 'All 31 Tanzanian Regions (Mikoa) Visible'}
          </span>
          <span className="text-paper/30">·</span>
          <span>{projects.length} Mapped Opportunities</span>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-paper/55">
          <Maximize2 size={11} className="text-gold" />
          <span>
            Scroll to zoom · Hover region for dossier · Click region to fit bounds
          </span>
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
