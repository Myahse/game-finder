import { AVATAR_PROFILE_MARKER } from './schema'
import type { PlayerAvatarConfig } from './schema'
export function parsePlayerAvatar(raw: unknown): PlayerAvatarConfig | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as PlayerAvatarConfig
  if (o.version !== 1) return null
  if (!o.bodyType || !o.skinTone) return null
  return o
}

export function playerAvatarForUser(user: {
  avatar_url?: string | null
  player_avatar?: unknown
  player_avatar_public?: unknown
}): PlayerAvatarConfig | null {
  const pub = parsePlayerAvatar(user.player_avatar_public)
  if (pub) return pub
  if (user.avatar_url === AVATAR_PROFILE_MARKER) {
    return parsePlayerAvatar(user.player_avatar)
  }
  return null
}

export function hasPlayerAvatar(user: {
  avatar_url?: string | null
  player_avatar?: unknown
}): boolean {
  return !!parsePlayerAvatar(user.player_avatar) || user.avatar_url === AVATAR_PROFILE_MARKER
}
