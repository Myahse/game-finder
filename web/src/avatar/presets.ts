import type { PlayerAvatarConfig, SportSlug } from './schema'
import { AVATAR_VERSION } from './schema'

export const PRESET_LABELS: { id: string; name: string; sport: SportSlug }[] = [
  { id: 'hooper', name: 'The Hooper', sport: 'basketball' },
  { id: 'footballer', name: 'The Footballer', sport: 'football' },
  { id: 'volleyball', name: 'The Spiker', sport: 'volleyball' },
  { id: 'tennis', name: 'The Tennis Player', sport: 'tennis' },
  { id: 'badminton', name: 'The Shuttler', sport: 'badminton' },
  { id: 'runner', name: 'The Runner', sport: 'running' },
  { id: 'gym', name: 'The Gym Athlete', sport: 'gym' },
  { id: 'casual', name: 'The Casual', sport: 'basketball' },
]

/** Visual quality bar — athletic 6'2" basketball player. */
export function referenceAvatar(): PlayerAvatarConfig {
  return {
    version: AVATAR_VERSION,
    bodyType: 'athletic',
    height: 1.88,
    skinTone: 'skin_05',
    face: 'face_oval',
    eyes: 'eyes_03',
    eyebrows: 'brow_athletic',
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
      return { ...base, skinTone: 'skin_08', hair: 'hair_fade_mid', facialHair: 'beard_short', bodyType: 'muscular', accessory: null, height: 1.8 }
    case 'volleyball':
      return { ...base, skinTone: 'skin_07', hair: 'hair_box_braids', bodyType: 'average', pose: 'action', accessory: 'acc_necklace', height: 1.84 }
    case 'tennis':
      return { ...base, skinTone: 'skin_03', hair: 'hair_ponytail', hairColor: 'dark_brown', headwear: 'head_cap', face: 'face_heart', eyes: 'eyes_05', accessory: 'acc_earrings', bodyType: 'slim', pose: 'action', height: 1.72 }
    case 'badminton':
      return { ...base, skinTone: 'skin_09', hair: 'hair_wavy_med', hairColor: 'dark_brown', eyewear: 'eye_glasses', accessory: 'acc_watch', bodyType: 'slim', height: 1.7 }
    case 'runner':
      return { ...base, skinTone: 'skin_04', hair: 'hair_curls_short', headwear: 'head_headband', bodyType: 'slim', accessory: 'acc_watch', height: 1.74 }
    case 'gym':
      return { ...base, skinTone: 'skin_06', hair: 'hair_buzz', facialHair: 'beard_full_mustache', bodyType: 'muscular', accessory: null, height: 1.82 }
    case 'casual':
      return { ...base, top: 'top_hoodie', bottom: 'bottom_sweatpants', shoes: 'shoes_sneakers', sportsEquipment: null, skinTone: 'skin_11', hair: 'hair_locs', facialHair: 'beard_goatee', accessory: null }
    default:
      return { ...base, headwear: 'head_headband' }
  }
}
