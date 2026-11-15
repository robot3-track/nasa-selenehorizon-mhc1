import React, { useMemo, useState } from 'react';
import {
  EphemerisSample,
  computeSunEarthTopocentric,
} from '../lib/lunarEphemeris';
import {
  ParsedHorizonsRow,
  parseCustomHorizonProfile,
  parseJplHorizonsText,
} from '../lib/horizonsParser';
import { EXACT_NASA_URLS, buildHorizonsApiUrl } from '../lib/nasaData';
import { useComprehension } from '../lib/comprehension';
import { DiagramSwoop, ExplainDropdown } from './NotebookPrimitives';
import { CheckCircle2, Download, RefreshCw, RotateCcw, Upload } from 'lucide-react';

interface DataHorizonsViewProps {
  siteName: string;
  latDeg: number;
  lonDeg: number;
  elevM: number;
  startDateIso: string;
  durationHours: number;
  samples: EphemerisSample[];
  horizonsOverlay: ParsedHorizonsRow[];
  hasCustomHorizon: boolean;
  demSourceLabel: string;
  onSetHorizonsOverlay: (rows: ParsedHorizonsRow[]) => void;
  onApplyCustomHorizon: (profile: number[]) => void;
  onResetHorizon: () => void;
  onExportCsv: () => void;
}

const SAMPLE_HORIZONS_CSV = `$$SOE
2026-Nov-14 00:00, , , 270.112, 1.540
2026-Nov-14 06:00, , , 273.214, 1.568
2026-Nov-14 12:00, , , 276.319, 1.591
2026-Nov-14 18:00, , , 279.420, 1.610
2026-Nov-15 00:00, , , 282.518, 1.625
$$EOE`;

const SAMPLE_HORIZON_MASK = `# Azimuth (deg), Horizon Elevation (deg)
0, 1.4
45, 0.8
90, 2.2
135, 3.6
180, 1.1
225, 0.5
270, 1.8
315, 2.4`;

export const DataHorizonsView: React.FC<DataHorizonsViewProps> = ({
  siteName,
  latDeg,
  lonDeg,
  elevM,
  startDateIso,
  durationHours,
  samples,
  horizonsOverlay,
  hasCustomHorizon,
  demSourceLabel,
  onSetHorizonsOverlay,
  onApplyCustomHorizon,
  onResetHorizon,
  onExportCsv,
}) => {
  const { level } = useComprehension();
  const isHighSchool = level === 'high-school';
  const isAdvanced = level === 'graduate' || level === 'nasa-professor';
  const isProfessor = level === 'nasa-professor';
  const degDecimals = isProfessor ? 3 : 2;

  const [horizonsText, setHorizonsText] = useState('');
  const [horizonsStatus, setHorizonsStatus] = useState<{
    type: 'idle' | 'loading' | 'success' | 'error';
    message?: string;
  }>({ type: 'idle' });
  const [apiTarget, setApiTarget] = useState<'10' | '399'>('10');

  const [maskText, setMaskText] = useState('');
  const [maskStatus, setMaskStatus] = useState<{
    type: 'idle' | 'success' | 'error';
    message?: string;
  }>({ type: 'idle' });

  const [page, setPage] = useState(0);
  const pageSize = isHighSchool ? 12 : 24;

  const comparisonRows = useMemo(() => {
    return horizonsOverlay.slice(0, 60).map((row) => {
      const local = computeSunEarthTopocentric(new Date(row.timestampMs), latDeg, lonDeg, elevM);
      const ref = row.target === 'Earth' ? local.earth : local.sun;
      const dAz = ((row.azimuthDeg - ref.azimuthDeg + 540) % 360) - 180;
      const dEl = row.elevationDeg - ref.elevationDeg;
      return {
        ...row,
        localAz: ref.azimuthDeg,
        localEl: ref.elevationDeg,
        dAz,
        dEl,
      };
    });
  }, [horizonsOverlay, latDeg, lonDeg, elevM]);

  const handleFetchHorizons = async () => {
    setHorizonsStatus({ type: 'loading', message: 'Querying NASA JPL Horizons API...' });
    try {
      const start = new Date(`${startDateIso}:00Z`);
      const stop = new Date(start.getTime() + Math.min(durationHours, 168) * 3600 * 1000);
      const qs = new URLSearchParams({
        lat: latDeg.toFixed(4),
        lon: lonDeg.toFixed(4),
        elevKm: (elevM / 1000).toFixed(3),
        startTime: start.toISOString(),
        stopTime: stop.toISOString(),
        stepSize: '6 h',
        target: apiTarget,
      });

      const res = await fetch(`/api/horizons?${qs.toString()}`);
      const json = (await res.json()) as { result?: string; error?: string; target?: string };
      if (!res.ok || !json.result) {
        setHorizonsStatus({
          type: 'error',
          message: json.error || 'Failed to retrieve NASA JPL Horizons table.',
        });
        return;
      }

      setHorizonsText(json.result);
      const parsed = parseJplHorizonsText(json.result);
      if (parsed.error) {
        setHorizonsStatus({ type: 'error', message: parsed.error });
        return;
      }
      const labeled = parsed.rows.map((r) => ({
        ...r,
        target: (apiTarget === '399' ? 'Earth' : 'Sun') as 'Sun' | 'Earth',
      }));
      onSetHorizonsOverlay(labeled);
      setHorizonsStatus({
        type: 'success',
        message: `Loaded ${labeled.length} live NASA JPL Horizons DE441 points (${json.target}).`,
      });
    } catch (err) {
      setHorizonsStatus({
        type: 'error',
        message:
          err instanceof Error
            ? err.message
            : 'Network error reaching /api/horizons. Paste a Horizons CSV table below instead.',
      });
    }
  };

  const handleParseHorizons = () => {
    const parsed = parseJplHorizonsText(horizonsText);
    if (parsed.error) {
      setHorizonsStatus({ type: 'error', message: parsed.error });
      return;
    }
    onSetHorizonsOverlay(parsed.rows);
    setHorizonsStatus({
      type: 'success',
      message: `Parsed ${parsed.rows.length} rows (${parsed.detectedTarget}) and overlaid onto the 360° Horizon Panorama.`,
    });
  };

  const handleParseMask = () => {
    const parsed = parseCustomHorizonProfile(maskText);
    if (parsed.error || !parsed.profile) {
      setMaskStatus({ type: 'error', message: parsed.error || 'Invalid mask input.' });
      return;
    }
    onApplyCustomHorizon(parsed.profile);
    setMaskStatus({
      type: 'success',
      message: 'Applied custom 360° horizon elevation profile to active simulation.',
    });
  };

  const totalPages = Math.max(1, Math.ceil(samples.length / pageSize));
  const pagedSamples = samples.slice(page * pageSize, (page + 1) * pageSize);

  const directHorizonsUrl = useMemo(() => {
    const start = new Date(`${startDateIso}:00Z`);
    const validStart = Number.isNaN(start.getTime()) ? new Date() : start;
    const stop = new Date(validStart.getTime() + Math.min(durationHours, 168) * 3600 * 1000);
    return buildHorizonsApiUrl(
      latDeg,
      lonDeg,
      elevM,
      validStart.toISOString(),
      stop.toISOString(),
      apiTarget
    );
  }, [latDeg, lonDeg, elevM, startDateIso, durationHours, apiTarget]);

  const rmseStats = useMemo(() => {
    if (!comparisonRows.length) return null;
    const sumAz2 = comparisonRows.reduce((acc, r) => acc + r.dAz * r.dAz, 0);
    const sumEl2 = comparisonRows.reduce((acc, r) => acc + r.dEl * r.dEl, 0);
    return {
      azRmse: Math.sqrt(sumAz2 / comparisonRows.length),
      elRmse: Math.sqrt(sumEl2 / comparisonRows.length),
    };
  }, [comparisonRows]);

  return (
    <div className="max-w-[1440px] mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-6">
      {!isHighSchool && (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Panel 1: NASA JPL Horizons Live & CSV Importer */}
        <DiagramSwoop className="notebook-sheet overflow-hidden flex flex-col">
          <div className="p-5 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  NASA JPL Horizons Ephemeris Verification
                </h2>
                <p className="text-xs text-slate-600 mt-1">
                  Query NASA JPL Horizons (DE441) directly for <span className="font-semibold">{siteName}</span> or paste an exported CSV/plain-text table to cross-check Sun &amp; Earth angles.
                </p>
              </div>
              <div className="flex items-center gap-1 bg-[#F4EFE4] p-1 rounded-lg border border-[#E4DDD0]">
              <button
                type="button"
                onClick={() => setApiTarget('10')}
                className={`px-2.5 py-1 text-xs font-medium rounded whitespace-nowrap shrink-0 cursor-pointer ${
                  apiTarget === '10'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Target: Sun
              </button>
              <button
                type="button"
                onClick={() => setApiTarget('399')}
                className={`px-2.5 py-1 text-xs font-medium rounded whitespace-nowrap shrink-0 cursor-pointer ${
                  apiTarget === '399'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Target: Earth
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleFetchHorizons}
              disabled={horizonsStatus.type === 'loading'}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold bg-blue-700 text-white rounded hover:bg-blue-800 transition-colors disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${horizonsStatus.type === 'loading' ? 'animate-spin' : ''}`}
              />
              Fetch Live JPL Horizons
            </button>
            <button
              type="button"
              onClick={() => setHorizonsText(SAMPLE_HORIZONS_CSV)}
              className="px-3 py-2 text-xs font-medium text-slate-700 bg-slate-50 border border-slate-300 rounded hover:bg-slate-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Load Sample Table
            </button>
            {horizonsOverlay.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  onSetHorizonsOverlay([]);
                  setHorizonsStatus({ type: 'idle' });
                }}
                className="px-3 py-2 text-xs font-medium text-slate-500 hover:text-slate-800 whitespace-nowrap shrink-0 cursor-pointer"
              >
                Clear Overlay
              </button>
            )}
          </div>

          <textarea
            value={horizonsText}
            onChange={(e) => setHorizonsText(e.target.value)}
            placeholder="Paste NASA JPL Horizons output (CSV or $$SOE ... $$EOE Azimuth/Elevation table)..."
            rows={6}
            className="w-full bg-slate-50 border border-slate-300 rounded p-3 text-xs font-mono text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-600"
          />

          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={handleParseHorizons}
              disabled={!horizonsText.trim()}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium bg-slate-900 text-white rounded hover:bg-slate-800 transition-colors disabled:opacity-40 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              Parse &amp; Overlay Table
            </button>

            {horizonsStatus.type !== 'idle' && (
              <p
                className={`text-xs font-medium ${
                  horizonsStatus.type === 'error'
                    ? 'text-rose-700'
                    : horizonsStatus.type === 'success'
                      ? 'text-emerald-700'
                      : 'text-blue-700'
                }`}
              >
                {horizonsStatus.message}
              </p>
            )}
          </div>

          {comparisonRows.length > 0 && (
            <div className="border-t border-slate-200 pt-3">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <div className="text-xs font-semibold text-slate-700">
                  NASA JPL Horizons DE441 vs. Local Solver Residuals
                </div>
                {isAdvanced && rmseStats && (
                  <div className="text-[11px] font-mono text-blue-800 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                    RMSE: ΔAz {rmseStats.azRmse.toFixed(3)}° · ΔEl {rmseStats.elRmse.toFixed(3)}°
                  </div>
                )}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs font-mono tabular-nums text-left">
                  <thead>
                    <tr className="text-slate-500 border-b border-slate-200 font-sans">
                      <th className="py-1.5 pr-3">UTC</th>
                      <th className="py-1.5 pr-3 text-right">JPL Az / El</th>
                      <th className="py-1.5 pr-3 text-right">Local Az / El</th>
                      <th className="py-1.5 text-right">Residual ΔAz / ΔEl</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {comparisonRows.slice(0, 6).map((r, i) => (
                      <tr key={i}>
                        <td className="py-1.5 pr-3 text-slate-700">{r.isoUtc.slice(0, 16)}</td>
                        <td className="py-1.5 pr-3 text-right text-slate-900 font-medium">
                          {r.azimuthDeg.toFixed(degDecimals)}° / {r.elevationDeg.toFixed(degDecimals)}°
                        </td>
                        <td className="py-1.5 pr-3 text-right text-slate-600">
                          {r.localAz.toFixed(degDecimals)}° / {r.localEl.toFixed(degDecimals)}°
                        </td>
                        <td className="py-1.5 text-right text-blue-700 font-semibold">
                          {r.dAz >= 0 ? '+' : ''}
                          {r.dAz.toFixed(degDecimals)}° / {r.dEl >= 0 ? '+' : ''}
                          {r.dEl.toFixed(degDecimals)}°
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          </div>

          <ExplainDropdown
            contentKey="jplVerify"
            sources={[
              { label: 'Live JPL Horizons API Query for This Site', url: directHorizonsUrl },
              { label: 'JPL Horizons Web App', url: EXACT_NASA_URLS.jplHorizonsApp },
            ]}
          />
        </DiagramSwoop>

        {/* Panel 2: Custom LOLA / Moon Trek Horizon Mask Importer */}
        <DiagramSwoop delay={0.08} className="notebook-sheet overflow-hidden flex flex-col">
          <div className="p-5 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Custom Horizon Profile Import
                </h2>
                <p className="text-xs text-slate-600 mt-1">
                  Active terrain source: <span className="font-semibold text-slate-800">{demSourceLabel}</span>. Optionally override with a 360° horizon CSV (azimuth°, elevation°) exported from NASA Moon Trek or PDS LOLA 5 m/px GeoTIFFs.
                </p>
              </div>
            {hasCustomHorizon && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 whitespace-nowrap shrink-0">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Custom Mask Active
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setMaskText(SAMPLE_HORIZON_MASK)}
              className="px-3 py-2 text-xs font-medium text-slate-700 bg-slate-50 border border-slate-300 rounded hover:bg-slate-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Load Sample Horizon CSV
            </button>
            {hasCustomHorizon && (
              <button
                type="button"
                onClick={() => {
                  onResetHorizon();
                  setMaskStatus({ type: 'idle' });
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-amber-800 bg-amber-50 border border-amber-300 rounded hover:bg-amber-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Restore NASA LOLA DEM
              </button>
            )}
          </div>

          <textarea
            value={maskText}
            onChange={(e) => setMaskText(e.target.value)}
            placeholder="0, 1.4&#10;45, 0.8&#10;90, 2.2&#10;..."
            rows={6}
            className="w-full bg-slate-50 border border-slate-300 rounded p-3 text-xs font-mono text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-600"
          />

          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={handleParseMask}
              disabled={!maskText.trim()}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium bg-slate-900 text-white rounded hover:bg-slate-800 transition-colors disabled:opacity-40 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              Apply Custom Horizon
            </button>

            {maskStatus.type !== 'idle' && (
              <p
                className={`text-xs font-medium ${
                  maskStatus.type === 'error' ? 'text-rose-700' : 'text-emerald-700'
                }`}
              >
                {maskStatus.message}
              </p>
            )}
            </div>
          </div>

          <ExplainDropdown
            contentKey="customMask"
            sources={[
              { label: 'PDS LRO LOLA 5m/px Polar GDRs', url: EXACT_NASA_URLS.lolaPolarGdr },
              { label: 'NASA Moon Trek 5m ImageServer', url: EXACT_NASA_URLS.lolaDem5mService },
              { label: 'NASA Moon Trek Portal', url: EXACT_NASA_URLS.moonTrekPortal },
            ]}
          />
        </DiagramSwoop>
      </div>
      )}

      {/* Full Ephemeris Data Table (Simplified 4-column schedule in High School mode; expanded margins & precision in Grad/Prof) */}
      <DiagramSwoop className="notebook-sheet overflow-hidden">
        <div className="px-4 sm:px-5 py-3.5 border-b border-[#EAE3D5] flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              {isHighSchool
                ? 'Sunlight & Earth Radio Schedule'
                : 'Computed Ephemeris & Link Budget Table'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {isHighSchool
                ? `${siteName} · ${samples.length} time steps · Switch to Intermediate or higher in the header menu for raw Az/El angles and JPL Horizons DE441 tools`
                : `${siteName} · ${Math.abs(latDeg).toFixed(3)}°S, ${lonDeg.toFixed(2)}°E · ${samples.length} epochs · Terrain: ${demSourceLabel}`}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs text-slate-600">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="px-2.5 py-1 border border-slate-300 rounded disabled:opacity-35 hover:bg-slate-100 cursor-pointer"
              >
                Prev
              </button>
              <span className="px-2 font-mono tabular-nums">
                {page + 1} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="px-2.5 py-1 border-slate-300 border rounded disabled:opacity-35 hover:bg-slate-100 cursor-pointer"
              >
                Next
              </button>
            </div>
            <button
              type="button"
              onClick={onExportCsv}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold bg-blue-700 text-white rounded hover:bg-blue-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Download CSV
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          {isHighSchool ? (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs text-slate-600">
                  <th className="py-2.5 px-4 font-semibold">Date &amp; Time (UTC)</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Sunlight</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Earth Signal</th>
                  <th className="py-2.5 px-4 font-semibold text-right">Overall Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {pagedSamples.map((s) => (
                  <tr key={s.timestampMs} className="hover:bg-slate-50">
                    <td className="py-2.5 px-4 font-mono tabular-nums text-slate-700">
                      {s.isoUtc.slice(0, 16).replace('T', ' ')}
                    </td>
                    <td className="py-2.5 px-3 text-right font-medium">
                      {s.sunUsable ? (
                        <span className="text-amber-700">
                          {(s.sunVisibleFrac * 100).toFixed(0)}% Sun ({s.arrayOutputWm2.toFixed(0)} W/m²)
                        </span>
                      ) : (
                        <span className="text-slate-500">Blocked by Crater</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right font-medium">
                      {s.earthUsable ? (
                        <span className="text-sky-700">Clear Line-of-Sight</span>
                      ) : (
                        <span className="text-slate-500">Blocked by Ridge</span>
                      )}
                    </td>
                    <td className="py-2.5 px-4 text-right font-medium">
                      {s.simultaneousUsable ? (
                        <span className="text-emerald-700">● Power + Signal Ready</span>
                      ) : s.sunUsable ? (
                        <span className="text-amber-700">● Solar Power Only</span>
                      ) : s.earthUsable ? (
                        <span className="text-sky-700">● Signal Only (Battery)</span>
                      ) : (
                        <span className="text-slate-500">✖ Eclipse / Blackout</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs text-slate-600">
                  <th className="py-2.5 px-4 font-semibold">Timestamp (UTC)</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Sun Az</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Sun El</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Sun Mask</th>
                  {isAdvanced && (
                    <th className="py-2.5 px-3 font-semibold text-right">Δθ Sun</th>
                  )}
                  <th className="py-2.5 px-3 font-semibold text-right">Array Power</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Earth Az</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Earth El</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Earth Mask</th>
                  {isAdvanced && (
                    <>
                      <th className="py-2.5 px-3 font-semibold text-right">Δθ DTE</th>
                      <th className="py-2.5 px-3 font-semibold text-right">OWLT</th>
                    </>
                  )}
                  <th className="py-2.5 px-4 font-semibold text-right">Window State</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {pagedSamples.map((s) => {
                  const sunMargin = s.sun.elevationDeg - s.sunHorizonElevDeg;
                  const earthMargin = s.earth.elevationDeg - s.earthHorizonElevDeg;
                  return (
                    <tr key={s.timestampMs} className="hover:bg-slate-50">
                      <td className="py-2 px-4 font-mono tabular-nums text-slate-700">
                        {s.isoUtc.slice(0, 16).replace('T', ' ')}
                      </td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-800">
                        {s.sun.azimuthDeg.toFixed(degDecimals)}°
                      </td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums text-amber-700 font-medium">
                        {s.sun.elevationDeg >= 0 ? '+' : ''}
                        {s.sun.elevationDeg.toFixed(degDecimals)}°
                      </td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-500">
                        {s.sunHorizonElevDeg >= 0 ? '+' : ''}
                        {s.sunHorizonElevDeg.toFixed(degDecimals)}°
                      </td>
                      {isAdvanced && (
                        <td
                          className={`py-2 px-3 text-right font-mono tabular-nums font-medium ${
                            sunMargin >= 0 ? 'text-emerald-700' : 'text-rose-700'
                          }`}
                        >
                          {sunMargin >= 0 ? '+' : ''}
                          {sunMargin.toFixed(degDecimals)}°
                        </td>
                      )}
                      <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-900 font-medium">
                        {s.arrayOutputWm2.toFixed(0)} W/m²
                      </td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-800">
                        {s.earth.azimuthDeg.toFixed(degDecimals)}°
                      </td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums text-sky-700 font-medium">
                        {s.earth.elevationDeg >= 0 ? '+' : ''}
                        {s.earth.elevationDeg.toFixed(degDecimals)}°
                      </td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-500">
                        {s.earthHorizonElevDeg >= 0 ? '+' : ''}
                        {s.earthHorizonElevDeg.toFixed(degDecimals)}°
                      </td>
                      {isAdvanced && (
                        <>
                          <td
                            className={`py-2 px-3 text-right font-mono tabular-nums font-medium ${
                              earthMargin >= 0 ? 'text-emerald-700' : 'text-rose-700'
                            }`}
                          >
                            {earthMargin >= 0 ? '+' : ''}
                            {earthMargin.toFixed(degDecimals)}°
                          </td>
                          <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-600">
                            {s.rfOneWaySec.toFixed(3)}s
                          </td>
                        </>
                      )}
                      <td className="py-2 px-4 text-right font-medium">
                        {s.simultaneousUsable ? (
                          <span className="text-emerald-700">● Power + DTE</span>
                        ) : s.sunUsable ? (
                          <span className="text-amber-700">● Power Only</span>
                        ) : s.earthUsable ? (
                          <span className="text-sky-700">● DTE Only</span>
                        ) : (
                          <span className="text-slate-500">✖ Dark / Occulted</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <ExplainDropdown
          contentKey="ephemTable"
          sources={[
            { label: 'Live JPL Horizons API Query', url: directHorizonsUrl },
            { label: 'LOLA 5m/px Polar DEM', url: EXACT_NASA_URLS.lolaDem5mService },
            { label: 'LOLA 30m/px SPole75 DEM', url: EXACT_NASA_URLS.lolaDem30mService },
            { label: 'NAIF SPICE Kernels', url: EXACT_NASA_URLS.naifSpiceKernels },
          ]}
        />
      </DiagramSwoop>
    </div>
  );
};
