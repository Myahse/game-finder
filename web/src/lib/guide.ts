/** First-time screen tips: shown once per screen, per player, on this device. */
export type GuideScreen = 'avatar' | 'map' | 'play' | 'game' | 'challenges' | 'profile'

const PREFIX = 'ftg_guide_v1_'
/** Players who joined before this long ago already know the app — no tips. */
const NEW_PLAYER_MS = 30 * 24 * 60 * 60 * 1000

export function isNewPlayer(createdAt: string | undefined, now = Date.now()): boolean {
  if (!createdAt) return false
  const t = Date.parse(createdAt)
  return Number.isFinite(t) && now - t < NEW_PLAYER_MS
}

export function guideSeen(userId: string, screen: GuideScreen): boolean {
  try {
    return localStorage.getItem(`${PREFIX}${userId}_off`) === '1' || localStorage.getItem(`${PREFIX}${userId}_${screen}`) === '1'
  } catch {
    return true
  }
}

export function markGuideSeen(userId: string, screen: GuideScreen) {
  try {
    localStorage.setItem(`${PREFIX}${userId}_${screen}`, '1')
  } catch {
    // ignore
  }
}

/** "Skip tips": no more tips on any screen. */
export function turnOffGuide(userId: string) {
  try {
    localStorage.setItem(`${PREFIX}${userId}_off`, '1')
  } catch {
    // ignore
  }
}
