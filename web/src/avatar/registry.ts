import type { AvatarAsset, AvatarCategory, SportSlug } from './schema'
import { currentT } from '../i18n/LocaleProvider'

type AvatarLabels = ReturnType<typeof currentT>['avatarLabels']
export type OptionGroup = keyof AvatarLabels['options']

/** Display name of an option in the device language (English fallback). Read at call time, never at module load. */
export function optionLabel(group: OptionGroup, id: string, fallback = id): string {
  const names = currentT().avatarLabels?.options?.[group] as Record<string, string> | undefined
  return names?.[id] ?? fallback
}

/** Display name of a studio category in the device language. */
export function categoryLabel(id: AvatarCategory, fallback: string = id): string {
  return (currentT().avatarLabels?.categories as Record<string, string> | undefined)?.[id] ?? fallback
}

/** `name` is a getter so every screen shows the current device language. */
function named<T extends { id: string }>(group: OptionGroup, item: T, en: string): T & { name: string } {
  return Object.defineProperty(item, 'name', {
    get: () => optionLabel(group, item.id, en),
    enumerable: true,
  }) as T & { name: string }
}

function assets(category: AvatarCategory, items: [string, string][], sports?: SportSlug[], group: OptionGroup = category): AvatarAsset[] {
  return items.map(([id, name]) => named(group, { id, category, compatibleSports: sports }, name))
}

export const BODY_TYPES = assets('body', [
  ['slim', 'Slim'],
  ['average', 'Average'],
  ['athletic', 'Athletic'],
  ['muscular', 'Muscular'],
  ['larger', 'Larger'],
])

export const SKIN_TONES = assets('skin', [
  ['skin_01', 'Tone 1'],
  ['skin_02', 'Tone 2'],
  ['skin_03', 'Tone 3'],
  ['skin_04', 'Tone 4'],
  ['skin_05', 'Tone 5'],
  ['skin_06', 'Tone 6'],
  ['skin_07', 'Tone 7'],
  ['skin_08', 'Tone 8'],
  ['skin_09', 'Tone 9'],
  ['skin_10', 'Tone 10'],
  ['skin_11', 'Tone 11'],
  ['skin_12', 'Tone 12'],
])

export const FACES = assets('face', [
  ['face_oval', 'Oval'],
  ['face_round', 'Round'],
  ['face_square', 'Square'],
  ['face_heart', 'Heart'],
  ['face_long', 'Long'],
  ['face_angular', 'Angular'],
])

export const EYES = assets('eyes', [
  ['eyes_01', 'Default'],
  ['eyes_03', 'Happy'],
  ['eyes_02', 'Focused'],
  ['eyes_04', 'Side glance'],
  ['eyes_05', 'Wide'],
  ['eyes_wink', 'Wink'],
])

export const EYEBROWS = assets('eyebrows', [
  ['brow_curved', 'Natural'],
  ['brow_straight', 'Flat'],
  ['brow_thick', 'Bold'],
  ['brow_thin', 'Raised'],
  ['brow_athletic', 'Determined'],
  ['brow_expressive', 'Expressive'],
])

export const NOSES = assets('nose', [
  ['nose_small', 'Small'],
  ['nose_medium', 'Medium'],
  ['nose_large', 'Large'],
  ['nose_straight', 'Straight'],
  ['nose_rounded', 'Rounded'],
  ['nose_wide', 'Wide'],
  ['nose_narrow', 'Narrow'],
])

export const MOUTHS = assets('mouth', [
  ['mouth_neutral', 'Grin'],
  ['mouth_smile', 'Smile'],
  ['mouth_big_smile', 'Big smile'],
  ['mouth_serious', 'Serious'],
  ['mouth_confident', 'Cheeky'],
])

export const HAIRS = assets('hair', [
  ['hair_buzz', 'Buzz cut'],
  ['hair_short_flat', 'Short'],
  ['hair_short_round', 'Short round'],
  ['hair_side_part', 'Side part'],
  ['hair_waves', 'Waves'],
  ['hair_curls_short', 'Short curls'],
  ['hair_quiff', 'Quiff'],
  ['hair_twists', 'Twists'],
  ['hair_locs', 'Locs'],
  ['hair_locs_long', 'Long locs'],
  ['hair_afro', 'Afro'],
  ['hair_puff', 'Afro + band'],
  ['hair_curly', 'Curly'],
  ['hair_long_curly', 'Long curly'],
  ['hair_big', 'Big hair'],
  ['hair_bun', 'Bun'],
  ['hair_braid_crown', 'Braid crown'],
  ['hair_bob', 'Bob'],
  ['hair_bob_bangs', 'Bob + bangs'],
  ['hair_shaggy', 'Shaggy'],
  ['hair_mullet', 'Mullet'],
  ['hair_shaved_side', 'Shaved side'],
  ['hair_long_wavy', 'Long wavy'],
  ['hair_long_straight', 'Long straight'],
  ['hair_long_sleek', 'Long sleek'],
  ['hair_long_strand', 'Long + strand'],
  ['hair_balding', 'Balding'],
  ['hair_headwrap', 'Turban'],
  ['hair_hijab', 'Hijab'],
])

export const HAIR_COLORS = assets('hair', [
  ['black', 'Black'],
  ['dark_brown', 'Dark brown'],
  ['brown', 'Brown'],
  ['light_brown', 'Light brown'],
  ['blonde', 'Blonde'],
  ['platinum', 'Platinum'],
  ['red', 'Red'],
  ['grey', 'Grey'],
], undefined, 'hairColor')

export const FACIAL_HAIR = assets('facialHair', [
  ['beard_none', 'None'],
  ['beard_stubble', 'Light beard'],
  ['beard_short', 'Beard'],
  ['beard_full', 'Full beard'],
  ['beard_mustache', 'Moustache'],
  ['beard_goatee', 'Big moustache'],
])

export const TOPS = assets('top', [
  ['top_basketball_jersey', 'Basketball jersey'],
  ['top_football_jersey', 'Football jersey'],
  ['top_tennis_shirt', 'Tennis shirt'],
  ['top_badminton_shirt', 'Badminton shirt'],
  ['top_running_shirt', 'Running shirt'],
  ['top_compression', 'Compression top'],
  ['top_hoodie', 'Hoodie'],
  ['top_tank', 'Tank top'],
  ['top_tee', 'Casual tee'],
  ['top_sports_bra', 'Sports bra'],
])

export const BOTTOMS = assets('bottom', [
  ['bottom_basketball_shorts', 'Basketball shorts'],
  ['bottom_football_shorts', 'Football shorts'],
  ['bottom_tennis_shorts', 'Tennis shorts'],
  ['bottom_running_shorts', 'Running shorts'],
  ['bottom_sweatpants', 'Sweatpants'],
  ['bottom_athletic_pants', 'Athletic pants'],
  ['bottom_leggings', 'Leggings'],
  ['bottom_tennis_skirt', 'Tennis skirt'],
])

export const SHOES_LIST = assets('shoes', [
  ['shoes_basketball', 'Basketball shoes'],
  ['shoes_football', 'Football boots'],
  ['shoes_tennis', 'Tennis shoes'],
  ['shoes_running', 'Running shoes'],
  ['shoes_badminton', 'Indoor court shoes'],
  ['shoes_sneakers', 'Sneakers'],
])

export const HEADWEAR = assets('headwear', [
  ['head_cap', 'Hat'],
  ['head_beanie', 'Beanie'],
  ['head_bobble', 'Bobble hat'],
  ['head_earflap', 'Earflap hat'],
])

export const EYEWEAR = assets('eyewear', [
  ['eye_glasses', 'Glasses'],
  ['eye_round', 'Round'],
  ['eye_sport', 'Wayfarers'],
  ['eye_sunglasses', 'Sunglasses'],
])

export const ACCESSORIES = assets('accessory', [
  ['acc_wristbands', 'Wristbands'],
  ['acc_watch', 'Watch'],
  ['acc_necklace', 'Necklace'],
  ['acc_earrings', 'Earrings'],
])

export const SPORTS = assets('sport', [
  ['basketball', 'Basketball'],
  ['football', 'Football'],
  ['tennis', 'Tennis'],
  ['badminton', 'Badminton'],
  ['volleyball', 'Volleyball'],
  ['running', 'Running'],
  ['gym', 'Gym'],
])

export const EQUIPMENT = assets('sportsEquipment', [
  ['eq_basketball', 'Basketball'],
  ['eq_football', 'Football'],
  ['eq_tennis_racket', 'Tennis racket'],
  ['eq_badminton_racket', 'Badminton racket'],
  ['eq_volleyball', 'Volleyball'],
  ['eq_water_bottle', 'Water bottle'],
  ['eq_dumbbells', 'Dumbbells'],
])

export const POSES = assets('pose', [['standing', 'Standing'], ['action', 'Action']])

/* Optional extras — ids must match backend/internal/avatar/catalog.go */
export const FIGURES: { id: 'straight' | 'curvy'; name: string }[] = [
  named('figure', { id: 'straight' }, 'Straight'),
  named('figure', { id: 'curvy' }, 'Curvy'),
]

export const EYE_COLORS: { id: string; name: string; hex: string }[] = [
  named('eyeColor', { id: 'brown', hex: '#5a3520' }, 'Brown'),
  named('eyeColor', { id: 'dark', hex: '#2b1a10' }, 'Dark brown'),
  named('eyeColor', { id: 'hazel', hex: '#7b6a2e' }, 'Hazel'),
  named('eyeColor', { id: 'green', hex: '#3f7a4a' }, 'Green'),
  named('eyeColor', { id: 'blue', hex: '#3b6fb6' }, 'Blue'),
  named('eyeColor', { id: 'grey', hex: '#6f7d88' }, 'Grey'),
]

export const LASHES: { id: 'none' | 'natural' | 'bold'; name: string }[] = [
  named('lashes', { id: 'none' }, 'None'),
  named('lashes', { id: 'natural' }, 'Natural'),
  named('lashes', { id: 'bold' }, 'Bold'),
]

export const LIP_COLORS: { id: string; name: string; hex: string }[] = [
  named('lipColor', { id: 'natural', hex: '#9a4a40' }, 'Natural'),
  named('lipColor', { id: 'nude', hex: '#b9776a' }, 'Nude'),
  named('lipColor', { id: 'rose', hex: '#c4566e' }, 'Rose'),
  named('lipColor', { id: 'berry', hex: '#7d2448' }, 'Berry'),
  named('lipColor', { id: 'red', hex: '#c0202b' }, 'Red'),
]

export const DETAILS: { id: 'freckles' | 'beauty_mark' | 'dimples' | 'face_paint' | 'tattoo_arm' | 'tattoo_sleeve'; name: string }[] = [
  named('details', { id: 'freckles' }, 'Freckles'),
  named('details', { id: 'beauty_mark' }, 'Beauty mark'),
  named('details', { id: 'dimples' }, 'Dimples'),
  named('details', { id: 'face_paint' }, 'Eye black'),
  named('details', { id: 'tattoo_arm' }, 'Arm band tattoo'),
  named('details', { id: 'tattoo_sleeve' }, 'Sleeve tattoo'),
]

export const KIT_COLORS: { id: string; name: string; hex: string }[] = [
  named('kitColor', { id: 'red', hex: '#dc2626' }, 'Red'),
  named('kitColor', { id: 'orange', hex: '#f2552c' }, 'Orange'),
  named('kitColor', { id: 'gold', hex: '#f5b301' }, 'Gold'),
  named('kitColor', { id: 'green', hex: '#109c4e' }, 'Green'),
  named('kitColor', { id: 'teal', hex: '#0d9488' }, 'Teal'),
  named('kitColor', { id: 'sky', hex: '#0ea5e9' }, 'Sky'),
  named('kitColor', { id: 'blue', hex: '#2563eb' }, 'Blue'),
  named('kitColor', { id: 'navy', hex: '#1e3a8a' }, 'Navy'),
  named('kitColor', { id: 'purple', hex: '#7c3aed' }, 'Purple'),
  named('kitColor', { id: 'pink', hex: '#ec4899' }, 'Pink'),
  named('kitColor', { id: 'maroon', hex: '#7f1d1d' }, 'Maroon'),
  named('kitColor', { id: 'black', hex: '#1d1f2b' }, 'Black'),
  named('kitColor', { id: 'white', hex: '#f6f5f0' }, 'White'),
  named('kitColor', { id: 'grey', hex: '#8d929b' }, 'Grey'),
]

const BY_CATEGORY: Record<AvatarCategory, AvatarAsset[]> = {
  body: BODY_TYPES,
  skin: SKIN_TONES,
  face: FACES,
  eyes: EYES,
  eyebrows: EYEBROWS,
  nose: NOSES,
  mouth: MOUTHS,
  hair: HAIRS,
  facialHair: FACIAL_HAIR,
  top: TOPS,
  bottom: BOTTOMS,
  shoes: SHOES_LIST,
  headwear: HEADWEAR,
  eyewear: EYEWEAR,
  accessory: ACCESSORIES,
  sport: SPORTS,
  sportsEquipment: EQUIPMENT,
  pose: POSES,
}

export function assetsForCategory(cat: AvatarCategory): AvatarAsset[] {
  return BY_CATEGORY[cat] ?? []
}

function category(id: AvatarCategory, en: string): { id: AvatarCategory; label: string } {
  return Object.defineProperty({ id }, 'label', { get: () => categoryLabel(id, en), enumerable: true }) as { id: AvatarCategory; label: string }
}

export const STUDIO_CATEGORIES: { id: AvatarCategory; label: string }[] = [
  category('body', 'Body'),
  category('skin', 'Skin'),
  category('face', 'Face'),
  category('eyes', 'Eyes'),
  category('eyebrows', 'Brows'),
  category('nose', 'Nose'),
  category('mouth', 'Mouth'),
  category('hair', 'Hair'),
  category('facialHair', 'Facial hair'),
  category('top', 'Top'),
  category('bottom', 'Bottom'),
  category('shoes', 'Shoes'),
  category('headwear', 'Headwear'),
  category('eyewear', 'Eyewear'),
  category('accessory', 'Accessories'),
  category('sport', 'Sport'),
  category('sportsEquipment', 'Equipment'),
  category('pose', 'Pose'),
]
