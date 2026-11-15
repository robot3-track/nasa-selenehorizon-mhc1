import { LolaDemGrid, latLonToPolarMeters } from './lunarSites';

export interface ArtemisRegionFeature {
  label: string;
  rings: Array<Array<[number, number]>>; // [lon, lat] rings
  centroidLat: number;
  centroidLon: number;
  crestLat: number;
  crestLon: number;
  crestElevM: number | null;
}

export type NasaMapLayerId =
  | 'LRO_LOLA_ClrShade_SPole75_30mp_v04'
  | 'LRO_LOLA_ClrShade_SPole875_5mp_v04'
  | 'LRO_WAC_Mosaic_SPole60_100m_v02'
  | 'WAC_POLE_ILL_PCT_SOUTH_100M'
  | 'ClrAVGVISIB_75S_120M_201608_EARTH_SP';

export const EXACT_NASA_URLS = {
  jplHorizonsApp: 'https://ssd.jpl.nasa.gov/horizons/app.html#/',
  jplHorizonsApi: 'https://ssd.jpl.nasa.gov/api/horizons.api',
  lolaPdsNode: 'https://pds-geosciences.wustl.edu/missions/lro/lola.htm',
  lolaPolarGdr:
    'https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/polar/',
  lolaDem30mService:
    'https://trek.nasa.gov/moon/trekarcgis/rest/services/LRO_LOLA_DEM_SPole75_30mp_v04/ImageServer',
  lolaDem5mService:
    'https://trek.nasa.gov/moon/trekarcgis/rest/services/LRO_LOLA_DEM_SPole875_5mp_v04/ImageServer',
  artemisRegionsRest:
    'https://trek.nasa.gov/moon/trekarcgis2/rest/services/A3_Named_regions_SP/MapServer/0',
  artemisPressRelease:
    'https://www.nasa.gov/news-release/nasa-identifies-candidate-regions-for-landing-next-americans-on-moon/',
  naifSpiceKernels: 'https://naif.jpl.nasa.gov/pub/naif/generic_kernels/spk/planets/',
  iau2015Paper: 'https://doi.org/10.1007/s10569-017-9805-5',
  svsSouthPole: 'https://svs.gsfc.nasa.gov/gallery/lunar-south-pole/',
  moonTrekPortal: 'https://trek.nasa.gov/moon/',
};

export function buildHorizonsApiUrl(
  latDeg: number,
  lonDeg: number,
  elevM: number,
  startIso: string,
  stopIso: string,
  targetCode: '10' | '399' = '10'
): string {
  const params = new URLSearchParams({
    format: 'text',
    COMMAND: `'${targetCode}'`,
    OBJ_DATA: 'NO',
    MAKE_EPHEM: 'YES',
    EPHEM_TYPE: 'OBSERVER',
    CENTER: `'coord@301'`,
    COORD_TYPE: 'GEODETIC',
    SITE_COORD: `'${lonDeg.toFixed(4)},${latDeg.toFixed(4)},${(elevM / 1000).toFixed(3)}'`,
    START_TIME: `'${startIso.slice(0, 16).replace('T', ' ')}'`,
    STOP_TIME: `'${stopIso.slice(0, 16).replace('T', ' ')}'`,
    STEP_SIZE: `'6 h'`,
    QUANTITIES: `'4'`,
    CSV_FORMAT: 'YES',
  });
  return `${EXACT_NASA_URLS.jplHorizonsApi}?${params.toString()}`;
}

export const NASA_MAP_LAYERS: Array<{
  id: NasaMapLayerId;
  label: string;
  citation: string;
  url: string;
  portalUrl: string;
  description: string;
}> = [
  {
    id: 'LRO_LOLA_ClrShade_SPole75_30mp_v04',
    label: 'LOLA Elevation Relief',
    citation: 'NASA LRO LOLA DEM Color Relief (30 m/px, SPole75 v04)',
    url: 'https://trek.nasa.gov/tiles/Moon/SP/LRO_LOLA_ClrShade_SPole75_30mp_v04/1.0.0/WMTSCapabilities.xml',
    portalUrl: 'https://pds-geosciences.wustl.edu/missions/lro/lola.htm',
    description:
      'Color-coded lunar surface height measured by laser pulses from NASA’s Lunar Orbiter Laser Altimeter (LOLA). Warm colors mark high sunlit crater rims and ridges; cool blues mark deep crater floors.',
  },
  {
    id: 'LRO_LOLA_ClrShade_SPole875_5mp_v04',
    label: 'LOLA 5m/px Polar Crest',
    citation: 'NASA LRO LOLA DEM 5 m/px Color Relief (87.5°S–90°S)',
    url: 'https://trek.nasa.gov/tiles/Moon/SP/LRO_LOLA_ClrShade_SPole875_5mp_v04/1.0.0/WMTSCapabilities.xml',
    portalUrl:
      'https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/polar/',
    description:
      'Ultra-high-resolution 5-meter-per-pixel elevation mosaic covering the innermost 2.5° around the South Pole, showing boulder-scale ridge crests like Connecting Ridge and Shackleton rim.',
  },
  {
    id: 'LRO_WAC_Mosaic_SPole60_100m_v02',
    label: 'LROC Camera Mosaic',
    citation: 'NASA LROC Wide Angle Camera South Pole Mosaic (100 m/px v02)',
    url: 'https://trek.nasa.gov/tiles/Moon/SP/LRO_WAC_Mosaic_SPole60_100m_v02/1.0.0/WMTSCapabilities.xml',
    portalUrl: 'https://trek.nasa.gov/moon/',
    description:
      'True optical camera photograph mosaic captured by the Lunar Reconnaissance Orbiter Camera (LROC WAC), showing real crater textures and natural south pole lighting contrast.',
  },
  {
    id: 'WAC_POLE_ILL_PCT_SOUTH_100M',
    label: 'Illumination %',
    citation: 'NASA LROC WAC Percentage-Based Solar Illumination (100 m/px)',
    url: 'https://trek.nasa.gov/tiles/Moon/SP/WAC_POLE_ILL_PCT_SOUTH_100M/1.0.0/WMTSCapabilities.xml',
    portalUrl: 'https://trek.nasa.gov/moon/',
    description:
      'Long-term empirical sunlight map compiled from thousands of LROC images showing what percentage of time each pixel receives direct sunlight versus permanently shadowed darkness.',
  },
  {
    id: 'ClrAVGVISIB_75S_120M_201608_EARTH_SP',
    label: 'Earth Visibility',
    citation: 'NASA LRO LOLA Average Earth Visibility Map (120 m/px)',
    url: 'https://trek.nasa.gov/tiles/Moon/SP/ClrAVGVISIB_75S_120M_201608_EARTH_SP/1.0.0/WMTSCapabilities.xml',
    portalUrl: 'https://trek.nasa.gov/moon/',
    description:
      'NASA LOLA line-of-sight model showing how often Earth appears above surrounding mountains for Direct-to-Earth radio communication without an orbital relay.',
  },
];

function decodeBase64Float32(b64: string): Float32Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    bytes[i] = bin.charCodeAt(i);
  }
  return new Float32Array(bytes.buffer);
}

async function fetchDem(url: string): Promise<LolaDemGrid> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = (await res.json()) as {
    width: number;
    height: number;
    bbox: { xmin: number; ymin: number; xmax: number; ymax: number };
    elevationsBase64: string;
    source: string;
    citationUrl: string;
  };
  return {
    width: json.width,
    height: json.height,
    bbox: json.bbox,
    data: decodeBase64Float32(json.elevationsBase64),
    source: json.source,
    citationUrl: json.citationUrl,
  };
}

export function fetchRegionalLolaDem(): Promise<LolaDemGrid> {
  return fetchDem('/api/nasa/lola-dem?mode=regional');
}

export function fetchLocalLolaDem(latDeg: number, lonDeg: number): Promise<LolaDemGrid> {
  const { xM, yM } = latLonToPolarMeters(latDeg, lonDeg);
  return fetchDem(`/api/nasa/lola-dem?mode=local&x=${Math.round(xM)}&y=${Math.round(yM)}`);
}

export function fetchCrestLolaDem(latDeg: number, lonDeg: number): Promise<LolaDemGrid> {
  const { xM, yM } = latLonToPolarMeters(latDeg, lonDeg);
  return fetchDem(`/api/nasa/lola-dem?mode=crest&x=${Math.round(xM)}&y=${Math.round(yM)}`);
}

export async function fetchArtemisRegions(): Promise<{
  regions: ArtemisRegionFeature[];
  source: string;
  citationUrl: string;
}> {
  const res = await fetch('/api/nasa/artemis-regions');
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = (await res.json()) as {
    source: string;
    citationUrl: string;
    geojson: {
      features: Array<{
        properties: {
          label?: string;
          crestLat?: number;
          crestLon?: number;
          crestElevM?: number;
        };
        geometry: {
          type: string;
          coordinates: number[][][] | number[][][][];
        };
      }>;
    };
  };

  const regions: ArtemisRegionFeature[] = [];
  for (const f of json.geojson?.features ?? []) {
    const label = f.properties?.label || 'Artemis III Region';
    const rings: Array<Array<[number, number]>> = [];
    if (f.geometry?.type === 'Polygon') {
      for (const ring of f.geometry.coordinates as number[][][]) {
        rings.push(ring.map((pt) => [pt[0], pt[1]]));
      }
    } else if (f.geometry?.type === 'MultiPolygon') {
      for (const poly of f.geometry.coordinates as number[][][][]) {
        for (const ring of poly) {
          rings.push(ring.map((pt) => [pt[0], pt[1]]));
        }
      }
    }
    const pts = rings[0] ?? [];
    if (pts.length > 0) {
      const centroidLon =
        (((pts.reduce((acc, p) => acc + p[0], 0) / pts.length) % 360) + 360) % 360;
      const centroidLat = pts.reduce((acc, p) => acc + p[1], 0) / pts.length;
      regions.push({
        label,
        rings,
        centroidLat,
        centroidLon,
        crestLat: f.properties?.crestLat ?? centroidLat,
        crestLon: f.properties?.crestLon ?? centroidLon,
        crestElevM: f.properties?.crestElevM ?? null,
      });
    }
  }

  return {
    regions,
    source: json.source,
    citationUrl: json.citationUrl,
  };
}
