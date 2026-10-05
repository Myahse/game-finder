import type { PlayerAvatarConfig } from '../../schema'
import { DEMO_CHARACTER_GLB, demoGlbEnabled } from './demoGlb'

export type GlbSlot = {
  url: string
  available: boolean
}

const BASE = '/avatar'

function slot(path: string, available = false): GlbSlot {
  return { url: `${BASE}/${path}`, available }
}

export const BASE_BODY: GlbSlot = slot('base/male-athletic.glb', false)

const HAIR: Record<string, GlbSlot> = {
  hair_crop: slot('hair/hair_crop.glb', false),
  hair_fade_mid: slot('hair/hair_fade_mid.glb', false),
  hair_buzz: slot('hair/hair_buzz.glb', false),
  hair_afro: slot('hair/hair_afro.glb', false),
}

const TOPS: Record<string, GlbSlot> = {
  top_basketball_jersey: slot('tops/top_basketball_jersey.glb', false),
  top_football_jersey: slot('tops/top_football_jersey.glb', false),
  top_tennis_shirt: slot('tops/top_tennis_shirt.glb', false),
}

const BOTTOMS: Record<string, GlbSlot> = {
  bottom_basketball_shorts: slot('bottoms/bottom_basketball_shorts.glb', false),
  bottom_football_shorts: slot('bottoms/bottom_football_shorts.glb', false),
}

const SHOES: Record<string, GlbSlot> = {
  shoes_basketball: slot('shoes/shoes_basketball.glb', false),
  shoes_football: slot('shoes/shoes_football.glb', false),
}

const EQUIPMENT: Record<string, GlbSlot> = {
  eq_basketball: slot('equipment/eq_basketball.glb', false),
  eq_football: slot('equipment/eq_football.glb', false),
  eq_tennis_racket: slot('equipment/eq_tennis_racket.glb', false),
}

const ACCESSORIES: Record<string, GlbSlot> = {
  acc_wristbands: slot('accessories/acc_wristbands.glb', false),
}

function pick(map: Record<string, GlbSlot>, id: string | null | undefined, fallback: string): GlbSlot {
  if (id && map[id]) return map[id]
  return map[fallback] ?? slot('missing.glb', false)
}

export type ResolvedGlbAvatar = {
  mode: 'demo' | 'modular'
  displayUrl: string
  base: GlbSlot
  hair: GlbSlot
  top: GlbSlot
  bottom: GlbSlot
  shoes: GlbSlot
  equipment: GlbSlot | null
  accessory: GlbSlot | null
}

export function resolveGlbAvatar(config: PlayerAvatarConfig): ResolvedGlbAvatar {
  const hair = pick(HAIR, config.hair, 'hair_crop')
  const top = pick(TOPS, config.top, 'top_basketball_jersey')
  const bottom = pick(BOTTOMS, config.bottom, 'bottom_basketball_shorts')
  const shoes = pick(SHOES, config.shoes, 'shoes_basketball')
  const equipment = config.sportsEquipment ? pick(EQUIPMENT, config.sportsEquipment, 'eq_basketball') : null
  const accessory = config.accessory ? pick(ACCESSORIES, config.accessory, 'acc_wristbands') : null

  const modularReady = [BASE_BODY, hair, top, bottom, shoes, equipment, accessory]
    .filter(Boolean)
    .every((s) => (s as GlbSlot).available)

  if (modularReady) {
    return {
      mode: 'modular',
      displayUrl: BASE_BODY.url,
      base: BASE_BODY,
      hair,
      top,
      bottom,
      shoes,
      equipment,
      accessory,
    }
  }

  if (demoGlbEnabled()) {
    return {
      mode: 'demo',
      displayUrl: DEMO_CHARACTER_GLB,
      base: BASE_BODY,
      hair,
      top,
      bottom,
      shoes,
      equipment,
      accessory,
    }
  }

  return {
    mode: 'demo',
    displayUrl: '',
    base: BASE_BODY,
    hair,
    top,
    bottom,
    shoes,
    equipment,
    accessory,
  }
}

export function skinTintHex(skinTone: string): string {
  const map: Record<string, string> = {
    skin_01: '#F4D8C6',
    skin_02: '#EDD0B8',
    skin_03: '#E2BC96',
    skin_04: '#C99563',
    skin_05: '#A67A4E',
    skin_06: '#8B5E3C',
    skin_07: '#6E4528',
    skin_08: '#4F321C',
    skin_09: '#D9A574',
    skin_10: '#B8895A',
    skin_11: '#9A6B47',
    skin_12: '#7A5235',
  }
  return map[skinTone] ?? map.skin_05
}
