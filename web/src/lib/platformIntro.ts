const PREFIX = 'ftg_platform_intro_v1_'

export function platformIntroSeen(userId: string): boolean {
  try {
    return localStorage.getItem(PREFIX + userId) === '1'
  } catch {
    return false
  }
}

export function markPlatformIntroSeen(userId: string) {
  try {
    localStorage.setItem(PREFIX + userId, '1')
  } catch {
    // ignore
  }
}
