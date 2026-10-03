const PREFIX = 'ftg_platform_intro_v1_'
const GUEST_KEY = 'ftg_guest_intro_v1'

export function guestIntroSeen(): boolean {
  try {
    return localStorage.getItem(GUEST_KEY) === '1'
  } catch {
    return false
  }
}

export function markGuestIntroSeen() {
  try {
    localStorage.setItem(GUEST_KEY, '1')
  } catch {
    // ignore
  }
}

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
