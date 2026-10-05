import type { PlayerAvatarConfig, SportSlug } from './schema'
import { AVATAR_VERSION } from './schema'

export const PRESET_LABELS: { id: string; name: string; sport: SportSlug }[] = [
  { id: 'reference', name: 'Reference hooper', sport: 'basketball' },
  { id: 'hooper', name: 'The Hooper', sport: 'basketball' },
  { id: 'footballer', name: 'The Footballer', sport: 'football' },
  { id: 'tennis', name: 'The Tennis Player', sport: 'tennis' },
  { id: 'runner', name: 'The Runner', sport: 'running' },
  { id: 'gym', name: 'The Gym Athlete', sport: 'gym' },
  { id: 'casual', name: 'The Casual Athlete', sport: 'basketball' },
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

function kit(sport: SportSlug): Pick<PlayerAvatarConfig, 'top' | 'bottom' | 'shoes' | 'sportsEquipment' | 'accessory' | 'headwear'> {
  switch (sport) {
    case 'football':
      return { top: 'top_football_jersey', bottom: 'bottom_football_shorts', shoes: 'shoes_football', sportsEquipment: 'eq_football', accessory: null, headwear: null }
    case 'tennis':
      return { top: 'top_tennis_shirt', bottom: 'bottom_tennis_shorts', shoes: 'shoes_tennis', sportsEquipment: 'eq_tennis_racket', accessory: null, headwear: 'head_cap' }
    case 'running':
      return { top: 'top_running_shirt', bottom: 'bottom_running_shorts', shoes: 'shoes_running', sportsEquipment: 'eq_water_bottle', accessory: null, headwear: null }
    case 'gym':
      return { top: 'top_tank', bottom: 'bottom_athletic_pants', shoes: 'shoes_sneakers', sportsEquipment: 'eq_dumbbells', accessory: null, headwear: null }
    default:
      return { top: 'top_basketball_jersey', bottom: 'bottom_basketball_shorts', shoes: 'shoes_basketball', sportsEquipment: 'eq_basketball', accessory: 'acc_wristbands', headwear: 'head_headband' }
  }
}

export function defaultConfig(_sport: SportSlug = 'basketball'): PlayerAvatarConfig {
  return referenceAvatar()
}

export function presetConfig(presetId: string): PlayerAvatarConfig {
  if (presetId === 'reference') return referenceAvatar()
  const meta = PRESET_LABELS.find((p) => p.id === presetId) ?? PRESET_LABELS[0]
  const base = { ...referenceAvatar(), ...kit(meta.sport), sport: meta.sport }
  if (presetId === 'casual') {
    return { ...base, top: 'top_tee', bottom: 'bottom_running_shorts', shoes: 'shoes_sneakers', sportsEquipment: null, headwear: null, accessory: null }
  }
  if (presetId === 'runner') {
    return { ...base, hair: 'hair_crop', bodyType: 'slim', height: 1.72, sport: 'running', ...kit('running') }
  }
  if (presetId === 'gym') {
    return { ...base, bodyType: 'muscular', height: 1.82, hair: 'hair_buzz', sport: 'gym', ...kit('gym') }
  }
  return base
}
