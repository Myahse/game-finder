import type { BodyType, PlayerAvatarConfig } from '../../schema'
import { HAIR_COLORS } from './palette'

/** Figure is drawn in a 240-wide space, centred on x = 120, feet on y ≈ 390. */
export const CX = 120

export type Geo = {
  /** Half widths */
  shoulder: number
  waist: number
  hip: number
  neck: number
  /** Stroke thickness of limbs */
  arm: number
  leg: number
}

const GEO: Record<BodyType, Geo> = {
  slim: { shoulder: 33, waist: 24, hip: 24, neck: 8.5, arm: 12, leg: 14 },
  average: { shoulder: 37, waist: 28, hip: 27, neck: 9.5, arm: 13.5, leg: 15.5 },
  athletic: { shoulder: 42, waist: 27, hip: 27, neck: 10.5, arm: 15, leg: 16.5 },
  muscular: { shoulder: 46, waist: 30, hip: 29, neck: 12, arm: 18, leg: 18.5 },
  larger: { shoulder: 42, waist: 37, hip: 34, neck: 12, arm: 17, leg: 19 },
}

export const geometry = (body: BodyType): Geo => GEO[body] ?? GEO.athletic

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

