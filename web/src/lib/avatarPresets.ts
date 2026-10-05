export const AVATAR_PRESET_V1_PREFIX = 'preset:v1.'
export const AVATAR_PRESET_V2_PREFIX = 'preset:v2.'

export type SkinId = 's0' | 's1' | 's2' | 's3' | 's4' | 's5'
export type BodyId = 'b0' | 'b1' | 'b2'
export type SizeId = 'z0' | 'z1' | 'z2' | 'z3'
export type HairId = 'h0' | 'h1' | 'h2' | 'h3' | 'h4' | 'h5'
export type AccessoryId = 'a0' | 'a1' | 'a2' | 'a3' | 'a4'
export type OutfitId = 'o0' | 'o1' | 'o2' | 'o3'
export type ColorId = 'j0' | 'j1' | 'j2' | 'j3' | 'j4' | 'j5' | 'j6' | 'j7'

/** @deprecated v1 bust preset */
export type AvatarPresetParts = { skin: SkinId; hair: HairId; jersey: ColorId }

export type AvatarConfigV2 = {
  v: 2
  skin: SkinId
  body: BodyId
  size: SizeId
  hair: HairId
  accessory: AccessoryId
  outfit: OutfitId
  color: ColorId
  use_as_profile: boolean
}

export const skinTones: { id: SkinId; face: string; shadow: string }[] = [
  { id: 's0', face: '#FDEBD0', shadow: '#E8C9A8' },
  { id: 's1', face: '#F5D0A9', shadow: '#D4A574' },
  { id: 's2', face: '#E0AC69', shadow: '#C68642' },
  { id: 's3', face: '#C68642', shadow: '#8D5524' },
  { id: 's4', face: '#8D5524', shadow: '#5C3317' },
  { id: 's5', face: '#5C3317', shadow: '#3D2314' },
]

export const bodyTypes: { id: BodyId; label: string }[] = [
  { id: 'b0', label: 'Lean' },
  { id: 'b1', label: 'Athletic' },
  { id: 'b2', label: 'Solid' },
]

export const bodySizes: { id: SizeId; label: string }[] = [
  { id: 'z0', label: 'S' },
  { id: 'z1', label: 'M' },
  { id: 'z2', label: 'L' },
  { id: 'z3', label: 'XL' },
]

export const hairStyles: { id: HairId; label: string }[] = [
  { id: 'h0', label: 'Bald' },
  { id: 'h1', label: 'Crop' },
  { id: 'h2', label: 'Curls' },
  { id: 'h3', label: 'Waves' },
  { id: 'h4', label: 'Afro' },
  { id: 'h5', label: 'Band' },
]

export const accessories: { id: AccessoryId; label: string }[] = [
  { id: 'a0', label: 'None' },
  { id: 'a1', label: 'Cap' },
  { id: 'a2', label: 'Headband' },
  { id: 'a3', label: 'Shades' },
  { id: 'a4', label: 'Wristbands' },
]

export const outfits: { id: OutfitId; label: string }[] = [
  { id: 'o0', label: 'Jersey' },
  { id: 'o1', label: 'Tank' },
  { id: 'o2', label: 'Hoodie' },
  { id: 'o3', label: 'Polo' },
]

export const outfitColors: { id: ColorId; fill: string; trim: string }[] = [
  { id: 'j0', fill: '#16a34a', trim: '#14532d' },
  { id: 'j1', fill: '#2563eb', trim: '#1e3a8a' },
  { id: 'j2', fill: '#dc2626', trim: '#7f1d1d' },
  { id: 'j3', fill: '#ca8a04', trim: '#713f12' },
  { id: 'j4', fill: '#9333ea', trim: '#581c87' },
  { id: 'j5', fill: '#0d9488', trim: '#134e4a' },
  { id: 'j6', fill: '#ea580c', trim: '#7c2d12' },
  { id: 'j7', fill: '#171717', trim: '#404040' },
]

/** @deprecated */
export const jerseyColors = outfitColors

export function buildPresetV2Url(c: Omit<AvatarConfigV2, 'v' | 'use_as_profile'>): string {
  return `${AVATAR_PRESET_V2_PREFIX}${c.skin}.${c.body}.${c.size}.${c.hair}.${c.accessory}.${c.outfit}.${c.color}`
}

export function parsePresetV2Url(url: string | null | undefined): Omit<AvatarConfigV2, 'v' | 'use_as_profile'> | null {
  if (!url?.trim().startsWith(AVATAR_PRESET_V2_PREFIX)) return null
  const parts = url.trim().slice(AVATAR_PRESET_V2_PREFIX.length).split('.')
  if (parts.length !== 7) return null
  const [skin, body, size, hair, accessory, outfit, color] = parts
  if (!validV2Parts(skin, body, size, hair, accessory, outfit, color)) return null
  return { skin, body, size, hair, accessory, outfit, color } as Omit<AvatarConfigV2, 'v' | 'use_as_profile'>
}

function validV2Parts(...ids: string[]) {
  return (
    skinTones.some((s) => s.id === ids[0]) &&
    bodyTypes.some((b) => b.id === ids[1]) &&
    bodySizes.some((z) => z.id === ids[2]) &&
    hairStyles.some((h) => h.id === ids[3]) &&
    accessories.some((a) => a.id === ids[4]) &&
    outfits.some((o) => o.id === ids[5]) &&
    outfitColors.some((j) => j.id === ids[6])
  )
}

export function parseAvatarConfig(raw: unknown): AvatarConfigV2 | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as AvatarConfigV2
  if (o.v !== 2) return null
  if (!validV2Parts(o.skin, o.body, o.size, o.hair, o.accessory, o.outfit, o.color)) return null
  return { ...o, use_as_profile: !!o.use_as_profile }
}

export function defaultAvatarConfig(seed?: string): AvatarConfigV2 {
  const base = (seed ?? 'player').split('').reduce((n, c) => n + c.charCodeAt(0), 0)
  return {
    v: 2,
    skin: skinTones[base % skinTones.length].id,
    body: bodyTypes[(base >> 2) % bodyTypes.length].id,
    size: bodySizes[(base >> 4) % bodySizes.length].id,
    hair: hairStyles[(base >> 3) % hairStyles.length].id,
    accessory: 'a0',
    outfit: 'o0',
    color: outfitColors[(base >> 5) % outfitColors.length].id,
    use_as_profile: true,
  }
}

export function configFromUser(
  avatarUrl: string | null | undefined,
  avatarConfig: unknown,
): AvatarConfigV2 {
  const fromJson = parseAvatarConfig(avatarConfig)
  if (fromJson) return fromJson
  const v2 = parsePresetV2Url(avatarUrl)
  if (v2) return { v: 2, ...v2, use_as_profile: true }
  const v1 = parsePresetV1Url(avatarUrl)
  if (v1) {
    return {
      v: 2,
      skin: v1.skin,
      body: 'b1',
      size: 'z1',
      hair: v1.hair,
      accessory: 'a0',
      outfit: 'o0',
      color: v1.jersey,
      use_as_profile: true,
    }
  }
  return defaultAvatarConfig()
}

function parsePresetV1Url(url: string | null | undefined): { skin: SkinId; hair: HairId; jersey: ColorId } | null {
  if (!url?.trim().startsWith(AVATAR_PRESET_V1_PREFIX)) return null
  const parts = url.trim().slice(AVATAR_PRESET_V1_PREFIX.length).split('.')
  if (parts.length !== 3) return null
  const [skin, hair, jersey] = parts
  if (!skinTones.some((s) => s.id === skin)) return null
  if (!hairStyles.some((h) => h.id === hair)) return null
  if (!outfitColors.some((j) => j.id === jersey)) return null
  return { skin: skin as SkinId, hair: hair as HairId, jersey: jersey as ColorId }
}

export function isPresetAvatar(url: string | null | undefined): boolean {
  const t = url?.trim() ?? ''
  return t.startsWith(AVATAR_PRESET_V1_PREFIX) || t.startsWith(AVATAR_PRESET_V2_PREFIX)
}

export function isUploadedAvatar(url: string | null | undefined): boolean {
  const t = url?.trim()
  return !!t && !isPresetAvatar(t)
}

/** Shown on profile: photo, or preset when use_as_profile. */
export function profileShowsAvatar(user: {
  avatar_url?: string | null
  avatar_config?: unknown
}): boolean {
  if (isUploadedAvatar(user.avatar_url)) return true
  const cfg = parseAvatarConfig(user.avatar_config)
  if (cfg?.use_as_profile) return true
  return isPresetAvatar(user.avatar_url)
}

export function hasSavedAvatar(user: { avatar_url?: string | null; avatar_config?: unknown }): boolean {
  return !!parseAvatarConfig(user.avatar_config) || profileShowsAvatar(user)
}

export function avatarConfigForProfile(user: {
  avatar_url?: string | null
  avatar_config?: unknown
}): AvatarConfigV2 | null {
  const cfg = parseAvatarConfig(user.avatar_config)
  if (cfg?.use_as_profile) return cfg
  if (isPresetAvatar(user.avatar_url) && !isUploadedAvatar(user.avatar_url)) {
    return configFromUser(user.avatar_url, null)
  }
  return null
}
