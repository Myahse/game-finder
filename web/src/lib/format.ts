import type { Activity, Game, GameType, ReportType, SkillLevel } from './types'

export function formatDistance(m: number | null | undefined): string {
  if (m == null) return ''
  if (m < 1000) return `${Math.max(10, Math.round(m / 10) * 10)} m`
  return `${(m / 1000).toFixed(m < 10_000 ? 1 : 0)} km`
}

export function distanceM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const rad = (d: number) => (d * Math.PI) / 180
  const a =
    Math.sin(rad(lat2 - lat1) / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lng2 - lng1) / 2) ** 2
  return 2 * 6371000 * Math.asin(Math.sqrt(a))
}

export function timeAgo(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return 'No recent activity'
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000))
  if (s < 60) return 'just now'
  const m = Math.round(s / 60)
  if (m < 60) return `${m} minute${m === 1 ? '' : 's'} ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h} hour${h === 1 ? '' : 's'} ago`
  const d = Math.round(h / 24)
  return `${d} day${d === 1 ? '' : 's'} ago`
}

export function clock(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export function dayAndClock(iso: string): string {
  const d = new Date(iso)
  const today = new Date()
  const tomorrow = new Date(today.getTime() + 86_400_000)
  const day =
    d.toDateString() === today.toDateString()
      ? 'Today'
      : d.toDateString() === tomorrow.toDateString()
        ? 'Tomorrow'
        : d.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' })
  return `${day} ${clock(iso)}`
}

export function gameTimeLabel(g: Pick<Game, 'status' | 'start_time'>): string {
  return g.status === 'active' ? `Started ${clock(g.start_time)}` : dayAndClock(g.start_time)
}

export const activityMeta: Record<Activity, { label: string; emoji: string; tone: string }> = {
  active: { label: 'GAME ACTIVE', emoji: '🔥', tone: 'live' },
  players: { label: 'PLAYERS PRESENT', emoji: '🟡', tone: 'players' },
  inactive: { label: 'INACTIVE', emoji: '⚪', tone: 'idle' },
}

export const skillLabels: Record<SkillLevel, string> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
  all_levels: 'All levels',
}

export const gameTypeLabels: Record<GameType, string> = {
  pickup: 'Pickup',
  training: 'Training',
  match: 'Match',
  tournament: 'Tournament',
}

export const reportLabels: Record<ReportType, string> = {
  not_exist: "Court doesn't exist",
  wrong_location: 'Wrong location',
  closed: 'Closed',
  wrong_info: 'Wrong information',
  unsafe: 'Unsafe',
  duplicate: 'Duplicate',
  other: 'Other',
}

/** Directions in the native maps app where possible. */
export function directionsUrl(lat: number, lng: number): string {
  const isApple = /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent) && 'ontouchend' in document
  return isApple
    ? `https://maps.apple.com/?daddr=${lat},${lng}&dirflg=d`
    : `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`
}
