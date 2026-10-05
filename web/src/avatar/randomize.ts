import type { PlayerAvatarConfig, SportSlug } from './schema'
import { defaultConfig } from './presets'
import { ACCESSORIES, DETAILS, EYE_COLORS, EYEBROWS, EYES, EYEWEAR, FACIAL_HAIR, FACES, HAIR_COLORS, HAIRS, HEADWEAR, LIP_COLORS, MOUTHS, NOSES, SKIN_TONES, SPORTS } from './registry'

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

const ids = (assets: { id: string }[]) => assets.map((a) => a.id)

/** A random but coherent player: one sport's kit, random look. Keeps the profile-picture choice. */
export function randomizeAvatar(base?: PlayerAvatarConfig): PlayerAvatarConfig {
  const sport = pick(ids(SPORTS)) as SportSlug
  const next = defaultConfig(sport)
  next.bodyType = pick(['slim', 'average', 'athletic', 'muscular', 'larger'] as const)
  next.height = Math.round((1.6 + Math.random() * 0.4) * 100) / 100
  next.skinTone = pick(ids(SKIN_TONES))
  next.face = pick(ids(FACES))
  next.eyes = pick(ids(EYES))
  next.eyebrows = pick(ids(EYEBROWS))
  next.nose = pick(ids(NOSES))
  next.mouth = pick(ids(MOUTHS))
  next.hair = pick(ids(HAIRS))
  next.hairColor = Math.random() > 0.35 ? pick(['black', 'dark_brown']) : pick(ids(HAIR_COLORS))
  next.facialHair = Math.random() > 0.5 ? 'beard_none' : pick(ids(FACIAL_HAIR))
  next.headwear = Math.random() > 0.7 ? pick(ids(HEADWEAR)) : null
  next.eyewear = Math.random() > 0.85 ? pick(ids(EYEWEAR)) : null
  next.accessory = Math.random() > 0.55 ? pick(ids(ACCESSORIES)) : null
  next.pose = Math.random() > 0.5 ? 'action' : 'standing'
  next.figure = Math.random() > 0.5 ? 'curvy' : 'straight'
  next.eyeColor = Math.random() > 0.6 ? pick(ids(EYE_COLORS)) : 'brown'
  next.lashes = Math.random() > 0.55 ? pick(['natural', 'bold'] as const) : 'none'
  next.lipColor = Math.random() > 0.65 ? pick(ids(LIP_COLORS)) : 'natural'
  next.details = DETAILS.filter(() => Math.random() > 0.85).map((d) => d.id)
  next.useAsProfile = base?.useAsProfile ?? true
  return next
}
