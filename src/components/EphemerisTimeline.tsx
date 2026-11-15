import React, { useMemo, useRef, useState } from 'react';
import { EphemerisSample } from '../lib/lunarEphemeris';
import { EXACT_NASA_URLS } from '../lib/nasaData';
import { useComprehension } from '../lib/comprehension';
import { ExplainDropdown } from './NotebookPrimitives';

interface EphemerisTimelineProps {
  samples: EphemerisSample[];
  currentIndex: number;
  minSunElevDeg: number;
  minEarthElevDeg: number;
  onScrubIndex: (index: number) => void;
}

const WIDTH = 960;
const HEIGHT = 224;
const PAD = { top: 18, right: 20, bottom: 52, left: 68 };
const PLOT_W = WIDTH - PAD.left - PAD.right;
const PLOT_H = HEIGHT - PAD.top - PAD.bottom;

export const EphemerisTimeline: React.FC<EphemerisTimelineProps> = ({
  samples,
  currentIndex,
  minSunElevDeg,
  minEarthElevDeg,
  onScrubIndex,
}) => {
  const { level } = useComprehension();
  const isHighSchool = level === 'high-school';
  const isProfessor = level === 'nasa-professor';
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const { minEl, maxEl } = useMemo(() => {
    let lo = -6;
    let hi = 12;
    for (const s of samples) {
      lo = Math.min(lo, s.sun.elevationDeg, s.earth.elevationDeg, s.sunHorizonElevDeg, s.earthHorizonElevDeg);
      hi = Math.max(hi, s.sun.elevationDeg, s.earth.elevationDeg, s.sunHorizonElevDeg, s.earthHorizonElevDeg);
    }
    return { minEl: Math.floor(lo - 1), maxEl: Math.ceil(hi + 1) };
  }, [samples]);

  const idxToX = (i: number) =>
    samples.length > 1 ? PAD.left + (i / (samples.length - 1)) * PLOT_W : PAD.left;
  const elToY = (el: number) => PAD.top + ((maxEl - el) / (maxEl - minEl)) * PLOT_H;

  const { sunPath, earthPath, sunHorizonPath, earthHorizonPath } = useMemo(() => {
    if (!samples.length) {
      return { sunPath: '', earthPath: '', sunHorizonPath: '', earthHorizonPath: '' };
    }
    const sunPts: string[] = [];
    const earthPts: string[] = [];
    const sunH: string[] = [];
    const earthH: string[] = [];
    for (let i = 0; i < samples.length; i++) {
      const x = idxToX(i).toFixed(1);
      const s = samples[i];
      sunPts.push(`${x},${elToY(s.sun.elevationDeg).toFixed(1)}`);
      earthPts.push(`${x},${elToY(s.earth.elevationDeg).toFixed(1)}`);
      sunH.push(`${x},${elToY(s.sunHorizonElevDeg + minSunElevDeg).toFixed(1)}`);
      earthH.push(`${x},${elToY(s.earthHorizonElevDeg + minEarthElevDeg).toFixed(1)}`);
    }
    return {
      sunPath: `M ${sunPts.join(' L ')}`,
      earthPath: `M ${earthPts.join(' L ')}`,
      sunHorizonPath: `M ${sunH.join(' L ')}`,
      earthHorizonPath: `M ${earthH.join(' L ')}`,
    };
  }, [samples, minEl, maxEl, minSunElevDeg, minEarthElevDeg]);

  const windowBars = useMemo(() => {
    const buildSpans = (pred: (s: EphemerisSample) => boolean) => {
      const spans: Array<{ startIdx: number; endIdx: number }> = [];
      let openStart: number | null = null;
      for (let i = 0; i < samples.length; i++) {
        if (pred(samples[i])) {
          if (openStart === null) openStart = i;
        } else if (openStart !== null) {
          spans.push({ startIdx: openStart, endIdx: i - 1 });
          openStart = null;
        }
      }
      if (openStart !== null) spans.push({ startIdx: openStart, endIdx: samples.length - 1 });
      return spans;
    };
    return {
      sun: buildSpans((s) => s.sunUsable),
      earth: buildSpans((s) => s.earthUsable),
      dual: buildSpans((s) => s.simultaneousUsable),
    };
  }, [samples]);

  const scrubFromClientX = (clientX: number) => {
    if (!svgRef.current || samples.length < 2) return;
    const rect = svgRef.current.getBoundingClientRect();
    const sx = ((clientX - rect.left) / rect.width) * WIDTH;
    const t = Math.max(0, Math.min(1, (sx - PAD.left) / PLOT_W));
    onScrubIndex(Math.round(t * (samples.length - 1)));
  };

  const timeTicks = useMemo(() => {
    if (samples.length < 2) return [];
    const count = 6;
    const arr: Array<{ x: number; label: string }> = [];
    for (let k = 0; k <= count; k++) {
      const idx = Math.round((k / count) * (samples.length - 1));
      const d = new Date(samples[idx].timestampMs);
      arr.push({ x: idxToX(idx), label: d.toISOString().slice(5, 16).replace('T', ' ') });
    }
    return arr;
  }, [samples]);

  const curX = idxToX(currentIndex);
  const currentSample = samples[currentIndex] ?? samples[0];

  return (
    <div className="notebook-sheet overflow-hidden">
      <div className="px-4 py-3 border-b border-[#EAE3D5] flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-bold text-slate-900">
            {isHighSchool
              ? 'Day-by-Day Sunlight & Earth Radio Timeline'
              : 'Power & Direct-to-Earth Window Timeline'}
          </h2>
          {currentSample && (
            <p className="text-xs font-mono text-slate-500 tabular-nums">
              {isHighSchool ? 'Selected Time: ' : 'Cursor: '}
              {currentSample.isoUtc.slice(0, 16).replace('T', ' ')} UTC
              {isProfessor &&
                ` · Sun ${currentSample.sun.elevationDeg >= 0 ? '+' : ''}${currentSample.sun.elevationDeg.toFixed(3)}° · Earth ${currentSample.earth.elevationDeg >= 0 ? '+' : ''}${currentSample.earth.elevationDeg.toFixed(3)}°`}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-medium text-slate-700">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3.5 h-0.5 bg-amber-600 inline-block" />
            {isHighSchool ? 'Sun Height' : 'Sun Elevation'}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3.5 h-0.5 bg-sky-600 inline-block" />
            {isHighSchool ? 'Earth Height' : 'Earth Elevation'}
          </span>
          {!isHighSchool && (
            <span className="inline-flex items-center gap-1.5">
              <span className="w-3.5 h-0.5 border-t border-dashed border-slate-500 inline-block" />
              Local Mask + Margin
            </span>
          )}
        </div>
      </div>

      <div className="p-3">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="w-full h-auto block cursor-ew-resize select-none"
          onPointerDown={(e) => {
            setIsDragging(true);
            e.currentTarget.setPointerCapture(e.pointerId);
            scrubFromClientX(e.clientX);
          }}
          onPointerMove={(e) => {
            if (isDragging) scrubFromClientX(e.clientX);
          }}
          onPointerUp={() => setIsDragging(false)}
          role="img"
          aria-label="Multi-day solar power and Earth communication elevation timeline"
        >
          <rect x={PAD.left} y={PAD.top} width={PLOT_W} height={PLOT_H} fill="#F8FAFC" />

          {[-5, 0, 5, 10, 15]
            .filter((el) => el >= minEl && el <= maxEl)
            .map((el) => {
              const y = elToY(el);
              return (
                <g key={el}>
                  <line
                    x1={PAD.left}
                    y1={y}
                    x2={PAD.left + PLOT_W}
                    y2={y}
                    stroke={el === 0 ? '#94A3B8' : '#E2E8F0'}
                    strokeDasharray={el === 0 ? '4 3' : undefined}
                  />
                  <text
                    x={PAD.left - 7}
                    y={y + 4}
                    textAnchor="end"
                    className="fill-slate-600 font-mono text-[11px]"
                  >
                    {isHighSchool && el === 0 ? 'Flat' : el > 0 ? `+${el}°` : `${el}°`}
                  </text>
                </g>
              );
            })}

          {!isHighSchool && sunHorizonPath && (
            <path
              d={sunHorizonPath}
              fill="none"
              stroke="#D97706"
              strokeOpacity={0.5}
              strokeWidth={1.1}
              strokeDasharray="3 3"
            />
          )}
          {!isHighSchool && earthHorizonPath && (
            <path
              d={earthHorizonPath}
              fill="none"
              stroke="#0284C7"
              strokeOpacity={0.5}
              strokeWidth={1.1}
              strokeDasharray="3 3"
            />
          )}

          {sunPath && <path d={sunPath} fill="none" stroke="#D97706" strokeWidth={2} />}
          {earthPath && <path d={earthPath} fill="none" stroke="#0284C7" strokeWidth={2} />}

          {[
            { label: isHighSchool ? 'Sunlight' : 'Sunlit', spans: windowBars.sun, y: PAD.top + PLOT_H + 7, color: '#D97706' },
            { label: isHighSchool ? 'Radio OK' : 'Earth DTE', spans: windowBars.earth, y: PAD.top + PLOT_H + 17, color: '#0284C7' },
            { label: isHighSchool ? 'Both OK' : 'Both Clear', spans: windowBars.dual, y: PAD.top + PLOT_H + 27, color: '#059669' },
          ].map((track) => (
            <g key={track.label}>
              <text
                x={PAD.left - 7}
                y={track.y + 6.5}
                textAnchor="end"
                className="fill-slate-600 text-[10px] font-medium"
              >
                {track.label}
              </text>
              <rect x={PAD.left} y={track.y} width={PLOT_W} height={7} fill="#E2E8F0" rx={2} />
              {track.spans.map((sp, idx) => {
                const x1 = idxToX(sp.startIdx);
                const x2 = idxToX(sp.endIdx);
                return (
                  <rect
                    key={idx}
                    x={x1}
                    y={track.y}
                    width={Math.max(2.5, x2 - x1)}
                    height={7}
                    fill={track.color}
                    rx={2}
                  />
                );
              })}
            </g>
          ))}

          {timeTicks.map((t, idx) => (
            <text
              key={idx}
              x={t.x}
              y={HEIGHT - 3}
              textAnchor={idx === 0 ? 'start' : idx === timeTicks.length - 1 ? 'end' : 'middle'}
              className="fill-slate-500 font-mono text-[10px]"
            >
              {t.label}
            </text>
          ))}

          <line
            x1={curX}
            y1={PAD.top}
            x2={curX}
            y2={PAD.top + PLOT_H + 35}
            stroke="#1E293B"
            strokeWidth={1.5}
          />
          <polygon
            points={`${curX - 4.5},${PAD.top} ${curX + 4.5},${PAD.top} ${curX},${PAD.top + 6.5}`}
            fill="#1E293B"
          />

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

      <ExplainDropdown
        contentKey="timeline"
        sources={[
          {
            label: 'NASA JPL Horizons System',
            url: EXACT_NASA_URLS.jplHorizonsApp,
          },
          {
            label: 'NAIF SPICE Lunar Kernels',
            url: EXACT_NASA_URLS.naifSpiceKernels,
          },
          {
            label: 'LRO LOLA Topography PDS Node',
            url: EXACT_NASA_URLS.lolaPdsNode,
          },
        ]}
      />
    </div>
  );
};
