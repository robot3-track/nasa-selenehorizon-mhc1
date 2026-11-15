import React from 'react';

/**
 * Custom vector aerospace insignia inspired by NASA flight dynamics and lunar south pole orbital mechanics.
 */
export const NasaFlightInsignia: React.FC<{ className?: string }> = ({ className = 'w-9 h-9' }) => (
  <svg
    viewBox="0 0 64 64"
    className={className}
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    {/* Deep NASA Cobalt disc */}
    <circle cx="32" cy="32" r="29" fill="#0B3D91" />
    <circle cx="32" cy="32" r="27.2" stroke="#93C5FD" strokeOpacity="0.45" strokeWidth="1" />

    {/* Starfield accents */}
    <circle cx="17" cy="19" r="1.1" fill="#FFFFFF" fillOpacity="0.85" />
    <circle cx="47" cy="17" r="1" fill="#FFFFFF" fillOpacity="0.85" />
    <circle cx="22" cy="46" r="0.9" fill="#FFFFFF" fillOpacity="0.7" />

    {/* Lunar South Pole sphere silhouette */}
    <circle cx="32" cy="36" r="11.5" fill="#E2E8F0" />
    <path
      d="M22.5 42.5C25.5 39.5 29.2 38.2 32 38.2C35.2 38.2 38.8 39.6 41.5 42.5C39.2 45.5 35.8 47.5 32 47.5C28.2 47.5 24.8 45.5 22.5 42.5Z"
      fill="#94A3B8"
    />
    {/* Shackleton Crater rim ring */}
    <ellipse cx="32" cy="37.5" rx="3.4" ry="1.8" stroke="#475569" strokeWidth="1.2" />

    {/* Orbital trajectory ring */}
    <ellipse
      cx="32"
      cy="32"
      rx="24"
      ry="9"
      transform="rotate(-22 32 32)"
      stroke="#FFFFFF"
      strokeWidth="1.8"
    />

    {/* Crimson aerospace chevron vector */}
    <path
      d="M15 44L33 13L38.5 31L49 23L35.5 36.5L32 23L15 44Z"
      fill="#FC3D21"
      stroke="#FFFFFF"
      strokeWidth="1"
      strokeLinejoin="round"
    />
  </svg>
);

export const ArtemisPolarBadge: React.FC<{ className?: string }> = ({ className = 'w-7 h-7' }) => (
  <svg
    viewBox="0 0 48 48"
    className={className}
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <polygon
      points="24,3 44,39 4,39"
      fill="#0B3D91"
      stroke="#1E40AF"
      strokeWidth="1.5"
      strokeLinejoin="round"
    />
    <circle cx="24" cy="29" r="7" fill="#F8FAFC" />
    <path d="M9 36C16 25 32 25 39 36" stroke="#FC3D21" strokeWidth="2.4" strokeLinecap="round" />
    <path d="M24 9L27.5 22H20.5L24 9Z" fill="#F59E0B" />
  </svg>
);
