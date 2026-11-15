import React, { createContext, useContext, useEffect, useState } from 'react';

export type ComprehensionLevel =
  | 'high-school'
  | 'collegiate'
  | 'graduate'
  | 'nasa-professor';

export interface ComprehensionMeta {
  id: ComprehensionLevel;
  label: string;
  shortLabel: string;
  description: string;
  dataFocus: string;
  mathFocus: string;
}

export const COMPREHENSION_LEVELS: ComprehensionMeta[] = [
  {
    id: 'high-school',
    label: 'Introductory',
    shortLabel: 'Introductory',
    description: 'Essential charts, plain-English readouts & intuition-first geometry',
    dataFocus: 'Stacked skyline & polar Moon map with 2 core power/signal cards',
    mathFocus: 'Visual horizon angles & foundational trigonometry',
  },
  {
    id: 'collegiate',
    label: 'Intermediate',
    shortLabel: 'Intermediate',
    description: 'Planetary astronomy, sky-dome radar, flux laws & libration bounds',
    dataFocus: '4 telemetry cards, dual polar sky/map instruments & mission timeline',
    mathFocus: 'Spherical lunar curvature drop & solar disc grazing flux',
  },
  {
    id: 'graduate',
    label: 'Advanced',
    shortLabel: 'Advanced',
    description: 'IAU 2015 frame transforms, clearance margins & multi-site matrix',
    dataFocus: 'Full trade-space matrices, angular LOS margins & expanded ephemeris columns',
    mathFocus: 'Great-circle ray-marching, conformal projection metrics & link inequalities',
  },
  {
    id: 'nasa-professor',
    label: 'Expert',
    shortLabel: 'Expert',
    description: 'Flight-dynamics kinematics, DE441 residuals & sub-meter DEM diagnostics',
    dataFocus: 'Expanded engineering controls, DE441 RMSE residuals & high-precision vector feeds',
    mathFocus: 'Body-fixed ENU matrices, physical libration harmonics & gradient operators',
  },
];

interface ComprehensionContextValue {
  level: ComprehensionLevel;
  setLevel: (level: ComprehensionLevel) => void;
  meta: ComprehensionMeta;
  hasChosenInitial: boolean;
  isModalOpen: boolean;
  openModal: () => void;
  closeModal: () => void;
  confirmLevel: (level: ComprehensionLevel) => void;
}

const ComprehensionContext = createContext<ComprehensionContextValue>({
  level: 'collegiate',
  setLevel: () => {},
  meta: COMPREHENSION_LEVELS[1],
  hasChosenInitial: true,
  isModalOpen: false,
  openModal: () => {},
  closeModal: () => {},
  confirmLevel: () => {},
});

const STORAGE_KEY = 'selene_horizon_comprehension_v1';
const CHOSEN_KEY = 'selene_horizon_comprehension_chosen_v1';

export const ComprehensionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [level, setLevelState] = useState<ComprehensionLevel>(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY) as ComprehensionLevel | null;
      if (saved && COMPREHENSION_LEVELS.some((c) => c.id === saved)) {
        return saved;
      }
    } catch {
      // Ignore storage access restrictions
    }
    return 'collegiate';
  });

  const [hasChosenInitial, setHasChosenInitial] = useState<boolean>(() => {
    try {
      return window.localStorage.getItem(CHOSEN_KEY) === 'yes';
    } catch {
      return false;
    }
  });

  const [isModalOpen, setIsModalOpen] = useState<boolean>(() => {
    try {
      return window.localStorage.getItem(CHOSEN_KEY) !== 'yes';
    } catch {
      return true;
    }
  });

  const persistLevel = (next: ComprehensionLevel) => {
    setLevelState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Ignore storage access restrictions
    }
  };

  const setLevel = (next: ComprehensionLevel) => {
    persistLevel(next);
  };

  const confirmLevel = (next: ComprehensionLevel) => {
    persistLevel(next);
    setHasChosenInitial(true);
    setIsModalOpen(false);
    try {
      window.localStorage.setItem(CHOSEN_KEY, 'yes');
    } catch {
      // Ignore storage access restrictions
    }
  };

  const openModal = () => setIsModalOpen(true);
  const closeModal = () => {
    setHasChosenInitial(true);
    setIsModalOpen(false);
    try {
      window.localStorage.setItem(CHOSEN_KEY, 'yes');
    } catch {
      // Ignore storage access restrictions
    }
  };

  useEffect(() => {
    if (!COMPREHENSION_LEVELS.some((c) => c.id === level)) {
      setLevelState('collegiate');
    }
  }, [level]);

  const meta =
    COMPREHENSION_LEVELS.find((c) => c.id === level) ?? COMPREHENSION_LEVELS[1];

  return (
    <ComprehensionContext.Provider
      value={{
        level,
        setLevel,
        meta,
        hasChosenInitial,
        isModalOpen,
        openModal,
        closeModal,
        confirmLevel,
      }}
    >
      {children}
    </ComprehensionContext.Provider>
  );
};

export function useComprehension(): ComprehensionContextValue {
  return useContext(ComprehensionContext);
}
