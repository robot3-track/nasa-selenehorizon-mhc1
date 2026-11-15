import React, { useMemo, useRef, useState } from 'react';
import { EphemerisSample, sampleHorizonAtAzimuth } from '../lib/lunarEphemeris';
import { ParsedHorizonsRow } from '../lib/horizonsParser';
import { EXACT_NASA_URLS } from '../lib/nasaData';
import { resolvePointLabels } from '../lib/labelPlacement';
import { useComprehension } from '../lib/comprehension';
import { ExplainDropdown } from './NotebookPrimitives';

interface HorizonPanoramaProps {
  siteName: string;
  horizonProfileDeg: number[];
  samples: EphemerisSample[];
  currentIndex: number;
  minSunElevDeg: number;
  minEarthElevDeg: number;
  showTracks: boolean;
  showDiscs: boolean;
  demSourceLabel: string;
  ephemerisSourceLabel: string;
  horizonsUrl?: string;
  horizonsOverlay?: ParsedHorizonsRow[];
  onScrubIndex?: (index: number) => void;
}

const WIDTH = 960;
const HEIGHT = 330;
const PAD = { top: 22, right: 24, bottom: 34, left: 50 };
const PLOT_W = WIDTH - PAD.left - PAD.right;
const PLOT_H = HEIGHT - PAD.top - PAD.bottom;

export const HorizonPanorama: React.FC<HorizonPanoramaProps> = ({
  siteName,
  horizonProfileDeg,
  samples,
  currentIndex,
  minSunElevDeg,
  minEarthElevDeg,
  showTracks,
  showDiscs,
  demSourceLabel,
  ephemerisSourceLabel,
  horizonsUrl,
  horizonsOverlay = [],
  onScrubIndex,
}) => {
  const { level } = useComprehension();
  const isHighSchool = level === 'high-school';
  const isAdvanced = level === 'graduate' || level === 'nasa-professor';
  const isProfessor = level === 'nasa-professor';
  const degDecimals = isProfessor ? 3 : 2;

  const svgRef = useRef<SVGSVGElement | null>(null);
  const [hoverPos, setHoverPos] = useState<{ az: number; el: number; x: number; y: number } | null>(
    null
  );

  const currentSample = samples[currentIndex] ?? samples[0];

  const { minEl, maxEl } = useMemo(() => {
    let hi = 16;
    let lo = -8;
    for (const h of horizonProfileDeg) {
      if (h + 4 > hi) hi = Math.ceil(h + 4);
      if (h - 2 < lo) lo = Math.floor(h - 2);
    }
    for (const s of samples) {
      if (s.sun.elevationDeg + 3 > hi) hi = Math.ceil(s.sun.elevationDeg + 3);
      if (s.earth.elevationDeg + 3 > hi) hi = Math.ceil(s.earth.elevationDeg + 3);
    }
    return { minEl: Math.max(-18, lo), maxEl: Math.min(35, hi) };
  }, [horizonProfileDeg, samples]);

  const azToX = (az: number) => PAD.left + (az / 360) * PLOT_W;
  const elToY = (el: number) => PAD.top + ((maxEl - el) / (maxEl - minEl)) * PLOT_H;

  const { horizonLinePath, horizonFillPath } = useMemo(() => {
    if (!horizonProfileDeg.length) return { horizonLinePath: '', horizonFillPath: '' };
    const pts: string[] = [];
    for (let az = 0; az < 360; az++) {
      pts.push(`${azToX(az).toFixed(1)},${elToY(horizonProfileDeg[az]).toFixed(1)}`);
    }
    pts.push(`${azToX(360).toFixed(1)},${elToY(horizonProfileDeg[0]).toFixed(1)}`);
    const line = `M ${pts.join(' L ')}`;
    const bottomY = (PAD.top + PLOT_H).toFixed(1);
    const fill = `${line} L ${azToX(360).toFixed(1)},${bottomY} L ${azToX(0).toFixed(1)},${bottomY} Z`;
    return { horizonLinePath: line, horizonFillPath: fill };
  }, [horizonProfileDeg, minEl, maxEl]);

  const { sunSegments, earthSegments } = useMemo(() => {
    if (!showTracks || samples.length < 2) return { sunSegments: null, earthSegments: null };

    const buildSegments = (getter: (s: EphemerisSample) => { az: number; el: number; clear: boolean }) => {
      const clearPaths: string[] = [];
      const occultedPaths: string[] = [];
      let curPts: string[] = [];
      let curClear = getter(samples[0]).clear;
      let prevAz = getter(samples[0]).az;

      for (let i = 0; i < samples.length; i++) {
        const pt = getter(samples[i]);
        const wrapped = Math.abs(pt.az - prevAz) > 180;
        const stateChanged = pt.clear !== curClear;

        if (wrapped || stateChanged) {
          if (curPts.length > 1) {
            (curClear ? clearPaths : occultedPaths).push(`M ${curPts.join(' L ')}`);
          }
          if (stateChanged && !wrapped && curPts.length > 0) {
            curPts = [curPts[curPts.length - 1], `${azToX(pt.az).toFixed(1)},${elToY(pt.el).toFixed(1)}`];
          } else {
            curPts = [`${azToX(pt.az).toFixed(1)},${elToY(pt.el).toFixed(1)}`];
          }
          curClear = pt.clear;
        } else {
          curPts.push(`${azToX(pt.az).toFixed(1)},${elToY(pt.el).toFixed(1)}`);
        }
        prevAz = pt.az;
      }
      if (curPts.length > 1) {
        (curClear ? clearPaths : occultedPaths).push(`M ${curPts.join(' L ')}`);
      }
      return { clearPaths, occultedPaths };
    };

    return {
      sunSegments: buildSegments((s) => ({
        az: s.sun.azimuthDeg,
        el: s.sun.elevationDeg,
        clear: s.sunUsable,
      })),
      earthSegments: buildSegments((s) => ({
        az: s.earth.azimuthDeg,
        el: s.earth.elevationDeg,
        clear: s.earthUsable,
      })),
    };
  }, [samples, showTracks, minEl, maxEl]);

  const placedBodyLabels = useMemo(() => {
    if (!currentSample) return {};
    return resolvePointLabels(
      [
        {
          id: 'earth',
          px: azToX(currentSample.earth.azimuthDeg),
          py: elToY(currentSample.earth.elevationDeg),
          radius: 7,
          w: 98,
          h: 18,
          priority: 2,
        },
        {
          id: 'sun',
          px: azToX(currentSample.sun.azimuthDeg),
          py: elToY(currentSample.sun.elevationDeg),
          radius: 7,
          w: 88,
          h: 18,
          priority: 1,
        },
      ],
      { x: PAD.left + 4, y: PAD.top + 4, w: PLOT_W - 8, h: PLOT_H - 8 }
    );
  }, [currentSample, minEl, maxEl]);

  const elevationTicks = useMemo(() => {
    const ticks: number[] = [];
    const step = maxEl - minEl > 28 ? 5 : 4;
    const start = Math.ceil(minEl / step) * step;
    for (let e = start; e <= maxEl; e += step) ticks.push(e);
    if (!ticks.includes(0) && minEl < 0 && maxEl > 0) ticks.push(0);
    return ticks.sort((a, b) => a - b);
  }, [minEl, maxEl]);

  const azimuthTicks = isHighSchool
    ? [
        { deg: 0, label: 'North (0°)' },
        { deg: 90, label: 'East (90°)' },
        { deg: 180, label: 'South (180°)' },
        { deg: 270, label: 'West (270°)' },
        { deg: 360, label: 'North (360°)' },
      ]
    : [
        { deg: 0, label: '0° N' },
        { deg: 45, label: '45° NE' },
        { deg: 90, label: '90° E' },
        { deg: 135, label: '135° SE' },
        { deg: 180, label: '180° S' },
        { deg: 225, label: '225° SW' },
        { deg: 270, label: '270° W' },
        { deg: 315, label: '315° NW' },
        { deg: 360, label: '360° N' },
      ];

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const sx = ((e.clientX - rect.left) / rect.width) * WIDTH;
    const sy = ((e.clientY - rect.top) / rect.height) * HEIGHT;
    if (sx < PAD.left || sx > PAD.left + PLOT_W || sy < PAD.top || sy > PAD.top + PLOT_H) {
      setHoverPos(null);
      return;
    }
    const az = ((sx - PAD.left) / PLOT_W) * 360;
    const el = maxEl - ((sy - PAD.top) / PLOT_H) * (maxEl - minEl);
    setHoverPos({ az, el, x: sx, y: sy });
  };

  const handleClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!onScrubIndex || !svgRef.current || samples.length === 0) return;
    const rect = svgRef.current.getBoundingClientRect();
    const sx = ((e.clientX - rect.left) / rect.width) * WIDTH;
    if (sx < PAD.left || sx > PAD.left + PLOT_W) return;
    const clickAz = ((sx - PAD.left) / PLOT_W) * 360;

    let bestIdx = 0;
    let bestDiff = 999;
    for (let i = 0; i < samples.length; i++) {
      const diff = Math.abs(((samples[i].sun.azimuthDeg - clickAz + 540) % 360) - 180);
      if (diff < bestDiff) {
        bestDiff = diff;
        bestIdx = i;
      }
    }
    onScrubIndex(bestIdx);
  };

  const hoverHorizonEl = hoverPos ? sampleHorizonAtAzimuth(horizonProfileDeg, hoverPos.az) : 0;
  const pxPerDegX = PLOT_W / 360;
  const pxPerDegY = PLOT_H / (maxEl - minEl);

  return (
    <div className="notebook-sheet overflow-hidden">
      <div className="px-4 sm:px-5 py-3 border-b border-[#EAE3D5] flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-slate-900">
            {isHighSchool
              ? `Skyline Horizon View — ${siteName}`
              : `360° Horizon Obstruction & Sky Path — ${siteName}`}
          </h2>
          <p className="text-xs text-slate-600">
            {isHighSchool
              ? 'Solid lines = clear sunlight or radio signal · Dashed lines = blocked behind crater hills'
              : 'Solid lines show clear visibility above crater rims; dashed lines indicate terrain blockage'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs font-medium text-slate-700">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3.5 h-0.5 bg-amber-500 inline-block" />
            {isHighSchool ? 'Sun Path' : 'Sun (Solid = Clear / Dashed = Occulted)'}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3.5 h-0.5 bg-sky-400 inline-block" />
            {isHighSchool ? 'Earth Radio Path' : 'Earth DTE'}
          </span>
          {!isHighSchool && horizonsOverlay.length > 0 && (
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 border border-slate-700 inline-block" />
              JPL DE441 Check
            </span>
          )}
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3.5 h-2.5 bg-slate-600 border border-slate-700 inline-block rounded-xs" />
            {isHighSchool ? 'Crater Terrain' : 'LOLA Mask'}
          </span>
        </div>
      </div>

      <div className="p-3 bg-white">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="w-full h-auto block cursor-crosshair select-none"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoverPos(null)}
          onClick={handleClick}
          role="img"
          aria-label="360-degree lunar horizon mask with Sun and Earth sky tracks"
        >
          <defs>
            <linearGradient id="lunarSkyDaylight" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0F172A" />
              <stop offset="100%" stopColor="#1E293B" />
            </linearGradient>
            <linearGradient id="regolithFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#64748B" />
              <stop offset="100%" stopColor="#334155" />
            </linearGradient>
            <clipPath id="horizonClip">
              <rect x={PAD.left} y={PAD.top} width={PLOT_W} height={PLOT_H} />
            </clipPath>
          </defs>

          <rect x={PAD.left} y={PAD.top} width={PLOT_W} height={PLOT_H} fill="url(#lunarSkyDaylight)" />

          {elevationTicks.map((el) => {
            const y = elToY(el);
            const isZero = el === 0;
            return (
              <g key={`el-${el}`}>
                <line
                  x1={PAD.left}
                  y1={y}
                  x2={PAD.left + PLOT_W}
                  y2={y}
                  stroke={isZero ? '#64748B' : '#334155'}
                  strokeWidth={isZero ? 1.2 : 0.7}
                  strokeDasharray={isZero ? '4 3' : undefined}
                />
                <text
                  x={PAD.left - 8}
                  y={y + 4}
                  textAnchor="end"
                  className="fill-slate-600 font-mono text-[11px]"
                >
                  {el > 0 ? `+${el}°` : `${el}°`}
                </text>
              </g>
            );
          })}

          {azimuthTicks.map((t) => {
            const x = azToX(t.deg);
            const anchor = t.deg === 0 ? 'start' : t.deg === 360 ? 'end' : 'middle';
            return (
              <g key={`az-${t.deg}`}>
                <line
                  x1={x}
                  y1={PAD.top}
                  x2={x}
                  y2={PAD.top + PLOT_H}
                  stroke={t.deg % 90 === 0 ? '#475569' : '#293548'}
                  strokeWidth={0.9}
                />
                <text
                  x={x}
                  y={PAD.top + PLOT_H + 19}
                  textAnchor={anchor}
                  className="fill-slate-600 font-mono text-[11px]"
                >
                  {t.label}
                </text>
              </g>
            );
          })}

          <g clipPath="url(#horizonClip)">
            {sunSegments?.occultedPaths.map((d, idx) => (
              <path
                key={`sun-occ-${idx}`}
                d={d}
                fill="none"
                stroke="#F59E0B"
                strokeOpacity={0.38}
                strokeWidth={1.6}
                strokeDasharray="4 4"
              />
            ))}

            {earthSegments?.occultedPaths.map((d, idx) => (
              <path
                key={`earth-occ-${idx}`}
                d={d}
                fill="none"
                stroke="#38BDF8"
                strokeOpacity={0.38}
                strokeWidth={1.6}
                strokeDasharray="4 4"
              />
            ))}

            {horizonFillPath && <path d={horizonFillPath} fill="url(#regolithFill)" />}
            {horizonLinePath && (
              <path d={horizonLinePath} fill="none" stroke="#CBD5E1" strokeWidth={1.6} />
            )}

            {!isHighSchool && minSunElevDeg > 0 && horizonProfileDeg.length === 360 && (
              <path
                d={`M ${horizonProfileDeg
                  .map((h, az) => `${azToX(az).toFixed(1)},${elToY(h + minSunElevDeg).toFixed(1)}`)
                  .join(' L ')}`}
                fill="none"
                stroke="#FBBF24"
                strokeOpacity={0.5}
                strokeWidth={1}
                strokeDasharray="2 3"
              />
            )}
            {!isHighSchool && minEarthElevDeg > 0 && horizonProfileDeg.length === 360 && (
              <path
                d={`M ${horizonProfileDeg
                  .map((h, az) => `${azToX(az).toFixed(1)},${elToY(h + minEarthElevDeg).toFixed(1)}`)
                  .join(' L ')}`}
                fill="none"
                stroke="#38BDF8"
                strokeOpacity={0.5}
                strokeWidth={1}
                strokeDasharray="2 3"
              />
            )}

            {sunSegments?.clearPaths.map((d, idx) => (
              <path key={`sun-clr-${idx}`} d={d} fill="none" stroke="#FBBF24" strokeWidth={2.4} />
            ))}
            {earthSegments?.clearPaths.map((d, idx) => (
              <path key={`earth-clr-${idx}`} d={d} fill="none" stroke="#38BDF8" strokeWidth={2.4} />
            ))}

            {!isHighSchool &&
              horizonsOverlay.map((pt, i) => (
                <circle
                  key={`jpl-${i}`}
                  cx={azToX(pt.azimuthDeg)}
                  cy={elToY(pt.elevationDeg)}
                  r={3.2}
                  fill={pt.target === 'Earth' ? '#38BDF8' : '#FBBF24'}
                  stroke="#FFFFFF"
                  strokeWidth={1}
                />
              ))}

            {currentSample && (
              <g>
                {!isHighSchool && (
                  <line
                    x1={azToX(currentSample.earth.azimuthDeg)}
                    y1={elToY(currentSample.earth.elevationDeg)}
                    x2={azToX(currentSample.earth.azimuthDeg)}
                    y2={elToY(currentSample.earthHorizonElevDeg)}
                    stroke="#38BDF8"
                    strokeOpacity={0.6}
                    strokeWidth={1}
                    strokeDasharray="2 2"
                  />
                )}
                {!isHighSchool && showDiscs && (
                  <ellipse
                    cx={azToX(currentSample.earth.azimuthDeg)}
                    cy={elToY(currentSample.earth.elevationDeg)}
                    rx={Math.max(6, currentSample.earth.angularRadiusDeg * pxPerDegX * 2.2)}
                    ry={Math.max(6, currentSample.earth.angularRadiusDeg * pxPerDegY)}
                    fill={currentSample.earthUsable ? '#38BDF8' : '#0369A1'}
                    fillOpacity={0.35}
                    stroke="#7DD3FC"
                    strokeWidth={1.6}
                  />
                )}
                <circle
                  cx={azToX(currentSample.earth.azimuthDeg)}
                  cy={elToY(currentSample.earth.elevationDeg)}
                  r={isHighSchool ? 5.5 : 4.5}
                  fill={currentSample.earthUsable ? '#38BDF8' : '#475569'}
                  stroke="#FFFFFF"
                  strokeWidth={1.5}
                />
                {(() => {
                  const lbl = placedBodyLabels['earth'];
                  const ex = azToX(currentSample.earth.azimuthDeg);
                  const ey = elToY(currentSample.earth.elevationDeg);
                  return (
                    <>
                      {lbl?.needsLeader && (
                        <line
                          x1={ex}
                          y1={ey}
                          x2={lbl.leaderX2}
                          y2={lbl.leaderY2}
                          stroke="#7DD3FC"
                          strokeOpacity={0.65}
                          strokeWidth={0.9}
                        />
                      )}
                      <text
                        x={lbl ? lbl.textX : ex + 9}
                        y={lbl ? lbl.textY + 4 : ey - 8}
                        textAnchor={lbl ? lbl.textAnchor : 'start'}
                        className="fill-sky-200 font-mono text-[11px] font-semibold"
                        style={{ paintOrder: 'stroke', stroke: '#0F172A', strokeWidth: 3 }}
                      >
                        {isHighSchool
                          ? `Earth: ${currentSample.earthUsable ? 'Clear' : 'Blocked'}`
                          : `Earth ${currentSample.earth.elevationDeg >= 0 ? '+' : ''}${currentSample.earth.elevationDeg.toFixed(degDecimals)}°`}
                      </text>
                    </>
                  );
                })()}
              </g>
            )}

            {currentSample && (
              <g>
                {!isHighSchool && (
                  <line
                    x1={azToX(currentSample.sun.azimuthDeg)}
                    y1={elToY(currentSample.sun.elevationDeg)}
                    x2={azToX(currentSample.sun.azimuthDeg)}
                    y2={elToY(currentSample.sunHorizonElevDeg)}
                    stroke="#FBBF24"
                    strokeOpacity={0.6}
                    strokeWidth={1}
                    strokeDasharray="2 2"
                  />
                )}
                {!isHighSchool && showDiscs && (
                  <ellipse
                    cx={azToX(currentSample.sun.azimuthDeg)}
                    cy={elToY(currentSample.sun.elevationDeg)}
                    rx={Math.max(5, currentSample.sun.angularRadiusDeg * pxPerDegX * 3)}
                    ry={Math.max(5, currentSample.sun.angularRadiusDeg * pxPerDegY)}
                    fill={currentSample.sunUsable ? '#F59E0B' : '#92400E'}
                    fillOpacity={0.4}
                    stroke="#FDE68A"
                    strokeWidth={1.4}
                  />
                )}
                <circle
                  cx={azToX(currentSample.sun.azimuthDeg)}
                  cy={elToY(currentSample.sun.elevationDeg)}
                  r={isHighSchool ? 6 : 4.5}
                  fill={currentSample.sunUsable ? '#FBBF24' : '#78350F'}
                  stroke="#FFFFFF"
                  strokeWidth={1.5}
                />
                {(() => {
                  const lbl = placedBodyLabels['sun'];
                  const sx = azToX(currentSample.sun.azimuthDeg);
                  const sy = elToY(currentSample.sun.elevationDeg);
                  return (
                    <>
                      {lbl?.needsLeader && (
                        <line
                          x1={sx}
                          y1={sy}
                          x2={lbl.leaderX2}
                          y2={lbl.leaderY2}
                          stroke="#FDE68A"
                          strokeOpacity={0.65}
                          strokeWidth={0.9}
                        />
                      )}
                      <text
                        x={lbl ? lbl.textX : sx + 9}
                        y={lbl ? lbl.textY + 4 : sy - 8}
                        textAnchor={lbl ? lbl.textAnchor : 'start'}
                        className="fill-amber-200 font-mono text-[11px] font-semibold"
                        style={{ paintOrder: 'stroke', stroke: '#0F172A', strokeWidth: 3 }}
                      >
                        {isHighSchool
                          ? `Sun: ${currentSample.sunUsable ? 'Clear' : 'Blocked'}`
                          : `Sun ${currentSample.sun.elevationDeg >= 0 ? '+' : ''}${currentSample.sun.elevationDeg.toFixed(degDecimals)}°`}
                      </text>
                    </>
                  );
                })()}
              </g>
            )}

            {hoverPos && (
              <g pointerEvents="none">
                <line
                  x1={hoverPos.x}
                  y1={PAD.top}
                  x2={hoverPos.x}
                  y2={PAD.top + PLOT_H}
                  stroke="#FFFFFF"
                  strokeOpacity={0.45}
                />
                <line
                  x1={PAD.left}
                  y1={hoverPos.y}
                  x2={PAD.left + PLOT_W}
                  y2={hoverPos.y}
                  stroke="#FFFFFF"
                  strokeOpacity={0.45}
                />
                <circle cx={hoverPos.x} cy={elToY(hoverHorizonEl)} r={3.5} fill="#FFFFFF" />
              </g>
            )}
          </g>

          <rect
            x={PAD.left}
            y={PAD.top}
            width={PLOT_W}
            height={PLOT_H}
            fill="none"
            stroke="#CBD5E1"
            strokeWidth={1}
          />
        </svg>
      </div>

      <div className="px-4 sm:px-5 py-2.5 border-t border-[#EAE3D5] notebook-paper-strip flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
        {hoverPos ? (
          <div className="flex flex-wrap items-center gap-4 font-mono tabular-nums text-slate-800">
            <span>{isHighSchool ? 'Direction' : 'Az'}: {hoverPos.az.toFixed(1)}°</span>
            <span>
              {isHighSchool ? 'Height' : 'El'}: {hoverPos.el >= 0 ? '+' : ''}
              {hoverPos.el.toFixed(degDecimals)}°
            </span>
            <span>
              {isHighSchool ? 'Crater' : 'Terrain'}: {hoverHorizonEl >= 0 ? '+' : ''}
              {hoverHorizonEl.toFixed(degDecimals)}°
            </span>
            <span
              className={
                hoverPos.el - hoverHorizonEl >= 0 ? 'text-emerald-700 font-semibold' : 'text-rose-700 font-semibold'
              }
            >
              {isHighSchool
                ? hoverPos.el - hoverHorizonEl >= 0
                  ? 'Clear Above Mountains'
                  : 'Blocked by Mountains'
                : `${isAdvanced ? 'Δθ ' : ''}Margin: ${hoverPos.el - hoverHorizonEl >= 0 ? '+' : ''}${(hoverPos.el - hoverHorizonEl).toFixed(degDecimals)}°`}
            </span>
          </div>
        ) : (
          <span>
            {isHighSchool
              ? 'Hover across the sky to check mountain height · Click to move the Sun'
              : 'Hover sky plot to measure crater rim clearance · Click to jump to solar azimuth'}
          </span>
        )}
        {!isHighSchool && (
          <span className="text-slate-500">
            {ephemerisSourceLabel} · {demSourceLabel}
          </span>
        )}
      </div>

      <ExplainDropdown
        contentKey="panorama"
        sources={[
          {
            label: 'NASA JPL Horizons DE441 Query',
            url: horizonsUrl || EXACT_NASA_URLS.jplHorizonsApp,
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
            label: 'IAU 2015 Lunar Frame (Archinal et al.)',
            url: EXACT_NASA_URLS.iau2015Paper,
          },
        ]}
      />
    </div>
  );
};
