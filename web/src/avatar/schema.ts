export const AVATAR_VERSION = 1
export const AVATAR_PROFILE_MARKER = 'avatar:player'

export type BodyType = 'slim' | 'average' | 'athletic' | 'muscular' | 'larger'
export type SportSlug = 'basketball' | 'football' | 'tennis' | 'badminton' | 'volleyball' | 'running' | 'gym'
export type Pose = 'standing' | 'action'
export type Figure = 'straight' | 'curvy'
export type Lashes = 'none' | 'natural' | 'bold'
export type AvatarDetail = 'freckles' | 'beauty_mark' | 'dimples' | 'face_paint' | 'tattoo_arm' | 'tattoo_sleeve'

export interface PlayerAvatarConfig {
  version: typeof AVATAR_VERSION
  bodyType: BodyType
  /** Meters — 1.45–2.25 */
  height: number
  skinTone: string
  face: string
  eyes: string
  eyebrows: string
  nose: string
  mouth: string
  hair: string
  hairColor: string
  facialHair: string
  top: string
  bottom: string
  shoes: string
  headwear: string | null
  eyewear: string | null
  accessory: string | null
  sport: SportSlug
  sportsEquipment: string | null
  pose: Pose
  useAsProfile: boolean
  /* Optional (older saves omit them → default look). Keep in sync with backend/internal/avatar. */
  figure?: Figure
  eyeColor?: string
  lashes?: Lashes
  lipColor?: string
  details?: AvatarDetail[]
  /** Team colour ids (see KIT_COLORS); empty/undefined = the sport's colours. */
  kitMain?: string | null
  kitTrim?: string | null
  /** Jersey number 0–99; undefined/null = the sport's default. */
  number?: number | null
}

export type AvatarCategory =
  | 'body'
  | 'skin'
  | 'face'
  | 'eyes'
  | 'eyebrows'
  | 'nose'
  | 'mouth'
  | 'hair'
  | 'facialHair'
  | 'top'
  | 'bottom'
  | 'shoes'
  | 'headwear'
  | 'eyewear'
  | 'accessory'
  | 'sport'
  | 'sportsEquipment'
  | 'pose'

export interface AvatarAsset {
  id: string
  category: AvatarCategory
  name: string
  preview?: string
  compatibleSports?: SportSlug[]
}
