import React, { useMemo, useState } from 'react';
import { EphemerisSample, sampleHorizonAtAzimuth } from '../lib/lunarEphemeris';
import { EXACT_NASA_URLS } from '../lib/nasaData';
import { resolvePointLabels } from '../lib/labelPlacement';
import { useComprehension } from '../lib/comprehension';
import { ExplainDropdown } from './NotebookPrimitives';

interface PolarSkyDomeProps {
  siteName: string;
  horizonProfileDeg: number[];
  samples: EphemerisSample[];
  currentIndex: number;
  minSunElevDeg: number;
  minEarthElevDeg: number;
  showTracks: boolean;
  onScrubIndex?: (index: number) => void;
}

const SIZE = 452;
const CX = SIZE / 2;
const CY = SIZE / 2;
const R_OUTER = 160;
const MIN_EL = -6;
const MAX_EL = 16;

export const PolarSkyDome: React.FC<PolarSkyDomeProps> = ({
  siteName,
  horizonProfileDeg,
  samples,
  currentIndex,
  minSunElevDeg,
  minEarthElevDeg,
  showTracks,
  onScrubIndex,
}) => {
  const { level } = useComprehension();
  const isAdvanced = level === 'graduate' || level === 'nasa-professor';
  const isProfessor = level === 'nasa-professor';
  const degDecimals = isProfessor ? 2 : 1;

  const [hoverAz, setHoverAz] = useState<number | null>(null);
  const currentSample = samples[currentIndex] ?? samples[0];

  // Map elevation (-6° outer rim .. +16° zenith core) to polar radius
  const elToR = (elDeg: number) => {
    const clamped = Math.max(MIN_EL, Math.min(MAX_EL, elDeg));
    return ((MAX_EL - clamped) / (MAX_EL - MIN_EL)) * R_OUTER;
  };

  // Azimuth 0° = North (top), 90° = East (right), 180° = South (bottom), 270° = West (left)
  const azElToXY = (azDeg: number, elDeg: number) => {
    const rad = (azDeg * Math.PI) / 180;
    const r = elToR(elDeg);
    return {
      x: CX + r * Math.sin(rad),
      y: CY - r * Math.cos(rad),
    };
  };

  // Terrain obstruction annulus: from outer rim (MIN_EL) inward to horizonProfileDeg[az]
  const { terrainMaskPath, horizonContourPath, horizonSummary } = useMemo(() => {
    if (!horizonProfileDeg.length) {
      return {
        terrainMaskPath: '',
        horizonContourPath: '',
        horizonSummary: { min: 0, max: 0, mean: 0 },
      };
    }

    const innerPts: string[] = [];
    const outerPts: string[] = [];
    let minH = Infinity;
    let maxH = -Infinity;
    let sumH = 0;

    for (let az = 0; az < 360; az++) {
      const h = horizonProfileDeg[az];
      if (h < minH) minH = h;
      if (h > maxH) maxH = h;
      sumH += h;

      const ptIn = azElToXY(az, h);
      innerPts.push(`${ptIn.x.toFixed(1)},${ptIn.y.toFixed(1)}`);
    }

    // Outer circle traversed in reverse to create a clean hollow ring mask via evenodd rule
    for (let az = 360; az >= 0; az -= 2) {
      const ptOut = azElToXY(az % 360, MIN_EL);
      outerPts.push(`${ptOut.x.toFixed(1)},${ptOut.y.toFixed(1)}`);
    }

    const contour = `M ${innerPts.join(' L ')} Z`;
    const mask = `${contour} M ${outerPts.join(' L ')} Z`;

    return {
      terrainMaskPath: mask,
      horizonContourPath: contour,
      horizonSummary: {
        min: minH,
        max: maxH,
        mean: sumH / 360,
      },
    };
  }, [horizonProfileDeg]);

  const { sunSegments, earthSegments } = useMemo(() => {
    if (!showTracks || samples.length < 2) {
      return {
        sunSegments: { clear: [] as string[], blocked: [] as string[] },
        earthSegments: { clear: [] as string[], blocked: [] as string[] },
      };
    }

    const buildPolarTrack = (
      getter: (s: EphemerisSample) => { az: number; el: number; clear: boolean }
    ) => {
      const clear: string[] = [];
      const blocked: string[] = [];
      let curPts: string[] = [];
      let curClear = getter(samples[0]).clear;

      for (let i = 0; i < samples.length; i++) {
        const pt = getter(samples[i]);
        const xy = azElToXY(pt.az, pt.el);
        const ptStr = `${xy.x.toFixed(1)},${xy.y.toFixed(1)}`;
        if (pt.clear !== curClear) {
          if (curPts.length > 1) {
            (curClear ? clear : blocked).push(`M ${curPts.join(' L ')}`);
          }
          curPts = curPts.length > 0 ? [curPts[curPts.length - 1], ptStr] : [ptStr];
          curClear = pt.clear;
        } else {
          curPts.push(ptStr);
        }
      }
      if (curPts.length > 1) {
        (curClear ? clear : blocked).push(`M ${curPts.join(' L ')}`);
      }
      return { clear, blocked };
    };

    return {
      sunSegments: buildPolarTrack((s) => ({
        az: s.sun.azimuthDeg,
        el: s.sun.elevationDeg,
        clear: s.sunUsable,
      })),
      earthSegments: buildPolarTrack((s) => ({
        az: s.earth.azimuthDeg,
        el: s.earth.elevationDeg,
        clear: s.earthUsable,
      })),
    };
  }, [samples, showTracks]);

  const curSunXY = currentSample
    ? azElToXY(currentSample.sun.azimuthDeg, currentSample.sun.elevationDeg)
    : null;
  const curEarthXY = currentSample
    ? azElToXY(currentSample.earth.azimuthDeg, currentSample.earth.elevationDeg)
    : null;

  const placedDomeLabels = useMemo(() => {
    if (!curSunXY || !curEarthXY) return {};
    const zenithObstacle = { x: CX - 18, y: CY - 14, w: 36, h: 28 };
    const ringLabelObstacle = { x: CX, y: CY - R_OUTER, w: 34, h: R_OUTER };
    return resolvePointLabels(
      [
        { id: 'earth', px: curEarthXY.x, py: curEarthXY.y, radius: 7.5, w: 68, h: 16, priority: 2 },
        { id: 'sun', px: curSunXY.x, py: curSunXY.y, radius: 9, w: 62, h: 16, priority: 1 },
      ],
      {
        x: CX - R_OUTER + 8,
        y: CY - R_OUTER + 8,
        w: R_OUTER * 2 - 16,
        h: R_OUTER * 2 - 16,
      },
      [zenithObstacle, ringLabelObstacle]
    );
  }, [curSunXY, curEarthXY]);

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * SIZE;
    const py = ((e.clientY - rect.top) / rect.height) * SIZE;
    const dx = px - CX;
    const dy = CY - py;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > R_OUTER + 12 || dist < 6) {
      setHoverAz(null);
      return;
    }
    let az = (Math.atan2(dx, dy) * 180) / Math.PI;
    if (az < 0) az += 360;
    setHoverAz(Math.round(az) % 360);
  };

  const handleClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!onScrubIndex || !samples.length) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * SIZE;
    const py = ((e.clientY - rect.top) / rect.height) * SIZE;
    const dx = px - CX;
    const dy = CY - py;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > R_OUTER + 12) return;
    let clickAz = (Math.atan2(dx, dy) * 180) / Math.PI;
    if (clickAz < 0) clickAz += 360;

    let bestIdx = 0;
    let bestDiff = 999;
    for (let i = 0; i < samples.length; i++) {
      let diff = Math.abs(samples[i].sun.azimuthDeg - clickAz);
      if (diff > 180) diff = 360 - diff;
      if (diff < bestDiff) {
        bestDiff = diff;
        bestIdx = i;
      }
    }
    onScrubIndex(bestIdx);
  };

  const elevRings = [-3, 0, 5, 10];
  const hoverMaskElev = hoverAz !== null ? sampleHorizonAtAzimuth(horizonProfileDeg, hoverAz) : null;

  return (
    <div className="notebook-sheet overflow-hidden flex flex-col">
      <div className="px-4 py-3 border-b border-[#EAE3D5] flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-bold text-slate-900">
            Polar Sky-Dome &amp; Horizon Mask Radar
          </h2>
          <p className="text-xs text-slate-600">
            360° grazing-elevation diagram for {siteName} · Click bearing to jump Sun epoch
          </p>
        </div>

        <span className="text-xs font-mono text-slate-600 tabular-nums">
          Mask {horizonSummary.min >= 0 ? '+' : ''}
          {horizonSummary.min.toFixed(1)}° to {horizonSummary.max >= 0 ? '+' : ''}
          {horizonSummary.max.toFixed(1)}°
        </span>
      </div>

      <div className="relative p-4 flex items-center justify-center bg-[#0B1324]">
        <svg
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          className="w-full max-w-[400px] aspect-square cursor-crosshair select-none"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoverAz(null)}
          onClick={handleClick}
          role="img"
          aria-label="Polar sky dome showing terrain horizon mask, Sun spiral, and Earth libration track"
        >
          <defs>
            <radialGradient id="skyDomeBg" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#16233F" />
              <stop offset="72%" stopColor="#0F172A" />
              <stop offset="100%" stopColor="#090E1B" />
            </radialGradient>
            <clipPath id="domeClip">
              <circle cx={CX} cy={CY} r={R_OUTER} />
            </clipPath>
          </defs>

          {/* Outer instrument bezel */}
          <circle cx={CX} cy={CY} r={R_OUTER + 4} fill="none" stroke="#334155" strokeWidth={1.5} />
          <circle cx={CX} cy={CY} r={R_OUTER} fill="url(#skyDomeBg)" />

          {/* Azimuth spokes every 30 deg */}
          {Array.from({ length: 12 }, (_, idx) => {
            const az = idx * 30;
            const pt = azElToXY(az, MIN_EL);
            const isCardinal = az % 90 === 0;
            return (
              <line
                key={az}
                x1={CX}
                y1={CY}
                x2={pt.x}
                y2={pt.y}
                stroke="#334155"
                strokeOpacity={isCardinal ? 0.75 : 0.35}
                strokeWidth={isCardinal ? 1 : 0.75}
                strokeDasharray={isCardinal ? undefined : '2 3'}
              />
            );
          })}

          {/* Terrain horizon obstruction ring */}
          <g clipPath="url(#domeClip)">
            {terrainMaskPath && (
              <path
                d={terrainMaskPath}
                fill="#334155"
                fillOpacity={0.72}
                fillRule="evenodd"
              />
            )}
            {horizonContourPath && (
              <path
                d={horizonContourPath}
                fill="none"
                stroke="#CBD5E1"
                strokeWidth={1.6}
              />
            )}

            {/* Elevation rings */}
            {elevRings.map((el) => {
              const r = elToR(el);
              const isZero = el === 0;
              return (
                <g key={el}>
                  <circle
                    cx={CX}
                    cy={CY}
                    r={r}
                    fill="none"
                    stroke={isZero ? '#94A3B8' : '#475569'}
                    strokeWidth={isZero ? 1.25 : 0.8}
                    strokeDasharray={isZero ? '4 3' : '2 3'}
                  />
                  <text
                    x={CX + 4}
                    y={CY - r + 10}
                    className={`font-mono text-[9px] ${
                      isZero ? 'fill-slate-200 font-semibold' : 'fill-slate-400'
                    }`}
                  >
                    {el >= 0 ? `+${el}°` : `${el}°`}
                  </text>
                </g>
              );
            })}

            {/* Minimum engineering clearance rings (shown clearly in Graduate/Professor modes) */}
            {minSunElevDeg > 0 && (
              <circle
                cx={CX}
                cy={CY}
                r={elToR(minSunElevDeg)}
                fill="none"
                stroke="#F59E0B"
                strokeOpacity={isAdvanced ? 0.65 : 0.35}
                strokeWidth={isAdvanced ? 1.2 : 0.9}
                strokeDasharray="2 3"
              />
            )}
            {minEarthElevDeg > 0 && (
              <circle
                cx={CX}
                cy={CY}
                r={elToR(minEarthElevDeg)}
                fill="none"
                stroke="#38BDF8"
                strokeOpacity={isAdvanced ? 0.65 : 0.35}
                strokeWidth={isAdvanced ? 1.2 : 0.9}
                strokeDasharray="2 3"
              />
            )}

            {/* Earth libration figure-8 track */}
            {earthSegments.blocked.map((d, i) => (
              <path
                key={`eb-${i}`}
                d={d}
                fill="none"
                stroke="#38BDF8"
                strokeOpacity={0.35}
                strokeWidth={1.3}
                strokeDasharray="3 3"
              />
            ))}
            {earthSegments.clear.map((d, i) => (
              <path
                key={`ec-${i}`}
                d={d}
                fill="none"
                stroke="#38BDF8"
                strokeWidth={2}
              />
            ))}

            {/* Sun spiral track */}
            {sunSegments.blocked.map((d, i) => (
              <path
                key={`sb-${i}`}
                d={d}
                fill="none"
                stroke="#F59E0B"
                strokeOpacity={0.35}
                strokeWidth={1.4}
                strokeDasharray="3 3"
              />
            ))}
            {sunSegments.clear.map((d, i) => (
              <path
                key={`sc-${i}`}
                d={d}
                fill="none"
                stroke="#FBBF24"
                strokeWidth={2.2}
              />
            ))}

            {/* Live Sun & Earth radial vectors + markers */}
            {curEarthXY && currentSample && (
              <g>
                <line
                  x1={CX}
                  y1={CY}
                  x2={curEarthXY.x}
                  y2={curEarthXY.y}
                  stroke="#38BDF8"
                  strokeOpacity={0.55}
                  strokeWidth={1.2}
                  strokeDasharray="3 2"
                />
                <circle
                  cx={curEarthXY.x}
                  cy={curEarthXY.y}
                  r={7.5}
                  fill="#0284C7"
                  fillOpacity={currentSample.earthUsable ? 0.35 : 0.15}
                />
                <circle
                  cx={curEarthXY.x}
                  cy={curEarthXY.y}
                  r={4.2}
                  fill={currentSample.earthUsable ? '#38BDF8' : '#0F172A'}
                  stroke="#E0F2FE"
                  strokeWidth={1.4}
                />
              </g>
            )}

            {curSunXY && currentSample && (
              <g>
                <line
                  x1={CX}
                  y1={CY}
                  x2={curSunXY.x}
                  y2={curSunXY.y}
                  stroke="#FBBF24"
                  strokeOpacity={0.65}
                  strokeWidth={1.4}
                />
                <circle
                  cx={curSunXY.x}
                  cy={curSunXY.y}
                  r={9}
                  fill="#F59E0B"
                  fillOpacity={currentSample.sunUsable ? 0.35 : 0.12}
                />
                <circle
                  cx={curSunXY.x}
                  cy={curSunXY.y}
                  r={4.8}
                  fill={currentSample.sunUsable ? '#FBBF24' : '#1E293B'}
                  stroke="#FEF3C7"
                  strokeWidth={1.5}
                />
              </g>
            )}

            {/* Non-overlapping live Sun & Earth callout labels */}
            {curEarthXY && currentSample && (() => {
              const lbl = placedDomeLabels['earth'];
              if (!lbl) return null;
              return (
                <g pointerEvents="none">
                  {lbl.needsLeader && (
                    <line
                      x1={curEarthXY.x}
                      y1={curEarthXY.y}
                      x2={lbl.leaderX2}
                      y2={lbl.leaderY2}
                      stroke="#7DD3FC"
                      strokeOpacity={0.65}
                      strokeWidth={0.9}
                    />
                  )}
                  <text
                    x={lbl.textX}
                    y={lbl.textY + 4}
                    textAnchor={lbl.textAnchor}
                    className="fill-sky-200 font-mono text-[9.5px] font-semibold"
                    style={{ paintOrder: 'stroke', stroke: '#0B1324', strokeWidth: 3 }}
                  >
                    Earth {currentSample.earth.elevationDeg >= 0 ? '+' : ''}
                    {currentSample.earth.elevationDeg.toFixed(degDecimals)}°
                  </text>
                </g>
              );
            })()}

            {curSunXY && currentSample && (() => {
              const lbl = placedDomeLabels['sun'];
              if (!lbl) return null;
              return (
                <g pointerEvents="none">
                  {lbl.needsLeader && (
                    <line
                      x1={curSunXY.x}
                      y1={curSunXY.y}
                      x2={lbl.leaderX2}
                      y2={lbl.leaderY2}
                      stroke="#FDE68A"
                      strokeOpacity={0.65}
                      strokeWidth={0.9}
                    />
                  )}
                  <text
                    x={lbl.textX}
                    y={lbl.textY + 4}
                    textAnchor={lbl.textAnchor}
                    className="fill-amber-200 font-mono text-[9.5px] font-semibold"
                    style={{ paintOrder: 'stroke', stroke: '#0B1324', strokeWidth: 3 }}
                  >
                    Sun {currentSample.sun.elevationDeg >= 0 ? '+' : ''}
                    {currentSample.sun.elevationDeg.toFixed(degDecimals)}°
                  </text>
                </g>
              );
            })()}

            {/* Hover azimuth sightline */}
            {hoverAz !== null && hoverMaskElev !== null && (
              <g>
                <line
                  x1={CX}
                  y1={CY}
                  x2={azElToXY(hoverAz, MIN_EL).x}
                  y2={azElToXY(hoverAz, MIN_EL).y}
                  stroke="#E2E8F0"
                  strokeOpacity={0.6}
                  strokeWidth={1}
                />
                <circle
                  cx={azElToXY(hoverAz, hoverMaskElev).x}
                  cy={azElToXY(hoverAz, hoverMaskElev).y}
                  r={3.5}
                  fill="#F8FAFC"
                  stroke="#0F172A"
                  strokeWidth={1}
                />
              </g>
            )}
          </g>

          {/* Zenith center dot */}
          <circle cx={CX} cy={CY} r={2.5} fill="#94A3B8" />
          <text x={CX} y={CY + 13} textAnchor="middle" className="fill-slate-400 font-mono text-[8.5px]">
            +{MAX_EL}°
          </text>

          {/* Compass degree labels cleanly positioned outside outer ring */}
          <text
            x={CX}
            y={CY - R_OUTER - 16}
            textAnchor="middle"
            className="fill-sky-300 font-mono text-[10px] font-semibold"
          >
            0° N (Earth Ref)
          </text>
          <text
            x={CX + R_OUTER + 10}
            y={CY + 3}
            textAnchor="start"
            className="fill-slate-300 font-mono text-[10px] font-semibold"
          >
            90° E
          </text>
          <text
            x={CX}
            y={CY + R_OUTER + 22}
            textAnchor="middle"
            className="fill-slate-300 font-mono text-[10px] font-semibold"
          >
            180° S
          </text>
          <text
            x={CX - R_OUTER - 10}
            y={CY + 3}
            textAnchor="end"
            className="fill-slate-300 font-mono text-[10px] font-semibold"
          >
            270° W
          </text>
        </svg>
      </div>

      {/* Live readout & complete key footer */}
      <div className="px-4 py-2.5 border-t border-[#EAE3D5] notebook-paper-strip flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
        <span className="font-mono tabular-nums text-slate-800">
          {hoverAz !== null && hoverMaskElev !== null
            ? `Az ${hoverAz}° · Terrain Mask ${hoverMaskElev >= 0 ? '+' : ''}${hoverMaskElev.toFixed(2)}°`
            : `Mean Horizon ${horizonSummary.mean >= 0 ? '+' : ''}${horizonSummary.mean.toFixed(2)}° · Dashed Ring = 0°`}
        </span>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          <span className="inline-flex items-center gap-1.5 text-slate-700">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" />
            Sun
          </span>
          <span className="inline-flex items-center gap-1.5 text-slate-700">
            <span className="w-2.5 h-2.5 rounded-full bg-sky-400 inline-block" />
            Earth
          </span>
          <span className="inline-flex items-center gap-1.5 text-slate-700">
            <span className="w-3 h-0.5 border-t border-dashed border-slate-500 inline-block" />
            0° Ring
          </span>
          <span className="inline-flex items-center gap-1.5 text-slate-700">
            <span className="w-2.5 h-2.5 rounded-xs bg-slate-600 inline-block" />
            Terrain
          </span>
        </div>
      </div>

      <ExplainDropdown
        contentKey="skydome"
        sources={[
          {
            label: 'PDS LRO LOLA Polar GDR Archive',
            url: EXACT_NASA_URLS.lolaPolarGdr,
          },
          {
            label: 'NASA Moon Trek 5m DEM Service',
            url: EXACT_NASA_URLS.lolaDem5mService,
          },
          {
            label: 'NAIF SPICE Ephemeris Kernels',
            url: EXACT_NASA_URLS.naifSpiceKernels,
          },
        ]}
      />
    </div>
  );
};
