import type { AvatarAsset, AvatarCategory, SportSlug } from './schema'

function assets(category: AvatarCategory, items: [string, string][], sports?: SportSlug[]): AvatarAsset[] {
  return items.map(([id, name]) => ({ id, category, name, compatibleSports: sports }))
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
])

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
  { id: 'straight', name: 'Straight' },
  { id: 'curvy', name: 'Curvy' },
]

export const EYE_COLORS: { id: string; name: string; hex: string }[] = [
  { id: 'brown', name: 'Brown', hex: '#5a3520' },
  { id: 'dark', name: 'Dark brown', hex: '#2b1a10' },
  { id: 'hazel', name: 'Hazel', hex: '#7b6a2e' },
  { id: 'green', name: 'Green', hex: '#3f7a4a' },
  { id: 'blue', name: 'Blue', hex: '#3b6fb6' },
  { id: 'grey', name: 'Grey', hex: '#6f7d88' },
]

export const LASHES: { id: 'none' | 'natural' | 'bold'; name: string }[] = [
  { id: 'none', name: 'None' },
  { id: 'natural', name: 'Natural' },
  { id: 'bold', name: 'Bold' },
]

export const LIP_COLORS: { id: string; name: string; hex: string }[] = [
  { id: 'natural', name: 'Natural', hex: '#9a4a40' },
  { id: 'nude', name: 'Nude', hex: '#b9776a' },
  { id: 'rose', name: 'Rose', hex: '#c4566e' },
  { id: 'berry', name: 'Berry', hex: '#7d2448' },
  { id: 'red', name: 'Red', hex: '#c0202b' },
]

export const DETAILS: { id: 'freckles' | 'beauty_mark' | 'dimples' | 'face_paint' | 'tattoo_arm' | 'tattoo_sleeve'; name: string }[] = [
  { id: 'freckles', name: 'Freckles' },
  { id: 'beauty_mark', name: 'Beauty mark' },
  { id: 'dimples', name: 'Dimples' },
  { id: 'face_paint', name: 'Eye black' },
  { id: 'tattoo_arm', name: 'Arm band tattoo' },
  { id: 'tattoo_sleeve', name: 'Sleeve tattoo' },
]

export const KIT_COLORS: { id: string; name: string; hex: string }[] = [
  { id: 'red', name: 'Red', hex: '#dc2626' },
  { id: 'orange', name: 'Orange', hex: '#f2552c' },
  { id: 'gold', name: 'Gold', hex: '#f5b301' },
  { id: 'green', name: 'Green', hex: '#109c4e' },
  { id: 'teal', name: 'Teal', hex: '#0d9488' },
  { id: 'sky', name: 'Sky', hex: '#0ea5e9' },
  { id: 'blue', name: 'Blue', hex: '#2563eb' },
  { id: 'navy', name: 'Navy', hex: '#1e3a8a' },
  { id: 'purple', name: 'Purple', hex: '#7c3aed' },
  { id: 'pink', name: 'Pink', hex: '#ec4899' },
  { id: 'maroon', name: 'Maroon', hex: '#7f1d1d' },
  { id: 'black', name: 'Black', hex: '#1d1f2b' },
  { id: 'white', name: 'White', hex: '#f6f5f0' },
  { id: 'grey', name: 'Grey', hex: '#8d929b' },
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

export const STUDIO_CATEGORIES: { id: AvatarCategory; label: string }[] = [
  { id: 'body', label: 'Body' },
  { id: 'skin', label: 'Skin' },
  { id: 'face', label: 'Face' },
  { id: 'eyes', label: 'Eyes' },
  { id: 'eyebrows', label: 'Brows' },
  { id: 'nose', label: 'Nose' },
  { id: 'mouth', label: 'Mouth' },
  { id: 'hair', label: 'Hair' },
  { id: 'facialHair', label: 'Facial hair' },
  { id: 'top', label: 'Top' },
  { id: 'bottom', label: 'Bottom' },
  { id: 'shoes', label: 'Shoes' },
  { id: 'headwear', label: 'Headwear' },
  { id: 'eyewear', label: 'Eyewear' },
  { id: 'accessory', label: 'Accessories' },
  { id: 'sport', label: 'Sport' },
  { id: 'sportsEquipment', label: 'Equipment' },
  { id: 'pose', label: 'Pose' },
]
