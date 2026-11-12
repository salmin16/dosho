/**
 * Official Level-1 Administrative Regions ("Mikoa") of the United Republic of Tanzania
 * Includes all 31 Regions (26 Mainland + 5 Zanzibar) with polygon boundaries,
 * regional capitals, geological zones, and primary mineral endowments.
 *
 * Also exports `TANZANIA_GEOBOUNDARIES_ADM1_URL` for live high-density GeoJSON
 * hydration from geoBoundaries / OpenStreetMap ADM1 datasets.
 */

export interface TanzaniaRegionProperties {
  shapeName: string;
  regionCode: string;
  capital: string;
  zone:
    | 'Lake Victoria Goldfields'
    | 'Central Dodoma Craton'
    | 'Northern Gemstone & Rift Belt'
    | 'Southern Highlands & Rukwa Rift'
    | 'Southern Graphite & Rare Earth Corridor'
    | 'Western Kigoma-Katavi Polymetallic Belt'
    | 'Coastal & Zanzibar Basin';
  keyMinerals: string[];
  activeLicencesEstimate: number;
  center: [number, number]; // [lat, lng]
}

export interface TanzaniaRegionFeature {
  type: 'Feature';
  properties: TanzaniaRegionProperties;
  geometry: {
    type: 'Polygon';
    coordinates: [number, number][][]; // [[[lng, lat], ...]]
  };
}

export interface TanzaniaRegionsFeatureCollection {
  type: 'FeatureCollection';
  features: TanzaniaRegionFeature[];
}

/**
 * Public high-resolution Tanzania ADM1 GeoJSON endpoint (geoBoundaries / HDX mirror)
 * The Leaflet component renders the embedded 31-region ADM1 GeoJSON immediately and
 * upgrades polygon vertices when the remote dataset resolves.
 */
export const TANZANIA_GEOBOUNDARIES_ADM1_URL =
  'https://raw.githubusercontent.com/wmgeolab/geoBoundaries/main/releaseData/gbOpen/TZA/ADM1/geoBoundaries-TZA-ADM1_simplified.geojson';

export const TANZANIA_REGIONS_META: Record<
  string,
  Omit<TanzaniaRegionProperties, 'shapeName'>
> = {
  Geita: {
    regionCode: 'TZ-27',
    capital: 'Geita',
    zone: 'Lake Victoria Goldfields',
    keyMinerals: ['Gold', 'Silver', 'Copper'],
    activeLicencesEstimate: 412,
    center: [-2.87, 32.23],
  },
  Mwanza: {
    regionCode: 'TZ-18',
    capital: 'Mwanza',
    zone: 'Lake Victoria Goldfields',
    keyMinerals: ['Gold', 'Granite', 'Silver'],
    activeLicencesEstimate: 285,
    center: [-2.65, 33.05],
  },
  Shinyanga: {
    regionCode: 'TZ-22',
    capital: 'Shinyanga',
    zone: 'Lake Victoria Goldfields',
    keyMinerals: ['Gold', 'Diamonds', 'Silver'],
    activeLicencesEstimate: 340,
    center: [-3.65, 33.15],
  },
  Mara: {
    regionCode: 'TZ-13',
    capital: 'Musoma',
    zone: 'Lake Victoria Goldfields',
    keyMinerals: ['Gold', 'Copper', 'Silver'],
    activeLicencesEstimate: 260,
    center: [-1.75, 34.15],
  },
  Simiyu: {
    regionCode: 'TZ-29',
    capital: 'Bariadi',
    zone: 'Lake Victoria Goldfields',
    keyMinerals: ['Gold', 'Nickel', 'Limestone'],
    activeLicencesEstimate: 118,
    center: [-2.85, 34.15],
  },
  Kagera: {
    regionCode: 'TZ-05',
    capital: 'Bukoba',
    keyMinerals: ['Nickel', 'Tin', 'Cobalt', 'Gold'],
    zone: 'Lake Victoria Goldfields',
    activeLicencesEstimate: 195,
    center: [-1.95, 31.25],
  },
  Kigoma: {
    regionCode: 'TZ-08',
    capital: 'Kigoma',
    zone: 'Western Kigoma-Katavi Polymetallic Belt',
    keyMinerals: ['Copper', 'Nickel', 'Cobalt', 'Limestone'],
    activeLicencesEstimate: 144,
    center: [-4.65, 30.25],
  },
  Katavi: {
    regionCode: 'TZ-28',
    capital: 'Mpanda',
    zone: 'Western Kigoma-Katavi Polymetallic Belt',
    keyMinerals: ['Gold', 'Copper', 'Lead'],
    activeLicencesEstimate: 210,
    center: [-6.35, 31.15],
  },
  Rukwa: {
    regionCode: 'TZ-20',
    capital: 'Sumbawanga',
    zone: 'Southern Highlands & Rukwa Rift',
    keyMinerals: ['Coal', 'Helium', 'Copper', 'Gemstones'],
    activeLicencesEstimate: 132,
    center: [-7.75, 31.55],
  },
  Songwe: {
    regionCode: 'TZ-31',
    capital: 'Vwawa',
    zone: 'Southern Highlands & Rukwa Rift',
    keyMinerals: ['Gold', 'Rare Earths', 'Coal', 'Niobium'],
    activeLicencesEstimate: 245,
    center: [-8.85, 32.75],
  },
  Mbeya: {
    regionCode: 'TZ-14',
    capital: 'Mbeya',
    zone: 'Southern Highlands & Rukwa Rift',
    keyMinerals: ['Gold', 'Coal', 'Iron Ore', 'Limestone'],
    activeLicencesEstimate: 275,
    center: [-8.45, 33.65],
  },
  Tabora: {
    regionCode: 'TZ-24',
    capital: 'Tabora',
    zone: 'Central Dodoma Craton',
    keyMinerals: ['Gold', 'Diamonds', 'Uranium'],
    activeLicencesEstimate: 168,
    center: [-5.15, 32.65],
  },
  Singida: {
    regionCode: 'TZ-23',
    capital: 'Singida',
    zone: 'Central Dodoma Craton',
    keyMinerals: ['Gold', 'Copper', 'Gypsum', 'Salt'],
    activeLicencesEstimate: 230,
    center: [-5.15, 34.65],
  },
  Dodoma: {
    regionCode: 'TZ-03',
    capital: 'Dodoma',
    zone: 'Central Dodoma Craton',
    keyMinerals: ['Gold', 'Lithium', 'Copper', 'Gemstones'],
    activeLicencesEstimate: 290,
    center: [-6.15, 35.85],
  },
  Manyara: {
    regionCode: 'TZ-26',
    capital: 'Babati',
    zone: 'Northern Gemstone & Rift Belt',
    keyMinerals: ['Tanzanite', 'Ruby', 'Tsavorite', 'Graphite', 'Phosphate'],
    activeLicencesEstimate: 365,
    center: [-4.25, 36.45],
  },
  Arusha: {
    regionCode: 'TZ-01',
    capital: 'Arusha',
    zone: 'Northern Gemstone & Rift Belt',
    keyMinerals: ['Ruby', 'Emerald', 'Soda Ash', 'Industrial Minerals'],
    activeLicencesEstimate: 175,
    center: [-3.15, 36.15],
  },
  Kilimanjaro: {
    regionCode: 'TZ-09',
    capital: 'Moshi',
    zone: 'Northern Gemstone & Rift Belt',
    keyMinerals: ['Copper', 'Gypsum', 'Bauxite', 'Gemstones'],
    activeLicencesEstimate: 112,
    center: [-3.75, 37.55],
  },
  Tanga: {
    regionCode: 'TZ-25',
    capital: 'Tanga',
    zone: 'Northern Gemstone & Rift Belt',
    keyMinerals: ['Graphite', 'Gemstones', 'Limestone', 'Gold'],
    activeLicencesEstimate: 184,
    center: [-5.15, 38.25],
  },
  Morogoro: {
    regionCode: 'TZ-16',
    capital: 'Morogoro',
    zone: 'Southern Graphite & Rare Earth Corridor',
    keyMinerals: ['Graphite', 'Ruby', 'Spinel', 'Gold', 'Marble'],
    activeLicencesEstimate: 310,
    center: [-7.45, 37.15],
  },
  Iringa: {
    regionCode: 'TZ-04',
    capital: 'Iringa',
    zone: 'Southern Highlands & Rukwa Rift',
    keyMinerals: ['Gold', 'Copper', 'Granite', 'Kaolin'],
    activeLicencesEstimate: 140,
    center: [-7.75, 35.35],
  },
  Njombe: {
    regionCode: 'TZ-30',
    capital: 'Njombe',
    zone: 'Southern Highlands & Rukwa Rift',
    keyMinerals: ['Iron Ore', 'Coal', 'Vanadium', 'Titanium'],
    activeLicencesEstimate: 162,
    center: [-9.45, 34.85],
  },
  Ruvuma: {
    regionCode: 'TZ-21',
    capital: 'Songea',
    zone: 'Southern Graphite & Rare Earth Corridor',
    keyMinerals: ['Coal', 'Uranium', 'Gold', 'Sapphire'],
    activeLicencesEstimate: 225,
    center: [-10.75, 36.05],
  },
  Lindi: {
    regionCode: 'TZ-12',
    capital: 'Lindi',
    zone: 'Southern Graphite & Rare Earth Corridor',
    keyMinerals: ['Graphite', 'Nickel', 'Gold', 'Gypsum', 'Gemstones'],
    activeLicencesEstimate: 335,
    center: [-9.45, 38.45],
  },
  Mtwara: {
    regionCode: 'TZ-17',
    capital: 'Mtwara',
    zone: 'Southern Graphite & Rare Earth Corridor',
    keyMinerals: ['Graphite', 'Heavy Mineral Sands', 'Limestone'],
    activeLicencesEstimate: 148,
    center: [-10.65, 39.25],
  },
  Pwani: {
    regionCode: 'TZ-19',
    capital: 'Kibaha',
    zone: 'Coastal & Zanzibar Basin',
    keyMinerals: ['Kaolin', 'Silica Sand', 'Salt', 'Limestone'],
    activeLicencesEstimate: 120,
    center: [-7.05, 38.75],
  },
  'Dar es Salaam': {
    regionCode: 'TZ-02',
    capital: 'Dar es Salaam',
    zone: 'Coastal & Zanzibar Basin',
    keyMinerals: ['Mineral Export Hub', 'Refining & Assaying', 'Limestone'],
    activeLicencesEstimate: 95,
    center: [-6.82, 39.27],
  },
  'Kaskazini Unguja': {
    regionCode: 'TZ-07',
    capital: 'Mkokotoni',
    zone: 'Coastal & Zanzibar Basin',
    keyMinerals: ['Limestone', 'Construction Aggregates'],
    activeLicencesEstimate: 18,
    center: [-5.93, 39.28],
  },
  'Kusini Unguja': {
    regionCode: 'TZ-11',
    capital: 'Koani',
    zone: 'Coastal & Zanzibar Basin',
    keyMinerals: ['Limestone', 'Industrial Sand'],
    activeLicencesEstimate: 15,
    center: [-6.26, 39.42],
  },
  'Mjini Magharibi': {
    regionCode: 'TZ-15',
    capital: 'Zanzibar City',
    zone: 'Coastal & Zanzibar Basin',
    keyMinerals: ['Bullion Trading & Maritime Port'],
    activeLicencesEstimate: 22,
    center: [-6.16, 39.21],
  },
  'Kaskazini Pemba': {
    regionCode: 'TZ-06',
    capital: 'Wete',
    zone: 'Coastal & Zanzibar Basin',
    keyMinerals: ['Limestone', 'Marine Aggregates'],
    activeLicencesEstimate: 12,
    center: [-5.05, 39.77],
  },
  'Kusini Pemba': {
    regionCode: 'TZ-10',
    capital: 'Chake Chake',
    zone: 'Coastal & Zanzibar Basin',
    keyMinerals: ['Limestone', 'Marine Aggregates'],
    activeLicencesEstimate: 14,
    center: [-5.32, 39.75],
  },
};

/**
 * Normalizes any ADM1 shapeName from external GeoJSON sources (e.g. "Dar-es-Salaam",
 * "Coast", "Zanzibar West") to the canonical Tanzanian region name ("Mkoa").
 */
export function resolveRegionMetadata(
  rawName: string
): TanzaniaRegionProperties {
  const cleaned = rawName.replace(/\s+Region$/i, '').trim();
  const aliasMap: Record<string, string> = {
    'Dar-es-Salaam': 'Dar es Salaam',
    Coast: 'Pwani',
    'Zanzibar North': 'Kaskazini Unguja',
    'Zanzibar South and Central': 'Kusini Unguja',
    'Zanzibar Central/South': 'Kusini Unguja',
    'Zanzibar Urban/West': 'Mjini Magharibi',
    'Zanzibar West': 'Mjini Magharibi',
    'Pemba North': 'Kaskazini Pemba',
    'Pemba South': 'Kusini Pemba',
  };
  const canonical = aliasMap[cleaned] || cleaned;
  const meta = TANZANIA_REGIONS_META[canonical] ?? {
    regionCode: 'TZ-ADM1',
    capital: canonical,
    zone: 'Central Dodoma Craton',
    keyMinerals: ['Gold', 'Copper', 'Industrial Minerals'],
    activeLicencesEstimate: 120,
    center: [-6.2, 35.0],
  };

  return {
    shapeName: canonical,
    ...meta,
  };
}

/**
 * Embedded Level-1 Administrative GeoJSON covering all 31 Regions ("Mikoa") of Tanzania.
 * Guarantees instant zero-latency rendering even offline or before remote GeoJSON finishes loading.
 */
export const TANZANIA_ADM1_FALLBACK_GEOJSON: TanzaniaRegionsFeatureCollection = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: resolveRegionMetadata('Kagera'),
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [30.48, -1.02],
            [31.8, -1.0],
            [31.85, -2.15],
            [31.45, -2.85],
            [31.05, -3.15],
            [30.52, -2.65],
            [30.42, -1.85],
            [30.48, -1.02],
          ],
        ],
      },
    },
    {
      type: 'Feature',
      properties: resolveRegionMetadata('Geita'),
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [31.45, -2.35],
            [32.55, -2.35],
            [32.65, -3.35],
            [31.85, -3.65],
            [31.25, -3.35],
            [31.45, -2.35],
          ],
        ],
      },
    },
    {
      type: 'Feature',
      properties: resolveRegionMetadata('Mwanza'),
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [32.55, -2.05],
            [33.65, -2.05],
            [33.65, -3.15],
            [32.65, -3.25],
            [32.55, -2.05],
          ],
        ],
      },
    },
    {
      type: 'Feature',
      properties: resolveRegionMetadata('Mara'),
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [33.45, -1.05],
            [34.55, -1.35],
            [35.15, -1.85],
            [34.85, -2.35],
            [33.65, -2.15],
            [33.45, -1.05],
          ],
        ],
      },
    },
    {
      type: 'Feature',
      properties: resolveRegionMetadata('Simiyu'),
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [33.65, -2.15],
            [34.85, -2.35],
            [34.85, -3.55],
            [33.65, -3.55],
            [33.65, -2.15],
          ],
        ],
      },
    },
    {
      type: 'Feature',
      properties: resolveRegionMetadata('Shinyanga'),
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [32.15, -3.25],
            [33.65, -3.15],
            [33.85, -4.15],
            [32.25, -4.15],
            [32.15, -3.25],
          ],
        ],
      },
    },
    {
      type: 'Feature',
      properties: resolveRegionMetadata('Kigoma'),
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [30.52, -2.65],
            [31.25, -3.35],
            [31.45, -5.25],
            [30.15, -6.15],
            [29.65, -4.85],
            [29.95, -4.15],
            [30.52, -2.65],
          ],
        ],
      },
    },
    {
      type: 'Feature',
      properties: resolveRegionMetadata('Tabora'),
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [31.45, -4.15],
            [33.85, -4.15],
            [34.15, -6.35],
            [31.65, -6.35],
            [31.45, -4.15],
          ],
        ],
      },
    },
    {
      type: 'Feature',
      properties: resolveRegionMetadata('Katavi'),
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [30.25, -5.65],
            [31.65, -5.65],
            [32.35, -7.15],
            [30.65, -7.25],
            [30.25, -5.65],
          ],
        ],
      },
    },
    {
      type: 'Feature',
      properties: resolveRegionMetadata('Rukwa'),
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [30.65, -7.25],
            [32.15, -7.15],
            [32.35, -8.85],
            [31.15, -8.65],
            [30.65, -7.25],
          ],
        ],
      },
    },
    {
      type: 'Feature',
      properties: resolveRegionMetadata('Songwe'),
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [32.15, -7.65],
            [33.25, -7.75],
            [33.35, -9.45],
            [32.25, -9.15],
            [32.15, -7.65],
          ],
        ],
      },
    },
    {
      type: 'Feature',
      properties: resolveRegionMetadata('Mbeya'),
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [33.25, -7.15],
            [34.55, -7.35],
            [34.35, -9.55],
            [33.35, -9.45],
            [33.25, -7.15],
          ],
        ],
      },
    },
    {
      type: 'Feature',
      properties: resolveRegionMetadata('Singida'),
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [33.85, -3.85],
            [35.25, -4.05],
            [35.25, -6.65],
            [34.15, -6.65],
            [33.85, -3.85],
          ],
        ],
      },
    },
    {
      type: 'Feature',
      properties: resolveRegionMetadata('Dodoma'),
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [35.25, -4.85],
            [36.75, -5.05],
            [36.65, -7.15],
            [35.25, -7.05],
            [35.25, -4.85],
          ],
        ],
      },
    },
    {
      type: 'Feature',
      properties: resolveRegionMetadata('Arusha'),
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [34.85, -1.85],
            [36.95, -2.55],
            [36.95, -3.65],
            [35.15, -3.65],
            [34.85, -1.85],
          ],
        ],
      },
    },
    {
      type: 'Feature',
      properties: resolveRegionMetadata('Manyara'),
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [35.15, -3.65],
            [37.35, -3.65],
            [37.45, -5.35],
            [35.25, -4.85],
            [35.15, -3.65],
          ],
        ],
      },
    },
    {
      type: 'Feature',
      properties: resolveRegionMetadata('Kilimanjaro'),
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [36.95, -2.85],
            [37.85, -3.05],
            [38.25, -4.35],
            [37.35, -4.35],
            [36.95, -2.85],
          ],
        ],
      },
    },
    {
      type: 'Feature',
      properties: resolveRegionMetadata('Tanga'),
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [37.35, -4.35],
            [39.15, -4.65],
            [39.05, -5.85],
            [37.45, -5.75],
            [37.35, -4.35],
          ],
        ],
      },
    },
    {
      type: 'Feature',
      properties: resolveRegionMetadata('Morogoro'),
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [36.65, -5.85],
            [38.35, -5.95],
            [37.95, -9.15],
            [35.95, -8.95],
            [36.65, -5.85],
          ],
        ],
      },
    },
    {
      type: 'Feature',
      properties: resolveRegionMetadata('Pwani'),
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [38.15, -5.85],
            [39.25, -6.15],
            [39.45, -8.25],
            [38.15, -8.15],
            [38.15, -5.85],
          ],
        ],
      },
    },
    {
      type: 'Feature',
      properties: resolveRegionMetadata('Dar es Salaam'),
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [39.05, -6.58],
            [39.55, -6.65],
            [39.55, -7.15],
            [39.05, -7.12],
            [39.05, -6.58],
          ],
        ],
      },
    },
    {
      type: 'Feature',
      properties: resolveRegionMetadata('Iringa'),
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [34.55, -7.05],
            [36.45, -7.15],
            [36.15, -8.65],
            [34.55, -8.45],
            [34.55, -7.05],
          ],
        ],
      },
    },
    {
      type: 'Feature',
      properties: resolveRegionMetadata('Njombe'),
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [34.35, -8.45],
            [35.65, -8.65],
            [35.45, -10.15],
            [34.35, -9.95],
            [34.35, -8.45],
          ],
        ],
      },
    },
    {
      type: 'Feature',
      properties: resolveRegionMetadata('Ruvuma'),
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [34.65, -9.95],
            [37.75, -9.65],
            [37.85, -11.65],
            [34.85, -11.55],
            [34.65, -9.95],
          ],
        ],
      },
    },
    {
      type: 'Feature',
      properties: resolveRegionMetadata('Lindi'),
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [37.75, -8.15],
            [39.55, -8.25],
            [39.65, -10.15],
            [37.75, -10.15],
            [37.75, -8.15],
          ],
        ],
      },
    },
    {
      type: 'Feature',
      properties: resolveRegionMetadata('Mtwara'),
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [37.85, -10.15],
            [40.35, -10.25],
            [39.85, -11.25],
            [37.85, -11.45],
            [37.85, -10.15],
          ],
        ],
      },
    },
    {
      type: 'Feature',
      properties: resolveRegionMetadata('Kaskazini Unguja'),
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [39.21, -5.75],
            [39.38, -5.75],
            [39.39, -6.05],
            [39.21, -6.05],
            [39.21, -5.75],
          ],
        ],
      },
    },
    {
      type: 'Feature',
      properties: resolveRegionMetadata('Mjini Magharibi'),
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [39.16, -6.05],
            [39.28, -6.05],
            [39.28, -6.28],
            [39.16, -6.28],
            [39.16, -6.05],
          ],
        ],
      },
    },
    {
      type: 'Feature',
      properties: resolveRegionMetadata('Kusini Unguja'),
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [39.28, -6.05],
            [39.52, -6.05],
            [39.52, -6.48],
            [39.28, -6.48],
            [39.28, -6.05],
          ],
        ],
      },
    },
    {
      type: 'Feature',
      properties: resolveRegionMetadata('Kaskazini Pemba'),
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [39.65, -4.88],
            [39.88, -4.88],
            [39.88, -5.18],
            [39.65, -5.18],
            [39.65, -4.88],
          ],
        ],
      },
    },
    {
      type: 'Feature',
      properties: resolveRegionMetadata('Kusini Pemba'),
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [39.65, -5.18],
            [39.88, -5.18],
            [39.88, -5.48],
            [39.65, -5.48],
            [39.65, -5.18],
          ],
        ],
      },
    },
  ],
};
