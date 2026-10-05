import type { PlayerAvatarConfig, SportSlug } from './schema'
import { defaultConfig } from './presets'
import {
  ACCESSORIES,
  BOTTOMS,
  EYEBROWS,
  EYES,
  FACIAL_HAIR,
  FACES,
  HAIR_COLORS,
  HAIRS,
  HEADWEAR,
  MOUTHS,
  NOSES,
  SHOES_LIST,
  SPORTS,
  TOPS,
} from './registry'

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function idList(assets: { id: string; compatibleSports?: SportSlug[] }[], sport: SportSlug): string[] {
  const filtered = assets.filter((a) => !a.compatibleSports?.length || a.compatibleSports.includes(sport))
  return (filtered.length ? filtered : assets).map((a) => a.id)
}

export function randomizeAvatar(base?: PlayerAvatarConfig): PlayerAvatarConfig {
  const sport = pick(idList(SPORTS, 'basketball')) as SportSlug
  const c = defaultConfig(sport)
  const next = { ...c, ...base, sport }
  next.bodyType = pick(['slim', 'average', 'athletic', 'muscular', 'larger'] as const)
  next.height = 1.55 + Math.random() * 0.55
  next.skinTone = pick(idList(SKINS(), sport))
  next.face = pick(idList(FACES, sport))
  next.eyes = pick(idList(EYES, sport))
  next.eyebrows = pick(idList(EYEBROWS, sport))
  next.nose = pick(idList(NOSES, sport))
  next.mouth = pick(idList(MOUTHS, sport))
  next.hair = pick(idList(HAIRS, sport))
  next.hairColor = pick(idList(HAIR_COLORS, sport))
  next.facialHair = pick(idList(FACIAL_HAIR, sport))
  next.top = pick(idList(TOPS, sport))
  next.bottom = pick(idList(BOTTOMS, sport))
  next.shoes = pick(idList(SHOES_LIST, sport))
  next.sportsEquipment = defaultConfig(sport).sportsEquipment
  next.headwear = Math.random() > 0.65 ? pick(idList(HEADWEAR, sport)) : null
  next.eyewear = Math.random() > 0.8 ? pick(idList(EYEWEAR(), sport)) : null
  next.accessory = Math.random() > 0.6 ? pick(idList(ACCESSORIES, sport)) : null
  next.pose = Math.random() > 0.5 ? 'action' : 'standing'
  return next
}

function SKINS() {
  return [{ id: 'skin_01' }, { id: 'skin_02' }, { id: 'skin_03' }, { id: 'skin_04' }, { id: 'skin_05' }, { id: 'skin_06' }, { id: 'skin_07' }, { id: 'skin_08' }]
}

function EYEWEAR() {
  return [{ id: 'eye_glasses' }, { id: 'eye_sunglasses' }, { id: 'eye_sport' }]
}
