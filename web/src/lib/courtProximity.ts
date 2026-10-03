import { distanceM } from './format'
import type { Coords } from './location'

/** Matches backend default `presence_max_distance_m`. */
export const COURT_AT_RADIUS_M = 500

export function isAtCourt(
  me: Coords | null | undefined,
  court: { latitude: number; longitude: number },
  maxM = COURT_AT_RADIUS_M,
): boolean {
  if (!me) return false
  return distanceM(me.latitude, me.longitude, court.latitude, court.longitude) <= maxM
}

export const NOT_AT_COURT_TITLE = "You're not at the court"
export const NOT_AT_COURT_MESSAGE =
  'Turn on location and move within about 500 m of the court to check in or join a live game. You can still join scheduled games from anywhere.'
