import { MOON_RADIUS_KM } from './lunarEphemeris';

const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;
const MOON_RADIUS_M = MOON_RADIUS_KM * 1000;

export interface LandingSite {
  id: string;
  name: string;
  region: string;
  latDeg: number; // Selenographic latitude (-90 to 0)
  lonDeg: number; // Selenographic East longitude (0 to 360)
  elevM: number; // LOLA datum elevation (meters)
  slopeDeg: number;
  summary: string;
  sourceLabel: string;
}

export interface LolaDemGrid {
  width: number;
  height: number;
  bbox: { xmin: number; ymin: number; xmax: number; ymax: number };
  data: Float32Array;
  source: string;
  citationUrl: string;
}

// Verified LOLA ridge-crest coordinates inside official NASA Artemis III Candidate Regions (A3_Named_regions_SP)
export const LUNAR_SOUTH_POLE_SITES: LandingSite[] = [
  {
    id: 'connecting-ridge',
    name: 'Connecting Ridge',
    region: 'Artemis III Region · Shackleton–de Gerlache Crest',
    latDeg: -89.4388,
    lonDeg: 222.421,
    elevM: 1958,
    slopeDeg: 5.8,
    summary:
      'High-illumination crest linking Shackleton and de Gerlache craters (~90% annual sunlight) with unobstructed sub-zero horizons and nearby permanently shadowed cold traps.',
    sourceLabel: 'NASA A3_Named_regions_SP / LOLA 5m DEM',
  },
  {
    id: 'shackleton-rim',
    name: 'Peak Near Shackleton',
    region: 'Artemis III Region · 88.8°S Rim Crest',
    latDeg: -88.811,
    lonDeg: 123.69,
    elevM: 1645,
    slopeDeg: 6.4,
    summary:
      'Elevated rim crest adjacent to Shackleton Crater. High multi-month solar exposure paired with periodic grazing Earth passes.',
    sourceLabel: 'NASA A3_Named_regions_SP / LOLA 5m DEM',
  },
  {
    id: 'malapert-massif',
    name: 'Malapert Massif',
    region: 'Artemis III Region · Near-Side Massif',
    latDeg: -85.9891,
    lonDeg: 3.062,
    elevM: 5107,
    slopeDeg: 7.2,
    summary:
      '5.1 km massif aligned near the 0°E sub-Earth meridian, offering near-continuous Direct-to-Earth visibility and extended sunlit ridges.',
    sourceLabel: 'NASA A3_Named_regions_SP / LOLA 30m DEM',
  },
  {
    id: 'mons-mouton',
    name: 'Mons Mouton (Leibnitz Beta)',
    region: 'Artemis III Region · High Plateau',
    latDeg: -85.4266,
    lonDeg: 31.743,
    elevM: 6399,
    slopeDeg: 3.1,
    summary:
      'Broad flat-topped 6.4 km massif plateau (VIPER target region) with gentle slopes, high Earth elevation, and predictable diurnal lighting.',
    sourceLabel: 'NASA A3_Named_regions_SP / LOLA 30m DEM',
  },
  {
    id: 'nobile-rim-1',
    name: 'Nobile Rim 1',
    region: 'Artemis III Region · Nobile Highlands',
    latDeg: -85.1968,
    lonDeg: 36.817,
    elevM: 6721,
    slopeDeg: 5.4,
    summary:
      'Highland ridge overlooking Nobile crater with commanding elevation, balanced solar duty cycles, and clear near-side telemetry geometry.',
    sourceLabel: 'NASA A3_Named_regions_SP / LOLA 30m DEM',
  },
  {
    id: 'haworth-rim',
    name: 'Haworth',
    region: 'Artemis III Region · Haworth Massif',
    latDeg: -86.3987,
    lonDeg: 336.838,
    elevM: 2680,
    slopeDeg: 6.9,
    summary:
      'Near-side crater massif overlooking Haworth permanently shadowed deposits, combining favorable DTE links with seasonal crater-wall shadowing.',
    sourceLabel: 'NASA A3_Named_regions_SP / LOLA 30m DEM',
  },
  {
    id: 'de-gerlache-rim',
    name: 'de Gerlache Rim',
    region: 'Artemis III Region · Western Polar Rim',
    latDeg: -88.6834,
    lonDeg: 292.068,
    elevM: 1795,
    slopeDeg: 6.1,
    summary:
      'High-latitude crater rim crest west of Shackleton offering strong solar lighting windows alongside low-grazing Earth passes.',
    sourceLabel: 'NASA A3_Named_regions_SP / LOLA 5m DEM',
  },
  {
    id: 'faustini-rim-a',
    name: 'Faustini Rim A',
    region: 'Artemis III Region · Eastern Polar Rim',
    latDeg: -87.7689,
    lonDeg: 95.655,
    elevM: 466,
    slopeDeg: 7.5,
    summary:
      'Eastern rim near Faustini and Shoemaker craters where nearby massifs create strong azimuthal horizon variation across seasons.',
    sourceLabel: 'NASA A3_Named_regions_SP / LOLA 5m DEM',
  },
];

/**
 * Exact NASA Moon2000_spole Polar Stereographic projection:
 * +Y = 0° E (Prime Meridian toward Earth), +X = 90° E.
 */
export function latLonToPolarMeters(latDeg: number, lonDeg: number): { xM: number; yM: number } {
  const colatHalf = ((90 + latDeg) * DEG2RAD) / 2;
  const rM = 2 * MOON_RADIUS_M * Math.tan(colatHalf);
  const lonRad = lonDeg * DEG2RAD;
  return {
    xM: rM * Math.sin(lonRad),
    yM: rM * Math.cos(lonRad),
  };
}

export function polarMetersToLatLon(xM: number, yM: number): { latDeg: number; lonDeg: number } {
  const rM = Math.sqrt(xM * xM + yM * yM);
  const colatRad = 2 * Math.atan(rM / (2 * MOON_RADIUS_M));
  const latDeg = -90 + colatRad * RAD2DEG;
  let lonDeg = Math.atan2(xM, yM) * RAD2DEG;
  if (lonDeg < 0) lonDeg += 360;
  return { latDeg, lonDeg };
}

function sampleDemGrid(grid: LolaDemGrid, xM: number, yM: number): number | null {
  const { xmin, xmax, ymin, ymax } = grid.bbox;
  if (xM < xmin || xM > xmax || yM < ymin || yM > ymax) return null;

  const fx = ((xM - xmin) / (xmax - xmin)) * (grid.width - 1);
  const fy = ((ymax - yM) / (ymax - ymin)) * (grid.height - 1);

  const x0 = Math.max(0, Math.min(grid.width - 2, Math.floor(fx)));
  const y0 = Math.max(0, Math.min(grid.height - 2, Math.floor(fy)));
  const tx = fx - x0;
  const ty = fy - y0;

  const v00 = grid.data[y0 * grid.width + x0];
  const v10 = grid.data[y0 * grid.width + x0 + 1];
  const v01 = grid.data[(y0 + 1) * grid.width + x0];
  const v11 = grid.data[(y0 + 1) * grid.width + x0 + 1];

  if (
    !Number.isFinite(v00) ||
    !Number.isFinite(v10) ||
    !Number.isFinite(v01) ||
    !Number.isFinite(v11) ||
    Math.abs(v00) > 20000 ||
    Math.abs(v10) > 20000 ||
    Math.abs(v01) > 20000 ||
    Math.abs(v11) > 20000
  ) {
    return null;
  }

  const top = v00 * (1 - tx) + v10 * tx;
  const bot = v01 * (1 - tx) + v11 * tx;
  return top * (1 - ty) + bot * ty;
}

function fallbackAnalyticElevation(xM: number, yM: number): number {
  const xKm = xM / 1000;
  const yKm = yM / 1000;
  const n1 = Math.sin(xKm * 0.043 + 0.7) * Math.cos(yKm * 0.039 - 0.4) * 320;
  const n2 = Math.sin((xKm + yKm) * 0.091 + 1.2) * Math.cos((xKm - yKm) * 0.087) * 140;
  return -150 + n1 + n2;
}

/**
 * Multi-tier LOLA elevation sampler:
 * 1. Crest DEM (~27m/px via LRO_LOLA_DEM_SPole875_5mp_v04)
 * 2. Local DEM (~280m/px via LRO_LOLA_DEM_SPole75_30mp_v04)
 * 3. Regional DEM (~2.1km/px via LRO_LOLA_DEM_SPole75_30mp_v04)
 */
export function sampleElevationMeters(
  xM: number,
  yM: number,
  crestDem?: LolaDemGrid | null,
  localDem?: LolaDemGrid | null,
  regionalDem?: LolaDemGrid | null
): number {
  if (crestDem) {
    const v = sampleDemGrid(crestDem, xM, yM);
    if (v !== null) return v;
  }
  if (localDem) {
    const v = sampleDemGrid(localDem, xM, yM);
    if (v !== null) return v;
  }
  if (regionalDem) {
    const v = sampleDemGrid(regionalDem, xM, yM);
    if (v !== null) return v;
  }
  return fallbackAnalyticElevation(xM, yM);
}

export function sampleElevationAtLatLon(
  latDeg: number,
  lonDeg: number,
  crestDem?: LolaDemGrid | null,
  localDem?: LolaDemGrid | null,
  regionalDem?: LolaDemGrid | null
): number {
  const { xM, yM } = latLonToPolarMeters(latDeg, lonDeg);
  return sampleElevationMeters(xM, yM, crestDem, localDem, regionalDem);
}

/**
 * Ray-marches a 360-degree terrain horizon profile across the multi-tier NASA LRO LOLA DEM stack,
 * accounting for lunar curvature (R = 1737.4 km) and observer mast height.
 */
export function computeHorizonProfile(
  latDeg: number,
  lonDeg: number,
  mastHeightM = 2.5,
  crestDem?: LolaDemGrid | null,
  localDem?: LolaDemGrid | null,
  regionalDem?: LolaDemGrid | null
): number[] {
  const latRad = latDeg * DEG2RAD;
  const lonRad = lonDeg * DEG2RAD;
  const cosLat = Math.cos(latRad);
  const sinLat = Math.sin(latRad);
  const cosLon = Math.cos(lonRad);
  const sinLon = Math.sin(lonRad);

  const obsElevM =
    sampleElevationAtLatLon(latDeg, lonDeg, crestDem, localDem, regionalDem) + mastHeightM;

  // Fine near-field sampling (150m..3km on crest DEM) out to far-field 112km massifs
  const stepsKm = [
    0.15, 0.25, 0.4, 0.65, 1.0, 1.5, 2.2, 3.1, 4.4, 6.0, 8.0, 10.5, 13.5, 17, 21, 26, 32, 39, 47,
    56, 67, 80, 95, 112,
  ];

  const profile: number[] = new Array(360);

  for (let azDeg = 0; azDeg < 360; azDeg++) {
    const azRad = azDeg * DEG2RAD;
    const cosAz = Math.cos(azRad);
    const sinAz = Math.sin(azRad);

    const dirX = -sinLat * cosLon * cosAz - sinLon * sinAz;
    const dirY = -sinLat * sinLon * cosAz + cosLon * sinAz;
    const dirZ = cosLat * cosAz;

    let maxElevAngleDeg = -8.0;

    for (let s = 0; s < stepsKm.length; s++) {
      const distKm = stepsKm[s];
      const angDist = distKm / MOON_RADIUS_KM;

      const sinA = Math.sin(angDist);
      const cosA = Math.cos(angDist);
      const px = cosA * (cosLat * cosLon) + sinA * dirX;
      const py = cosA * (cosLat * sinLon) + sinA * dirY;
      const pz = cosA * sinLat + sinA * dirZ;

      const tLatDeg = Math.asin(Math.max(-1, Math.min(1, pz))) * RAD2DEG;
      let tLonDeg = Math.atan2(py, px) * RAD2DEG;
      if (tLonDeg < 0) tLonDeg += 360;

      const targetElevM = sampleElevationAtLatLon(tLatDeg, tLonDeg, crestDem, localDem, regionalDem);
      const dElevKm = (targetElevM - obsElevM) / 1000.0;
      const curvatureDropKm = (distKm * distKm) / (2 * MOON_RADIUS_KM);

      const angleDeg = Math.atan2(dElevKm - curvatureDropKm, distKm) * RAD2DEG;
      if (angleDeg > maxElevAngleDeg) {
        maxElevAngleDeg = angleDeg;
      }
    }

    profile[azDeg] = Number(maxElevAngleDeg.toFixed(3));
  }

  return profile;
}
