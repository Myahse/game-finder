import type { ReactNode } from 'react'

/** Court / pitch line drawings (200×120) — the small per-sport detail behind cards and headers. */
const motifs: Record<string, ReactNode> = {
  basketball: (
    <>
      <rect x="4" y="4" width="192" height="112" rx="2" />
      <path d="M100 4v112" />
      <circle cx="100" cy="60" r="16" />
      <path d="M4 38h36v44H4M196 38h-36v44h36" />
      <path d="M40 46a14 14 0 0 1 0 28M160 46a14 14 0 0 0 0 28" />
      <path d="M4 14h12a46 46 0 0 1 0 92H4M196 14h-12a46 46 0 0 0 0 92h12" />
      <circle cx="12" cy="60" r="3" />
      <circle cx="188" cy="60" r="3" />
    </>
  ),
  football: (
    <>
      <rect x="4" y="4" width="192" height="112" rx="2" />
      <path d="M100 4v112" />
      <circle cx="100" cy="60" r="18" />
      <circle cx="100" cy="60" r="1.5" />
      <path d="M4 28h30v64H4M196 28h-30v64h30" />
      <path d="M4 46h12v28H4M196 46h-12v28h12" />
      <path d="M34 48a14 14 0 0 1 0 24M166 48a14 14 0 0 0 0 24" />
    </>
  ),
  volleyball: (
    <>
      <rect x="10" y="10" width="180" height="100" rx="2" />
      <path d="M70 10v100M130 10v100" />
      <path d="M100 2v116" strokeWidth="3" />
      <path d="M94 2v116M106 2v116" strokeDasharray="2 4" />
    </>
  ),
  tennis: (
    <>
      <rect x="4" y="10" width="192" height="100" rx="1" />
      <path d="M4 22h192M4 98h192" />
      <path d="M52 22v76M148 22v76M52 60h96" />
      <path d="M100 4v112" strokeWidth="3" />
      <path d="M4 60h4M192 60h4" />
    </>
  ),
  badminton: (
    <>
      <rect x="10" y="8" width="180" height="104" rx="1" />
      <path d="M10 16h180M10 104h180" />
      <path d="M20 8v104M180 8v104" />
      <path d="M76 8v104M124 8v104" />
      <path d="M20 60h56M124 60h56" />
      <path d="M100 2v116" strokeWidth="3" />
      <path d="M30 96C60 20 140 10 172 40" strokeDasharray="3 5" />
    </>
  ),
}

export function SportMotif({ slug, className = '' }: { slug: string; className?: string }) {
  return (
    <svg
      viewBox="0 0 200 120"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      preserveAspectRatio="xMidYMid slice"
      className={className}
      aria-hidden
    >
      {motifs[slug] ?? motifs.basketball}
    </svg>
  )
}
