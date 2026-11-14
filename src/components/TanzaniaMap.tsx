import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import type { Feature, GeoJsonObject } from 'geojson';
import 'leaflet/dist/leaflet.css';
import {
  Compass,
  Layers,
  MapPin,
  RotateCcw,
  Sparkles,
  X,
} from 'lucide-react';
import type { Project } from '../data/fixtures';
import { PROJECTS, formatUsd } from '../data/fixtures';
import {
  TANZANIA_ADM1_GEOJSON,
  resolveRegionMetadata,
  type TanzaniaRegionProperties,
} from '../data/tanzaniaRegionsGeoJson';
import { useLocalization } from '../context/LocalizationContext';

const LEVEL_COLOR = ['#9a8f82', '#c9a35c', '#d6a443', '#c0612b', '#3e5c49'];

const TANZANIA_BOUNDS: L.LatLngBoundsExpression = [
  [-11.75, 29.3],
  [-0.95, 40.55],
];

// Coastal/island regions whose labels only appear when zoomed in (zoom >= 7) to prevent crowding
const COMPACT_REGIONS = new Set([
  'Dar es Salaam',
  'Kilimanjaro',
  'Kaskazini Unguja',
  'Kusini Unguja',
  'Mjini Magharibi',
  'Kaskazini Pemba',
  'Kusini Pemba',
]);

/**
 * Watermark-free custom Leaflet Canvas GridLayer that renders a dark engineering
 * GIS coordinate grid and subtle bathymetric/topographic texture with zero external API keys.
 */
function createEngineeringGridLayer(): L.GridLayer {
  const GridLayerClass = L.GridLayer.extend({
    createTile: function (coords: L.Coords) {
      const tile = document.createElement('canvas');
      const size = this.getTileSize();
      tile.width = size.x;
      tile.height = size.y;
      const ctx = tile.getContext('2d');
      if (!ctx) return tile;

      // Deep basalt engineering background
      ctx.fillStyle = '#111318';
      ctx.fillRect(0, 0, size.x, size.y);

      // Subtle technical sub-grid
      ctx.strokeStyle = 'rgba(214, 164, 67, 0.045)';
      ctx.lineWidth = 1;
      const step = 64;
      for (let x = 0; x <= size.x; x += step) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, size.y);
        ctx.stroke();
      }
      for (let y = 0; y <= size.y; y += step) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(size.x, y);
        ctx.stroke();
      }

      // Primary tile border graticule
      ctx.strokeStyle = 'rgba(214, 164, 67, 0.09)';
      ctx.strokeRect(0, 0, size.x, size.y);

      // Subtle coordinate crosshairs at tile corners
      ctx.strokeStyle = 'rgba(214, 164, 67, 0.22)';
      ctx.beginPath();
      ctx.moveTo(0, 6);
      ctx.lineTo(0, 0);
      ctx.lineTo(6, 0);
      ctx.stroke();

      void coords;
      return tile;
    },
  });
  return new GridLayerClass();
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
  const { t, localizeProject, currency, rateForSelected, formatUsd: formatLocalizedUsd } =
    useLocalization();
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const geoJsonLayerRef = useRef<L.GeoJSON | null>(null);
  const labelsLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const markersLayerGroupRef = useRef<L.LayerGroup | null>(null);

  const [isMounted, setIsMounted] = useState(false);
  const [hoveredRegionName, setHoveredRegionName] = useState<string | null>(
    null
  );
  const [activeRegion, setActiveRegion] = useState<string | null>(
    selectedRegion
  );
  const [currentZoom, setCurrentZoom] = useState<number>(6);
  const [showRegionLabels, setShowRegionLabels] = useState<boolean>(true);

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
          fillOpacity: 0.48,
          color: '#fbbf24',
          weight: 2.5,
          opacity: 1,
        };
      }

      if (isHovered) {
        return {
          fillColor: '#c0612b',
          fillOpacity: 0.34,
          color: '#fbbf24',
          weight: 2,
          opacity: 1,
        };
      }

      return {
        fillColor: regionProjects > 0 ? '#1e2430' : '#171b24',
        fillOpacity: regionProjects > 0 ? 0.88 : 0.75,
        color: '#d97706', // Classic gold/amber regional border (#d97706)
        weight: 1.25,
        opacity: 0.85,
      };
    },
    []
  );

  // Initialize Leaflet Map instance once on client mount (zero API-key watermarks)
  useEffect(() => {
    if (!isMounted || !mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [-6.369, 34.8888],
      zoom: 6,
      minZoom: 5,
      maxZoom: 11,
      scrollWheelZoom: true,
      zoomControl: false,
      attributionControl: false, // Clean UI without watermark clutter
    });

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // 1. Watermark-free Engineering Coordinate Grid Layer
    createEngineeringGridLayer().addTo(map);

    // 2. Watermark-free OpenStreetMap geographic reference layer (dark-filtered via CSS)
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      opacity: 0.22,
      className: 'mineconnect-osm-dark-tiles',
    }).addTo(map);

    map.on('zoomend', () => {
      setCurrentZoom(map.getZoom());
    });

    // 3. Official 31-Region ("Mikoa") GeoJSON Polygon Layer
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

          // Keep hover super clean: no large popup following the mouse when panning!
          layer.on({
            mouseover: (e: L.LeafletEvent) => {
              const pathLayer = e.target as L.Path;
              setHoveredRegionName(props.shapeName);
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
              setHoveredRegionName((prev) =>
                prev === props.shapeName ? null : prev
              );
              pathLayer.setStyle(getRegionStyle(props.shapeName, false));
            },
            click: (e: L.LeafletEvent) => {
              L.DomEvent.stopPropagation(e);
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
                    padding: [48, 48],
                    maxZoom: 8,
                    duration: 0.8,
                  });
                }
              } else {
                map.flyToBounds(TANZANIA_BOUNDS, {
                  padding: [20, 20],
                  duration: 0.8,
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

    map.fitBounds(TANZANIA_BOUNDS, { padding: [18, 18] });

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

  // Sync external `selectedRegion` prop changes
  useEffect(() => {
    setActiveRegion(selectedRegion ?? null);
    activeRegionRef.current = selectedRegion ?? null;

    const map = mapInstanceRef.current;
    const geoLayer = geoJsonLayerRef.current;
    if (!map || !geoLayer) return;

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
              padding: [48, 48],
              maxZoom: 8,
              duration: 0.8,
            });
          }
        }
      });
    }
  }, [selectedRegion, getRegionStyle]);

  // Update polygon styles whenever activeRegion or projectCounts change
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

  // Render clean, non-overlapping regional name labels
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

      // Hide tiny island/coastal labels at low zoom unless specifically selected
      if (COMPACT_REGIONS.has(shapeName) && currentZoom < 7 && !isSelected) {
        return;
      }

      const icon = L.divIcon({
        className: 'mineconnect-region-divicon',
        html: `<span style="
          display:inline-block;
          transform:translate(-50%, -50%);
          font-family:var(--font-mono);
          font-size:${isSelected ? '11px' : '9px'};
          font-weight:${isSelected ? '700' : '600'};
          letter-spacing:0.06em;
          text-transform:uppercase;
          white-space:nowrap;
          color:${isSelected ? '#fbbf24' : 'rgba(246, 241, 231, 0.72)'};
          text-shadow:0 1px 3px rgba(0,0,0,0.95), 0 0 6px rgba(0,0,0,0.9);
          pointer-events:none;
        ">${shapeName}</span>`,
        iconSize: [0, 0],
      });

      L.marker(center, { icon, interactive: false }).addTo(labelsGroup);
    });
  }, [isMounted, showRegionLabels, activeRegion, currentZoom]);

  // Render verified project markers (`L.circleMarker`) — details open cleanly when clicked
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

      // Compact single-line label on hover; full details appear when clicked
      marker.bindTooltip(
        `<span style="font-family:var(--font-mono);font-size:10px;color:#fbbf24;font-weight:600;">${p.title} (${p.region}) · ${formatLocalizedUsd(p.investmentUsd)}</span>`,
        {
          direction: 'top',
          offset: [0, -8],
          className: 'mineconnect-leaflet-tooltip',
        }
      );

      marker.on('click', (e: L.LeafletEvent) => {
        L.DomEvent.stopPropagation(e);
        onSelectProjectRef.current?.(p.id);
        activeRegionRef.current = p.region;
        setActiveRegion(p.region);
        onSelectRegionRef.current?.(p.region);
        mapInstanceRef.current?.flyTo([p.lat, p.lng], 8, { duration: 0.75 });
      });

      marker.addTo(markersGroup);
    });
  }, [isMounted, projects, selectedId, localizeProject, currency, rateForSelected, formatLocalizedUsd]);

  // Organized details card ONLY appears when a region is actively CLICKED/SELECTED
  const clickedRegionMeta = useMemo(() => {
    if (!activeRegion) return null;
    return resolveRegionMetadata(activeRegion);
  }, [activeRegion]);

  const clickedRegionProjects = useMemo(() => {
    if (!activeRegion) return [];
    return projects.filter(
      (p) => p.region.toLowerCase() === activeRegion.toLowerCase()
    );
  }, [projects, activeRegion]);

  const handleResetView = useCallback(() => {
    activeRegionRef.current = null;
    setActiveRegion(null);
    setHoveredRegionName(null);
    onSelectRegionRef.current?.(null);
    mapInstanceRef.current?.flyToBounds(TANZANIA_BOUNDS, {
      padding: [20, 20],
      duration: 0.8,
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
      map.flyToBounds(TANZANIA_BOUNDS, { padding: [20, 20], duration: 0.8 });
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
            padding: [48, 48],
            maxZoom: 8,
            duration: 0.8,
          });
        }
      }
    });
  };

  return (
    <div
      className={`relative isolate z-0 overflow-hidden rounded-2xl border border-gold/25 bg-ink text-paper shadow-2xl ${className}`}
      role="region"
      aria-label={t('map.ariaLabel')}
    >
      {/* Top Bar: Clean Status Pill + Region Selector + Reset */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-gold/20 bg-ink-2 px-4 py-2.5">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-gold opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-gold" />
          </span>
          <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-gold">
            Tanzania Regional GIS (31 Mikoa)
          </span>
          {hoveredRegionName && (
            <span className="rounded border border-gold/30 bg-ochre/20 px-2 py-0.5 font-mono text-[10px] text-gold">
              Hover: {hoveredRegionName} (Click for details)
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Select a Tanzanian Region (Mkoa)"
            value={activeRegion ?? ''}
            onChange={(e) =>
              handleSelectRegionFromDropdown(e.target.value || null)
            }
            className="h-8 rounded-lg border border-gold/35 bg-ink px-2.5 font-mono text-[11px] text-paper outline-none transition focus:border-gold"
          >
            <option value="">Select Region (All 31 Mikoa)</option>
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
            className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 font-mono text-[10px] font-semibold uppercase tracking-wider transition ${
              showRegionLabels
                ? 'border-gold/45 bg-ochre/30 text-gold'
                : 'border-paper/20 bg-ink text-paper/70 hover:text-paper'
            }`}
            title="Toggle Regional Labels"
          >
            <Layers size={12} />
            <span className="hidden sm:inline">Labels</span>
          </button>

          {activeRegion && (
            <button
              type="button"
              onClick={handleResetView}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-gold/40 bg-ochre px-2.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-paper transition hover:bg-ochre-dark"
              title="Reset Tanzania Bounds"
            >
              <RotateCcw size={12} />
              <span>Reset Map</span>
            </button>
          )}
        </div>
      </div>

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
            background: variant === 'dark' ? '#111318' : '#15120f',
          }}
        />

        {/* Organized Clicked-Region Dossier Card (ONLY visible when a region is clicked) */}
        {clickedRegionMeta && (
          <div className="pointer-events-auto absolute bottom-4 left-4 z-[450] w-[calc(100%-2rem)] max-w-sm rounded-xl border border-gold/45 bg-ink/95 p-4 shadow-2xl backdrop-blur-md">
            <div className="flex items-start justify-between gap-3 border-b border-paper/10 pb-2.5">
              <div>
                <span className="inline-flex items-center gap-1 font-mono text-[10px] font-semibold uppercase tracking-wider text-gold">
                  <Sparkles size={11} />
                  {clickedRegionMeta.regionCode} · {clickedRegionMeta.zone}
                </span>
                <h4 className="font-display mt-0.5 text-xl font-medium text-paper">
                  Mkoa wa {clickedRegionMeta.shapeName}
                </h4>
              </div>
              <button
                type="button"
                onClick={handleResetView}
                className="rounded-md border border-paper/15 bg-paper/5 p-1 text-paper/70 transition hover:border-gold/40 hover:text-gold"
                title="Close Region Details & Reset Zoom"
              >
                <X size={14} />
              </button>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 rounded-lg border border-paper/10 bg-ink-2/90 p-2.5 font-mono text-[11px]">
              <div>
                <div className="text-[9px] uppercase text-paper/50">
                  Regional Capital
                </div>
                <div className="font-semibold text-paper">
                  {clickedRegionMeta.capital}
                </div>
              </div>
              <div>
                <div className="text-[9px] uppercase text-paper/50">
                  Platform Listings
                </div>
                <div className="font-semibold text-gold">
                  {clickedRegionProjects.length} Active (Est. ~
                  {clickedRegionMeta.activeLicencesEstimate} Licences)
                </div>
              </div>
            </div>

            <div className="mt-3">
              <div className="font-mono text-[10px] uppercase tracking-wider text-paper/55">
                Primary Mineral Endowments
              </div>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {clickedRegionMeta.keyMinerals.map((m) => (
                  <span
                    key={m}
                    className="rounded border border-gold/30 bg-ochre/20 px-2 py-0.5 font-mono text-[10px] text-gold"
                  >
                    {m}
                  </span>
                ))}
              </div>
            </div>

            {clickedRegionProjects.length > 0 && (
              <div className="mt-3 border-t border-paper/10 pt-2.5">
                <div className="font-mono text-[10px] uppercase tracking-wider text-paper/55">
                  Opportunities in {clickedRegionMeta.shapeName}
                </div>
                <ul className="mt-1.5 max-h-28 space-y-1 overflow-y-auto pr-1">
                  {clickedRegionProjects.map((rawProj) => {
                    const p = localizeProject(rawProj);
                    return (
                      <li key={p.id}>
                        <button
                          type="button"
                          onClick={() => onSelect?.(p.id)}
                          className="flex w-full items-center justify-between rounded bg-paper/5 px-2 py-1 text-left text-xs text-paper hover:bg-ochre/25 hover:text-gold"
                        >
                          <span className="truncate font-medium">
                            {p.title}
                          </span>
                          <span className="ml-2 shrink-0 font-mono text-[10px] text-gold">
                            {formatUsd(p.investmentUsd)}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom Interactive Status Strip */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gold/20 bg-ink-2 px-4 py-2.5 font-mono text-[11px] text-paper/70">
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-1.5 text-gold">
            <MapPin size={12} />
            {activeRegion
              ? `Selected: Mkoa wa ${activeRegion}`
              : 'Click any Region (Mkoa) or Project Pin to inspect'}
          </span>
          <span className="text-paper/30">·</span>
          <span>{projects.length} Mapped Opportunities</span>
        </div>
        <span className="text-[10px] text-paper/55">
          Scroll to zoom · Drag to pan · Click region for organized dossier
        </span>
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
          className="h-2.5 w-3.5 shrink-0 rounded-xs border border-[#d97706] bg-[#1e2430]"
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
