import { EphemerisSample } from './lunarEphemeris';

export interface ParsedHorizonsRow {
  isoUtc: string;
  timestampMs: number;
  azimuthDeg: number;
  elevationDeg: number;
  target: 'Sun' | 'Earth' | 'Unknown';
}

const MONTHS: Record<string, number> = {
  Jan: 0,
  Feb: 1,
  Mar: 2,
  Apr: 3,
  May: 4,
  Jun: 5,
  Jul: 6,
  Aug: 7,
  Sep: 8,
  Oct: 9,
  Nov: 10,
  Dec: 11,
};

function parseHorizonsDate(token: string): Date | null {
  const clean = token.trim();
  // Format 1: 2026-Nov-14 00:00 or 2026-Nov-14 00:00:00
  const m = clean.match(/^(\d{4})-([A-Za-z]{3})-(\d{2})\s+(\d{2}):(\d{2})(?::(\d{2}(?:\.\d+)?))?/);
  if (m) {
    const year = Number(m[1]);
    const month = MONTHS[m[2]];
    const day = Number(m[3]);
    const hour = Number(m[4]);
    const min = Number(m[5]);
    const sec = m[6] ? Math.floor(Number(m[6])) : 0;
    if (month !== undefined) {
      return new Date(Date.UTC(year, month, day, hour, min, sec));
    }
  }
  // Format 2: ISO string
  const parsed = new Date(clean.endsWith('Z') ? clean : `${clean}Z`);
  if (!Number.isNaN(parsed.getTime())) return parsed;
  return null;
}

/**
 * Parses NASA JPL Horizons plain-text or CSV ephemeris output (with or without $$SOE..$$EOE).
 */
export function parseJplHorizonsText(rawText: string): {
  rows: ParsedHorizonsRow[];
  detectedTarget: 'Sun' | 'Earth' | 'Unknown';
  error?: string;
} {
  let detectedTarget: 'Sun' | 'Earth' | 'Unknown' = 'Unknown';
  if (/Target body name:\s*Sun/i.test(rawText)) detectedTarget = 'Sun';
  else if (/Target body name:\s*Earth/i.test(rawText)) detectedTarget = 'Earth';

  const soeIdx = rawText.indexOf('$$SOE');
  const eoeIdx = rawText.indexOf('$$EOE');
  const bodyText =
    soeIdx !== -1 && eoeIdx !== -1 && eoeIdx > soeIdx
      ? rawText.slice(soeIdx + 5, eoeIdx)
      : rawText;

  const lines = bodyText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('*') && !l.startsWith('#') && !l.startsWith('Date'));

  const rows: ParsedHorizonsRow[] = [];

  for (const line of lines) {
    // Try CSV first
    if (line.includes(',')) {
      const parts = line.split(',').map((p) => p.trim());
      const date = parseHorizonsDate(parts[0]);
      if (!date) continue;

      // Extract numeric columns after date (skipping empty solar-presence flags like '', '*', 'm')
      const nums = parts
        .slice(1)
        .map((p) => (p === '' ? NaN : Number(p)))
        .filter((n) => Number.isFinite(n));

      if (nums.length >= 2) {
        const az = nums[0];
        const el = nums[1];
        if (az >= 0 && az <= 360 && el >= -90 && el <= 90) {
          rows.push({
            isoUtc: date.toISOString(),
            timestampMs: date.getTime(),
            azimuthDeg: az,
            elevationDeg: el,
            target: detectedTarget,
          });
        }
      }
      continue;
    }

    // Try whitespace-separated Horizons table line: "2026-Nov-14 00:00  *  142.3456  2.1234"
    const m = line.match(
      /^(\d{4}-[A-Za-z]{3}-\d{2}\s+\d{2}:\d{2}(?::\d{2})?)\s+(?:[*CmNtAr\s]*?)\s+(-?\d+\.\d+)\s+(-?\d+\.\d+)/
    );
    if (m) {
      const date = parseHorizonsDate(m[1]);
      const az = Number(m[2]);
      const el = Number(m[3]);
      if (date && Number.isFinite(az) && Number.isFinite(el)) {
        rows.push({
          isoUtc: date.toISOString(),
          timestampMs: date.getTime(),
          azimuthDeg: ((az % 360) + 360) % 360,
          elevationDeg: el,
          target: detectedTarget,
        });
      }
    }
  }

  if (rows.length === 0) {
    return {
      rows: [],
      detectedTarget,
      error:
        'No valid ephemeris rows found. Expected JPL Horizons CSV or $$SOE..$$EOE table with Date (UTC), Azimuth (deg), and Elevation (deg).',
    };
  }

  return { rows, detectedTarget };
}

/**
 * Parses a custom 360-degree horizon mask from CSV ("azimuth,elevation") or JSON array.
 */
export function parseCustomHorizonProfile(rawText: string): {
  profile?: number[];
  error?: string;
} {
  const trimmed = rawText.trim();
  if (!trimmed) return { error: 'Input is empty.' };

  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed);
      const arr = Array.isArray(parsed) ? parsed : parsed.horizon || parsed.elevations;
      if (Array.isArray(arr) && arr.length === 360 && arr.every((n) => typeof n === 'number')) {
        return { profile: arr };
      }
    } catch {
      return { error: 'Invalid JSON format. Provide a 360-element number array or azimuth,elevation CSV.' };
    }
  }

  const pairs: Array<{ az: number; el: number }> = [];
  for (const line of trimmed.split(/\r?\n/)) {
    const clean = line.trim();
    if (!clean || clean.startsWith('#') || /^[a-zA-Z]/.test(clean)) continue;
    const parts = clean.split(/[,\s;]+/).map(Number);
    if (parts.length >= 2 && Number.isFinite(parts[0]) && Number.isFinite(parts[1])) {
      pairs.push({ az: ((parts[0] % 360) + 360) % 360, el: Math.max(-30, Math.min(60, parts[1])) });
    }
  }

  if (pairs.length < 8) {
    return {
      error: 'Need at least 8 azimuth,elevation data rows (e.g. "0, 1.45") to interpolate a 360° horizon mask.',
    };
  }

  pairs.sort((a, b) => a.az - b.az);
  const profile = new Array<number>(360);

  for (let az = 0; az < 360; az++) {
    let idx = pairs.findIndex((p) => p.az >= az);
    if (idx === -1) {
      const p0 = pairs[pairs.length - 1];
      const p1 = pairs[0];
      const span = p1.az + 360 - p0.az;
      const t = span > 0 ? (az - p0.az) / span : 0;
      profile[az] = Number((p0.el * (1 - t) + p1.el * t).toFixed(3));
    } else if (idx === 0) {
      const p0 = pairs[pairs.length - 1];
      const p1 = pairs[0];
      const span = p1.az + 360 - p0.az;
      const t = span > 0 ? (az + 360 - p0.az) / span : 0;
      profile[az] = Number((p0.el * (1 - t) + p1.el * t).toFixed(3));
    } else {
      const p0 = pairs[idx - 1];
      const p1 = pairs[idx];
      const span = p1.az - p0.az;
      const t = span > 0 ? (az - p0.az) / span : 0;
      profile[az] = Number((p0.el * (1 - t) + p1.el * t).toFixed(3));
    }
  }

  return { profile };
}

/**
 * Generates a mission ephemeris CSV ready for engineering spreadsheets or Python pipelines.
 */
export function buildEphemerisCsv(
  siteName: string,
  latDeg: number,
  lonDeg: number,
  elevM: number,
  samples: EphemerisSample[]
): string {
  const header = [
    `# Selene Horizon Lunar South Pole Ephemeris Export`,
    `# Site: ${siteName} | Lat: ${latDeg.toFixed(4)} deg | Lon: ${lonDeg.toFixed(4)} deg E | Datum Elev: ${elevM.toFixed(0)} m`,
    `UTC_Time,Sun_Azimuth_deg,Sun_Elevation_deg,Sun_Horizon_deg,Sun_Clearance_deg,Solar_Visible_Fraction,Array_Power_Wm2,Earth_Azimuth_deg,Earth_Elevation_deg,Earth_Horizon_deg,Earth_Clearance_deg,DTE_Link_Clear,Simultaneous_Sun_DTE,OneWay_RF_Latency_s`,
  ];

  const rows = samples.map((s) =>
    [
      s.isoUtc,
      s.sun.azimuthDeg.toFixed(3),
      s.sun.elevationDeg.toFixed(3),
      s.sunHorizonElevDeg.toFixed(3),
      s.sunClearanceDeg.toFixed(3),
      s.sunVisibleFrac.toFixed(3),
      s.arrayOutputWm2.toFixed(1),
      s.earth.azimuthDeg.toFixed(3),
      s.earth.elevationDeg.toFixed(3),
      s.earthHorizonElevDeg.toFixed(3),
      s.earthClearanceDeg.toFixed(3),
      s.earthUsable ? '1' : '0',
      s.simultaneousUsable ? '1' : '0',
      s.rfOneWaySec.toFixed(4),
    ].join(',')
  );

  return [...header, ...rows].join('\n');
}
