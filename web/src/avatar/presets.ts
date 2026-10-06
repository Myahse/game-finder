import type { PlayerAvatarConfig, SportSlug } from './schema'
import { AVATAR_VERSION } from './schema'
import { currentT } from '../i18n/LocaleProvider'

/** Sports that have an avatar kit. */
export const AVATAR_SPORTS: SportSlug[] = ['basketball', 'football', 'tennis', 'badminton', 'volleyball', 'running', 'gym']

type Preset = { id: string; name: string; sport: SportSlug }

/** `name` is a getter so the preset follows the device language (English fallback). */
function preset(id: string, en: string, sport: SportSlug): Preset {
  return Object.defineProperty({ id, sport }, 'name', {
    get: () => (currentT().avatarLabels?.presets as Record<string, string> | undefined)?.[id] ?? en,
    enumerable: true,
  }) as Preset
}

export const PRESET_LABELS: Preset[] = [
  preset('hooper', 'The Hooper', 'basketball'),
  preset('footballer', 'The Footballer', 'football'),
  preset('volleyball', 'The Spiker', 'volleyball'),
  preset('tennis', 'The Tennis Player', 'tennis'),
  preset('badminton', 'The Shuttler', 'badminton'),
  preset('runner', 'The Runner', 'running'),
  preset('gym', 'The Gym Athlete', 'gym'),
  preset('casual', 'The Casual', 'basketball'),
]

/** Visual quality bar — athletic 6'2" basketball player. */
export function referenceAvatar(): PlayerAvatarConfig {
  return {
    version: AVATAR_VERSION,
    bodyType: 'athletic',
    height: 1.88,
    skinTone: 'skin_05',
    face: 'face_oval',
    eyes: 'eyes_01',
    eyebrows: 'brow_curved',
    nose: 'nose_medium',
    mouth: 'mouth_smile',
    hair: 'hair_crop',
    hairColor: 'black',
    facialHair: 'beard_none',
    top: 'top_basketball_jersey',
    bottom: 'bottom_basketball_shorts',
    shoes: 'shoes_basketball',
    headwear: null,
    eyewear: null,
    accessory: 'acc_wristbands',
    sport: 'basketball',
    sportsEquipment: 'eq_basketball',
    pose: 'standing',
    useAsProfile: true,
  }
}

type Kit = Pick<PlayerAvatarConfig, 'top' | 'bottom' | 'shoes' | 'sportsEquipment'>

/** Default outfit + equipment for each sport (picking a sport dresses the player in it). */
export function sportKit(sport: SportSlug): Kit {
  switch (sport) {
    case 'football':
      return { top: 'top_football_jersey', bottom: 'bottom_football_shorts', shoes: 'shoes_football', sportsEquipment: 'eq_football' }
    case 'volleyball':
      return { top: 'top_tank', bottom: 'bottom_running_shorts', shoes: 'shoes_badminton', sportsEquipment: 'eq_volleyball' }
    case 'tennis':
      return { top: 'top_tennis_shirt', bottom: 'bottom_tennis_shorts', shoes: 'shoes_tennis', sportsEquipment: 'eq_tennis_racket' }
    case 'badminton':
      return { top: 'top_badminton_shirt', bottom: 'bottom_athletic_pants', shoes: 'shoes_badminton', sportsEquipment: 'eq_badminton_racket' }
    case 'running':
      return { top: 'top_running_shirt', bottom: 'bottom_running_shorts', shoes: 'shoes_running', sportsEquipment: 'eq_water_bottle' }
    case 'gym':
      return { top: 'top_compression', bottom: 'bottom_sweatpants', shoes: 'shoes_sneakers', sportsEquipment: 'eq_dumbbells' }
    default:
      return { top: 'top_basketball_jersey', bottom: 'bottom_basketball_shorts', shoes: 'shoes_basketball', sportsEquipment: 'eq_basketball' }
  }
}

export function defaultConfig(sport: SportSlug = 'basketball'): PlayerAvatarConfig {
  return { ...referenceAvatar(), ...sportKit(sport), sport }
}

export function presetConfig(presetId: string): PlayerAvatarConfig {
  const meta = PRESET_LABELS.find((p) => p.id === presetId) ?? PRESET_LABELS[0]
  const base = defaultConfig(meta.sport)
  switch (presetId) {
    case 'footballer':
      return {
        ...base,
        skinTone: 'skin_08',
        hair: 'hair_short_flat',
        facialHair: 'beard_short',
        bodyType: 'muscular',
        accessory: null,
        height: 1.8,
        details: ['face_paint'],
      }
    case 'volleyball':
      return {
        ...base,
        figure: 'curvy',
        top: 'top_sports_bra',
        bottom: 'bottom_leggings',
        skinTone: 'skin_07',
        hair: 'hair_puff',
        lashes: 'bold',
        lipColor: 'berry',
        eyeColor: 'dark',
        bodyType: 'athletic',
        pose: 'action',
        accessory: 'acc_earrings',
        height: 1.84,
      }
    case 'tennis':
      return {
        ...base,
        figure: 'curvy',
        bottom: 'bottom_tennis_skirt',
        skinTone: 'skin_03',
        hair: 'hair_long_wavy',
        hairColor: 'dark_brown',
        face: 'face_heart',
        eyes: 'eyes_05',
        eyeColor: 'hazel',
        lashes: 'natural',
        lipColor: 'rose',
        accessory: 'acc_watch',
        bodyType: 'slim',
        pose: 'action',
        height: 1.72,
      }
    case 'badminton':
      return {
        ...base,
        figure: 'curvy',
        bottom: 'bottom_leggings',
        skinTone: 'skin_10',
        hair: 'hair_bun',
        hairColor: 'black',
        eyewear: 'eye_glasses',
        lashes: 'natural',
        lipColor: 'nude',
        details: ['dimples'],
        bodyType: 'average',
        kitMain: 'pink',
        kitTrim: 'white',
        number: 21,
        height: 1.66,
      }
    case 'runner':
      return {
        ...base,
        skinTone: 'skin_01',
        hair: 'hair_curls_short',
        hairColor: 'red',
        eyeColor: 'green',
        headwear: null,
        bodyType: 'slim',
        accessory: 'acc_watch',
        details: ['freckles'],
        height: 1.76,
      }
    case 'gym':
      return {
        ...base,
        skinTone: 'skin_06',
        hair: 'hair_buzz',
        facialHair: 'beard_full_mustache',
        bodyType: 'muscular',
        accessory: null,
        details: ['tattoo_sleeve'],
        height: 1.82,
      }
    case 'casual':
      return {
        ...base,
        top: 'top_hoodie',
        bottom: 'bottom_sweatpants',
        shoes: 'shoes_sneakers',
        sportsEquipment: null,
        skinTone: 'skin_11',
        hair: 'hair_locs_long',
        facialHair: 'beard_goatee',
        accessory: null,
      }
    default:
      return { ...base, hair: 'hair_short_round' }
  }
}
