import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Compass, X } from 'lucide-react';

export interface TourStep {
  selector: string;
  fallbackSelector?: string;
  title: string;
  body: string;
  preferredSide: 'right' | 'left' | 'top' | 'bottom';
}

const RAW_TOUR_STEPS: TourStep[] = [
  {
    selector: '[data-tour="comprehension-menu"]',
    title: '01. Comprehension & Workspace Depth Menu',
    body: 'Switch between Introductory, Intermediate, Advanced, and Expert right from the top header anytime—adapting not only text and LaTeX math depth, but also which charts, margins, and precision metrics are shown.',
    preferredSide: 'bottom',
  },
  {
    selector: '[data-tour="site-controls"]',
    title: '02. Candidate Landing Region & Coordinates',
    body: "Choose one of NASA's 8 Artemis III candidate south pole sites—such as Connecting Ridge or Malapert Massif—or inspect exact selenographic coordinates.",
    preferredSide: 'right',
  },
  {
    selector: '[data-tour="mission-epoch"]',
    title: '03. Ephemeris Epoch & Synodic Span',
    body: 'Pick any UTC mission start epoch or seasonal solstice/equinox preset, then set an evaluation window from 24 hours up to a full 29.53-day lunar synodic day.',
    preferredSide: 'right',
  },
  {
    selector: '[data-tour="telemetry-strip"]',
    title: '04. Topocentric Telemetry & DTE Link State',
    body: 'Track real-time solar power availability and Direct-to-Earth (DTE) signal visibility against the local NASA LOLA horizon mask.',
    preferredSide: 'bottom',
  },
  {
    selector: '[data-tour="horizon-panorama"]',
    title: '05. 360° LOLA Horizon Obstruction Panorama',
    body: 'Compare surrounding crater rims derived from NASA LRO LOLA elevation grids against Sun and Earth sky tracks. Click anywhere on the sky to jump to that solar azimuth.',
    preferredSide: 'left',
  },
  {
    selector: '[data-tour="polar-skydome"]',
    title: '06. Polar Sky-Dome Grazing-Elevation Radar',
    body: 'Inspect the 360° grazing horizon (-6° outer rim to +16° zenith core) from directly overhead. The dashed 0° circle marks the mathematical horizon.',
    preferredSide: 'left',
  },
  {
    selector: '[data-tour="polar-map"]',
    title: '07. NASA Moon Trek GIS Polar Map',
    body: 'Switch spacecraft map layers (LOLA relief, LROC mosaic, Illumination %, Earth Visibility), zoom down to 58 km, toggle solar shadow ray-tracing, or click any Artemis III region outline.',
    preferredSide: 'left',
  },
  {
    selector: '[data-tour="nav-tabs"]',
    fallbackSelector: '[data-tour="mobile-menu-btn"]',
    title: '08. Navigation, Trade-Space & JPL Verification',
    body: 'Use the navigation menu to open Compare Sites, Horizons & Export (for NASA JPL DE441 checks and CSV downloads), or the Science Guide.',
    preferredSide: 'bottom',
  },
];

interface GuidedTourProps {
  isOpen: boolean;
  onClose: () => void;
  onEnsurePlannerTab: () => void;
}

interface BoxRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

function calcOverlapArea(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number }
): number {
  const ox = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
  const oy = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
  return ox * oy;
}

function findVisibleElement(step: TourStep): HTMLElement | null {
  const candidates = [step.selector, step.fallbackSelector].filter(Boolean) as string[];
  for (const sel of candidates) {
    const el = document.querySelector(sel) as HTMLElement | null;
    if (!el) continue;
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') continue;
    const rect = el.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) return el;
  }
  return null;
}

export const GuidedTour: React.FC<GuidedTourProps> = ({
  isOpen,
  onClose,
  onEnsurePlannerTab,
}) => {
  const [stepIndex, setStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<BoxRect | null>(null);
  const [cardPos, setCardPos] = useState<{ top: number; left: number }>({ top: 76, left: 16 });
  const cardRef = useRef<HTMLDivElement | null>(null);

  // Dynamically filter steps to elements visible under current comprehension level & screen size
  const activeSteps = useMemo(() => {
    if (!isOpen) return RAW_TOUR_STEPS;
    const visible = RAW_TOUR_STEPS.filter((s) => findVisibleElement(s) !== null);
    return visible.length > 0 ? visible : RAW_TOUR_STEPS;
  }, [isOpen]);

  const safeIdx = Math.min(stepIndex, Math.max(0, activeSteps.length - 1));
  const step = activeSteps[safeIdx] ?? activeSteps[0];

  useEffect(() => {
    if (isOpen) {
      setStepIndex(0);
      onEnsurePlannerTab();
    }
  }, [isOpen, onEnsurePlannerTab]);

  // Lock page scrolling completely until user skips or completes tutorial
  useEffect(() => {
    if (!isOpen) return;

    const prevHtmlOverflow = document.documentElement.style.overflow;
    const prevBodyOverflow = document.body.style.overflow;
    const prevHtmlOverscroll = document.documentElement.style.overscrollBehavior;

    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overscrollBehavior = 'none';

    const preventWheel = (e: WheelEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest('[data-tour-card="true"]')) return;
      e.preventDefault();
    };

    const preventTouch = (e: TouchEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest('[data-tour-card="true"]')) return;
      e.preventDefault();
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        setStepIndex((i) => (i < activeSteps.length - 1 ? i + 1 : i));
        return;
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setStepIndex((i) => (i > 0 ? i - 1 : 0));
        return;
      }
      if (
        [' ', 'PageUp', 'PageDown', 'Home', 'End', 'ArrowUp', 'ArrowDown'].includes(e.key)
      ) {
        e.preventDefault();
      }
    };

    window.addEventListener('wheel', preventWheel, { passive: false, capture: true });
    window.addEventListener('touchmove', preventTouch, { passive: false, capture: true });
    window.addEventListener('keydown', onKeyDown, { capture: true });

    return () => {
      document.documentElement.style.overflow = prevHtmlOverflow;
      document.body.style.overflow = prevBodyOverflow;
      document.documentElement.style.overscrollBehavior = prevHtmlOverscroll;
      window.removeEventListener('wheel', preventWheel, { capture: true });
      window.removeEventListener('touchmove', preventTouch, { capture: true });
      window.removeEventListener('keydown', onKeyDown, { capture: true });
    };
  }, [isOpen, onClose, activeSteps.length]);

  const measureTarget = useCallback(() => {
    if (!isOpen) return;
    const el = findVisibleElement(step);
    if (!el) {
      setTargetRect(null);
      return;
    }
    const r = el.getBoundingClientRect();
    setTargetRect({
      top: r.top,
      left: r.left,
      width: r.width,
      height: r.height,
    });
  }, [isOpen, step]);

  // Programmatically scroll viewport so both target and card fit cleanly in frame (desktop & mobile)
  useEffect(() => {
    if (!isOpen) return;
    const el = findVisibleElement(step);
    if (!el) {
      setTargetRect(null);
      return;
    }

    const r = el.getBoundingClientRect();
    const vh = window.innerHeight;
    const vw = window.innerWidth;
    const isMobile = vw < 768;
    const cardW = isMobile ? vw - 24 : Math.min(336, vw - 32);
    const cardH = Math.min(cardRef.current?.offsetHeight ?? (isMobile ? 210 : 250), Math.round(vh * 0.46));
    const headerSafe = 66;
    const gap = 12;

    const absTop = window.scrollY + r.top;
    const maxScroll = Math.max(0, document.documentElement.scrollHeight - vh);
    const hasSideSpace =
      !isMobile && (vw - r.right >= cardW + gap + 20 || r.left >= cardW + gap + 20);

    let targetScrollY = window.scrollY;
    if (
      step.selector === '[data-tour="nav-tabs"]' ||
      step.selector === '[data-tour="comprehension-menu"]'
    ) {
      targetScrollY = 0;
    } else if (hasSideSpace && r.height <= vh - headerSafe - 24) {
      targetScrollY = absTop - headerSafe - Math.max(8, (vh - headerSafe - r.height) / 2);
    } else if (r.height + cardH + gap + headerSafe + 16 <= vh) {
      targetScrollY = absTop - (headerSafe + 8);
    } else {
      // On mobile / tight heights: align top of target directly beneath sticky header
      targetScrollY = absTop - (headerSafe + 8);
    }

    targetScrollY = Math.max(0, Math.min(maxScroll, targetScrollY));

    const startScrollY = window.scrollY;
    let tweenRaf = 0;
    if (Math.abs(targetScrollY - startScrollY) > 2) {
      const duration = 260;
      const startTime = performance.now();
      const stepScroll = (now: number) => {
        const t = Math.min(1, (now - startTime) / duration);
        const eased = 1 - Math.pow(1 - t, 3);
        const nextY = startScrollY + (targetScrollY - startScrollY) * eased;
        document.documentElement.scrollTop = nextY;
        window.scrollTo(0, nextY);
        measureTarget();
        if (t < 1) {
          tweenRaf = requestAnimationFrame(stepScroll);
        } else {
          measureTarget();
        }
      };
      tweenRaf = requestAnimationFrame(stepScroll);
    } else {
      measureTarget();
    }

    const t1 = window.setTimeout(measureTarget, 150);
    const t2 = window.setTimeout(measureTarget, 340);

    const onResize = () => measureTarget();
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(tweenRaf);
      clearTimeout(t1);
      clearTimeout(t2);
      window.removeEventListener('resize', onResize);
    };
  }, [isOpen, safeIdx, step, measureTarget]);

  // Guaranteed in-frame, zero-overlap placement solver for desktop & mobile
  useLayoutEffect(() => {
    if (!isOpen) return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const isMobile = vw < 768;
    const marginX = isMobile ? 12 : 16;
    const cardW = cardRef.current?.offsetWidth ?? (isMobile ? vw - 24 : Math.min(336, vw - 32));
    const cardH = cardRef.current?.offsetHeight ?? (isMobile ? 200 : 250);
    const pad = 6;
    const gap = 12;
    const isHeaderTarget =
      step.selector === '[data-tour="nav-tabs"]' ||
      step.selector === '[data-tour="comprehension-menu"]';
    const topSafe = isHeaderTarget ? 66 : 64;

    if (!targetRect) {
      setCardPos({
        top: Math.max(topSafe, Math.min(vh - cardH - 12, (vh - cardH) / 2)),
        left: Math.max(marginX, (vw - cardW) / 2),
      });
      return;
    }

    const spot = {
      x: Math.max(4, targetRect.left - pad),
      y: Math.max(4, targetRect.top - pad),
      w: Math.min(vw - 8, targetRect.width + pad * 2),
      h: targetRect.height + pad * 2,
    };

    const clampLeft = (x: number) => Math.max(marginX, Math.min(vw - cardW - marginX, x));
    const clampTop = (y: number) => Math.max(12, Math.min(vh - cardH - 12, y));

    const sideOrder: Array<'right' | 'left' | 'bottom' | 'top'> = (
      isMobile
        ? ['bottom', 'top']
        : [step.preferredSide, 'left', 'right', 'bottom', 'top']
    ).filter((s, idx, arr) => arr.indexOf(s) === idx) as Array<
      'right' | 'left' | 'bottom' | 'top'
    >;

    const candidates: Array<{
      side: 'right' | 'left' | 'bottom' | 'top';
      x: number;
      y: number;
      inBounds: boolean;
      overlap: number;
    }> = [];

    for (const side of sideOrder) {
      let x = marginX;
      let y = topSafe;
      let inBounds = true;

      if (side === 'right') {
        x = spot.x + spot.w + gap;
        y = clampTop(Math.max(topSafe, spot.y + spot.h / 2 - cardH / 2));
        if (x + cardW + marginX > vw) inBounds = false;
      } else if (side === 'left') {
        x = spot.x - cardW - gap;
        y = clampTop(Math.max(topSafe, spot.y + spot.h / 2 - cardH / 2));
        if (x < marginX) inBounds = false;
      } else if (side === 'bottom') {
        x = clampLeft(spot.x + spot.w / 2 - cardW / 2);
        y = spot.y + spot.h + gap;
        if (y + cardH + 12 > vh) inBounds = false;
      } else {
        x = clampLeft(spot.x + spot.w / 2 - cardW / 2);
        y = spot.y - cardH - gap;
        if (y < topSafe) inBounds = false;
      }

      const clampedX = clampLeft(x);
      const clampedY = clampTop(y);
      const overlap = calcOverlapArea({ x: clampedX, y: clampedY, w: cardW, h: cardH }, spot);
      candidates.push({ side, x: clampedX, y: clampedY, inBounds, overlap });
    }

    const clean =
      candidates.find((c) => c.inBounds && c.overlap === 0) ??
      candidates.find((c) => c.overlap === 0) ??
      // On mobile when spotlight fills viewport height, pin card cleanly at bottom edge inside viewport
      {
        side: 'bottom' as const,
        x: clampLeft((vw - cardW) / 2),
        y: Math.max(topSafe, vh - cardH - 12),
        inBounds: true,
        overlap: 0,
      };

    setCardPos({ top: clean.y, left: clean.x });
  }, [isOpen, targetRect, step.preferredSide, step.selector, safeIdx]);

  if (!isOpen) return null;

  const vw = typeof window !== 'undefined' ? window.innerWidth : 1280;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
  const pad = 6;
  const rawSpotX = targetRect ? Math.max(4, targetRect.left - pad) : 0;
  const rawSpotY = targetRect ? Math.max(4, targetRect.top - pad) : 0;
  const rawSpotW = targetRect ? Math.min(vw - rawSpotX - 4, targetRect.width + pad * 2) : 0;
  // Ensure the spotlight cutout visually stops above a bottom-docked mobile card so they never collide visually
  const maxBottomY = cardPos.top > vh * 0.45 ? cardPos.top - 10 : vh - 8;
  const spotH = targetRect
    ? Math.max(28, Math.min(targetRect.height + pad * 2, maxBottomY - rawSpotY))
    : 0;

  return (
    <div
      className="fixed inset-0 z-[100]"
      role="dialog"
      aria-modal="true"
      aria-label={`Guided Application Tutorial Step ${safeIdx + 1} of ${activeSteps.length}`}
    >
      {/* Darkened Backdrop with Crisp SVG Spotlight Cutout */}
      <svg className="fixed inset-0 w-full h-full pointer-events-auto" aria-hidden="true">
        <defs>
          <mask id="selene-tour-mask">
            <rect width="100%" height="100%" fill="white" />
            {targetRect && (
              <rect
                x={rawSpotX}
                y={rawSpotY}
                width={Math.max(24, rawSpotW)}
                height={spotH}
                rx={14}
                fill="black"
              />
            )}
          </mask>
        </defs>

        <rect
          width="100%"
          height="100%"
          fill="rgba(9, 14, 27, 0.78)"
          mask="url(#selene-tour-mask)"
        />

        {targetRect && (
          <rect
            x={rawSpotX}
            y={rawSpotY}
            width={Math.max(24, rawSpotW)}
            height={spotH}
            rx={14}
            fill="none"
            stroke="#F59E0B"
            strokeWidth={2.5}
          />
        )}
      </svg>

      {/* Tutorial Callout Card (strictly bounded within viewport) */}
      <div
        ref={cardRef}
        data-tour-card="true"
        style={{ top: cardPos.top, left: cardPos.left }}
        className="fixed z-[101] w-[calc(100vw-24px)] sm:w-[336px] max-h-[44vh] sm:max-h-[calc(100vh-32px)] overflow-y-auto notebook-sheet p-3.5 sm:p-5 shadow-2xl border-2 border-[#0B3D91] pointer-events-auto transition-[top,left] duration-200 ease-out"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#0B3D91]">
            <Compass className="w-4 h-4 shrink-0" />
            <span className="font-mono tabular-nums">
              Step {safeIdx + 1} of {activeSteps.length}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close tutorial"
            className="p-1 text-slate-400 hover:text-slate-700 rounded transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="mt-2 h-1.5 w-full bg-[#EFE9DC] rounded-full overflow-hidden">
          <div
            className="h-full bg-[#0B3D91] transition-all duration-200"
            style={{ width: `${((safeIdx + 1) / activeSteps.length) * 100}%` }}
          />
        </div>

        <h3 className="mt-2.5 sm:mt-3.5 text-sm sm:text-base font-bold text-slate-900">
          {step.title}
        </h3>
        <p className="mt-1 sm:mt-1.5 text-xs sm:text-sm text-slate-700 leading-relaxed">
          {step.body}
        </p>

        <div className="mt-3 sm:mt-4 pt-2.5 sm:pt-3 border-t border-[#EAE3D5] flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-medium text-slate-500 hover:text-slate-800 whitespace-nowrap shrink-0 cursor-pointer"
          >
            Skip Tutorial
          </button>

          <div className="flex items-center gap-2">
            {safeIdx > 0 && (
              <button
                type="button"
                onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
                className="inline-flex items-center gap-1 px-2.5 sm:px-3 py-1.5 text-xs font-medium text-slate-700 bg-[#FAF7F0] border border-[#E4DDD0] rounded-lg hover:bg-[#EFE9DC] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Back
              </button>
            )}

            {safeIdx < activeSteps.length - 1 ? (
              <button
                type="button"
                onClick={() => setStepIndex((i) => i + 1)}
                className="inline-flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 text-xs font-semibold text-white bg-[#0B3D91] rounded-lg hover:bg-blue-900 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Next Step
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 text-xs font-semibold text-white bg-emerald-700 rounded-lg hover:bg-emerald-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Start Exploring
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
