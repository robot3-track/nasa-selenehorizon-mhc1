// #debugging with Google Gemini Hydrogen 4
import React, { useEffect, useMemo, useState } from 'react';
import {
  LUNAR_SOUTH_POLE_SITES,
  LandingSite,
  LolaDemGrid,
  computeHorizonProfile,
  sampleElevationAtLatLon,
} from './lib/lunarSites';
import { SolarArrayMode, simulateMissionWindow } from './lib/lunarEphemeris';
import { ParsedHorizonsRow, buildEphemerisCsv, parseJplHorizonsText } from './lib/horizonsParser';
import {
  ArtemisRegionFeature,
  EXACT_NASA_URLS,
  buildHorizonsApiUrl,
  fetchArtemisRegions,
  fetchCrestLolaDem,
  fetchLocalLolaDem,
  fetchRegionalLolaDem,
} from './lib/nasaData';
import { HorizonPanorama } from './components/HorizonPanorama';
import { PolarSkyDome } from './components/PolarSkyDome';
import { PolarTerrainMap } from './components/PolarTerrainMap';
import { EphemerisTimeline } from './components/EphemerisTimeline';
import { SiteCompareView } from './components/SiteCompareView';
import { DataHorizonsView } from './components/DataHorizonsView';
import { MissionGuideView } from './components/MissionGuideView';
import { ArtemisPolarBadge, NasaFlightInsignia } from './components/NasaInsignia';
import {
  ComprehensionOnboardingModal,
  ComprehensionSelector,
  DiagramSwoop,
  ExplainDropdown,
  HeaderComprehensionMenu,
} from './components/NotebookPrimitives';
import { ComprehensionProvider, useComprehension } from './lib/comprehension';
import { GuidedTour } from './components/GuidedTour';
import {
  ChevronDown,
  ChevronRight,
  Compass,
  Download,
  ExternalLink,
  Menu,
  Pause,
  Play,
  RotateCcw,
  X,
} from 'lucide-react';

type AppTab = 'workbench' | 'compare' | 'data' | 'guide';

const DURATION_OPTIONS = [
  { hours: 24, label: '24 Hours', stepMinutes: 15 },
  { hours: 168, label: '7 Days', stepMinutes: 60 },
  { hours: 336, label: '14 Days', stepMinutes: 90 },
  { hours: 708, label: '29.5 Days', stepMinutes: 180 },
];

const EPOCH_PRESETS = [
  { iso: '2026-11-14T00:00', label: 'Nov 2026' },
  { iso: '2026-12-21T00:00', label: 'Dec Solstice' },
  { iso: '2027-03-20T00:00', label: 'Mar Equinox' },
  { iso: '2027-06-21T00:00', label: 'Jun Winter' },
];

function AppContent() {
  const { level, isModalOpen, hasChosenInitial } = useComprehension();
  const isHighSchool = level === 'high-school';
  const isAdvanced = level === 'graduate' || level === 'nasa-professor';
  const isProfessor = level === 'nasa-professor';
  const degDecimals = isProfessor ? 3 : 2;

  const [activeTab, setActiveTab] = useState<AppTab>('workbench');
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);

  // Selected site / custom coordinates
  const [activeSiteId, setActiveSiteId] = useState<string>(LUNAR_SOUTH_POLE_SITES[0].id);
  const [customSiteLabel, setCustomSiteLabel] = useState<string>('Custom Coordinate');
  const [latDeg, setLatDeg] = useState<number>(LUNAR_SOUTH_POLE_SITES[0].latDeg);
  const [lonDeg, setLonDeg] = useState<number>(LUNAR_SOUTH_POLE_SITES[0].lonDeg);
  const [elevM, setElevM] = useState<number>(LUNAR_SOUTH_POLE_SITES[0].elevM);

  // Mission window & engineering parameters
  const [startDateIso, setStartDateIso] = useState<string>('2026-11-14T00:00');
  const [durationHours, setDurationHours] = useState<number>(708);
  const [mastHeightM, setMastHeightM] = useState<number>(2.5);
  const [minSunElevDeg, setMinSunElevDeg] = useState<number>(0.0);
  const [minEarthElevDeg, setMinEarthElevDeg] = useState<number>(0.5);
  const [solarArrayMode, setSolarArrayMode] = useState<SolarArrayMode>('tracking');
  const [showTracks, setShowTracks] = useState<boolean>(true);
  const [showDiscs, setShowDiscs] = useState<boolean>(true);
  const [showAdvancedParams, setShowAdvancedParams] = useState<boolean>(false);

  useEffect(() => {
    setShowAdvancedParams(level === 'nasa-professor');
  }, [level]);

  // Playback & scrub state
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);

  // Live NASA data state
  const [regionalDem, setRegionalDem] = useState<LolaDemGrid | null>(null);
  const [localDem, setLocalDem] = useState<LolaDemGrid | null>(null);
  const [crestDem, setCrestDem] = useState<LolaDemGrid | null>(null);
  const [artemisRegions, setArtemisRegions] = useState<ArtemisRegionFeature[]>([]);
  const [horizonsOverlay, setHorizonsOverlay] = useState<ParsedHorizonsRow[]>([]);
  const [jplSyncStatus, setJplSyncStatus] = useState<'syncing' | 'verified' | 'offline'>('syncing');
  const [customHorizonProfile, setCustomHorizonProfile] = useState<number[] | null>(null);
  const [tourOpen, setTourOpen] = useState<boolean>(() => {
    try {
      return !window.localStorage.getItem('selene_horizon_tour_v1');
    } catch {
      return true;
    }
  });

  const handleCloseTour = () => {
    setTourOpen(false);
    try {
      window.localStorage.setItem('selene_horizon_tour_v1', 'done');
    } catch {
      // Ignore storage errors in restricted iframes
    }
  };

  // Fetch regional NASA LOLA DEM + official Artemis III regions once on mount
  useEffect(() => {
    let active = true;
    fetchRegionalLolaDem()
      .then((grid) => {
        if (active) setRegionalDem(grid);
      })
      .catch(() => {
        // Analytic terrain model remains active when offline
      });

    fetchArtemisRegions()
      .then((res) => {
        if (active) setArtemisRegions(res.regions);
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, []);

  // Fetch high-res local (~280 m/px) + crest (~27 m/px SPole875 5m) NASA LOLA DEMs around active site
  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      Promise.all([
        fetchCrestLolaDem(latDeg, lonDeg).catch(() => null),
        fetchLocalLolaDem(latDeg, lonDeg).catch(() => null),
      ]).then(([crest, local]) => {
        if (!active) return;
        setCrestDem(crest);
        setLocalDem(local);
        if (crest || local || regionalDem) {
          setElevM(Math.round(sampleElevationAtLatLon(latDeg, lonDeg, crest, local, regionalDem)));
        }
      });
    }, 120);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [latDeg, lonDeg, regionalDem]);

  // Automatically verify Sun & Earth ephemeris against live NASA JPL Horizons DE441
  useEffect(() => {
    let active = true;
    setJplSyncStatus('syncing');

    const start = new Date(`${startDateIso}:00Z`);
    if (Number.isNaN(start.getTime())) return;
    const stop = new Date(start.getTime() + Math.min(durationHours, 168) * 3600 * 1000);
    const step = durationHours <= 48 ? '4 h' : '12 h';

    const queryTarget = async (targetCode: '10' | '399') => {
      const qs = new URLSearchParams({
        lat: latDeg.toFixed(4),
        lon: lonDeg.toFixed(4),
        elevKm: (elevM / 1000).toFixed(3),
        startTime: start.toISOString(),
        stopTime: stop.toISOString(),
        stepSize: step,
        target: targetCode,
      });
      const res = await fetch(`/api/horizons?${qs.toString()}`);
      if (!res.ok) throw new Error('JPL Horizons unavailable');
      const json = (await res.json()) as { result?: string };
      if (!json.result) throw new Error('Empty Horizons result');
      const parsed = parseJplHorizonsText(json.result);
      return parsed.rows.map((r) => ({
        ...r,
        target: (targetCode === '399' ? 'Earth' : 'Sun') as 'Sun' | 'Earth',
      }));
    };

    const timer = window.setTimeout(() => {
      Promise.all([queryTarget('10'), queryTarget('399')])
        .then(([sunRows, earthRows]) => {
          if (!active) return;
          setHorizonsOverlay([...sunRows, ...earthRows]);
          setJplSyncStatus('verified');
        })
        .catch(() => {
          if (active) setJplSyncStatus('offline');
        });
    }, 250);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [latDeg, lonDeg, elevM, startDateIso, durationHours]);

  const activeSite = useMemo(
    () => LUNAR_SOUTH_POLE_SITES.find((s) => s.id === activeSiteId) ?? null,
    [activeSiteId]
  );

  const siteLabel = activeSite ? activeSite.name : customSiteLabel;

  const horizonProfileDeg = useMemo(() => {
    if (customHorizonProfile) return customHorizonProfile;
    return computeHorizonProfile(latDeg, lonDeg, mastHeightM, crestDem, localDem, regionalDem);
  }, [latDeg, lonDeg, mastHeightM, crestDem, localDem, regionalDem, customHorizonProfile]);

  const stepMinutes = useMemo(() => {
    return DURATION_OPTIONS.find((d) => d.hours === durationHours)?.stepMinutes ?? 120;
  }, [durationHours]);

  const { samples, summary } = useMemo(() => {
    const parsed = new Date(`${startDateIso}:00Z`);
    const validStart = Number.isNaN(parsed.getTime()) ? new Date('2026-11-14T00:00:00Z') : parsed;

    return simulateMissionWindow({
      latDeg,
      lonDeg,
      elevM,
      horizonProfileDeg,
      startDate: validStart,
      durationHours,
      stepMinutes,
      minSunElevDeg,
      minEarthElevDeg,
      solarArrayMode,
    });
  }, [
    latDeg,
    lonDeg,
    elevM,
    horizonProfileDeg,
    startDateIso,
    durationHours,
    stepMinutes,
    minSunElevDeg,
    minEarthElevDeg,
    solarArrayMode,
  ]);

  useEffect(() => {
    if (currentIndex >= samples.length) {
      setCurrentIndex(Math.max(0, samples.length - 1));
    }
  }, [samples.length, currentIndex]);

  useEffect(() => {
    if (!isPlaying || samples.length < 2) return;
    const intervalMs = Math.max(40, Math.round(140 / playbackSpeed));
    const timer = window.setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % samples.length);
    }, intervalMs);
    return () => window.clearInterval(timer);
  }, [isPlaying, playbackSpeed, samples.length]);

  const handleSelectSite = (site: LandingSite) => {
    setActiveSiteId(site.id);
    setLatDeg(site.latDeg);
    setLonDeg(site.lonDeg);
    setElevM(
      Math.round(
        sampleElevationAtLatLon(site.latDeg, site.lonDeg, crestDem, localDem, regionalDem) ||
          site.elevM
      )
    );
    setCustomHorizonProfile(null);
  };

  const handleSelectCustomCoords = (newLat: number, newLon: number, label?: string) => {
    const clampedLat = Math.max(-89.99, Math.min(-83.0, newLat));
    const wrappedLon = ((newLon % 360) + 360) % 360;
    setActiveSiteId('custom');
    setCustomSiteLabel(label || 'Custom Coordinate');
    setLatDeg(clampedLat);
    setLonDeg(wrappedLon);
    setElevM(
      Math.round(sampleElevationAtLatLon(clampedLat, wrappedLon, crestDem, localDem, regionalDem))
    );
    setCustomHorizonProfile(null);
  };

  const handleExportCsv = () => {
    const csv = buildEphemerisCsv(siteLabel, latDeg, lonDeg, elevM, samples);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `selene-horizon-${siteLabel.toLowerCase().replace(/\s+/g, '-')}-${startDateIso.slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const currentSample = samples[currentIndex] ?? samples[0];

  const demSourceLabel = customHorizonProfile
    ? 'User Custom Horizon CSV'
    : crestDem
      ? 'NASA LRO LOLA DEM (SPole875 5m/27m + SPole75 30m)'
      : localDem
        ? 'NASA LRO LOLA DEM (SPole75 280m local)'
        : regionalDem
          ? 'NASA LRO LOLA DEM (SPole75 regional)'
          : 'LOLA Analytic Fallback';

  const ephemerisSourceLabel =
    jplSyncStatus === 'verified'
      ? 'NASA JPL Horizons DE441 (Live Verified)'
      : jplSyncStatus === 'syncing'
        ? 'IAU 2015 / astronomy-engine (Syncing JPL...)'
        : 'IAU 2015 / astronomy-engine (Offline)';

  const navTabs: Array<{ id: AppTab; label: string }> = [
    { id: 'workbench', label: 'Site Planner' },
    { id: 'compare', label: 'Compare Sites' },
    { id: 'data', label: 'Horizons & Export' },
    { id: 'guide', label: 'Science Guide' },
  ];

  const liveHorizonsUrl = useMemo(() => {
    const start = new Date(`${startDateIso}:00Z`);
    const validStart = Number.isNaN(start.getTime()) ? new Date('2026-11-14T00:00:00Z') : start;
    const stop = new Date(validStart.getTime() + Math.min(durationHours, 168) * 3600 * 1000);
    return buildHorizonsApiUrl(latDeg, lonDeg, elevM, validStart.toISOString(), stop.toISOString(), '10');
  }, [latDeg, lonDeg, elevM, startDateIso, durationHours]);

  return (
    <div className="min-h-screen text-slate-900 flex flex-col">
      {/* Top Bar Contract: 3 clean zones + mobile hamburger */}
      <header className="border-b border-[#E4DDD0] bg-white/95 backdrop-blur-xs px-3 sm:px-6 h-14 flex items-center justify-between gap-3 sm:gap-6 sticky top-0 z-30">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            data-tour="mobile-menu-btn"
            onClick={() => setMobileMenuOpen(true)}
            aria-label="Open navigation menu"
            className="md:hidden p-1.5 -ml-1 text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          >
            <Menu className="w-5 h-5" />
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('workbench')}
            className="inline-flex items-center gap-2 text-sm sm:text-base font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <NasaFlightInsignia className="w-7 h-7 sm:w-8 sm:h-8 shrink-0" />
            <span>Selene Horizon</span>
          </button>
        </div>

        <nav data-tour="nav-tabs" className="hidden md:flex items-center gap-5 lg:gap-6 overflow-x-auto">
          {navTabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`py-4 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  isActive
                    ? 'border-[#0B3D91] text-[#0B3D91]'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </nav>

        <div className="flex items-center gap-2 shrink-0">
          <HeaderComprehensionMenu />
          <button
            type="button"
            onClick={handleExportCsv}
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[#0B3D91] text-white rounded-lg hover:bg-blue-900 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden lg:inline">Download CSV</span>
            <span className="lg:hidden">CSV</span>
          </button>
        </div>
      </header>

      {/* Mobile Sidebar Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="Mobile navigation drawer">
          <div
            className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="fixed inset-y-0 left-0 w-[min(300px,85vw)] bg-white border-r border-[#E4DDD0] shadow-2xl flex flex-col justify-between overflow-y-auto">
            <div className="p-4 space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-[#EAE3D5]">
                <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
                  <NasaFlightInsignia className="w-7 h-7 shrink-0" />
                  <span>Selene Horizon</span>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  aria-label="Close navigation menu"
                  className="p-1.5 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-1">
                <div className="px-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Workspace Views
                </div>
                {navTabs.map((tab) => {
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => {
                        setActiveTab(tab.id);
                        setMobileMenuOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors cursor-pointer ${
                        isActive
                          ? 'bg-[#0B3D91] text-white'
                          : 'text-slate-700 hover:bg-[#FAF7F0]'
                      }`}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              <div className="pt-3 border-t border-[#EAE3D5]">
                <ComprehensionSelector compact onSelect={() => setMobileMenuOpen(false)} />
              </div>
            </div>

            <div className="p-4 border-t border-[#EAE3D5] bg-[#FAF7F0] space-y-2">
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  setActiveTab('workbench');
                  setTourOpen(true);
                }}
                className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold text-[#0B3D91] bg-white border border-[#D8CFBE] rounded-lg hover:bg-[#EFE9DC] cursor-pointer"
              >
                <Compass className="w-3.5 h-3.5" />
                Launch Guided Tour
              </button>
              <button
                type="button"
                onClick={() => {
                  handleExportCsv();
                  setMobileMenuOpen(false);
                }}
                className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold bg-[#0B3D91] text-white rounded-lg hover:bg-blue-900 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                Download Ephemeris CSV
              </button>
            </div>
          </aside>
        </div>
      )}

      <main className="flex-1">
        {activeTab === 'workbench' && (
          <div className="max-w-[1440px] mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-5 flex flex-col lg:flex-row gap-4 sm:gap-5">
            {/* Left Guided Controls Column */}
            <aside className="w-full lg:w-[320px] shrink-0 space-y-4">
              {/* Step 1: Landing Site */}
              <section data-tour="site-controls" className="notebook-sheet p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold text-slate-900">
                    {isHighSchool ? '1. Pick a Moon Landing Site' : '1. Candidate Site & Coords'}
                  </h2>
                  <span className="text-xs font-mono text-slate-500 tabular-nums">
                    {elevM >= 0 ? '+' : ''}
                    {elevM} m {isHighSchool ? 'height' : 'LOLA'}
                  </span>
                </div>

                <select
                  aria-label="Select Artemis III South Pole Candidate Site"
                  value={activeSiteId}
                  onChange={(e) => {
                    const found = LUNAR_SOUTH_POLE_SITES.find((s) => s.id === e.target.value);
                    if (found) handleSelectSite(found);
                  }}
                  className="w-full bg-slate-50 border border-slate-300 rounded px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-600"
                >
                  {LUNAR_SOUTH_POLE_SITES.map((s) => (
                    <option key={s.id} value={s.id}>
                      {isHighSchool
                        ? s.name
                        : `${s.name} (${Math.abs(s.latDeg).toFixed(2)}°S, ${s.lonDeg.toFixed(1)}°E)`}
                    </option>
                  ))}
                  {activeSiteId === 'custom' && (
                    <option value="custom">
                      {customSiteLabel} ({Math.abs(latDeg).toFixed(2)}°S, {lonDeg.toFixed(1)}°E)
                    </option>
                  )}
                </select>

                {!isHighSchool && (
                <div className="grid grid-cols-2 gap-2.5">
                  <label className="block">
                    <span className="text-xs text-slate-600 block mb-1">Selenographic Lat (°)</span>
                    <input
                      type="number"
                      step={0.05}
                      min={-89.99}
                      max={-83}
                      value={latDeg}
                      onChange={(e) => handleSelectCustomCoords(Number(e.target.value), lonDeg)}
                      className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-xs font-mono text-slate-900 tabular-nums focus:outline-none focus:border-blue-600"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs text-slate-600 block mb-1">East Lon (°)</span>
                    <input
                      type="number"
                      step={0.5}
                      min={0}
                      max={360}
                      value={lonDeg}
                      onChange={(e) => handleSelectCustomCoords(latDeg, Number(e.target.value))}
                      className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-xs font-mono text-slate-900 tabular-nums focus:outline-none focus:border-blue-600"
                    />
                  </label>
                </div>
                )}
              </section>

              {/* Step 2: Date & Duration */}
              <section data-tour="mission-epoch" className="notebook-sheet p-4 space-y-3">
                <h2 className="text-sm font-bold text-slate-900">2. Ephemeris Epoch &amp; Span</h2>

                <label className="block">
                  <span className="text-xs text-slate-600 block mb-1">Start Epoch (UTC)</span>
                  <input
                    type="datetime-local"
                    value={startDateIso}
                    onChange={(e) => setStartDateIso(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-xs font-mono text-slate-900 focus:outline-none focus:border-blue-600"
                  />
                </label>

                <div className="grid grid-cols-2 gap-1.5">
                  {EPOCH_PRESETS.map((p) => (
                    <button
                      key={p.iso}
                      type="button"
                      onClick={() => setStartDateIso(p.iso)}
                      className={`px-2.5 py-1.5 text-xs font-medium rounded border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        startDateIso === p.iso
                          ? 'bg-blue-700 text-white border-blue-700'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>

                <div>
                  <span className="text-xs text-slate-600 block mb-1.5">Synodic Window</span>
                  <div className="grid grid-cols-4 gap-1 bg-slate-100 p-1 rounded border border-slate-200">
                    {DURATION_OPTIONS.map((opt) => (
                      <button
                        key={opt.hours}
                        type="button"
                        onClick={() => setDurationHours(opt.hours)}
                        className={`py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                          durationHours === opt.hours
                            ? 'bg-white text-slate-900 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {opt.label.replace(' Hours', 'h').replace(' Days', 'd')}
                      </button>
                    ))}
                  </div>
                </div>
              </section>

              {/* Step 3: Collapsible Engineering Constraints (omitted in High School mode for simplicity) */}
              {!isHighSchool && (
              <section className="notebook-sheet overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowAdvancedParams((v) => !v)}
                  className="w-full px-4 py-3 flex items-center justify-between text-sm font-bold text-slate-900 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  <span>3. Spacecraft &amp; LOS Margins</span>
                  {showAdvancedParams ? (
                    <ChevronDown className="w-4 h-4 text-slate-500" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-slate-500" />
                  )}
                </button>

                {showAdvancedParams && (
                  <div className="px-4 pb-4 pt-2 border-t border-slate-200 space-y-3">
                    <div>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-slate-600">Photovoltaic / HGA Mast Height</span>
                        <span className="font-mono font-semibold text-blue-700 tabular-nums">
                          {mastHeightM.toFixed(1)} m AGL
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0.5}
                        max={30}
                        step={0.5}
                        value={mastHeightM}
                        onChange={(e) => setMastHeightM(Number(e.target.value))}
                        className="w-full telemetry-slider"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-slate-600">Solar LOS Clearance Margin</span>
                        <span className="font-mono font-semibold text-amber-700 tabular-nums">
                          +{minSunElevDeg.toFixed(1)}°
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={5}
                        step={0.25}
                        value={minSunElevDeg}
                        onChange={(e) => setMinSunElevDeg(Number(e.target.value))}
                        className="w-full telemetry-slider"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-slate-600">Earth DTE Clearance Margin</span>
                        <span className="font-mono font-semibold text-sky-700 tabular-nums">
                          +{minEarthElevDeg.toFixed(1)}°
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={5}
                        step={0.25}
                        value={minEarthElevDeg}
                        onChange={(e) => setMinEarthElevDeg(Number(e.target.value))}
                        className="w-full telemetry-slider"
                      />
                    </div>

                    <div>
                      <span className="text-xs text-slate-600 block mb-1.5">Solar Panel Mount</span>
                      <div className="grid grid-cols-2 gap-1 bg-slate-100 p-1 rounded border border-slate-200">
                        <button
                          type="button"
                          onClick={() => setSolarArrayMode('tracking')}
                          className={`py-1.5 px-2 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                            solarArrayMode === 'tracking'
                              ? 'bg-white text-slate-900 shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          Vertical Tracking
                        </button>
                        <button
                          type="button"
                          onClick={() => setSolarArrayMode('horizontal')}
                          className={`py-1.5 px-2 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                            solarArrayMode === 'horizontal'
                              ? 'bg-white text-slate-900 shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          Fixed Horizontal
                        </button>
                      </div>
                    </div>

                    <div className="pt-1 flex items-center justify-between text-xs text-slate-700">
                      <label className="inline-flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={showTracks}
                          onChange={(e) => setShowTracks(e.target.checked)}
                          className="accent-blue-700"
                        />
                        Sky Tracks
                      </label>
                      <label className="inline-flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={showDiscs}
                          onChange={(e) => setShowDiscs(e.target.checked)}
                          className="accent-blue-700"
                        />
                        Angular Discs
                      </label>
                    </div>
                  </div>
                )}
              </section>
              )}

              {/* Live NASA Provenance Card */}
              <section className="notebook-sheet overflow-hidden text-xs">
                <div className="p-4 space-y-2">
                  <div className="font-bold text-slate-900">NASA</div>
                  {isHighSchool ? (
                    <p className="text-slate-600 leading-relaxed">
                      Using real NASA Lunar Reconnaissance Orbiter elevation maps and JPL Sun &amp; Earth positions for <strong className="text-slate-800">{siteLabel}</strong>.
                    </p>
                  ) : (
                  <div className="space-y-2 text-slate-600">
                    <div>
                      <span className="font-semibold text-slate-800">Ephemeris:</span>{' '}
                      <a
                        href={liveHorizonsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`inline-flex items-center gap-1 hover:underline ${
                          jplSyncStatus === 'verified' ? 'text-emerald-700 font-medium' : 'text-[#0B3D91]'
                        }`}
                      >
                        <span>{ephemerisSourceLabel}</span>
                        <ExternalLink className="w-3 h-3 shrink-0" />
                      </a>
                    </div>
                    <div>
                      <span className="font-semibold text-slate-800">Topography:</span>{' '}
                      <a
                        href={
                          crestDem
                            ? EXACT_NASA_URLS.lolaDem5mService
                            : EXACT_NASA_URLS.lolaDem30mService
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`inline-flex items-center gap-1 hover:underline ${
                          regionalDem ? 'text-emerald-700 font-medium' : 'text-[#0B3D91]'
                        }`}
                      >
                        <span>{demSourceLabel}</span>
                        <ExternalLink className="w-3 h-3 shrink-0" />
                      </a>
                    </div>
                    <div>
                      <span className="font-semibold text-slate-800">Landing Regions:</span>{' '}
                      <a
                        href={EXACT_NASA_URLS.artemisRegionsRest}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[#0B3D91] font-medium hover:underline"
                      >
                        <span>
                          {artemisRegions.length > 0
                            ? `${artemisRegions.length} NASA Artemis III polygons`
                            : '8 Artemis III benchmarks'}
                        </span>
                        <ExternalLink className="w-3 h-3 shrink-0" />
                      </a>
                    </div>
                  </div>
                  )}
                </div>
                <ExplainDropdown
                  contentKey="datafeeds"
                  sources={[
                    { label: 'JPL Horizons API', url: liveHorizonsUrl },
                    { label: 'LOLA 5m DEM Service', url: EXACT_NASA_URLS.lolaDem5mService },
                  ]}
                />
              </section>
            </aside>

            {/* Main Viewport Stage */}
            <div className="flex-1 min-w-0 space-y-4">
              {/* Plain-English Mission Summary Banner + Tutorial Launcher */}
              <DiagramSwoop className="notebook-sheet overflow-hidden">
                <div className="px-5 py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <ArtemisPolarBadge className="w-8 h-8 shrink-0" />
                    <p className="text-sm text-slate-700">
                      At <strong className="text-slate-900">{siteLabel}</strong>, the Sun clears the local LOLA horizon mask{' '}
                      <strong className="text-amber-700">{summary.sunVisiblePct.toFixed(1)}%</strong> of the window (max eclipse{' '}
                      <strong className="font-mono">{summary.longestDarkHours.toFixed(1)} h</strong>) and Direct-to-Earth (DTE) line-of-sight is clear{' '}
                      <strong className="text-sky-700">{summary.earthVisiblePct.toFixed(1)}%</strong> of the time.
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs font-mono text-slate-500 whitespace-nowrap">
                      {durationHours}h · {summary.totalEnergyKwhM2.toFixed(1)} kWh/m²
                    </span>
                    <button
                      type="button"
                      onClick={() => setTourOpen(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#0B3D91] bg-[#FAF7F0] border border-[#D8CFBE] rounded-lg hover:bg-[#EFE9DC] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <Compass className="w-3.5 h-3.5" />
                      Guided Tour
                    </button>
                  </div>
                </div>
              </DiagramSwoop>

              {/* Telemetry Strip: adapts count, density, and precision by comprehension level */}
              {currentSample && (
                <div data-tour="telemetry-strip">
                  <DiagramSwoop delay={0.04} className="notebook-sheet overflow-hidden">
                  {isHighSchool ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-[#EAE3D5]">
                      <div className="px-5 py-4 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-slate-700">Solar Power Right Now</span>
                          <span
                            className={`font-semibold ${
                              currentSample.sunUsable ? 'text-emerald-700' : 'text-rose-700'
                            }`}
                          >
                            {currentSample.sunUsable ? '● Sun Shines on Panels' : '✖ In Crater Shadow'}
                          </span>
                        </div>
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-2xl font-mono font-semibold text-amber-700 tabular-nums">
                            {(currentSample.sunVisibleFrac * 100).toFixed(0)}% Sun Visible
                          </span>
                          <span className="text-xs font-mono text-slate-500 tabular-nums">
                            {currentSample.arrayOutputWm2.toFixed(0)} W/m²
                          </span>
                        </div>
                        <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-amber-500 transition-all"
                            style={{ width: `${Math.round(currentSample.sunVisibleFrac * 100)}%` }}
                          />
                        </div>
                      </div>

                      <div className="px-5 py-4 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-slate-700">Direct Radio to Earth</span>
                          <span
                            className={`font-semibold ${
                              currentSample.earthUsable ? 'text-emerald-700' : 'text-rose-700'
                            }`}
                          >
                            {currentSample.earthUsable ? '● Signal Clear' : '✖ Blocked by Ridge'}
                          </span>
                        </div>
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-2xl font-mono font-semibold text-sky-700 tabular-nums">
                            {summary.earthVisiblePct.toFixed(0)}% of Window
                          </span>
                          <span className="text-xs text-slate-500">
                            ~{currentSample.rfOneWaySec.toFixed(1)}s light delay
                          </span>
                        </div>
                        <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-sky-500 transition-all"
                            style={{ width: `${Math.round(summary.earthVisiblePct)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-[#EAE3D5]">
                    <div className="px-4 py-3">
                      <div className="flex items-center justify-between text-xs text-slate-500">
                        <span className="font-semibold">Topocentric Solar Elev</span>
                        <span
                          className={`font-semibold ${
                            currentSample.sunUsable ? 'text-emerald-700' : 'text-rose-700'
                          }`}
                        >
                          {currentSample.sunUsable ? '● Sunlit' : '✖ Shadowed'}
                        </span>
                      </div>
                      <div className="mt-1 flex items-baseline gap-2">
                        <span className="text-2xl font-mono font-semibold text-amber-700 tabular-nums">
                          {currentSample.sun.elevationDeg >= 0 ? '+' : ''}
                          {currentSample.sun.elevationDeg.toFixed(degDecimals)}°
                        </span>
                        <span className="text-xs font-mono text-slate-500 tabular-nums">
                          Az {currentSample.sun.azimuthDeg.toFixed(1)}° · Mask{' '}
                          {currentSample.sunHorizonElevDeg.toFixed(degDecimals)}°
                        </span>
                      </div>
                      {isAdvanced && (
                        <div className="mt-1 text-[11px] font-mono text-slate-600 tabular-nums">
                          Δθ Margin:{' '}
                          <span
                            className={
                              currentSample.sun.elevationDeg - currentSample.sunHorizonElevDeg >= 0
                                ? 'text-emerald-700 font-semibold'
                                : 'text-rose-700 font-semibold'
                            }
                          >
                            {currentSample.sun.elevationDeg - currentSample.sunHorizonElevDeg >= 0
                              ? '+'
                              : ''}
                            {(currentSample.sun.elevationDeg - currentSample.sunHorizonElevDeg).toFixed(
                              degDecimals
                            )}
                            °
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="px-4 py-3">
                      <div className="flex items-center justify-between text-xs text-slate-500">
                        <span className="font-semibold">Array Power Density</span>
                        <span className="font-mono text-slate-500 tabular-nums">
                          {(currentSample.sunVisibleFrac * 100).toFixed(0)}% solar disc
                        </span>
                      </div>
                      <div className="mt-1 flex items-baseline gap-1.5">
                        <span className="text-2xl font-mono font-semibold text-slate-900 tabular-nums">
                          {currentSample.arrayOutputWm2.toFixed(0)}
                        </span>
                        <span className="text-xs font-mono text-slate-500 uppercase">W/m²</span>
                        <span className="text-xs text-slate-500 ml-auto">
                          {solarArrayMode === 'tracking' ? 'Sun-Tracking' : 'Horizontal'}
                        </span>
                      </div>
                      {isAdvanced && (
                        <div className="mt-1 text-[11px] font-mono text-slate-600 tabular-nums">
                          Mast {mastHeightM.toFixed(1)}m · {summary.totalEnergyKwhM2.toFixed(1)} kWh/m²
                        </div>
                      )}
                    </div>

                    <div className="px-4 py-3">
                      <div className="flex items-center justify-between text-xs text-slate-500">
                        <span className="font-semibold">Earth DTE Elevation</span>
                        <span
                          className={`font-semibold ${
                            currentSample.earthUsable ? 'text-emerald-700' : 'text-rose-700'
                          }`}
                        >
                          {currentSample.earthUsable ? '● Link Clear' : '✖ Occulted'}
                        </span>
                      </div>
                      <div className="mt-1 flex items-baseline gap-2">
                        <span className="text-2xl font-mono font-semibold text-sky-700 tabular-nums">
                          {currentSample.earth.elevationDeg >= 0 ? '+' : ''}
                          {currentSample.earth.elevationDeg.toFixed(degDecimals)}°
                        </span>
                        <span className="text-xs font-mono text-slate-500 tabular-nums">
                          Az {currentSample.earth.azimuthDeg.toFixed(1)}° ·{' '}
                          {currentSample.rfOneWaySec.toFixed(isProfessor ? 3 : 2)}s OWLT
                        </span>
                      </div>
                      {isAdvanced && (
                        <div className="mt-1 text-[11px] font-mono text-slate-600 tabular-nums">
                          Δθ DTE:{' '}
                          <span
                            className={
                              currentSample.earth.elevationDeg - currentSample.earthHorizonElevDeg >= 0
                                ? 'text-emerald-700 font-semibold'
                                : 'text-rose-700 font-semibold'
                            }
                          >
                            {currentSample.earth.elevationDeg - currentSample.earthHorizonElevDeg >= 0
                              ? '+'
                              : ''}
                            {(
                              currentSample.earth.elevationDeg - currentSample.earthHorizonElevDeg
                            ).toFixed(degDecimals)}
                            °
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="px-4 py-3">
                      <div className="flex items-center justify-between text-xs text-slate-500">
                        <span className="font-semibold">Simultaneous Sun + DTE</span>
                        <span className="font-mono text-slate-500 tabular-nums">
                          Max outage {summary.longestCommBlackoutHours.toFixed(1)}h
                        </span>
                      </div>
                      <div className="mt-1 flex items-baseline gap-2">
                        <span className="text-2xl font-mono font-semibold text-emerald-700 tabular-nums">
                          {summary.simultaneousPct.toFixed(1)}%
                        </span>
                        <span className="text-xs text-slate-500">
                          Mean {summary.meanPowerWm2.toFixed(0)} W/m²
                        </span>
                      </div>
                      {isAdvanced && (
                        <div className="mt-1 text-[11px] font-mono text-slate-600 tabular-nums">
                          Max Eclipse {summary.longestDarkHours.toFixed(1)}h · Slope{' '}
                          {activeSite ? `${activeSite.slopeDeg.toFixed(1)}°` : 'DEM'}
                        </div>
                      )}
                    </div>
                  </div>
                  )}
                  <ExplainDropdown
                    contentKey="telemetry"
                    sources={[
                      { label: 'Live NASA JPL Horizons Query', url: liveHorizonsUrl },
                      { label: 'LOLA 5m/px Polar DEM', url: EXACT_NASA_URLS.lolaDem5mService },
                      { label: 'IAU 2015 Lunar Frame', url: EXACT_NASA_URLS.iau2015Paper },
                    ]}
                  />
                  </DiagramSwoop>
                </div>
              )}

              {/* Playback & Time Scrubber Bar */}
              <div className="notebook-sheet px-4 py-2.5 flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setIsPlaying((p) => !p)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-slate-900 text-white rounded hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                    {isPlaying ? 'Pause' : 'Animate'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsPlaying(false);
                      setCurrentIndex(0);
                    }}
                    aria-label="Reset playback to window start"
                    className="p-1.5 text-slate-600 hover:text-slate-900 border border-slate-300 rounded hover:bg-slate-100 transition-colors cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setPlaybackSpeed((s) => (s === 1 ? 3 : s === 3 ? 8 : 1))}
                    className="px-2.5 py-1.5 text-xs font-mono text-slate-700 border border-slate-300 rounded hover:bg-slate-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    {playbackSpeed}x
                  </button>
                </div>

                <input
                  type="range"
                  aria-label="Mission time scrubber"
                  min={0}
                  max={Math.max(0, samples.length - 1)}
                  value={currentIndex}
                  onChange={(e) => {
                    setIsPlaying(false);
                    setCurrentIndex(Number(e.target.value));
                  }}
                  className="flex-1 min-w-[160px] telemetry-slider"
                />

                {currentSample && (
                  <div className="text-xs font-mono font-medium text-slate-800 tabular-nums whitespace-nowrap">
                    {currentSample.isoUtc.slice(0, 16).replace('T', ' ')} UTC
                  </div>
                )}
              </div>

              {/* 360° Lunar Horizon & Celestial Track */}
              <div data-tour="horizon-panorama">
                <DiagramSwoop delay={0.05}>
                  <HorizonPanorama
                    siteName={`${siteLabel} (${Math.abs(latDeg).toFixed(2)}°S, ${lonDeg.toFixed(1)}°E)`}
                    horizonProfileDeg={horizonProfileDeg}
                    samples={samples}
                    currentIndex={currentIndex}
                    minSunElevDeg={minSunElevDeg}
                    minEarthElevDeg={minEarthElevDeg}
                    showTracks={showTracks}
                    showDiscs={showDiscs}
                    demSourceLabel={demSourceLabel}
                    ephemerisSourceLabel={ephemerisSourceLabel}
                    horizonsUrl={liveHorizonsUrl}
                    horizonsOverlay={horizonsOverlay}
                    onScrubIndex={(idx) => {
                      setIsPlaying(false);
                      setCurrentIndex(idx);
                    }}
                  />
                </DiagramSwoop>
              </div>

              {/* Circular Instruments: High School hides PolarSkyDome to keep focus on the Moon map; Collegiate+ shows both */}
              <div className={`grid grid-cols-1 ${isHighSchool ? '' : 'xl:grid-cols-2'} gap-4 items-stretch`}>
                {!isHighSchool && (
                <div data-tour="polar-skydome" className="h-full">
                  <DiagramSwoop direction="left" delay={0.05} className="h-full">
                    <PolarSkyDome
                      siteName={siteLabel}
                      horizonProfileDeg={horizonProfileDeg}
                      samples={samples}
                      currentIndex={currentIndex}
                      minSunElevDeg={minSunElevDeg}
                      minEarthElevDeg={minEarthElevDeg}
                      showTracks={showTracks}
                      onScrubIndex={(idx) => {
                        setIsPlaying(false);
                        setCurrentIndex(idx);
                      }}
                    />
                  </DiagramSwoop>
                </div>
                )}

                <div data-tour="polar-map" className="h-full">
                  <DiagramSwoop direction={isHighSchool ? 'up' : 'right'} delay={0.09} className="h-full">
                    <PolarTerrainMap
                      activeSiteId={activeSiteId}
                      customLatDeg={latDeg}
                      customLonDeg={lonDeg}
                      currentSample={currentSample}
                      regionalDem={regionalDem}
                      localDem={localDem}
                      crestDem={crestDem}
                      artemisRegions={artemisRegions}
                      onSelectSite={handleSelectSite}
                      onSelectCustomCoords={handleSelectCustomCoords}
                    />
                  </DiagramSwoop>
                </div>
              </div>

              {/* Multi-Day Visibility Timeline & Site Summary */}
              <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-stretch">
                <DiagramSwoop direction="left" delay={0.04} className="xl:col-span-8">
                  <EphemerisTimeline
                    samples={samples}
                    currentIndex={currentIndex}
                    minSunElevDeg={minSunElevDeg}
                    minEarthElevDeg={minEarthElevDeg}
                    onScrubIndex={(idx) => {
                      setIsPlaying(false);
                      setCurrentIndex(idx);
                    }}
                  />
                </DiagramSwoop>

                <DiagramSwoop
                  direction="right"
                  delay={0.08}
                  className="xl:col-span-4 notebook-sheet overflow-hidden flex flex-col justify-between"
                >
                  <div className="p-5 flex-1 flex flex-col justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h3 className="text-sm font-bold text-slate-900">
                          {siteLabel} — Site Notes
                        </h3>
                        <span className="text-xs text-slate-500">
                          {activeSite ? activeSite.region : 'NASA Moon Trek Coordinate'}
                        </span>
                      </div>
                      <p className="text-sm text-slate-600 mt-1.5 leading-relaxed">
                        {activeSite
                          ? activeSite.summary
                          : 'Selected lunar south pole coordinate evaluated directly against the NASA LRO LOLA digital elevation model and JPL ephemeris.'}
                      </p>
                    </div>

                    {isHighSchool ? (
                    <div className="grid grid-cols-2 gap-3 pt-3 border-t border-[#EAE3D5] text-xs">
                      <div>
                        <div className="text-slate-500">Total Sunlight</div>
                        <div className="text-base font-mono font-semibold text-amber-700 tabular-nums mt-0.5">
                          {summary.sunVisiblePct.toFixed(0)}% of span
                        </div>
                      </div>
                      <div>
                        <div className="text-slate-500">Longest Dark Period</div>
                        <div className="text-base font-mono font-semibold text-slate-900 tabular-nums mt-0.5">
                          {summary.longestDarkHours.toFixed(1)} hrs
                        </div>
                      </div>
                    </div>
                    ) : (
                    <div className="grid grid-cols-2 gap-3 pt-3 border-t border-[#EAE3D5] text-xs">
                      <div>
                        <div className="text-slate-500">Peak Sun Elev</div>
                        <div className="text-base font-mono font-semibold text-amber-700 tabular-nums mt-0.5">
                          +{summary.maxSunElevDeg.toFixed(degDecimals)}°
                        </div>
                      </div>
                      <div>
                        <div className="text-slate-500">Peak Earth Elev</div>
                        <div className="text-base font-mono font-semibold text-sky-700 tabular-nums mt-0.5">
                          {summary.maxEarthElevDeg >= 0 ? '+' : ''}
                          {summary.maxEarthElevDeg.toFixed(degDecimals)}°
                        </div>
                      </div>
                      <div>
                        <div className="text-slate-500">Longest Eclipse</div>
                        <div className="text-base font-mono font-semibold text-slate-900 tabular-nums mt-0.5">
                          {summary.longestDarkHours.toFixed(1)} h
                        </div>
                      </div>
                      <div>
                        <div className="text-slate-500">Total Energy</div>
                        <div className="text-base font-mono font-semibold text-slate-900 tabular-nums mt-0.5">
                          {summary.totalEnergyKwhM2.toFixed(1)} kWh/m²
                        </div>
                      </div>
                    </div>
                    )}
                  </div>

                  <ExplainDropdown
                    contentKey="sitenotes"
                    sources={[
                      {
                        label: 'NASA Artemis III Candidate Regions',
                        url: EXACT_NASA_URLS.artemisPressRelease,
                      },
                      {
                        label: 'A3_Named_regions_SP GeoJSON',
                        url: EXACT_NASA_URLS.artemisRegionsRest,
                      },
                      {
                        label: 'NASA LRO LOLA PDS Node',
                        url: EXACT_NASA_URLS.lolaPdsNode,
                      },
                    ]}
                  />
                </DiagramSwoop>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'compare' && (
          <SiteCompareView
            startDateIso={startDateIso}
            durationHours={durationHours}
            mastHeightM={mastHeightM}
            minSunElevDeg={minSunElevDeg}
            minEarthElevDeg={minEarthElevDeg}
            solarArrayMode={solarArrayMode}
            regionalDem={regionalDem}
            onLoadSiteInWorkbench={(site, dateIso) => {
              handleSelectSite(site);
              if (dateIso) setStartDateIso(dateIso);
              setActiveTab('workbench');
            }}
          />
        )}

        {activeTab === 'data' && (
          <DataHorizonsView
            siteName={siteLabel}
            latDeg={latDeg}
            lonDeg={lonDeg}
            elevM={elevM}
            startDateIso={startDateIso}
            durationHours={durationHours}
            samples={samples}
            horizonsOverlay={horizonsOverlay}
            hasCustomHorizon={customHorizonProfile !== null}
            demSourceLabel={demSourceLabel}
            onSetHorizonsOverlay={setHorizonsOverlay}
            onApplyCustomHorizon={(prof) => setCustomHorizonProfile(prof)}
            onResetHorizon={() => setCustomHorizonProfile(null)}
            onExportCsv={handleExportCsv}
          />
        )}

        {activeTab === 'guide' && <MissionGuideView />}
      </main>

      {/* Subtle Attribution Footer with Provided NASA Space Apps Challenge Logo */}
      <footer className="border-t border-[#E4DDD0] bg-white/85 px-4 sm:px-6 py-4 mt-4">
        <div className="max-w-[1440px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 text-center sm:text-left">
            <NasaFlightInsignia className="w-5 h-5 shrink-0" />
            <span>
              Created by <strong className="text-slate-800">Hackclub Marina High School Chapter Team 1</strong> (Leader: <strong className="text-slate-800">Yohan Chang</strong>)
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden md:inline text-[11px] text-slate-500">
              Data: NASA JPL Horizons DE441 · LRO LOLA · Moon Trek
            </span>
            <div
              className="bg-[#162777] rounded-md px-2.5 py-1 opacity-85 hover:opacity-100 transition-opacity border border-[#0B3D91]/30 shrink-0"
              title="NASA Space Apps Challenge"
            >
              <img
                src="/assets/aistudio/image_9cc3f465.png"
                alt="NASA Space Apps Challenge"
                className="h-6 sm:h-7 w-auto object-contain block"
              />
            </div>
          </div>
        </div>
      </footer>

      <ComprehensionOnboardingModal />

      <GuidedTour
        isOpen={tourOpen && !isModalOpen && hasChosenInitial}
        onClose={handleCloseTour}
        onEnsurePlannerTab={() => setActiveTab('workbench')}
      />
    </div>
  );
}

export default function App() {
  return (
    <ComprehensionProvider>
      <AppContent />
    </ComprehensionProvider>
  );
}
