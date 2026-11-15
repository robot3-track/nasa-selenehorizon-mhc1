import React, { useEffect, useMemo, useState } from 'react';
import {
  LUNAR_SOUTH_POLE_SITES,
  LandingSite,
  LolaDemGrid,
  computeHorizonProfile,
} from '../lib/lunarSites';
import {
  SolarArrayMode,
  WindowSummaryStats,
  EphemerisSample,
  simulateMissionWindow,
} from '../lib/lunarEphemeris';
import { EXACT_NASA_URLS, fetchCrestLolaDem, fetchLocalLolaDem } from '../lib/nasaData';
import { resolvePointLabels } from '../lib/labelPlacement';
import { useComprehension } from '../lib/comprehension';
import { ArrowRight, Calendar, ChevronDown, ChevronRight, Layers } from 'lucide-react';
import { ArtemisPolarBadge } from './NasaInsignia';
import { DiagramSwoop, ExplainDropdown } from './NotebookPrimitives';

interface SiteCompareViewProps {
  startDateIso: string;
  durationHours: number;
  mastHeightM: number;
  minSunElevDeg: number;
  minEarthElevDeg: number;
  solarArrayMode: SolarArrayMode;
  regionalDem: LolaDemGrid | null;
  onLoadSiteInWorkbench: (site: LandingSite, dateIso?: string) => void;
}

interface SiteSimResult {
  site: LandingSite;
  horizon: number[];
  samples: EphemerisSample[];
  summary: WindowSummaryStats;
  hasCrestDem: boolean;
}

const SEASONAL_DATES = [
  { id: '2026-11-14T00:00', label: 'Nov 2026 (Current)' },
  { id: '2026-12-21T00:00', label: 'Dec 2026 (South Summer)' },
  { id: '2027-03-20T00:00', label: 'Mar 2027 (Equinox)' },
  { id: '2027-06-21T00:00', label: 'Jun 2027 (South Winter)' },
];

const SERIES_COLORS = ['#D97706', '#0B3D91', '#0284C7', '#059669'];

export const SiteCompareView: React.FC<SiteCompareViewProps> = ({
  startDateIso,
  durationHours,
  mastHeightM,
  minSunElevDeg,
  minEarthElevDeg,
  solarArrayMode,
  regionalDem,
  onLoadSiteInWorkbench,
}) => {
  const { level } = useComprehension();
  const isHighSchool = level === 'high-school';
  const isAdvanced = level === 'graduate' || level === 'nasa-professor';

  const [compareMode, setCompareMode] = useState<'sites' | 'dates'>('sites');
  const [selectedSiteIds, setSelectedSiteIds] = useState<string[]>([
    'connecting-ridge',
    'shackleton-rim',
    'malapert-massif',
    'mons-mouton',
  ]);
  const [dateCompareSiteId, setDateCompareSiteId] = useState<string>('connecting-ridge');
  const [showDataMatrix, setShowDataMatrix] = useState<boolean>(isAdvanced);
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);

  useEffect(() => {
    setShowDataMatrix(isAdvanced);
  }, [isAdvanced]);

  // Cache high-resolution crest & local DEMs per candidate site so compare matches Explorer accuracy
  const [siteDems, setSiteDems] = useState<
    Record<string, { crest: LolaDemGrid | null; local: LolaDemGrid | null }>
  >({});

  const neededSiteIds = useMemo(() => {
    return compareMode === 'sites' ? selectedSiteIds : [dateCompareSiteId];
  }, [compareMode, selectedSiteIds, dateCompareSiteId]);

  useEffect(() => {
    let active = true;
    for (const id of neededSiteIds) {
      if (siteDems[id]) continue;
      const site = LUNAR_SOUTH_POLE_SITES.find((s) => s.id === id);
      if (!site) continue;

      Promise.all([
        fetchCrestLolaDem(site.latDeg, site.lonDeg).catch(() => null),
        fetchLocalLolaDem(site.latDeg, site.lonDeg).catch(() => null),
      ]).then(([crest, local]) => {
        if (!active) return;
        setSiteDems((prev) => ({
          ...prev,
          [id]: { crest, local },
        }));
      });
    }
    return () => {
      active = false;
    };
  }, [neededSiteIds, siteDems]);

  const toggleSite = (id: string) => {
    setSelectedSiteIds((prev) => {
      if (prev.includes(id)) {
        return prev.length > 1 ? prev.filter((x) => x !== id) : prev;
      }
      if (prev.length >= 4) {
        return [...prev.slice(1), id];
      }
      return [...prev, id];
    });
  };

  const stepMinutes = durationHours > 240 ? 180 : durationHours > 72 ? 60 : 30;

  const siteComparisons: SiteSimResult[] = useMemo(() => {
    const start = new Date(`${startDateIso}:00Z`);
    const validStart = Number.isNaN(start.getTime()) ? new Date() : start;

    return selectedSiteIds
      .map((id) => LUNAR_SOUTH_POLE_SITES.find((s) => s.id === id))
      .filter((s): s is LandingSite => Boolean(s))
      .map((site) => {
        const demPair = siteDems[site.id];
        const horizon = computeHorizonProfile(
          site.latDeg,
          site.lonDeg,
          mastHeightM,
          demPair?.crest ?? null,
          demPair?.local ?? null,
          regionalDem
        );
        const sim = simulateMissionWindow({
          latDeg: site.latDeg,
          lonDeg: site.lonDeg,
          elevM: site.elevM,
          horizonProfileDeg: horizon,
          startDate: validStart,
          durationHours,
          stepMinutes,
          minSunElevDeg,
          minEarthElevDeg,
          solarArrayMode,
        });
        return {
          site,
          horizon,
          samples: sim.samples,
          summary: sim.summary,
          hasCrestDem: Boolean(demPair?.crest),
        };
      });
  }, [
    selectedSiteIds,
    startDateIso,
    durationHours,
    stepMinutes,
    mastHeightM,
    minSunElevDeg,
    minEarthElevDeg,
    solarArrayMode,
    regionalDem,
    siteDems,
  ]);

  const dateComparisons = useMemo(() => {
    const site =
      LUNAR_SOUTH_POLE_SITES.find((s) => s.id === dateCompareSiteId) ?? LUNAR_SOUTH_POLE_SITES[0];
    const demPair = siteDems[site.id];
    const horizon = computeHorizonProfile(
      site.latDeg,
      site.lonDeg,
      mastHeightM,
      demPair?.crest ?? null,
      demPair?.local ?? null,
      regionalDem
    );

    return SEASONAL_DATES.map((dItem) => {
      const start = new Date(`${dItem.id}:00Z`);
      const sim = simulateMissionWindow({
        latDeg: site.latDeg,
        lonDeg: site.lonDeg,
        elevM: site.elevM,
        horizonProfileDeg: horizon,
        startDate: start,
        durationHours,
        stepMinutes,
        minSunElevDeg,
        minEarthElevDeg,
        solarArrayMode,
      });
      return {
        dateItem: dItem,
        site,
        horizon,
        samples: sim.samples,
        summary: sim.summary,
      };
    });
  }, [
    dateCompareSiteId,
    durationHours,
    stepMinutes,
    mastHeightM,
    minSunElevDeg,
    minEarthElevDeg,
    solarArrayMode,
    regionalDem,
    siteDems,
  ]);

  const activeRows =
    compareMode === 'sites'
      ? siteComparisons.map((r, idx) => ({
          key: r.site.id,
          label: r.site.name,
          sublabel: `${Math.abs(r.site.latDeg).toFixed(2)}°S · ${r.site.lonDeg.toFixed(1)}°E`,
          color: SERIES_COLORS[idx % SERIES_COLORS.length],
          summary: r.summary,
          slopeDeg: r.site.slopeDeg,
          horizon: r.horizon,
          samples: r.samples,
          onOpen: () => onLoadSiteInWorkbench(r.site),
        }))
      : dateComparisons.map((r, idx) => ({
          key: r.dateItem.id,
          label: r.dateItem.label,
          sublabel: `${r.site.name} · ${durationHours}h window`,
          color: SERIES_COLORS[idx % SERIES_COLORS.length],
          summary: r.summary,
          slopeDeg: r.site.slopeDeg,
          horizon: r.horizon,
          samples: r.samples,
          onOpen: () => onLoadSiteInWorkbench(r.site, r.dateItem.id),
        }));

  // Trade-space Quadrant Chart geometry
  const QW = 760;
  const QH = 290;
  const QPAD = { top: 24, right: 28, bottom: 42, left: 56 };
  const QPLOT_W = QW - QPAD.left - QPAD.right;
  const QPLOT_H = QH - QPAD.top - QPAD.bottom;
  const sunX = (pct: number) => QPAD.left + (Math.max(0, Math.min(100, pct)) / 100) * QPLOT_W;
  const earthY = (pct: number) => QPAD.top + ((100 - Math.max(0, Math.min(100, pct))) / 100) * QPLOT_H;

  const placedScatterLabels = useMemo(() => {
    const captionObstacles = [
      { x: sunX(99) - 185, y: earthY(95) - 12, w: 185, h: 16 }, // Optimal Dual Ops
      { x: sunX(99) - 210, y: earthY(6) - 12, w: 210, h: 16 }, // High-Solar Ridge
      { x: sunX(2), y: earthY(95) - 12, w: 120, h: 16 }, // Near-Side Comm Hub
    ];

    return resolvePointLabels(
      activeRows.map((row, idx) => {
        const cx = sunX(row.summary.sunVisiblePct);
        const cy = earthY(row.summary.earthVisiblePct);
        const r = 7 + Math.sqrt(Math.max(1, row.summary.simultaneousPct)) * 0.9;
        return {
          id: row.key,
          px: cx,
          py: cy,
          radius: r,
          w: Math.max(132, row.label.length * 6.4 + 14),
          h: 28,
          priority: activeRows.length - idx,
        };
      }),
      { x: QPAD.left + 4, y: QPAD.top + 4, w: QPLOT_W - 8, h: QPLOT_H - 8 },
      captionObstacles
    );
  }, [activeRows]);

  const renderMiniHorizon = (
    horizon: number[],
    samples: EphemerisSample[],
    title: string,
    subtitle: string,
    color: string,
    summary: WindowSummaryStats,
    onOpen: () => void
  ) => {
    const w = 360;
    const h = 115;
    const minEl = -8;
    const maxEl = 16;
    const elY = (el: number) => ((maxEl - Math.max(minEl, Math.min(maxEl, el))) / (maxEl - minEl)) * h;

    const horizonPath = `M ${horizon
      .map((el, az) => `${az},${elY(el).toFixed(1)}`)
      .join(' L ')} L 360,${h} L 0,${h} Z`;

    const buildTrack = (getter: (s: EphemerisSample) => { az: number; el: number }) => {
      const segs: string[] = [];
      let cur: string[] = [];
      let prevAz = samples[0] ? getter(samples[0]).az : 0;
      for (const s of samples) {
        const pt = getter(s);
        if (Math.abs(pt.az - prevAz) > 180) {
          if (cur.length > 1) segs.push(`M ${cur.join(' L ')}`);
          cur = [];
        }
        cur.push(`${pt.az.toFixed(1)},${elY(pt.el).toFixed(1)}`);
        prevAz = pt.az;
      }
      if (cur.length > 1) segs.push(`M ${cur.join(' L ')}`);
      return segs;
    };

    const sunPaths = buildTrack((s) => ({ az: s.sun.azimuthDeg, el: s.sun.elevationDeg }));
    const earthPaths = buildTrack((s) => ({ az: s.earth.azimuthDeg, el: s.earth.elevationDeg }));

    return (
      <DiagramSwoop
        key={`${title}-${subtitle}`}
        delay={0.05}
        className="notebook-sheet overflow-hidden flex flex-col"
      >
        <div className="px-4 py-3 border-b border-[#EAE3D5] flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: color }} />
            <div>
              <h3 className="text-sm font-bold text-slate-900">{title}</h3>
              <p className="text-xs text-slate-500 font-mono">{subtitle}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onOpen}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#0B3D91] border border-blue-200 bg-blue-50/70 rounded-lg hover:bg-blue-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Open in Site Planner
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-28 bg-[#0B1324] block">
          <line x1={0} y1={elY(10)} x2={w} y2={elY(10)} stroke="#1E293B" strokeWidth={0.7} />
          <line x1={0} y1={elY(0)} x2={w} y2={elY(0)} stroke="#475569" strokeDasharray="3 3" />
          <line x1={0} y1={elY(-5)} x2={w} y2={elY(-5)} stroke="#1E293B" strokeWidth={0.7} />
          <path d={horizonPath} fill="#475569" stroke="#CBD5E1" strokeWidth={1.1} />
          {sunPaths.map((d, i) => (
            <path key={`s-${i}`} d={d} fill="none" stroke="#FBBF24" strokeWidth={1.8} />
          ))}
          {earthPaths.map((d, i) => (
            <path key={`e-${i}`} d={d} fill="none" stroke="#38BDF8" strokeWidth={1.8} />
          ))}
          <text x={6} y={elY(10) - 2} className="fill-slate-400 font-mono text-[8px]">
            {isHighSchool ? 'High' : '+10°'}
          </text>
          <text x={6} y={elY(0) - 2} className="fill-slate-300 font-mono text-[8px]">
            {isHighSchool ? 'Flat' : '0°'}
          </text>
          <text x={w - 6} y={h - 4} textAnchor="end" className="fill-slate-400 font-mono text-[8px]">
            {isHighSchool ? 'Full Circle View' : '0°–360° Az'}
          </text>
        </svg>

        <div className="px-4 py-1.5 border-t border-[#EAE3D5] bg-white flex items-center gap-4 text-[11px] text-slate-600">
          <span className="inline-flex items-center gap-1">
            <span className="w-3 h-0.5 bg-amber-500 inline-block" /> Sun
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-3 h-0.5 bg-sky-500 inline-block" /> Earth
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-3 h-2 bg-slate-600 inline-block rounded-xs" /> LOLA Horizon
          </span>
        </div>

        <div
          className={`p-4 grid ${isHighSchool ? 'grid-cols-2' : 'grid-cols-3'} gap-3 text-xs notebook-paper-strip border-t border-[#EAE3D5]`}
        >
          <div>
            <div className="text-slate-500">{isHighSchool ? 'Sunlight Time' : 'Sunlit'}</div>
            <div className="text-base font-mono font-semibold text-amber-700 tabular-nums mt-0.5">
              {summary.sunVisiblePct.toFixed(1)}%
            </div>
          </div>
          <div>
            <div className="text-slate-500">{isHighSchool ? 'Earth Signal Time' : 'Earth DTE'}</div>
            <div className="text-base font-mono font-semibold text-sky-700 tabular-nums mt-0.5">
              {summary.earthVisiblePct.toFixed(1)}%
            </div>
          </div>
          {!isHighSchool && (
            <div>
              <div className="text-slate-500">Both Clear</div>
              <div className="text-base font-mono font-semibold text-emerald-700 tabular-nums mt-0.5">
                {summary.simultaneousPct.toFixed(1)}%
              </div>
            </div>
          )}
        </div>
      </DiagramSwoop>
    );
  };

  return (
    <div className="max-w-[1440px] mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-5">
      <div className="notebook-sheet p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex items-start gap-3">
          <ArtemisPolarBadge className="w-9 h-9 shrink-0 mt-0.5" />
          <div>
            <h1 className="text-lg font-bold text-slate-900">
              Artemis Candidate Trade-Space &amp; Horizon Diagram Comparator
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              Compare multi-tier NASA LOLA horizon profiles, power duty cycles, and Direct-to-Earth communication windows side by side across sites or seasons.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 bg-[#F4EFE4] p-1 rounded-lg border border-[#E4DDD0] self-start">
          <button
            type="button"
            onClick={() => setCompareMode('sites')}
            className={`inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              compareMode === 'sites'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            Compare Landing Sites
          </button>
          <button
            type="button"
            onClick={() => setCompareMode('dates')}
            className={`inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              compareMode === 'dates'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            Compare Seasons
          </button>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs">
        {compareMode === 'sites' ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-slate-500 mr-2">Select up to 4 regions:</span>
            {LUNAR_SOUTH_POLE_SITES.map((s) => {
              const active = selectedSiteIds.includes(s.id);
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => toggleSite(s.id)}
                  className={`px-3 py-1.5 text-xs font-medium rounded border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    active
                      ? 'bg-blue-700 text-white border-blue-700'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {s.name}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-slate-500 mr-2">Evaluate seasonal dates at:</span>
            {LUNAR_SOUTH_POLE_SITES.map((s) => {
              const active = dateCompareSiteId === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setDateCompareSiteId(s.id)}
                  className={`px-3 py-1.5 text-xs font-medium rounded border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    active
                      ? 'bg-blue-700 text-white border-blue-700'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {s.name}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Visual Mission Trade-Space Quadrant Diagram */}
      <DiagramSwoop className="notebook-sheet overflow-hidden">
        <div className="px-5 py-3 border-b border-[#EAE3D5] flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              Power vs. Communications Trade-Space Diagram
            </h2>
            <p className="text-xs text-slate-600">
              Solar illumination duty cycle (horizontal) vs. Direct-to-Earth visibility (vertical) · Bubble radius scales with simultaneous Sun + DTE window
            </p>
          </div>
          <span className="text-xs text-slate-500">
            NASA LRO LOLA 5m/30m DEM · IAU 2015 / astronomy-engine
          </span>
        </div>

        <div className="p-4 bg-[#0B1324]">
          <svg
            viewBox={`0 0 ${QW} ${QH}`}
            className="w-full h-auto block select-none"
            role="img"
            aria-label="Mission Trade-Space Quadrant Scatter Diagram"
          >
            {/* Optimal Dual Ops Quadrant Tint */}
            <rect
              x={sunX(75)}
              y={earthY(100)}
              width={sunX(100) - sunX(75)}
              height={earthY(50) - earthY(100)}
              fill="#10B981"
              fillOpacity={0.1}
            />

            {/* Gridlines */}
            {[0, 25, 50, 75, 100].map((pct) => (
              <g key={`gx-${pct}`}>
                <line
                  x1={sunX(pct)}
                  y1={QPAD.top}
                  x2={sunX(pct)}
                  y2={QPAD.top + QPLOT_H}
                  stroke="#1E293B"
                  strokeWidth={1}
                />
                <text
                  x={sunX(pct)}
                  y={QPAD.top + QPLOT_H + 16}
                  textAnchor="middle"
                  className="fill-slate-400 font-mono text-[10px]"
                >
                  {pct}%
                </text>
              </g>
            ))}
            {[0, 25, 50, 75, 100].map((pct) => (
              <g key={`gy-${pct}`}>
                <line
                  x1={QPAD.left}
                  y1={earthY(pct)}
                  x2={QPAD.left + QPLOT_W}
                  y2={earthY(pct)}
                  stroke="#1E293B"
                  strokeWidth={1}
                />
                <text
                  x={QPAD.left - 8}
                  y={earthY(pct) + 3}
                  textAnchor="end"
                  className="fill-slate-400 font-mono text-[10px]"
                >
                  {pct}%
                </text>
              </g>
            ))}

            {/* Quadrant decision thresholds */}
            <line
              x1={sunX(75)}
              y1={QPAD.top}
              x2={sunX(75)}
              y2={QPAD.top + QPLOT_H}
              stroke="#F59E0B"
              strokeOpacity={0.45}
              strokeDasharray="4 4"
            />
            <line
              x1={QPAD.left}
              y1={earthY(50)}
              x2={QPAD.left + QPLOT_W}
              y2={earthY(50)}
              stroke="#38BDF8"
              strokeOpacity={0.45}
              strokeDasharray="4 4"
            />

            {/* Quadrant captions */}
            <text
              x={sunX(99)}
              y={earthY(95)}
              textAnchor="end"
              className="fill-emerald-300/80 text-[10px] font-semibold"
            >
              {isHighSchool ? 'Best Sunlight + Radio Signal' : 'Optimal Dual Ops (Power + DTE)'}
            </text>
            <text
              x={sunX(99)}
              y={earthY(6)}
              textAnchor="end"
              className="fill-amber-300/75 text-[10px] font-medium"
            >
              {isHighSchool ? 'Strong Sun (Needs Relay Satellite)' : 'High-Solar Ridge (Orbital Relay Helpful)'}
            </text>
            <text
              x={sunX(2)}
              y={earthY(95)}
              textAnchor="start"
              className="fill-sky-300/75 text-[10px] font-medium"
            >
              {isHighSchool ? 'Strong Earth Signal' : 'Near-Side Comm Hub'}
            </text>

            {/* Axis Titles */}
            <text
              x={QPAD.left + QPLOT_W / 2}
              y={QH - 6}
              textAnchor="middle"
              className="fill-slate-300 text-[11px] font-medium"
            >
              {isHighSchool ? 'Sunlight Time (%)' : 'Solar Illumination Duty Cycle (%)'}
            </text>
            <text
              x={14}
              y={QPAD.top + QPLOT_H / 2}
              textAnchor="middle"
              transform={`rotate(-90 14 ${QPAD.top + QPLOT_H / 2})`}
              className="fill-slate-300 text-[11px] font-medium"
            >
              {isHighSchool ? 'Earth Signal Time (%)' : 'Earth DTE Visibility (%)'}
            </text>

            {/* Plotted Candidates with Non-Overlapping Labels */}
            {activeRows.map((row) => {
              const cx = sunX(row.summary.sunVisiblePct);
              const cy = earthY(row.summary.earthVisiblePct);
              const r = 7 + Math.sqrt(Math.max(1, row.summary.simultaneousPct)) * 0.9;
              const isHov = hoveredKey === row.key;
              const placed = placedScatterLabels[row.key];

              return (
                <g
                  key={row.key}
                  className="cursor-pointer"
                  onMouseEnter={() => setHoveredKey(row.key)}
                  onMouseLeave={() => setHoveredKey(null)}
                  onClick={row.onOpen}
                >
                  {placed?.needsLeader && (
                    <line
                      x1={cx}
                      y1={cy}
                      x2={placed.leaderX2}
                      y2={placed.leaderY2}
                      stroke={row.color}
                      strokeOpacity={0.75}
                      strokeWidth={1}
                      strokeDasharray="2 2"
                    />
                  )}
                  <circle
                    cx={cx}
                    cy={cy}
                    r={r + (isHov ? 4 : 0)}
                    fill={row.color}
                    fillOpacity={0.28}
                    stroke={row.color}
                    strokeWidth={isHov ? 2.4 : 1.6}
                  />
                  <circle cx={cx} cy={cy} r={4} fill="#FFFFFF" />
                  <text
                    x={placed ? placed.textX : cx + r + 6}
                    y={placed ? placed.textY : cy - 2}
                    textAnchor={placed ? placed.textAnchor : 'start'}
                    className="fill-white text-[11px] font-semibold"
                    style={{ paintOrder: 'stroke', stroke: '#0B1324', strokeWidth: 3.2 }}
                  >
                    {row.label}
                  </text>
                  <text
                    x={placed ? placed.textX : cx + r + 6}
                    y={placed ? placed.textY + 12 : cy + 10}
                    textAnchor={placed ? placed.textAnchor : 'start'}
                    className="fill-slate-300 font-mono text-[9.5px]"
                    style={{ paintOrder: 'stroke', stroke: '#0B1324', strokeWidth: 3.2 }}
                  >
                    {isHighSchool
                      ? `${row.summary.sunVisiblePct.toFixed(0)}% Sun · ${row.summary.earthVisiblePct.toFixed(0)}% Signal`
                      : `${row.summary.sunVisiblePct.toFixed(1)}% Sun · ${row.summary.earthVisiblePct.toFixed(1)}% DTE`}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Complete Scatter Diagram Key */}
        <div className="px-5 py-2.5 border-t border-[#EAE3D5] notebook-paper-strip flex flex-wrap items-center justify-between gap-3 text-xs text-slate-700">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            {activeRows.map((row) => (
              <span key={`key-${row.key}`} className="inline-flex items-center gap-1.5 font-medium">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: row.color }} />
                {row.label}
              </span>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-600">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 bg-emerald-500/20 border border-emerald-600 inline-block rounded-xs" />
              Optimal Zone (&ge;75% Sun &amp; &ge;50% DTE)
            </span>
            <span>Bubble Radius = Simultaneous Sun + DTE %</span>
          </div>
        </div>

        <ExplainDropdown
          contentKey="tradeSpace"
          sources={[
            {
              label: 'Artemis III Regions MapServer',
              url: EXACT_NASA_URLS.artemisRegionsRest,
            },
            {
              label: 'LOLA 5m/px Polar DEM Service',
              url: EXACT_NASA_URLS.lolaDem5mService,
            },
            {
              label: 'LOLA 30m/px SPole75 DEM Service',
              url: EXACT_NASA_URLS.lolaDem30mService,
            },
            {
              label: 'NASA JPL Horizons System',
              url: EXACT_NASA_URLS.jplHorizonsApp,
            },
          ]}
        />
      </DiagramSwoop>

      {/* Side-by-Side Horizon Diagrams */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {activeRows.map((row) =>
          renderMiniHorizon(
            row.horizon,
            row.samples,
            row.label,
            row.sublabel,
            row.color,
            row.summary,
            row.onOpen
          )
        )}
      </div>

      {/* Collapsible Secondary Numerical Matrix (hidden in simplified High School orientation, open in Grad/Prof) */}
      {!isHighSchool && (
      <DiagramSwoop className="notebook-sheet overflow-hidden">
        <button
          type="button"
          onClick={() => setShowDataMatrix((v) => !v)}
          className="w-full px-5 py-3.5 flex items-center justify-between gap-2 text-left hover:bg-slate-50 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2">
            {showDataMatrix ? (
              <ChevronDown className="w-4 h-4 text-slate-500" />
            ) : (
              <ChevronRight className="w-4 h-4 text-slate-500" />
            )}
            <span className="text-sm font-semibold text-slate-900">
              Detailed Telemetry Breakdown Table
            </span>
          </div>
          <span className="text-xs text-slate-500">
            Click to {showDataMatrix ? 'hide' : 'view'} raw tabular metrics
          </span>
        </button>

        {showDataMatrix && (
          <div className="overflow-x-auto border-t border-slate-200">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-xs text-slate-600 bg-slate-50">
                  <th className="py-2.5 px-4 font-semibold">Candidate / Epoch</th>
                  <th className="py-2.5 px-4 font-semibold text-right">Sunlit</th>
                  <th className="py-2.5 px-4 font-semibold text-right">Max Eclipse</th>
                  <th className="py-2.5 px-4 font-semibold text-right">Earth DTE</th>
                  <th className="py-2.5 px-4 font-semibold text-right">Max Blackout</th>
                  <th className="py-2.5 px-4 font-semibold text-right">Both Clear</th>
                  <th className="py-2.5 px-4 font-semibold text-right">Mean Power</th>
                  <th className="py-2.5 px-4 font-semibold text-right">Total Energy</th>
                  <th className="py-2.5 px-4 font-semibold text-right">Slope</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {activeRows.map((row) => (
                  <tr key={row.key} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900">{row.label}</div>
                      <div className="text-xs text-slate-500 font-mono">{row.sublabel}</div>
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-amber-700 font-semibold">
                      {row.summary.sunVisiblePct.toFixed(1)}%
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-800">
                      {row.summary.longestDarkHours.toFixed(1)} h
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-sky-700 font-semibold">
                      {row.summary.earthVisiblePct.toFixed(1)}%
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-800">
                      {row.summary.longestCommBlackoutHours.toFixed(1)} h
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-emerald-700 font-semibold">
                      {row.summary.simultaneousPct.toFixed(1)}%
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-800">
                      {row.summary.meanPowerWm2.toFixed(0)} W/m²
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-800">
                      {row.summary.totalEnergyKwhM2.toFixed(1)} kWh/m²
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-600">
                      {row.slopeDeg.toFixed(1)}°
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DiagramSwoop>
      )}
    </div>
  );
};
