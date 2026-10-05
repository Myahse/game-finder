import type { BodyType, PlayerAvatarConfig } from '../../schema'
import { KIT_COLORS } from '../../registry'
import { HAIR_COLORS, KITS, luminance } from './palette'

/** Figure is drawn in a 240-wide space, centred on x = 120, feet on y ≈ 390. */
export const CX = 120

export type Geo = {
  /** Half widths */
  shoulder: number
  waist: number
  hip: number
  neck: number
  /** Base limb thickness (widest muscle ≈ 1.2×) */
  arm: number
  leg: number
  /** Muscle definition (1 = average) and belly forward-curve in px */
  muscle: number
  belly: number
}

const GEO: Record<BodyType, Geo> = {
  slim: { shoulder: 33, waist: 24, hip: 24, neck: 8.5, arm: 11.5, leg: 13.5, muscle: 0.9, belly: 0 },
  average: { shoulder: 37, waist: 28, hip: 27, neck: 9.5, arm: 13, leg: 15, muscle: 1, belly: 2 },
  athletic: { shoulder: 42, waist: 27, hip: 27, neck: 10.5, arm: 14.5, leg: 16, muscle: 1.1, belly: 0 },
  muscular: { shoulder: 46, waist: 30, hip: 29, neck: 12, arm: 17, leg: 18, muscle: 1.22, belly: 0 },
  larger: { shoulder: 42, waist: 37, hip: 34, neck: 12, arm: 16.5, leg: 18.5, muscle: 0.95, belly: 9 },
}

/** Body proportions; a curvy figure narrows shoulders + waist and widens hips. */
export type Body = Geo & { curvy: boolean; thigh: number }

export function geometry(body: BodyType, figure: PlayerAvatarConfig['figure'] = 'straight'): Body {
  const g = GEO[body] ?? GEO.athletic
  if (figure !== 'curvy') return { ...g, curvy: false, thigh: 1 }
  return {
    ...g,
    shoulder: g.shoulder - 4,
    waist: Math.max(21, g.waist - 4),
    hip: g.hip + 8,
    leg: g.leg + 0.5,
    arm: g.arm - 1,
    neck: g.neck - 1,
    muscle: g.muscle * 0.92,
    curvy: true,
    thigh: 1.16,
  }
}

export const Y = { neckTop: 88, shoulder: 118, waist: 212, crotch: 262, knee: 314, ankle: 368, sole: 390 }

export type Skin = { base: string; mid: string; shadow: string; highlight: string }

/** Joint positions for each arm; `side` -1 = figure's right (viewer's left). */
export function armJoints(g: Geo, side: -1 | 1, raised: boolean) {
  const sx = CX + side * (g.shoulder - 6)
  if (raised) {
    return { shoulder: [sx, 128], elbow: [CX + side * (g.shoulder + 16), 98], wrist: [CX + side * (g.shoulder + 8), 64] } as const
  }
  return {
    shoulder: [sx, 128],
    elbow: [CX + side * (g.shoulder + 3), 176],
    wrist: [CX + side * (g.shoulder + 6), 224],
  } as const
}

export const legX = (g: Geo, side: -1 | 1) => CX + side * (g.hip * 0.5 + 2)


export type FaceSpec = { cheek: number; jaw: number; chinW: number; chin: number; cheekY: number }
const FACES: Record<string, FaceSpec> = {
  face_oval: { cheek: 27, jaw: 19, chinW: 8, chin: 100, cheekY: 66 },
  face_round: { cheek: 29, jaw: 24, chinW: 12, chin: 98, cheekY: 68 },
  face_square: { cheek: 28, jaw: 26, chinW: 15, chin: 99, cheekY: 68 },
  face_heart: { cheek: 29, jaw: 16, chinW: 5, chin: 101, cheekY: 62 },
  face_long: { cheek: 25, jaw: 19, chinW: 8, chin: 105, cheekY: 68 },
  face_angular: { cheek: 27, jaw: 23, chinW: 6, chin: 101, cheekY: 66 },
}
export const faceSpec = (id: string) => FACES[id] ?? FACES.face_oval


export function hairColor(c: PlayerAvatarConfig) {
  return HAIR_COLORS[c.hairColor] ?? HAIR_COLORS.black
}

const hexOf = (id: string | null | undefined) => KIT_COLORS.find((k) => k.id === id)?.hex

/** Resolved team kit: the player's chosen colours, else their sport's. */
export function kitOf(c: PlayerAvatarConfig) {
  const sport = KITS[c.sport] ?? KITS.basketball
  const main = hexOf(c.kitMain) ?? sport.main
  const trim = hexOf(c.kitTrim) ?? sport.trim
  const custom = !!(c.kitMain || c.kitTrim)
  const light = luminance(main) > 0.62
  // Numbers need contrast with the shirt: use the trim when it reads, else ink/white.
  const ink = custom ? (Math.abs(luminance(trim) - luminance(main)) > 0.35 ? trim : light ? '#1d1f2b' : '#ffffff') : sport.ink
  const number = c.number != null ? String(c.number) : sport.number
  /** A colour that shows up on light backgrounds (white kits fall back to the trim). */
  const accent = light ? trim : main
  return { main, trim, ink, number, accent }
}

