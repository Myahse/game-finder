import { api } from './api'

export const usernamePattern = /^[A-Za-z0-9_.]{3,24}$/

/** Latest check wins — avoids blur races showing "taken" for an older value. */
let checkSeq = 0

/**
 * @returns `true` if taken, `false` if available or check skipped (invalid / network error).
 */
export async function isUsernameTaken(username: string, sameAs?: string): Promise<boolean> {
  const u = username.trim()
  if (!usernamePattern.test(u)) return false
  if (sameAs && u.toLowerCase() === sameAs.trim().toLowerCase()) return false
  const seq = ++checkSeq
  const r = await api<{ available: boolean }>(
    `/api/auth/username-available?username=${encodeURIComponent(u)}`,
  ).catch(() => null)
  if (seq !== checkSeq) return false
  return r ? !r.available : false
}
