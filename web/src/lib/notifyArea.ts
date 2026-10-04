import { api, ApiError } from './api'
import { DEFAULT_CENTER, type Coords } from './location'

function distM(a: Coords, b: Coords): number {
  const r = 6_371_000
  const φ1 = (a.latitude * Math.PI) / 180
  const φ2 = (b.latitude * Math.PI) / 180
  const Δφ = ((b.latitude - a.latitude) * Math.PI) / 180
  const Δλ = ((b.longitude - a.longitude) * Math.PI) / 180
  const x =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2)
  return 2 * r * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x))
}

export type NotifyAreaState = { lastSent: Coords | null; lastAttemptMs: number }

/** Sync coarse alert zone when the user moves meaningfully (same rules as mobile). */
/** Register alert zone; falls back to app default center when GPS is unavailable. */
export async function syncNotifyArea(
  coords: Coords | null,
  state: NotifyAreaState,
): Promise<NotifyAreaState> {
  const point = coords ?? DEFAULT_CENTER
  if (state.lastSent && distM(state.lastSent, point) < 1500) return state
  const now = Date.now()
  if (state.lastAttemptMs && now - state.lastAttemptMs < 120_000) return state
  try {
    await api('/api/me/notify-area', { method: 'POST', json: point })
    return { lastSent: point, lastAttemptMs: now }
  } catch (e) {
    if (e instanceof ApiError && (e.code === 'notify_rate_limited' || e.code === 'notify_jump_too_far')) {
      return { ...state, lastAttemptMs: now }
    }
    throw e
  }
}
