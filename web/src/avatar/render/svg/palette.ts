import type { SportSlug } from '../../schema'

/** Mix a hex colour toward black (amt > 0) or white (amt < 0). */
export function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16)
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) =>
    Math.round(amt >= 0 ? c * (1 - amt) : c + (255 - c) * -amt),
  )
  return `#${ch.map((c) => c.toString(16).padStart(2, '0')).join('')}`
}

/** Blend two hex colours (t = 0 → a, 1 → b). */
export function mix(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16)
  const pb = parseInt(b.slice(1), 16)
  const ch = [16, 8, 0].map((sh) => Math.round(((pa >> sh) & 255) * (1 - t) + ((pb >> sh) & 255) * t))
  return `#${ch.map((c) => c.toString(16).padStart(2, '0')).join('')}`
}

/** Relative luminance 0–1 (sRGB, approximate). */
export function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16)
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => v / 255)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** Team kit per sport — matches the app's sport skins so a player's kit feels like their sport. */
export const KITS: Record<SportSlug, { main: string; trim: string; ink: string; number: string }> = {
  basketball: { main: '#f2552c', trim: '#1d1f2b', ink: '#ffffff', number: '23' },
  football: { main: '#109c4e', trim: '#f4f4ef', ink: '#ffffff', number: '10' },
  volleyball: { main: '#2563eb', trim: '#fbbf24', ink: '#ffffff', number: '7' },
  tennis: { main: '#f6f5f0', trim: '#7c3aed', ink: '#7c3aed', number: '' },
  badminton: { main: '#0d9488', trim: '#f472b6', ink: '#ffffff', number: '' },
  running: { main: '#e11d48', trim: '#ffffff', ink: '#ffffff', number: '' },
  gym: { main: '#26282e', trim: '#a3e635', ink: '#a3e635', number: '' },
}

export const HAIR_COLORS: Record<string, string> = {
  black: '#1b1714',
  dark_brown: '#3b2618',
  brown: '#5c3a1e',
  light_brown: '#8a5d34',
  blonde: '#d6ad5f',
  platinum: '#e4dfd3',
  red: '#a2452a',
  grey: '#8d8d8f',
}

export const LIP = '#8a4038'
export const INK = '#1f1a17'
