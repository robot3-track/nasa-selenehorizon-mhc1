import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  LandingSite,
  LolaDemGrid,
  LUNAR_SOUTH_POLE_SITES,
  latLonToPolarMeters,
  polarMetersToLatLon,
  sampleElevationMeters,
} from '../lib/lunarSites';
import { EphemerisSample } from '../lib/lunarEphemeris';
import {
  ArtemisRegionFeature,
  EXACT_NASA_URLS,
  NASA_MAP_LAYERS,
  NasaMapLayerId,
} from '../lib/nasaData';
import { resolvePointLabels } from '../lib/labelPlacement';
import { useComprehension } from '../lib/comprehension';
import { ExplainDropdown } from './NotebookPrimitives';

interface PolarTerrainMapProps {
  activeSiteId: string;
  customLatDeg: number;
  customLonDeg: number;
  currentSample?: EphemerisSample;
  regionalDem: LolaDemGrid | null;
  localDem: LolaDemGrid | null;
  crestDem: LolaDemGrid | null;
  artemisRegions: ArtemisRegionFeature[];
  onSelectSite: (site: LandingSite) => void;
  onSelectCustomCoords: (latDeg: number, lonDeg: number, label?: string) => void;
}

type MapZoom = 3 | 4 | 5;

const ZOOM_CONFIG: Record<
  MapZoom,
  {
    label: string;
    spanLabel: string;
    viewRadiusM: number;
    scaleBarKm: number;
    latRings: number[];
  }
> = {
  3: {
    label: '220 km',
    spanLabel: '82.8°S–90°S',
    viewRadiusM: 220000,
    scaleBarKm: 50,
    latRings: [-89, -87, -85],
  },
  4: {
    label: '115 km',
    spanLabel: '86.2°S–90°S',
    viewRadiusM: 115000,
    scaleBarKm: 25,
    latRings: [-89, -88, -87],
  },
  5: {
    label: '58 km',
    spanLabel: '88.1°S–90°S',
    viewRadiusM: 58000,
    scaleBarKm: 10,
    latRings: [-89.5, -89, -88.5],
  },
};

const SIZE = 420;
const HALF = SIZE / 2;
const DEG2RAD = Math.PI / 180;

export const PolarTerrainMap: React.FC<PolarTerrainMapProps> = ({
  activeSiteId,
  customLatDeg,
  customLonDeg,
  currentSample,
  regionalDem,
  localDem,
  crestDem,
  artemisRegions,
  onSelectSite,
  onSelectCustomCoords,
}) => {
  const { level } = useComprehension();
  const isHighSchool = level === 'high-school';
  const isProfessor = level === 'nasa-professor';

  const [activeLayer, setActiveLayer] = useState<NasaMapLayerId>('LRO_LOLA_ClrShade_SPole75_30mp_v04');
  const [zoomLevel, setZoomLevel] = useState<MapZoom>(3);
  const [showSolarShadows, setShowSolarShadows] = useState<boolean>(true);
  const [hoverCoord, setHoverCoord] = useState<{ lat: number; lon: number; elevM: number } | null>(
    null
  );
  const shadowCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const zoomCfg = ZOOM_CONFIG[zoomLevel];
  const viewRadiusM = zoomCfg.viewRadiusM;
  // Exact Moon Trek WMTS center 2x2 extent at zoom z:
  // z=3 -> 273,982.5 m, z=4 -> 136,991.25 m, z=5 -> 68,495.625 m
  const tileRadiusM = 273982.5 / Math.pow(2, zoomLevel - 3);
  const halfMatrix = 1 << (zoomLevel - 1);
  const tileRowNW = halfMatrix - 1;
  const tileRowSE = halfMatrix;
  const tileColNW = halfMatrix - 1;
  const tileColSE = halfMatrix;

  const handleSelectLayer = (layerId: NasaMapLayerId) => {
    setActiveLayer(layerId);
    if (layerId === 'LRO_LOLA_ClrShade_SPole875_5mp_v04' && zoomLevel < 5) {
      setZoomLevel(5);
    }
  };

  // Render real-time solar shadow overlay computed from multi-tier NASA LOLA DEM
  useEffect(() => {
    const canvas = shadowCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, SIZE, SIZE);
    if (!showSolarShadows || !regionalDem || !currentSample) return;

    const img = ctx.createImageData(SIZE, SIZE);
    const data = img.data;

    const sunAz = currentSample.sun.azimuthDeg;
    const sunEl = currentSample.sun.elevationDeg;
    const lonRad = customLonDeg * DEG2RAD;
    const azRad = sunAz * DEG2RAD;

    // Exact Moon2000_spole Sun vector: (sin(lon + az), cos(lon + az))
    const sunDirX = Math.sin(lonRad + azRad);
    const sunDirY = Math.cos(lonRad + azRad);
    const mPerPx = (viewRadiusM * 2) / SIZE;
    const tanEl = Math.tan(Math.max(-6, Math.min(25, sunEl)) * DEG2RAD);

    for (let py = 0; py < SIZE; py++) {
      const yM = ((HALF - py) / HALF) * viewRadiusM;
      for (let px = 0; px < SIZE; px++) {
        const dx = px - HALF;
        const dy = py - HALF;
        if (dx * dx + dy * dy > HALF * HALF) continue;

        const xM = ((px - HALF) / HALF) * viewRadiusM;
        const elev = sampleElevationMeters(xM, yM, crestDem, localDem, regionalDem);

        let shadowed = sunEl <= -0.8;
        if (!shadowed) {
          for (let step = 2; step <= 34; step += 3) {
            const distM = step * mPerPx;
            const tx = xM + sunDirX * distM;
            const ty = yM + sunDirY * distM;
            const targetElev = sampleElevationMeters(tx, ty, crestDem, localDem, regionalDem);
            const curvM = (distM * distM) / (2 * 1737400);
            if (targetElev - elev - curvM > distM * tanEl + 20) {
              shadowed = true;
              break;
            }
          }
        }

        if (shadowed) {
          const idx = (py * SIZE + px) * 4;
          data[idx] = 15;
          data[idx + 1] = 23;
          data[idx + 2] = 42;
          data[idx + 3] = 132;
        }
      }
    }

    ctx.putImageData(img, 0, 0);
  }, [
    showSolarShadows,
    regionalDem,
    localDem,
    crestDem,
    viewRadiusM,
    currentSample?.sun.azimuthDeg,
    currentSample?.sun.elevationDeg,
    customLonDeg,
  ]);

  const polarToSvg = (xM: number, yM: number) => ({
    x: HALF + (xM / viewRadiusM) * HALF,
    y: HALF - (yM / viewRadiusM) * HALF,
  });

  const tileBoxPx = (tileRadiusM / viewRadiusM) * SIZE;
  const tileOffsetPx = (SIZE - tileBoxPx) / 2;

  const activePolar = latLonToPolarMeters(customLatDeg, customLonDeg);
  const activeSvg = polarToSvg(activePolar.xM, activePolar.yM);

  const azToPolarDir = (azDeg: number) => {
    const lonRad = customLonDeg * DEG2RAD;
    const azRad = azDeg * DEG2RAD;
    return {
      dx: Math.sin(lonRad + azRad),
      dy: Math.cos(lonRad + azRad),
    };
  };

  const sunVec = currentSample ? azToPolarDir(currentSample.sun.azimuthDeg) : null;
  const earthVec = currentSample ? azToPolarDir(currentSample.earth.azimuthDeg) : null;

  const handleMapClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * SIZE;
    const py = ((e.clientY - rect.top) / rect.height) * SIZE;
    const xM = ((px - HALF) / HALF) * viewRadiusM;
    const yM = ((HALF - py) / HALF) * viewRadiusM;
    if (Math.sqrt(xM * xM + yM * yM) > viewRadiusM) return;
    const { latDeg, lonDeg } = polarMetersToLatLon(xM, yM);
    onSelectCustomCoords(Number(latDeg.toFixed(4)), Number(lonDeg.toFixed(3)));
  };

  const handleMapHover = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * SIZE;
    const py = ((e.clientY - rect.top) / rect.height) * SIZE;
    const xM = ((px - HALF) / HALF) * viewRadiusM;
    const yM = ((HALF - py) / HALF) * viewRadiusM;
    if (Math.sqrt(xM * xM + yM * yM) > viewRadiusM) {
      setHoverCoord(null);
      return;
    }
    const { latDeg, lonDeg } = polarMetersToLatLon(xM, yM);
    const elevM = sampleElevationMeters(xM, yM, crestDem, localDem, regionalDem);
    setHoverCoord({ lat: latDeg, lon: lonDeg, elevM });
  };

  const artemisSvgPolygons = useMemo(() => {
    return artemisRegions.map((reg) => {
      const pathStr = reg.rings
        .map((ring) => {
          const pts = ring.map(([lon, lat]) => {
            const { xM, yM } = latLonToPolarMeters(lat, ((lon % 360) + 360) % 360);
            const { x, y } = polarToSvg(xM, yM);
            return `${x.toFixed(1)},${y.toFixed(1)}`;
          });
          return `M ${pts.join(' L ')} Z`;
        })
        .join(' ');
      const cPos = latLonToPolarMeters(reg.crestLat, reg.crestLon);
      const cSvg = polarToSvg(cPos.xM, cPos.yM);
      return { ...reg, pathStr, cSvg };
    });
  }, [artemisRegions, viewRadiusM]);

  const activeLayerMeta = NASA_MAP_LAYERS.find((l) => l.id === activeLayer) ?? NASA_MAP_LAYERS[0];
  const scaleBarPx = ((zoomCfg.scaleBarKm * 1000) / viewRadiusM) * HALF;

  const placedSiteLabels = useMemo(() => {
    const visibleSites = LUNAR_SOUTH_POLE_SITES.map((site) => {
      const p = latLonToPolarMeters(site.latDeg, site.lonDeg);
      const { x, y } = polarToSvg(p.xM, p.yM);
      return { site, x, y, isSelected: site.id === activeSiteId };
    }).filter((item) => Math.hypot(item.x - HALF, item.y - HALF) <= HALF - 6);

    // Reserve perimeter compass tags, scale bar, and active reticle
    const reserved = [
      { x: HALF - 62, y: 0, w: 124, h: 24 }, // 0°E top
      { x: SIZE - 42, y: HALF - 10, w: 42, h: 20 }, // 90°E right
      { x: HALF - 26, y: SIZE - 44, w: 52, h: 44 }, // 180°E + scale bar bottom
      { x: 0, y: HALF - 10, w: 42, h: 20 }, // 270°E left
      { x: activeSvg.x - 10, y: activeSvg.y - 10, w: 20, h: 20 }, // active reticle
    ];

    return resolvePointLabels(
      visibleSites.map((item) => ({
        id: item.site.id,
        px: item.x,
        py: item.y,
        radius: item.isSelected ? 7 : 4.5,
        w: Math.min(138, item.site.name.length * 5.7 + 8),
        h: 14,
        priority: item.isSelected ? 10 : item.site.elevM / 1000,
      })),
      { x: 18, y: 24, w: SIZE - 36, h: SIZE - 68 },
      reserved
    );
  }, [activeSiteId, viewRadiusM, activeSvg.x, activeSvg.y]);

  const HS_LAYER_NAMES: Partial<Record<NasaMapLayerId, string>> = {
    LRO_LOLA_ClrShade_SPole75_30mp_v04: 'Height Color Map',
    LRO_LOLA_ClrShade_SPole875_5mp_v04: 'Zoomed Ridge Map',
    LRO_WAC_Mosaic_SPole60_100m_v02: 'Moon Photo Mosaic',
    WAC_POLE_ILL_PCT_SOUTH_100M: 'Yearly Sunlight %',
  };

  const visibleLayers = isHighSchool
    ? NASA_MAP_LAYERS.filter((l) => l.id !== 'ClrAVGVISIB_75S_120M_201608_EARTH_SP')
    : NASA_MAP_LAYERS;

  return (
    <div className="notebook-sheet overflow-hidden flex flex-col">
      <div className="px-4 py-3 border-b border-[#EAE3D5] flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-bold text-slate-900">
            {isHighSchool
              ? 'Lunar South Pole Map & Sunlight Shadows'
              : `NASA Moon Trek GIS Polar Map (${zoomCfg.spanLabel})`}
          </h2>
          <p className="text-xs text-slate-600">
            {isHighSchool
              ? 'Click any site dot or shaded region to inspect its view of the Sun and Earth'
              : 'Moon2000_spole Stereographic · Click map or Artemis III region to inspect crest horizon'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="inline-flex items-center bg-slate-100 p-0.5 rounded border border-slate-200">
            {([3, 4, 5] as MapZoom[]).map((z) => (
              <button
                key={z}
                type="button"
                onClick={() => setZoomLevel(z)}
                className={`px-2 py-0.5 text-[11px] font-mono rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  zoomLevel === z
                    ? 'bg-white text-blue-700 font-semibold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {ZOOM_CONFIG[z].label}
              </button>
            ))}
          </div>

          <label className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 cursor-pointer whitespace-nowrap">
            <input
              type="checkbox"
              checked={showSolarShadows}
              onChange={(e) => setShowSolarShadows(e.target.checked)}
              className="accent-blue-700"
            />
            Shadows
          </label>
        </div>
      </div>

      {/* Layer Switcher */}
      <div className="px-4 py-2 notebook-paper-strip border-b border-[#EAE3D5] flex flex-wrap gap-1.5">
        {visibleLayers.map((layer) => {
          const active = activeLayer === layer.id;
          return (
            <button
              key={layer.id}
              type="button"
              onClick={() => handleSelectLayer(layer.id)}
              className={`px-2.5 py-1 text-xs font-medium rounded border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                active
                  ? 'bg-blue-700 text-white border-blue-700'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              {isHighSchool ? (HS_LAYER_NAMES[layer.id] ?? layer.label) : layer.label}
            </button>
          );
        })}
      </div>

      <div className="relative p-4 flex items-center justify-center bg-[#0B1324]">
        <div className="relative w-full max-w-[400px] aspect-square rounded-full overflow-hidden border-2 border-slate-700 bg-slate-950">
          {/* 2x2 stitched NASA Moon Trek WMTS tiles for zoomLevel z=3,4,5 */}
          <div
            className="absolute grid grid-cols-2 grid-rows-2 pointer-events-none"
            style={{
              left: `${(tileOffsetPx / SIZE) * 100}%`,
              top: `${(tileOffsetPx / SIZE) * 100}%`,
              width: `${(tileBoxPx / SIZE) * 100}%`,
              height: `${(tileBoxPx / SIZE) * 100}%`,
            }}
          >
            <img
              src={`/api/nasa/tile/${activeLayer}/${zoomLevel}/${tileRowNW}/${tileColNW}.png`}
              alt="NASA LRO South Pole tile NW"
              className="w-full h-full object-cover block"
            />
            <img
              src={`/api/nasa/tile/${activeLayer}/${zoomLevel}/${tileRowNW}/${tileColSE}.png`}
              alt="NASA LRO South Pole tile NE"
              className="w-full h-full object-cover block"
            />
            <img
              src={`/api/nasa/tile/${activeLayer}/${zoomLevel}/${tileRowSE}/${tileColNW}.png`}
              alt="NASA LRO South Pole tile SW"
              className="w-full h-full object-cover block"
            />
            <img
              src={`/api/nasa/tile/${activeLayer}/${zoomLevel}/${tileRowSE}/${tileColSE}.png`}
              alt="NASA LRO South Pole tile SE"
              className="w-full h-full object-cover block"
            />
          </div>

          {/* Real-time solar shadow overlay computed from NASA LOLA DEM */}
          <canvas
            ref={shadowCanvasRef}
            width={SIZE}
            height={SIZE}
            className="absolute inset-0 w-full h-full pointer-events-none"
          />

          {/* Interactive Vector & Artemis III Overlay */}
          <svg
            viewBox={`0 0 ${SIZE} ${SIZE}`}
            className="absolute inset-0 w-full h-full cursor-crosshair select-none"
            onClick={handleMapClick}
            onMouseMove={handleMapHover}
            onMouseLeave={() => setHoverCoord(null)}
            role="img"
            aria-label="Lunar south pole NASA LRO map with Artemis III landing regions"
          >
            <defs>
              <clipPath id="mapCircleClip">
                <circle cx={HALF} cy={HALF} r={HALF - 1} />
              </clipPath>
            </defs>

            <g clipPath="url(#mapCircleClip)">
              {/* Latitude circles (shown in Collegiate+ for geographic reference) */}
              {!isHighSchool &&
                zoomCfg.latRings.map((lat) => {
                  const rM = latLonToPolarMeters(lat, 0).yM;
                  const rPx = (rM / viewRadiusM) * HALF;
                  if (rPx > HALF) return null;
                  return (
                    <g key={lat}>
                      <circle
                        cx={HALF}
                        cy={HALF}
                        r={rPx}
                        fill="none"
                        stroke="#FFFFFF"
                        strokeOpacity={0.35}
                        strokeDasharray="3 3"
                      />
                      <text
                        x={HALF + 4}
                        y={HALF - rPx + 11}
                        className="fill-white/90 font-mono text-[9px] drop-shadow"
                      >
                        {Math.abs(lat)}°S
                      </text>
                    </g>
                  );
                })}

              {/* Prime Meridian (0 deg E -> Top = Earth direction) */}
              {!isHighSchool && (
                <line
                  x1={HALF}
                  y1={HALF}
                  x2={HALF}
                  y2={14}
                  stroke="#38BDF8"
                  strokeOpacity={0.6}
                  strokeDasharray="3 3"
                />
              )}

              {/* Official NASA Artemis III Candidate Landing Region Polygons */}
              {artemisSvgPolygons.map((reg) => (
                <g
                  key={reg.label}
                  className="cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectCustomCoords(
                      Number(reg.crestLat.toFixed(4)),
                      Number(reg.crestLon.toFixed(3)),
                      reg.label
                    );
                  }}
                >
                  <path
                    d={reg.pathStr}
                    fill="#38BDF8"
                    fillOpacity={0.18}
                    stroke="#7DD3FC"
                    strokeWidth={1.3}
                  />
                </g>
              ))}

              {/* Candidate Site Markers with De-conflicted Labels */}
              {LUNAR_SOUTH_POLE_SITES.map((site) => {
                const p = latLonToPolarMeters(site.latDeg, site.lonDeg);
                const { x, y } = polarToSvg(p.xM, p.yM);
                if (Math.hypot(x - HALF, y - HALF) > HALF - 6) return null;
                const isSelected = site.id === activeSiteId;
                const placed = placedSiteLabels[site.id];
                return (
                  <g
                    key={site.id}
                    className="cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectSite(site);
                    }}
                  >
                    {placed?.needsLeader && (
                      <line
                        x1={x}
                        y1={y}
                        x2={placed.leaderX2}
                        y2={placed.leaderY2}
                        stroke={isSelected ? '#FCD34D' : '#CBD5E1'}
                        strokeOpacity={0.8}
                        strokeWidth={0.9}
                      />
                    )}
                    <circle
                      cx={x}
                      cy={y}
                      r={isSelected ? 5 : 3.5}
                      fill={isSelected ? '#F59E0B' : '#FFFFFF'}
                      stroke="#0F172A"
                      strokeWidth={1.3}
                    />
                    <text
                      x={placed ? placed.textX : x + 6}
                      y={placed ? placed.textY + 4 : y + 3}
                      textAnchor={placed ? placed.textAnchor : 'start'}
                      className={`text-[9.5px] font-semibold ${
                        isSelected ? 'fill-amber-300' : 'fill-white'
                      }`}
                      style={{ paintOrder: 'stroke', stroke: '#0F172A', strokeWidth: 2.8 }}
                    >
                      {site.name}
                    </text>
                  </g>
                );
              })}

              {/* Sun & Earth Direction Vectors from Active Site */}
              {sunVec && (
                <line
                  x1={activeSvg.x}
                  y1={activeSvg.y}
                  x2={activeSvg.x + sunVec.dx * 62}
                  y2={activeSvg.y - sunVec.dy * 62}
                  stroke="#F59E0B"
                  strokeWidth={2.2}
                />
              )}
              {earthVec && (
                <line
                  x1={activeSvg.x}
                  y1={activeSvg.y}
                  x2={activeSvg.x + earthVec.dx * 62}
                  y2={activeSvg.y - earthVec.dy * 62}
                  stroke="#38BDF8"
                  strokeWidth={2}
                  strokeDasharray="3 2"
                />
              )}

              {/* Active site reticle */}
              <circle
                cx={activeSvg.x}
                cy={activeSvg.y}
                r={8}
                fill="none"
                stroke="#F59E0B"
                strokeWidth={1.6}
              />
            </g>

            {/* Cardinal longitude labels */}
            <text
              x={HALF}
              y={13}
              textAnchor="middle"
              className="fill-sky-300 font-mono text-[10px] font-semibold"
              style={{ paintOrder: 'stroke', stroke: '#0B1324', strokeWidth: 2.5 }}
            >
              {isHighSchool ? 'Toward Earth' : '0°E (Toward Earth)'}
            </text>
            {!isHighSchool && (
              <>
                <text
                  x={SIZE - 10}
                  y={HALF + 3}
                  textAnchor="end"
                  className="fill-white/85 font-mono text-[9px]"
                >
                  90°E
                </text>
                <text
                  x={HALF}
                  y={SIZE - 8}
                  textAnchor="middle"
                  className="fill-white/85 font-mono text-[9px]"
                >
                  180°E
                </text>
                <text
                  x={10}
                  y={HALF + 3}
                  textAnchor="start"
                  className="fill-white/85 font-mono text-[9px]"
                >
                  270°E
                </text>
              </>
            )}

            {/* GIS Scale Bar */}
            <g transform={`translate(${HALF - scaleBarPx / 2}, ${SIZE - 29})`}>
              <line x1={0} y1={0} x2={scaleBarPx} y2={0} stroke="#FFFFFF" strokeWidth={1.8} />
              <line x1={0} y1={-3} x2={0} y2={3} stroke="#FFFFFF" strokeWidth={1.5} />
              <line
                x1={scaleBarPx}
                y1={-3}
                x2={scaleBarPx}
                y2={3}
                stroke="#FFFFFF"
                strokeWidth={1.5}
              />
              <text
                x={scaleBarPx / 2}
                y={-4}
                textAnchor="middle"
                className="fill-white font-mono text-[9px] font-semibold"
                style={{ paintOrder: 'stroke', stroke: '#0F172A', strokeWidth: 2.5 }}
              >
                {zoomCfg.scaleBarKm} km
              </text>
            </g>
          </svg>
        </div>
      </div>

      {/* Map Key + Live Readout */}
      <div className="px-4 py-2 border-t border-[#EAE3D5] bg-white flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-600">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3.5 h-0.5 bg-amber-500 inline-block" />
          Sun Direction
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3.5 h-0.5 border-t-2 border-dashed border-sky-500 inline-block" />
          Earth Direction
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 bg-sky-400/30 border border-sky-400 inline-block rounded-xs" />
          Artemis III Region
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-400 border border-slate-800 inline-block" />
          {isHighSchool ? 'Selected Site' : 'Active Crest'}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-white border border-slate-800 inline-block" />
          Candidate Site
        </span>
      </div>

      {/* Live readout & source citation */}
      <div className="px-4 py-2.5 border-t border-[#EAE3D5] notebook-paper-strip space-y-1 text-xs text-slate-600">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-mono tabular-nums text-slate-800">
            {hoverCoord
              ? isHighSchool
                ? `Surface height: ${hoverCoord.elevM >= 0 ? '+' : ''}${hoverCoord.elevM.toFixed(0)} m`
                : `${Math.abs(hoverCoord.lat).toFixed(isProfessor ? 4 : 3)}°S, ${hoverCoord.lon.toFixed(isProfessor ? 3 : 2)}°E · ${hoverCoord.elevM >= 0 ? '+' : ''}${hoverCoord.elevM.toFixed(0)} m`
              : isHighSchool
                ? 'Move pointer over the Moon map to check elevation'
                : 'Move pointer over map to sample LOLA elevation'}
          </span>
          {!isHighSchool && (
            <a
              href={activeLayerMeta.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#0B3D91] font-medium hover:underline"
            >
              Layer XML: {activeLayerMeta.citation}
            </a>
          )}
        </div>
        <p className="text-[11px] text-slate-500">{activeLayerMeta.description}</p>
      </div>

      <ExplainDropdown
        contentKey="polarmap"
        sources={[
          {
            label: `${activeLayerMeta.label} WMTS XML`,
            url: activeLayerMeta.url,
          },
          {
            label: 'Dataset Portal / PDS Archive',
            url: activeLayerMeta.portalUrl,
          },
          {
            label: 'Artemis III Regions GeoJSON Service',
            url: EXACT_NASA_URLS.artemisRegionsRest,
          },
          {
            label: 'NASA Artemis III Announcement',
            url: EXACT_NASA_URLS.artemisPressRelease,
          },
        ]}
      />
    </div>
  );
};
