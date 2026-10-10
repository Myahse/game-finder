/** Small motion helpers for the social sheets (sticker peel, bump). */

export type Pt = [number, number]

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t
export const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

/** Runs fn(t) for t in 0..1 over d ms; returns a cancel function. */
export function tween(d: number, fn: (t: number) => void, done?: () => void): () => void {
  const t0 = performance.now()
  let raf = 0
  const step = (now: number) => {
    const t = Math.min(1, Math.max(0, (now - t0) / d))
    fn(t)
    if (t < 1) raf = requestAnimationFrame(step)
    else done?.()
  }
  raf = requestAnimationFrame(step)
  return () => cancelAnimationFrame(raf)
}

/** One side of a polygon cut by the line through M with normal n. */
function half(poly: Pt[], M: Pt, n: Pt, keepPos: boolean): Pt[] {
  const out: Pt[] = []
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]
    const b = poly[(i + 1) % poly.length]
    const da = (a[0] - M[0]) * n[0] + (a[1] - M[1]) * n[1]
    const db = (b[0] - M[0]) * n[0] + (b[1] - M[1]) * n[1]
    const ia = keepPos ? da > 0 : da <= 0
    const ib = keepPos ? db > 0 : db <= 0
    if (ia) out.push(a)
    if (ia !== ib) {
      const t = da / (da - db)
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t])
    }
  }
  return out
}

const polygon = (p: Pt[]) => (p.length > 2 ? `polygon(${p.map(([x, y]) => `${x.toFixed(1)}px ${y.toFixed(1)}px`).join(',')})` : 'polygon(0 0, 0 0, 0 0)')

/**
 * Folds a W×H sticker so its corner C lands on P: the front keeps one side of the fold line,
 * the back is the other side mirrored across it. Returns how far it is peeled (0..~1 of the diagonal).
 */
export function paperFold(front: HTMLElement, back: HTMLElement, W: number, H: number, C: Pt, P: Pt): number {
  const dx = C[0] - P[0]
  const dy = C[1] - P[1]
  const d = Math.hypot(dx, dy)
  if (d < 0.5) {
    front.style.clipPath = ''
    back.style.clipPath = ''
    back.style.transform = ''
    return 0
  }
  const n: Pt = [dx / d, dy / d]
  const M: Pt = [(C[0] + P[0]) / 2, (C[1] + P[1]) / 2]
  const rect: Pt[] = [[0, 0], [W, 0], [W, H], [0, H]]
  const mn = M[0] * n[0] + M[1] * n[1]
  front.style.clipPath = polygon(half(rect, M, n, false))
  back.style.clipPath = polygon(half(rect, M, n, true))
  back.style.transform = `matrix(${1 - 2 * n[0] * n[0]}, ${-2 * n[0] * n[1]}, ${-2 * n[0] * n[1]}, ${1 - 2 * n[1] * n[1]}, ${2 * mn * n[0]}, ${2 * mn * n[1]})`
  return d / Math.hypot(W, H)
}

/** Corners of a W×H box with the inward direction of each. */
export const corners = (W: number, H: number): [number, number, number, number][] => [
  [0, 0, 1, 1],
  [W, 0, -1, 1],
  [W, H, -1, -1],
  [0, H, 1, -1],
]
