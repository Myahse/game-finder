import { currentT } from '../i18n/LocaleProvider'
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

export function notAtCourtTitle(): string {
  return currentT().games.notAtCourtTitle
}

export function notAtCourtMessage(): string {
  return currentT().games.notAtCourtMessage
}
