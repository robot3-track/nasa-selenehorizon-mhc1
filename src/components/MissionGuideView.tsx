import React from 'react';
import { ExternalLink } from 'lucide-react';
import { EXACT_NASA_URLS } from '../lib/nasaData';
import { DiagramSwoop, ExplainDropdown } from './NotebookPrimitives';

export const MissionGuideView: React.FC = () => {
  const citations = [
    {
      dataset: 'NASA JPL Horizons Ephemeris API (DE441)',
      provider: 'Jet Propulsion Laboratory / Solar System Dynamics',
      usage: 'Live topocentric Sun & Earth Azimuth/Elevation verification (CENTER=coord@301)',
      url: EXACT_NASA_URLS.jplHorizonsApp,
      apiUrl: EXACT_NASA_URLS.jplHorizonsApi,
    },
    {
      dataset: 'LRO LOLA 5 m/px Polar Crest DEM (LRO_LOLA_DEM_SPole875_5mp_v04)',
      provider: 'NASA Moon Trek / LOLA Science Team / PDS Geosciences Node',
      usage: 'High-resolution 5 m/px polar stereographic elevations (87.5°S–90°S) preventing narrow ridge averaging',
      url: EXACT_NASA_URLS.lolaPolarGdr,
      apiUrl: EXACT_NASA_URLS.lolaDem5mService,
    },
    {
      dataset: 'LRO LOLA South Pole 30 m/px DEM (LRO_LOLA_DEM_SPole75_30mp_v04)',
      provider: 'NASA Moon Trek / LOLA Science Team / PDS Geosciences Node',
      usage: 'Regional & far-field 32-bit Float meter elevations for 360° horizon ray-marching and shadow casting',
      url: EXACT_NASA_URLS.lolaPdsNode,
      apiUrl: EXACT_NASA_URLS.lolaDem30mService,
    },
    {
      dataset: 'Artemis III Candidate Landing Regions (A3_Named_regions_SP)',
      provider: 'NASA Exploration Systems Development / Moon Trek ArcGIS',
      usage: 'Official south pole landing region boundary polygons snapped to local LOLA ridge crests',
      url: EXACT_NASA_URLS.artemisPressRelease,
      apiUrl: EXACT_NASA_URLS.artemisRegionsRest,
    },
    {
      dataset: 'LRO LOLA Color Relief & LROC WAC Illumination Maps',
      provider: 'NASA Moon Trek WMTS (SPole75 / SPole875 / SPole60 / WAC_POLE_ILL_PCT_SOUTH_100M)',
      usage: 'Spacecraft polar stereographic basemaps, empirical illumination %, and average Earth visibility',
      url: EXACT_NASA_URLS.moonTrekPortal,
      apiUrl: 'https://trek.nasa.gov/tiles/Moon/SP/LRO_LOLA_ClrShade_SPole75_30mp_v04/1.0.0/WMTSCapabilities.xml',
    },
    {
      dataset: 'NAIF SPICE Kernels & NASA SVS Lunar South Pole Reference',
      provider: 'NASA NAIF / Goddard Scientific Visualization Studio',
      usage: 'Reference lunar orbital kernels (de440.bsp) and south pole lighting validation datasets',
      url: EXACT_NASA_URLS.svsSouthPole,
      apiUrl: EXACT_NASA_URLS.naifSpiceKernels,
    },
  ];

  return (
    <div className="max-w-[1140px] mx-auto px-3 sm:px-6 py-5 sm:py-8 space-y-6 sm:space-y-8">
      <DiagramSwoop className="notebook-sheet p-4 sm:p-6 space-y-2">
        <h1 className="text-2xl font-bold text-slate-900">
          Lunar South Pole Field Notebook &amp; Science Guide
        </h1>
        <p className="text-sm text-slate-600 max-w-3xl leading-relaxed">
          Understanding why landing site selection within 6° of the lunar south pole depends on crater-rim topography, seasonal solar tilt, and Earth libration cycles—with plain-English notes and exact NASA sources.
        </p>
      </DiagramSwoop>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <DiagramSwoop delay={0.04} className="notebook-sheet overflow-hidden flex flex-col justify-between">
          <div className="p-5 space-y-2.5">
            <h2 className="text-sm font-bold text-amber-800">
              1. Grazing Sunlight &amp; 1.54° Axial Tilt
            </h2>
            <p className="text-sm text-slate-700 leading-relaxed">
              Unlike Earth&apos;s 23.4° tilt, the Moon&apos;s spin axis is tilted only 1.54° to the ecliptic plane. Near 90°S, the Sun circles the horizon every 29.53 days while staying within a few degrees of horizontal.
            </p>
            <p className="text-xs text-slate-600 leading-relaxed">
              High ridges such as Connecting Ridge and Peak Near Shackleton capture extended sunlight (~90% annually), while deep crater interiors remain Permanently Shadowed Regions (PSRs).
            </p>
          </div>
          <ExplainDropdown
            contentKey="guideSun"
            sources={[
              { label: 'NASA SVS Lunar South Pole Collection', url: EXACT_NASA_URLS.svsSouthPole },
              { label: 'NASA LRO LOLA PDS Node', url: EXACT_NASA_URLS.lolaPdsNode },
            ]}
          />
        </DiagramSwoop>

        <DiagramSwoop delay={0.1} className="notebook-sheet overflow-hidden flex flex-col justify-between">
          <div className="p-5 space-y-2.5">
            <h2 className="text-sm font-bold text-sky-800">
              2. Lunar Libration &amp; Direct-to-Earth Links
            </h2>
            <p className="text-sm text-slate-700 leading-relaxed">
              Because the Moon&apos;s orbit is inclined 5.14° and slightly elliptical, Earth appears from the south pole to nod monthly by ±6.7° in elevation and ±7.9° in azimuth around the 0°E prime meridian.
            </p>
            <p className="text-xs text-slate-600 leading-relaxed">
              When Earth dips below a near-side mountain ridge, Direct-to-Earth (DTE) radio links drop out unless relayed by an orbiter. Elevated near-side massifs like Malapert Massif maintain &gt;90% Earth visibility.
            </p>
          </div>
          <ExplainDropdown
            contentKey="guideEarth"
            sources={[
              { label: 'NASA JPL Horizons System', url: EXACT_NASA_URLS.jplHorizonsApp },
              { label: 'IAU 2015 Lunar Frame Paper', url: EXACT_NASA_URLS.iau2015Paper },
            ]}
          />
        </DiagramSwoop>

        <DiagramSwoop delay={0.16} className="notebook-sheet overflow-hidden flex flex-col justify-between">
          <div className="p-5 space-y-2.5">
            <h2 className="text-sm font-bold text-emerald-800">
              3. Horizon Masking &amp; Solar Array Design
            </h2>
            <p className="text-sm text-slate-700 leading-relaxed">
              At 0°–5° solar elevation, flat horizontal solar panels intercept less than 9% of solar flux. Polar landers use vertical sun-tracking solar wings mounted on masts to capture full normal irradiance.
            </p>
            <p className="text-xs text-slate-600 leading-relaxed">
              Adjust the Photovoltaic / HGA Mast Height slider in the Site Planner to observe how raising solar arrays or high-gain antennas clears foreground crater rims in the LOLA DEM horizon profile.
            </p>
          </div>
          <ExplainDropdown
            contentKey="guideArray"
            sources={[
              { label: 'LOLA 5m/px Polar GDR Archive', url: EXACT_NASA_URLS.lolaPolarGdr },
              { label: 'NASA Moon Trek Portal', url: EXACT_NASA_URLS.moonTrekPortal },
            ]}
          />
        </DiagramSwoop>
      </div>

      {/* Authoritative NASA Source Citations */}
      <DiagramSwoop className="notebook-sheet overflow-hidden">
        <div className="px-5 py-3.5 border-b border-[#EAE3D5]">
          <h2 className="text-base font-bold text-slate-900">
            Exact NASA Data Sources &amp; Endpoint Directory
          </h2>
          <p className="text-xs text-slate-600 mt-0.5">
            Every map tile, DEM elevation grid, landing region boundary, and ephemeris check links directly to its official NASA source below.
          </p>
        </div>
        <div className="divide-y divide-[#EAE3D5]">
          {citations.map((item) => (
            <div
              key={item.dataset}
              className="px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div className="space-y-0.5">
                <div className="text-sm font-bold text-slate-900">{item.dataset}</div>
                <div className="text-xs font-medium text-slate-500">{item.provider}</div>
                <p className="text-xs text-slate-700">{item.usage}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0 self-start sm:self-center">
                <a
                  href={item.apiUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-[#FAF7F0] border border-[#E4DDD0] rounded-lg hover:bg-[#F2ECE0] transition-colors whitespace-nowrap shrink-0"
                >
                  Direct Service URL
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#0B3D91] bg-blue-50/70 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors whitespace-nowrap shrink-0"
                >
                  Open NASA Portal
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          ))}
        </div>
      </DiagramSwoop>
    </div>
  );
};
