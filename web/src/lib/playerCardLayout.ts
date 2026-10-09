/*
 * Layout helpers shared by the exported player card (canvas, lib/playerCardImage.ts) and the
 * live card in the sheet (components/PlayerCardLive.tsx), so both lay text out the same way.
 * Everything is in the 405×720 design space.
 */
export const DW = 405
export const DH = 720

export const INK = '#12151a'
export const MUTED = '#c9ced6'
export const DOMAIN = 'outforground.com'

/** Logo pin (64×70 artwork) and crown (24×24). */
export const PIN = 'M32 4c-11.6 0-21 9.4-21 21 0 15.8 21 35 21 35s21-19.2 21-35c0-11.6-9.4-21-21-21z'
export const CROWN = 'M3 8l4 4 5-7 5 7 4-4-2 11H5z'
/** Portrait pins: poster (280×330), scoreboard (64×72 artwork), pass (108×128). */
export const POSTER_PIN = 'M140 0C63 0 0 61 0 137c0 100 140 193 140 193s140-93 140-193C280 61 217 0 140 0z'
export const BOARD_PIN = 'M32 2C15.4 2 2 15.2 2 31.5 2 52 32 70 32 70s30-18 30-38.5C62 15.2 48.6 2 32 2z'
export const PASS_PIN = 'M54 0C24 0 0 24 0 53c0 39 54 75 54 75s54-36 54-75C108 24 84 0 54 0z'

/** Canvas/CSS font shorthand for the display face (Barlow Condensed). */
export const display = (px: number, w = 900) => `${w} ${px}px "Barlow Condensed", "Arial Narrow", sans-serif`
/** Canvas/CSS font shorthand for the text face (Inter). */
export const sans = (px: number, w = 800) => `${w} ${px}px Inter, system-ui, sans-serif`

/** Baseline of a line box at `top` (font ascent/descent as in Barlow: 1.0 / 0.2). */
export const base = (top: number, px: number, lh: number) => top + px * (lh / 2 + 0.4)
/** Same for Inter at its normal line height. */
export const interBase = (top: number, px: number) => top + px * 0.969

/** Fills `{key}` placeholders of a label. */
export const fillLabel = (s: string, vars: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ''))

/** Largest font size (≤ `px`, ≥ `min`) at which `widthAt(size)` fits `maxW`. */
export function fitSize(widthAt: (px: number) => number, px: number, maxW: number, min = 8): number {
  while (px > min && widthAt(px) > maxW) px -= 1
  return px
}

/** The clipped-top, pointed-bottom card outline as an SVG path. */
export function shieldPath(x: number, y: number, w: number, h: number, corner: number, tip: number): string {
  return polyPath(x, y, [[corner, 0], [w - corner, 0], [w, corner], [w, h - tip], [w / 2, h], [0, h - tip], [0, corner]])
}

/** A closed polygon (points relative to x, y) as an SVG path. */
export function polyPath(x: number, y: number, pts: [number, number][]): string {
  return pts.map(([px, py], i) => `${i ? 'L' : 'M'}${round(x + px)} ${round(y + py)}`).join('') + 'Z'
}

const round = (n: number) => Math.round(n * 1000) / 1000

/**
 * Scales a path whose commands only take x,y pairs (M/L/C/S/Q/T and lower case, no H/V/A),
 * e.g. to use a pin outline as a CSS `clip-path: path()`.
 */
export function scalePath(d: string, sx: number, sy = sx): string {
  let i = 0
  return d.replace(/-?\d*\.?\d+(?:e-?\d+)?/gi, (n) => String(round(Number(n) * (i++ % 2 ? sy : sx))))
}

/** Scoreboard record row: x of the wins column, the colon and the losses column (left edges). */
export function recordLayout(w1: number, w2: number, wc: number, left = 38, width = 329) {
  const free = Math.max(0, width - w1 - w2 - wc)
  const x1 = left + free / 6
  const xc = x1 + w1 + free / 3
  const x2 = xc + wc + free / 3
  return { x1, xc, x2 }
}

/** Left offsets of each character of `s` (for per-letter animation), given a prefix measure. */
export function letterOffsets(s: string, widthOf: (prefix: string) => number): number[] {
  const chars = Array.from(s)
  return chars.map((_, i) => (i ? widthOf(chars.slice(0, i).join('')) : 0))
}
