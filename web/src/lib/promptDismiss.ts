const DISMISS_MS = 7 * 24 * 60 * 60 * 1000

export function promptDismissed(key: string): boolean {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return false
    return Date.now() - Number(raw) < DISMISS_MS
  } catch {
    return false
  }
}

export function dismissPromptLater(key: string) {
  try {
    localStorage.setItem(key, String(Date.now()))
  } catch {
    // ignore
  }
}

export const PROMPT_KEYS = {
  notifications: 'ftg_prompt_notifications',
  install: 'ftg_prompt_install',
} as const

export function isStandalonePwa(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

export function isIos(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}
