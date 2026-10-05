import { armJoints, type Body, legX, Y } from './geometry'

export type Pt = readonly [number, number]

export function along(a: Pt, b: Pt, t: number): Pt {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]
}

/** Width profile of one limb segment: start, belly of the muscle (at `t`), end. */
export type Profile = { w0: number; wm: number; w1: number; t: number }

/** Width at position u (0–1) along a segment. */
export function widthAt(p: Profile, u: number) {
  return u <= p.t ? p.w0 + (p.wm - p.w0) * (u / p.t) : p.wm + (p.w1 - p.wm) * ((u - p.t) / (1 - p.t))
}

/**
 * Closed outline of a tapered segment from a to b (with a rounded end at b), optionally cut at `upto`.
 * The muscle side curves through the belly point, so arms/legs read as anatomy, not tubes.
 */
export function segment(a: Pt, b: Pt, p: Profile, upto = 1, grow = 0, flat = false): string {
  const end = along(a, b, upto)
  const w0 = p.w0 + grow
  const w1 = widthAt(p, upto) + grow
  const t = Math.min(p.t / upto, 0.9)
  const wm = (upto > p.t ? p.wm : widthAt(p, upto * 0.5)) + grow
  const dx = end[0] - a[0]
  const dy = end[1] - a[1]
  const len = Math.hypot(dx, dy) || 1
  const nx = -dy / len
  const ny = dx / len
  const m = along(a, end, t)
  const off = (pt: Pt, w: number, s: 1 | -1): Pt => [pt[0] + nx * (w / 2) * s, pt[1] + ny * (w / 2) * s]
  const ctrl = (s: 1 | -1) => {
    const A = off(a, w0, s)
    const B = off(end, w1, s)
    const M = off(m, wm, s)
    return [2 * M[0] - (A[0] + B[0]) / 2, 2 * M[1] - (A[1] + B[1]) / 2] as const
  }
  const aL = off(a, w0, 1)
  const bL = off(end, w1, 1)
  const bR = off(end, w1, -1)
  const aR = off(a, w0, -1)
  const cL = ctrl(1)
  const cR = ctrl(-1)
  const r = w1 / 2
  const endCap = flat ? `L ${bR[0]},${bR[1]}` : `A ${r},${r} 0 0 0 ${bR[0]},${bR[1]}`
  return `M ${aL[0]},${aL[1]} Q ${cL[0]},${cL[1]} ${bL[0]},${bL[1]} ${endCap} Q ${cR[0]},${cR[1]} ${aR[0]},${aR[1]} A ${w0 / 2},${w0 / 2} 0 0 0 ${aL[0]},${aL[1]} Z`
}

/** Upper arm + forearm profiles (deltoid → bicep → elbow → forearm → wrist). */
export function armProfiles(g: Body): [Profile, Profile] {
  const a = g.arm
  const m = g.muscle
  return [
    { w0: a * 1.12, wm: a * 1.06 * m, w1: a * 0.78, t: 0.36 },
    { w0: a * 0.82, wm: a * 0.92 * m, w1: a * 0.56, t: 0.26 },
  ]
}

/** Thigh + calf profiles (hip → thigh → knee → calf → ankle). */
export function legProfiles(g: Body): [Profile, Profile] {
  const l = g.leg
  const m = g.muscle
  return [
    { w0: l * 1.32 * g.thigh, wm: l * 1.2 * g.thigh * m, w1: l * 0.8, t: 0.32 },
    { w0: l * 0.8, wm: l * 0.9 * m, w1: l * 0.48, t: 0.3 },
  ]
}

export function legPoints(g: Body, side: -1 | 1) {
  const x = legX(g, side)
  return { hip: [x, Y.waist - 2] as Pt, knee: [x + side * 1, Y.knee] as Pt, ankle: [x + side * 3, Y.ankle] as Pt }
}

export function armPieces(g: Body, side: -1 | 1, raised: boolean, grow = 0, cut?: { upper?: number; lower?: number }) {
  const j = armJoints(g, side, raised)
  const [up, low] = armProfiles(g)
  const pieces = [segment(j.shoulder, j.elbow, up, cut?.upper ?? 1, grow)]
  if (cut?.lower !== 0) pieces.push(segment(j.elbow, j.wrist, low, cut?.lower ?? 1, grow))
  return pieces
}

/** Thigh (+ calf) pieces. `thighTo` < 1 stops partway down the thigh (shorts); `calfTo` trims above the ankle. */
export function legPieces(g: Body, side: -1 | 1, grow = 0, opts: { thighTo?: number; calfTo?: number; flat?: boolean } = {}) {
  const p = legPoints(g, side)
  const [thigh, calf] = legProfiles(g)
  const thighTo = opts.thighTo ?? 1
  const pieces = [segment(p.hip, p.knee, thigh, thighTo, grow, opts.flat && thighTo < 1)]
  if (thighTo >= 1) pieces.push(segment(p.knee, p.ankle, calf, opts.calfTo ?? 1, grow, opts.flat))
  return pieces
}

/** Half-width of the leg at a point along the thigh (0 = hip, 1 = knee). */
export function thighHalf(g: Body, t: number) {
  return widthAt(legProfiles(g)[0], t) / 2
}

/** Lower-leg piece from `from` (0 = knee) to the ankle — for socks. */
export function calfPiece(g: Body, side: -1 | 1, from: number, grow = 0, flat = false) {
  const p = legPoints(g, side)
  const [, calf] = legProfiles(g)
  const start = along(p.knee, p.ankle, from)
  const prof: Profile = { w0: widthAt(calf, from), wm: widthAt(calf, Math.max(from, calf.t) + (1 - Math.max(from, calf.t)) * 0.3), w1: calf.w1, t: 0.3 }
  return segment(start, p.ankle, prof, 1, grow, flat)
}

