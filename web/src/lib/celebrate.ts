import { buzz, cheer } from './fx'
import { prefersReducedMotion } from './motion'

export type Point = { x: number; y: number }
export type ConfettiPiece = { dx: number; dy: number; rotate: number; delay: number; color: number }

const COLORS = ['var(--brand)', 'var(--sport-accent)', 'var(--live)', 'var(--upcoming)', '#facc15']

/**
 * Burst vectors: pieces spread over a full circle (with jitter), biased upward, and pulled
 * down a little at the end like they're falling. `rand` is injectable for tests.
 */
export function confettiPieces(count: number, rand: () => number = Math.random): ConfettiPiece[] {
  const n = Math.max(0, Math.floor(count))
  return Array.from({ length: n }, (_, i) => {
    const angle = (i / Math.max(1, n)) * Math.PI * 2 + (rand() - 0.5) * 0.6
    const dist = 60 + rand() * 80
    return {
      dx: Math.round(Math.cos(angle) * dist),
      dy: Math.round(Math.sin(angle) * dist * 0.85 - 24 + 40 * rand()),
      rotate: Math.round((rand() - 0.5) * 720),
      delay: Math.round(rand() * 60),
      color: i % COLORS.length,
    }
  })
}

/** Where a burst should start: the centre of an element, or a point. */
export function burstOrigin(from?: Element | Point | null): Point {
  if (from && 'getBoundingClientRect' in from) {
    const r = from.getBoundingClientRect()
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
  }
  if (from) return from
  return { x: window.innerWidth / 2, y: window.innerHeight * 0.4 }
}

/** A confetti pop with sparks (canvas particles, removes itself) and a tiny vibration on phones. */
export function celebrate(from?: Element | Point | null, count = 26): void {
  if (typeof document === 'undefined' || prefersReducedMotion()) return
  cheer(burstOrigin(from), Math.max(30, count + 18))
  buzz([12, 40, 18])
}
