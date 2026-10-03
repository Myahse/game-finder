import type { ReactNode } from 'react'

const LINE = '#ffffff'

/** Top-down playing surfaces (200×110), drawn with real surface colours rather than the brand palette. */
const courts: Record<string, ReactNode> = {
  basketball: (
    <>
      <defs>
        <pattern id="ct-planks" width="9" height="110" patternUnits="userSpaceOnUse">
          <rect width="9" height="110" fill="#d6a067" />
          <path d="M8.5 0v110" stroke="#c48d55" strokeWidth="1" />
          <path d="M0 37h9M4 81h5" stroke="#c48d55" strokeWidth="0.6" />
        </pattern>
      </defs>
      <rect width="200" height="110" fill="url(#ct-planks)" />
      <rect x="6" y="38" width="34" height="34" fill="#b4532a" />
      <rect x="160" y="38" width="34" height="34" fill="#b4532a" />
      <circle cx="100" cy="55" r="12" fill="#b4532a" />
      <g stroke={LINE} strokeWidth="1.5" fill="none">
        <rect x="6" y="6" width="188" height="98" />
        <path d="M100 6v98" />
        <circle cx="100" cy="55" r="12" />
        <path d="M6 38h34v34H6M194 38h-34v34h34" />
        <circle cx="40" cy="55" r="12" />
        <circle cx="160" cy="55" r="12" />
        <path d="M6 13h12a43 43 0 0 1 0 84H6M194 13h-12a43 43 0 0 0 0 84h12" />
      </g>
      <circle cx="13" cy="55" r="3" fill="none" stroke="#e2562b" strokeWidth="1.5" />
      <circle cx="187" cy="55" r="3" fill="none" stroke="#e2562b" strokeWidth="1.5" />
      <g transform="translate(126 32)">
        <circle r="6.5" fill="#e0712c" stroke="#3a1a08" strokeWidth="0.8" />
        <path d="M-6.5 0h13M0-6.5v13M-4.6-4.6c2.4 2.4 2.4 6.8 0 9.2M4.6-4.6c-2.4 2.4-2.4 6.8 0 9.2" stroke="#3a1a08" strokeWidth="0.7" fill="none" />
      </g>
    </>
  ),
  football: (
    <>
      <defs>
        <pattern id="ct-grass" width="40" height="110" patternUnits="userSpaceOnUse">
          <rect width="20" height="110" fill="#3a8f4b" />
          <rect x="20" width="20" height="110" fill="#348445" />
        </pattern>
      </defs>
      <rect width="200" height="110" fill="url(#ct-grass)" />
      <g stroke={LINE} strokeWidth="1.5" fill="none">
        <rect x="8" y="6" width="184" height="98" />
        <path d="M100 6v98" />
        <circle cx="100" cy="55" r="14" />
        <path d="M8 29h28v52H8M192 29h-28v52h28" />
        <path d="M8 43h10v24H8M192 43h-10v24h10" />
        <path d="M36 46a12 12 0 0 1 0 18M164 46a12 12 0 0 0 0 18" />
        <path d="M8 49H3v12h5M192 49h5v12h-5" />
      </g>
      <circle cx="100" cy="55" r="1.4" fill={LINE} />
      <g transform="translate(124 66)">
        <circle r="5" fill="#ffffff" stroke="#1f2937" strokeWidth="0.7" />
        <path d="M0-2.2l2.1 1.5-.8 2.5H-1.3l-.8-2.5z" fill="#1f2937" />
      </g>
    </>
  ),
  volleyball: (
    <>
      <defs>
        <pattern id="ct-sand" width="6" height="6" patternUnits="userSpaceOnUse">
          <rect width="6" height="6" fill="#e8d2a2" />
          <circle cx="1.5" cy="2" r="0.45" fill="#cdb27c" />
          <circle cx="4.5" cy="4.8" r="0.35" fill="#d9c08b" />
        </pattern>
      </defs>
      <rect width="200" height="110" fill="url(#ct-sand)" />
      <rect x="36" y="18" width="128" height="74" fill="none" stroke="#1d4ed8" strokeWidth="2.5" />
      <path d="M100 8v94" stroke="#1f2937" strokeWidth="2.5" />
      <path d="M100 8v94" stroke="#ffffff" strokeWidth="0.8" strokeDasharray="2 3" />
      <circle cx="100" cy="8" r="2.5" fill="#1f2937" />
      <circle cx="100" cy="102" r="2.5" fill="#1f2937" />
      <g transform="translate(68 44)">
        <circle r="6.5" fill="#fde047" stroke="#1e3a8a" strokeWidth="0.8" />
        <path d="M-6 2.5C-2 1 2 1.5 5.5 4M-2.5-6c1.5 3 1.5 7-1 11M3-5.6c-1 3.5 0 7 3.4 8.4" stroke="#1e3a8a" strokeWidth="0.8" fill="none" />
      </g>
    </>
  ),
  tennis: (
    <>
      <rect width="200" height="110" fill="#3c7a52" />
      <rect x="18" y="12" width="164" height="86" fill="#2d5d9f" />
      <g stroke={LINE} strokeWidth="1.5" fill="none">
        <rect x="18" y="12" width="164" height="86" />
        <path d="M18 23h164M18 87h164" />
        <path d="M58 23v64M142 23v64M58 55h84" />
        <path d="M18 55h3M182 55h-3" />
      </g>
      <path d="M100 6v98" stroke="#111827" strokeWidth="3" />
      <path d="M100 6v98" stroke="#ffffff" strokeWidth="1" />
      <g transform="translate(132 36)">
        <circle r="4" fill="#d9f03a" />
        <path d="M-2.8-2.8c1.6 1.6 1.6 4 0 5.6M2.8-2.8c-1.6 1.6-1.6 4 0 5.6" stroke="#ffffff" strokeWidth="0.7" fill="none" />
      </g>
    </>
  ),
  badminton: (
    <>
      <rect width="200" height="110" fill="#17614a" />
      <rect x="20" y="10" width="160" height="90" fill="#1f7a5c" />
      <g stroke={LINE} strokeWidth="1.5" fill="none">
        <rect x="20" y="10" width="160" height="90" />
        <path d="M20 17h160M20 93h160" />
        <path d="M28 10v90M172 10v90" />
        <path d="M80 10v90M120 10v90" />
        <path d="M20 55h60M120 55h60" />
      </g>
      <path d="M100 4v102" stroke="#111827" strokeWidth="3" />
      <path d="M100 4v102" stroke="#ffffff" strokeWidth="1" />
      <g transform="translate(140 34) rotate(-35)">
        <path d="M-1.6 0L-6 -10h12L1.6 0z" fill="#ffffff" stroke="#9ca3af" strokeWidth="0.5" />
        <path d="M-3 -10l1.4 10M3 -10l-1.4 10M0 -10v10" stroke="#d1d5db" strokeWidth="0.4" />
        <circle cy="1.5" r="2.2" fill="#f5f5f4" stroke="#9ca3af" strokeWidth="0.5" />
      </g>
    </>
  ),
}

export function SportCourt({ slug, className = '' }: { slug: string; className?: string }) {
  return (
    <svg viewBox="0 0 200 110" preserveAspectRatio="xMidYMid slice" className={className} aria-hidden>
      {courts[slug] ?? courts.basketball}
    </svg>
  )
}
