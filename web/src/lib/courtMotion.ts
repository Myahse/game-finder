import { parseOpeningHours } from './openingHours'

/** Pointer velocity (px/s) from the last few moves; reads 0 if the finger stopped before letting go. */
export function velocityTracker() {
  let px = 0
  let pt = 0
  let v = 0
  return {
    reset(x: number) {
      px = x
      pt = performance.now()
      v = 0
    },
    push(x: number) {
      const t = performance.now()
      const dt = t - pt
      if (dt > 0) {
        const nv = ((x - px) / dt) * 1000
        v = dt > 50 ? nv : v * 0.35 + nv * 0.65
      }
      px = x
      pt = t
    },
    get v() {
      return performance.now() - pt > 90 ? 0 : v
    },
  }
}

/** Overscroll past an edge: gives less and less the further you pull. */
export function rubberBand(d: number, max = 70, soft = 120): number {
  return max * (1 - Math.exp(-d / soft))
}

const toMin = (hm: string) => {
  const [h, m] = hm.split(':').map(Number)
  return h * 60 + m
}

/**
 * Whether a court is open at `now`, from its stored hours (e.g. "06:00–22:00", overnight ranges too).
 * Null when the hours aren't a simple daily range we can read.
 */
export function openNow(raw: string | null | undefined, now = new Date()): { open: boolean; opens: string; closes: string } | null {
  const p = parseOpeningHours(raw)
  if (!p) return null
  const o = toMin(p.opens)
  const c = toMin(p.closes)
  const n = now.getHours() * 60 + now.getMinutes()
  let open: boolean
  if (o === c || (o === 0 && c >= 1440)) open = true
  else if (c > o) open = n >= o && n < c
  else open = n >= o || n < c
  return { open, opens: p.opens, closes: p.closes }
}
