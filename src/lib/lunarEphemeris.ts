import * as Astronomy from 'astronomy-engine';

export const MOON_RADIUS_KM = 1737.4;
export const EARTH_RADIUS_KM = 6371.0;
export const SUN_RADIUS_KM = 695700.0;
export const SOLAR_CONSTANT_WM2 = 1361.0;
export const SPEED_OF_LIGHT_KMS = 299792.458;

const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;

export interface BodySkyPosition {
  azimuthDeg: number; // 0 = Local Selenographic North, 90 = East, 180 = South, 270 = West
  elevationDeg: number; // -90 to +90 above mathematical sphere horizon
  distanceKm: number;
  angularRadiusDeg: number;
}

export interface EphemerisSample {
  timestampMs: number;
  isoUtc: string;
  sun: BodySkyPosition;
  earth: BodySkyPosition;
  sunHorizonElevDeg: number;
  earthHorizonElevDeg: number;
  sunClearanceDeg: number; // sun.elevationDeg - sunHorizonElevDeg
  earthClearanceDeg: number; // earth.elevationDeg - earthHorizonElevDeg
  sunVisibleFrac: number; // 0..1 accounting for Sun's 0.53 deg angular disc
  sunUsable: boolean; // clears horizon + minSunElevDeg threshold
  earthUsable: boolean; // clears horizon + minEarthElevDeg threshold
  simultaneousUsable: boolean;
  solarIrradianceWm2: number; // incident flux at 1 AU adjusted for R_sun^2 and disc fraction
  arrayOutputWm2: number; // tracking vertical vs fixed horizontal panel output
  rfOneWaySec: number;
}

export interface WindowSummaryStats {
  totalSamples: number;
  durationHours: number;
  sunVisiblePct: number;
  earthVisiblePct: number;
  simultaneousPct: number;
  longestDarkHours: number;
  longestCommBlackoutHours: number;
  meanPowerWm2: number;
  peakPowerWm2: number;
  totalEnergyKwhM2: number;
  maxSunElevDeg: number;
  minSunElevDeg: number;
  maxEarthElevDeg: number;
  minEarthElevDeg: number;
}

export type SolarArrayMode = 'tracking' | 'horizontal';

function normalizeDeg360(deg: number): number {
  const m = deg % 360;
  return m < 0 ? m + 360 : m;
}

/**
 * Computes IAU 2015 rotation matrix from ICRF/J2000 Equatorial (EQJ)
 * to Moon Body-Fixed Mean-Earth/Polar-Axis (Selenographic) coordinates.
 * Reference: Archinal et al. (2018), Celestial Mechanics and Dynamical Astronomy 130:22.
 */
function getMoonBodyFixedMatrix(ttDaysSinceJ2000: number): number[][] {
  const d = ttDaysSinceJ2000;
  const T = d / 36525.0;

  const E1 = (125.045 - 0.0529921 * d) * DEG2RAD;
  const E2 = (250.089 - 0.1059842 * d) * DEG2RAD;
  const E3 = (260.008 + 13.0120009 * d) * DEG2RAD;
  const E4 = (176.625 + 13.3407154 * d) * DEG2RAD;
  const E5 = (357.529 + 0.9856003 * d) * DEG2RAD;
  const E6 = (311.589 + 26.4057084 * d) * DEG2RAD;
  const E7 = (134.963 + 13.064993 * d) * DEG2RAD;
  const E8 = (276.617 + 0.3287146 * d) * DEG2RAD;
  const E9 = (34.226 + 1.7484877 * d) * DEG2RAD;
  const E10 = (15.134 - 0.1589763 * d) * DEG2RAD;
  const E11 = (119.743 + 0.0036096 * d) * DEG2RAD;
  const E12 = (239.961 + 0.1643573 * d) * DEG2RAD;
  const E13 = (25.053 + 12.9590088 * d) * DEG2RAD;

  const alpha0 =
    269.9949 +
    0.0031 * T -
    3.8787 * Math.sin(E1) -
    0.1204 * Math.sin(E2) +
    0.07 * Math.sin(E3) -
    0.0172 * Math.sin(E4) +
    0.0072 * Math.sin(E6) -
    0.0052 * Math.sin(E10) +
    0.0043 * Math.sin(E13);

  const delta0 =
    66.5392 +
    0.013 * T +
    1.5419 * Math.cos(E1) +
    0.0239 * Math.cos(E2) -
    0.0278 * Math.cos(E3) +
    0.0068 * Math.cos(E4) -
    0.0029 * Math.cos(E6) +
    0.0009 * Math.cos(E7) +
    0.0008 * Math.cos(E10) -
    0.0009 * Math.cos(E13);

  const W =
    38.3213 +
    13.17635815 * d -
    1.4e-12 * d * d +
    3.561 * Math.sin(E1) +
    0.1208 * Math.sin(E2) -
    0.0642 * Math.sin(E3) +
    0.0158 * Math.sin(E4) +
    0.0252 * Math.sin(E5) -
    0.0066 * Math.sin(E6) -
    0.0047 * Math.sin(E7) -
    0.0046 * Math.sin(E8) +
    0.0028 * Math.sin(E9) +
    0.0052 * Math.sin(E10) +
    0.004 * Math.sin(E11) +
    0.0019 * Math.sin(E12) -
    0.0044 * Math.sin(E13);

  const a = (90 + alpha0) * DEG2RAD;
  const b = (90 - delta0) * DEG2RAD;
  const c = W * DEG2RAD;

  const ca = Math.cos(a);
  const sa = Math.sin(a);
  const cb = Math.cos(b);
  const sb = Math.sin(b);
  const cc = Math.cos(c);
  const sc = Math.sin(c);

  // R = Rz(c) * Rx(b) * Rz(a)
  return [
    [cc * ca - sc * cb * sa, cc * sa + sc * cb * ca, sc * sb],
    [-sc * ca - cc * cb * sa, -sc * sa + cc * cb * ca, cc * sb],
    [sb * sa, -sb * ca, cb],
  ];
}

function mulMatVec(m: number[][], v: [number, number, number]): [number, number, number] {
  return [
    m[0][0] * v[0] + m[0][1] * v[1] + m[0][2] * v[2],
    m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2],
    m[2][0] * v[0] + m[2][1] * v[1] + m[2][2] * v[2],
  ];
}

function bodyFixedToTopocentric(
  targetBfKm: [number, number, number],
  latDeg: number,
  lonDeg: number,
  elevM: number,
  bodyRadiusKm: number
): BodySkyPosition {
  const lat = latDeg * DEG2RAD;
  const lon = lonDeg * DEG2RAD;
  const rObs = MOON_RADIUS_KM + elevM / 1000.0;

  const cosLat = Math.cos(lat);
  const sinLat = Math.sin(lat);
  const cosLon = Math.cos(lon);
  const sinLon = Math.sin(lon);

  const obsX = rObs * cosLat * cosLon;
  const obsY = rObs * cosLat * sinLon;
  const obsZ = rObs * sinLat;

  const dx = targetBfKm[0] - obsX;
  const dy = targetBfKm[1] - obsY;
  const dz = targetBfKm[2] - obsZ;

  const distKm = Math.sqrt(dx * dx + dy * dy + dz * dz);

  // Local ENU basis vectors
  const east = -sinLon * dx + cosLon * dy;
  const north = -sinLat * cosLon * dx - sinLat * sinLon * dy + cosLat * dz;
  const up = cosLat * cosLon * dx + cosLat * sinLon * dy + sinLat * dz;

  const elevationDeg = Math.asin(Math.max(-1, Math.min(1, up / distKm))) * RAD2DEG;
  const azimuthDeg = normalizeDeg360(Math.atan2(east, north) * RAD2DEG);
  const angularRadiusDeg = Math.asin(Math.min(1, bodyRadiusKm / distKm)) * RAD2DEG;

  return {
    azimuthDeg,
    elevationDeg,
    distanceKm: distKm,
    angularRadiusDeg,
  };
}

/**
 * Computes exact Selenographic Topocentric Sun & Earth coordinates at a given UTC timestamp.
 */
export function computeSunEarthTopocentric(
  date: Date,
  latDeg: number,
  lonDeg: number,
  elevM: number
): { sun: BodySkyPosition; earth: BodySkyPosition } {
  const time = Astronomy.MakeTime(date);

  // Moon geocentric position (EQJ, AU)
  const moonGeo = Astronomy.GeoMoon(time);
  // Sun geocentric position (EQJ, AU, light-time corrected)
  const sunGeo = Astronomy.GeoVector(Astronomy.Body.Sun, time, false);

  // Vectors from Moon center to Earth and Moon center to Sun in EQJ (km)
  const moonToEarthEqj: [number, number, number] = [
    -moonGeo.x * Astronomy.KM_PER_AU,
    -moonGeo.y * Astronomy.KM_PER_AU,
    -moonGeo.z * Astronomy.KM_PER_AU,
  ];
  const moonToSunEqj: [number, number, number] = [
    (sunGeo.x - moonGeo.x) * Astronomy.KM_PER_AU,
    (sunGeo.y - moonGeo.y) * Astronomy.KM_PER_AU,
    (sunGeo.z - moonGeo.z) * Astronomy.KM_PER_AU,
  ];

  const rot = getMoonBodyFixedMatrix(time.tt);
  const earthBf = mulMatVec(rot, moonToEarthEqj);
  const sunBf = mulMatVec(rot, moonToSunEqj);

  return {
    sun: bodyFixedToTopocentric(sunBf, latDeg, lonDeg, elevM, SUN_RADIUS_KM),
    earth: bodyFixedToTopocentric(earthBf, latDeg, lonDeg, elevM, EARTH_RADIUS_KM),
  };
}

/**
 * Computes fraction of a circular solar disc (0..1) visible above a horizon knife-edge.
 */
export function computeSolarDiscFraction(
  centerElevDeg: number,
  horizonElevDeg: number,
  angularRadiusDeg: number
): number {
  const diff = centerElevDeg - horizonElevDeg;
  if (diff >= angularRadiusDeg) return 1;
  if (diff <= -angularRadiusDeg) return 0;
  // Circular segment area fraction: h/R in [-1, 1]
  const u = Math.max(-1, Math.min(1, diff / angularRadiusDeg));
  const occludedArea = Math.acos(u) - u * Math.sqrt(Math.max(0, 1 - u * u));
  return Math.max(0, Math.min(1, 1 - occludedArea / Math.PI));
}

/**
 * Linearly interpolates a 360-bin horizon elevation array at any azimuth.
 */
export function sampleHorizonAtAzimuth(horizonProfileDeg: number[], azimuthDeg: number): number {
  if (!horizonProfileDeg.length) return 0;
  const az = normalizeDeg360(azimuthDeg);
  const i0 = Math.floor(az) % 360;
  const i1 = (i0 + 1) % 360;
  const frac = az - Math.floor(az);
  return horizonProfileDeg[i0] * (1 - frac) + horizonProfileDeg[i1] * frac;
}

/**
 * Generates an ephemeris time-series and summary metrics over a mission window.
 */
export function simulateMissionWindow(params: {
  latDeg: number;
  lonDeg: number;
  elevM: number;
  horizonProfileDeg: number[];
  startDate: Date;
  durationHours: number;
  stepMinutes: number;
  minSunElevDeg: number;
  minEarthElevDeg: number;
  solarArrayMode: SolarArrayMode;
}): { samples: EphemerisSample[]; summary: WindowSummaryStats } {
  const {
    latDeg,
    lonDeg,
    elevM,
    horizonProfileDeg,
    startDate,
    durationHours,
    stepMinutes,
    minSunElevDeg,
    minEarthElevDeg,
    solarArrayMode,
  } = params;

  const stepMs = stepMinutes * 60 * 1000;
  const startMs = startDate.getTime();
  const totalSteps = Math.max(2, Math.floor((durationHours * 60) / stepMinutes) + 1);

  const samples: EphemerisSample[] = [];
  let sunUsableCount = 0;
  let earthUsableCount = 0;
  let simultaneousCount = 0;

  let currentDarkRun = 0;
  let maxDarkRun = 0;
  let currentBlackoutRun = 0;
  let maxBlackoutRun = 0;

  let sumPowerWm2 = 0;
  let peakPowerWm2 = 0;
  let maxSunElevDeg = -90;
  let minSunElevDegVal = 90;
  let maxEarthElevDeg = -90;
  let minEarthElevDegVal = 90;

  for (let i = 0; i < totalSteps; i++) {
    const tMs = startMs + i * stepMs;
    const d = new Date(tMs);
    const { sun, earth } = computeSunEarthTopocentric(d, latDeg, lonDeg, elevM);

    const sunHorizonElevDeg = sampleHorizonAtAzimuth(horizonProfileDeg, sun.azimuthDeg);
    const earthHorizonElevDeg = sampleHorizonAtAzimuth(horizonProfileDeg, earth.azimuthDeg);

    const sunClearanceDeg = sun.elevationDeg - sunHorizonElevDeg;
    const earthClearanceDeg = earth.elevationDeg - earthHorizonElevDeg;

    const sunVisibleFrac = computeSolarDiscFraction(
      sun.elevationDeg,
      sunHorizonElevDeg + minSunElevDeg,
      sun.angularRadiusDeg
    );

    const sunUsable = sunClearanceDeg >= minSunElevDeg;
    const earthUsable = earthClearanceDeg >= minEarthElevDeg;
    const simultaneousUsable = sunUsable && earthUsable;

    const sunDistAu = sun.distanceKm / Astronomy.KM_PER_AU;
    const solarIrradianceWm2 = (SOLAR_CONSTANT_WM2 / (sunDistAu * sunDistAu)) * sunVisibleFrac;

    // Tracking vertical solar wing captures normal incidence (cos ≈ 1) when sunlit.
    // Fixed horizontal deck panels scale by sin(sun elevation).
    const arrayOutputWm2 =
      solarArrayMode === 'tracking'
        ? solarIrradianceWm2
        : solarIrradianceWm2 * Math.max(0, Math.sin(sun.elevationDeg * DEG2RAD));

    const rfOneWaySec = earth.distanceKm / SPEED_OF_LIGHT_KMS;

    if (sunUsable) {
      sunUsableCount++;
      currentDarkRun = 0;
    } else {
      currentDarkRun++;
      if (currentDarkRun > maxDarkRun) maxDarkRun = currentDarkRun;
    }

    if (earthUsable) {
      earthUsableCount++;
      currentBlackoutRun = 0;
    } else {
      currentBlackoutRun++;
      if (currentBlackoutRun > maxBlackoutRun) maxBlackoutRun = currentBlackoutRun;
    }

    if (simultaneousUsable) simultaneousCount++;

    sumPowerWm2 += arrayOutputWm2;
    if (arrayOutputWm2 > peakPowerWm2) peakPowerWm2 = arrayOutputWm2;

    if (sun.elevationDeg > maxSunElevDeg) maxSunElevDeg = sun.elevationDeg;
    if (sun.elevationDeg < minSunElevDegVal) minSunElevDegVal = sun.elevationDeg;
    if (earth.elevationDeg > maxEarthElevDeg) maxEarthElevDeg = earth.elevationDeg;
    if (earth.elevationDeg < minEarthElevDegVal) minEarthElevDegVal = earth.elevationDeg;

    samples.push({
      timestampMs: tMs,
      isoUtc: d.toISOString(),
      sun,
      earth,
      sunHorizonElevDeg,
      earthHorizonElevDeg,
      sunClearanceDeg,
      earthClearanceDeg,
      sunVisibleFrac,
      sunUsable,
      earthUsable,
      simultaneousUsable,
      solarIrradianceWm2,
      arrayOutputWm2,
      rfOneWaySec,
    });
  }

  const stepHours = stepMinutes / 60;
  const meanPowerWm2 = sumPowerWm2 / samples.length;
  const totalEnergyKwhM2 = (meanPowerWm2 * durationHours) / 1000;

  return {
    samples,
    summary: {
      totalSamples: samples.length,
      durationHours,
      sunVisiblePct: (sunUsableCount / samples.length) * 100,
      earthVisiblePct: (earthUsableCount / samples.length) * 100,
      simultaneousPct: (simultaneousCount / samples.length) * 100,
      longestDarkHours: maxDarkRun * stepHours,
      longestCommBlackoutHours: maxBlackoutRun * stepHours,
      meanPowerWm2,
      peakPowerWm2,
      totalEnergyKwhM2,
      maxSunElevDeg,
      minSunElevDeg: minSunElevDegVal,
      maxEarthElevDeg,
      minEarthElevDeg: minEarthElevDegVal,
    },
  };
}
