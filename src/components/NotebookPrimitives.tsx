import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import {
  BookOpen,
  Check,
  ChevronDown,
  ExternalLink,
  GraduationCap,
  Sigma,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import katex from 'katex';
import {
  COMPREHENSION_LEVELS,
  ComprehensionLevel,
  useComprehension,
} from '../lib/comprehension';
import { MATH_CONTENT, MathEquationSpec } from '../lib/mathContent';
import { NasaFlightInsignia } from './NasaInsignia';

export interface SourceLink {
  label: string;
  url: string;
}

export type { MathEquationSpec };

interface LatexMathProps {
  math: string;
  displayMode?: boolean;
  className?: string;
}

/**
 * Renders crisp LaTeX equations locally via bundled KaTeX.
 */
export const LatexMath: React.FC<LatexMathProps> = ({
  math,
  displayMode = false,
  className = '',
}) => {
  const html = useMemo(() => {
    try {
      return katex.renderToString(math, {
        displayMode,
        throwOnError: false,
        strict: false,
      });
    } catch {
      return math;
    }
  }, [math, displayMode]);

  return <span className={className} dangerouslySetInnerHTML={{ __html: html }} />;
};

/**
 * Splits prose containing $inline$ LaTeX delimiters so numbers & variables match notebook equations.
 */
export const RichMathText: React.FC<{ text: string }> = ({ text }) => {
  const parts = useMemo(() => text.split(/(\$[^$]+\$)/g), [text]);
  return (
    <>
      {parts.map((part, idx) => {
        if (part.startsWith('$') && part.endsWith('$') && part.length > 2) {
          return <LatexMath key={idx} math={part.slice(1, -1)} displayMode={false} />;
        }
        return <React.Fragment key={idx}>{part}</React.Fragment>;
      })}
    </>
  );
};

interface DiagramSwoopProps {
  children: React.ReactNode;
  className?: string;
  direction?: 'up' | 'left' | 'right';
  delay?: number;
}

/**
 * Scroll-triggered swoop animation for notebook diagram sheets.
 * Only animates compositor properties (transform & opacity) and respects prefers-reduced-motion.
 */
export const DiagramSwoop: React.FC<DiagramSwoopProps> = ({
  children,
  className = '',
  direction = 'up',
  delay = 0,
}) => {
  const shouldReduceMotion = useReducedMotion();

  if (shouldReduceMotion) {
    return <div className={className}>{children}</div>;
  }

  const initialOffset =
    direction === 'left'
      ? { x: -24, y: 18 }
      : direction === 'right'
        ? { x: 24, y: 18 }
        : { x: 0, y: 26 };

  return (
    <motion.div
      initial={{ opacity: 0, x: initialOffset.x, y: initialOffset.y, scale: 0.985 }}
      whileInView={{ opacity: 1, x: 0, y: 0, scale: 1 }}
      viewport={{ once: true, amount: 0.08 }}
      transition={{ duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
};

/**
 * First-visit pop-up modal allowing the user to pick their comprehension mode before exploring.
 */
export const ComprehensionOnboardingModal: React.FC = () => {
  const { level, isModalOpen, confirmLevel, closeModal } = useComprehension();
  const [draftLevel, setDraftLevel] = useState<ComprehensionLevel>(level);

  useEffect(() => {
    if (isModalOpen) {
      setDraftLevel(level);
    }
  }, [isModalOpen, level]);

  // Lock background page scroll while modal is visible
  useEffect(() => {
    if (!isModalOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeModal();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [isModalOpen, closeModal]);

  if (!isModalOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center p-3 sm:p-6 bg-slate-950/75 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-label="Choose Comprehension & Workspace Depth"
    >
      <div className="notebook-sheet w-full max-w-[680px] max-h-[calc(100vh-24px)] overflow-y-auto border-2 border-[#0B3D91] shadow-2xl">
        <div className="px-5 py-4 border-b border-[#EAE3D5] flex items-center justify-between gap-3 bg-[#FCFBF7]">
          <div className="flex items-center gap-3">
            <NasaFlightInsignia className="w-9 h-9 shrink-0" />
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900">
                Welcome to Selene Horizon
              </h2>
              <p className="text-xs text-slate-600">
                Select your comprehension level — this adapts what data is shown, layout density, and equation depth.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={closeModal}
            aria-label="Close comprehension selector"
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {COMPREHENSION_LEVELS.map((opt) => {
            const selected = draftLevel === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setDraftLevel(opt.id)}
                className={`text-left p-3.5 rounded-xl border-2 transition-all cursor-pointer flex flex-col justify-between gap-2 ${
                  selected
                    ? 'border-[#0B3D91] bg-blue-50/60 shadow-xs'
                    : 'border-[#E4DDD0] bg-white hover:border-slate-300 hover:bg-[#FAF7F0]/60'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                      <GraduationCap
                        className={`w-4 h-4 shrink-0 ${
                          selected ? 'text-[#0B3D91]' : 'text-slate-500'
                        }`}
                      />
                      {opt.label}
                    </span>
                    {selected && (
                      <span className="w-5 h-5 rounded-full bg-[#0B3D91] text-white inline-flex items-center justify-center shrink-0">
                        <Check className="w-3 h-3" />
                      </span>
                    )}
                  </div>
                  <p className="mt-1.5 text-xs text-slate-700 leading-relaxed">{opt.description}</p>
                </div>

                <div className="pt-2 border-t border-dashed border-[#E4DDD0] space-y-1 text-[11px] text-slate-600">
                  <div>
                    <strong className="text-slate-800">Layout:</strong> {opt.dataFocus}
                  </div>
                  <div>
                    <strong className="text-slate-800">Math:</strong> {opt.mathFocus}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <div className="px-5 py-3.5 border-t border-[#EAE3D5] bg-[#FCFBF7] flex flex-wrap items-center justify-between gap-3">
          <span className="text-[11px] text-slate-500">
            You can switch levels anytime from the header menu.
          </span>
          <button
            type="button"
            onClick={() => confirmLevel(draftLevel)}
            className="px-4 py-2 text-xs sm:text-sm font-semibold bg-[#0B3D91] text-white rounded-lg hover:bg-blue-900 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Continue in {COMPREHENSION_LEVELS.find((c) => c.id === draftLevel)?.label} Mode
          </button>
        </div>
      </div>
    </div>
  );
};

/**
 * Header dropdown menu allowing users to inspect and change comprehension level anytime.
 */
export const HeaderComprehensionMenu: React.FC = () => {
  const { level, setLevel, meta, openModal } = useComprehension();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative" data-tour="comprehension-menu">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-semibold text-slate-800 bg-[#FAF7F0] border border-[#D8CFBE] rounded-lg hover:bg-[#EFE9DC] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
      >
        <GraduationCap className="w-3.5 h-3.5 text-[#0B3D91] shrink-0" />
        <span className="hidden lg:inline text-slate-500 font-medium">Level:</span>
        <span>{meta.shortLabel}</span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-72 sm:w-80 notebook-sheet border border-[#D8CFBE] shadow-xl p-2 z-50 space-y-1"
        >
          <div className="px-2.5 py-1.5 border-b border-[#EAE3D5] flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
              Comprehension &amp; Data Mode
            </span>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                openModal();
              }}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#0B3D91] hover:underline cursor-pointer"
            >
              <SlidersHorizontal className="w-3 h-3" />
              Compare All
            </button>
          </div>

          {COMPREHENSION_LEVELS.map((opt) => {
            const active = level === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                onClick={() => {
                  setLevel(opt.id);
                  setOpen(false);
                }}
                className={`w-full text-left px-2.5 py-2 rounded-lg transition-colors cursor-pointer flex items-start justify-between gap-2 ${
                  active ? 'bg-blue-50 text-[#0B3D91]' : 'hover:bg-[#FAF7F0] text-slate-800'
                }`}
              >
                <div className="min-w-0">
                  <div className="text-xs font-bold">{opt.label}</div>
                  <div className="text-[11px] text-slate-600 leading-snug mt-0.5">
                    {opt.dataFocus}
                  </div>
                </div>
                {active && <Check className="w-3.5 h-3.5 text-[#0B3D91] shrink-0 mt-0.5" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

/**
 * Compact vertical or inline comprehension selector for mobile sidebar drawer.
 */
export const ComprehensionSelector: React.FC<{ compact?: boolean; onSelect?: () => void }> = ({
  compact = false,
  onSelect,
}) => {
  const { level, setLevel } = useComprehension();

  return (
    <div className={compact ? 'space-y-1.5' : 'notebook-sheet p-3 space-y-2'}>
      <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
        <GraduationCap className="w-4 h-4 text-[#0B3D91] shrink-0" />
        <span>Comprehension Mode</span>
      </div>
      <div className="grid grid-cols-1 gap-1.5">
        {COMPREHENSION_LEVELS.map((opt) => {
          const active = level === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => {
                setLevel(opt.id);
                onSelect?.();
              }}
              aria-pressed={active}
              className={`w-full text-left px-3 py-2 rounded-lg border text-xs transition-colors cursor-pointer ${
                active
                  ? 'bg-[#0B3D91] text-white border-[#0B3D91]'
                  : 'bg-[#FAF7F0] text-slate-800 border-[#E4DDD0] hover:bg-[#EFE9DC]'
              }`}
            >
              <div className="font-bold flex items-center justify-between">
                <span>{opt.label}</span>
                {active && <Check className="w-3.5 h-3.5" />}
              </div>
              <div className={`text-[11px] mt-0.5 ${active ? 'text-blue-100' : 'text-slate-600'}`}>
                {opt.dataFocus}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

interface ExplainDropdownProps {
  contentKey?: keyof typeof MATH_CONTENT;
  title?: string;
  paragraph?: string;
  equations?: MathEquationSpec[];
  sources: SourceLink[];
  defaultOpen?: boolean;
}

/**
 * Collapsible field-notebook drawer providing comprehension-adapted explanations,
 * LaTeX curvature/horizon/ephemeris equations, and direct NASA dataset links.
 */
export const ExplainDropdown: React.FC<ExplainDropdownProps> = ({
  contentKey,
  title = 'What does this show? (Explanation, math & sources)',
  paragraph = '',
  equations,
  sources,
  defaultOpen = false,
}) => {
  const { level, setLevel, meta } = useComprehension();
  const [open, setOpen] = useState(defaultOpen);
  const [mathOpen, setMathOpen] = useState(true);

  const leveled = contentKey ? MATH_CONTENT[contentKey][level] : undefined;
  const resolvedTitle = leveled?.title ?? title;
  const resolvedParagraph = leveled?.paragraph ?? paragraph;
  const resolvedEquations = leveled?.equations ?? equations;

  return (
    <div className="border-t border-[#EAE3D5] bg-[#FCFBF7]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full px-4 py-2.5 flex items-center justify-between gap-2 text-left text-xs font-medium text-slate-700 hover:bg-[#F5F1E6] transition-colors cursor-pointer"
      >
        <span className="inline-flex items-center gap-2 min-w-0">
          <BookOpen className="w-3.5 h-3.5 text-[#0B3D91] shrink-0" />
          <span className="truncate">
            <RichMathText text={resolvedTitle} />
          </span>
        </span>
        <span className="inline-flex items-center gap-2 shrink-0">
          <span className="text-[11px] font-medium text-slate-500 hidden sm:inline">
            {meta.shortLabel}
          </span>
          <ChevronDown
            className={`w-4 h-4 text-slate-500 transition-transform duration-200 shrink-0 ${
              open ? 'rotate-180' : ''
            }`}
          />
        </span>
      </button>

      {open && (
        <div className="px-4 pb-4 pt-2.5 space-y-3 border-t border-dashed border-[#E4DDD0] text-xs text-slate-700 leading-relaxed">
          {/* Quick inline depth switcher — flat underline links without rounded corner tabs */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#EAE3D5] pb-1.5">
            <span className="text-[11px] font-medium text-slate-500">
              Comprehension tier: <strong className="text-slate-800">{meta.label}</strong>
            </span>
            <div className="flex flex-wrap items-center gap-3">
              {COMPREHENSION_LEVELS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setLevel(opt.id)}
                  className={`py-0.5 text-[11px] font-medium rounded-none border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    level === opt.id
                      ? 'border-[#0B3D91] text-[#0B3D91] font-semibold'
                      : 'border-transparent text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {opt.shortLabel}
                </button>
              ))}
            </div>
          </div>

          <p>
            <RichMathText text={resolvedParagraph} />
          </p>

          {resolvedEquations && resolvedEquations.length > 0 && (
            <div className="border-t border-b border-[#E4DDD0] bg-white rounded-none -mx-4">
              <button
                type="button"
                onClick={() => setMathOpen((v) => !v)}
                aria-expanded={mathOpen}
                className="w-full px-4 py-2 flex items-center justify-between gap-2 text-left text-[11px] font-semibold text-[#0B3D91] bg-[#F8F5EC] hover:bg-[#F1ECE0] rounded-none transition-colors cursor-pointer"
              >
                <span className="inline-flex items-center gap-1.5">
                  <Sigma className="w-3.5 h-3.5 shrink-0" />
                  <span>Governing Equations &amp; Curvature Geometry ({resolvedEquations.length})</span>
                </span>
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform duration-200 shrink-0 ${
                    mathOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {mathOpen && (
                <div className="divide-y divide-[#EFE9DC]">
                  {resolvedEquations.map((eq) => (
                    <div key={eq.label} className="px-4 py-3 space-y-1.5 overflow-x-auto">
                      <div className="text-[11px] font-semibold text-slate-800">
                        <RichMathText text={eq.label} />
                      </div>
                      <div className="text-slate-900 py-0.5 min-w-0">
                        <LatexMath math={eq.latex} displayMode={true} />
                      </div>
                      {eq.note && (
                        <p className="text-[11px] text-slate-600 leading-relaxed">
                          <RichMathText text={eq.note} />
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {sources.length > 0 && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-0.5 text-[11px]">
              <span className="font-semibold text-slate-600">Exact Sources:</span>
              {sources.map((src) => (
                <a
                  key={src.url + src.label}
                  href={src.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[#0B3D91] font-medium hover:underline"
                >
                  <span>{src.label}</span>
                  <ExternalLink className="w-3 h-3 shrink-0" />
                </a>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
