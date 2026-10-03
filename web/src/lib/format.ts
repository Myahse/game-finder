import type { Activity, Game, GameType, PublicUser, ReportType, SkillLevel } from './types'

/** Public-facing label for a player (map, game lists) — username only. */
export function playerUsernameLabel(user: Pick<PublicUser, 'username'>): string {
  return `@${user.username}`
}

export function playerFullName(user: Pick<PublicUser, 'first_name' | 'last_name'>): string {
  return `${user.first_name} ${user.last_name}`.trim()
}

/** Members see @username; admins also see legal name. */
export function playerDisplayLabel(
  user: Pick<PublicUser, 'username' | 'first_name' | 'last_name'>,
  viewerIsAdmin = false,
): string {
  if (!viewerIsAdmin) return playerUsernameLabel(user)
  const name = playerFullName(user)
  return name ? `${name} (${playerUsernameLabel(user)})` : playerUsernameLabel(user)
}

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

export const activityMeta: Record<Activity, { label: string; tone: string }> = {
  active: { label: 'GAME ACTIVE', tone: 'live' },
  players: { label: 'PLAYERS PRESENT', tone: 'players' },
  inactive: { label: 'INACTIVE', tone: 'idle' },
}

export const skillLabels: Record<SkillLevel, string> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
  all_levels: 'All levels',
}

/** Skill options for a player profile (not game hosting). */
export const playerSkillLevels: SkillLevel[] = ['beginner', 'intermediate', 'advanced']

/** Slider UI: 2–30 capped, 31 = unlimited (API `max_players` 0). */
export const MAX_PLAYERS_SLIDER_MIN = 2
export const MAX_PLAYERS_SLIDER_CAP = 30
export const MAX_PLAYERS_SLIDER_UNLIMITED = 31
export const MAX_PLAYERS_API_UNLIMITED = 0

export function isUnlimitedMaxPlayers(max: number): boolean {
  return max === MAX_PLAYERS_API_UNLIMITED
}

export function maxPlayersSliderToApi(slider: number): number {
  return slider >= MAX_PLAYERS_SLIDER_UNLIMITED ? MAX_PLAYERS_API_UNLIMITED : slider
}

export function maxPlayersApiToSlider(api: number): number {
  return isUnlimitedMaxPlayers(api) ? MAX_PLAYERS_SLIDER_UNLIMITED : api
}

export function maxPlayersSliderLabel(slider: number): string {
  return slider >= MAX_PLAYERS_SLIDER_UNLIMITED ? 'Unlimited' : String(slider)
}

export function gamePlayerCountLabel(playerCount: number, maxPlayers: number): string {
  if (isUnlimitedMaxPlayers(maxPlayers)) return `${playerCount}/∞`
  return `${playerCount}/${maxPlayers}`
}

export function gameHasOpenSpots(game: { max_players: number; spots_left: number | null }): boolean {
  if (isUnlimitedMaxPlayers(game.max_players)) return true
  return (game.spots_left ?? 0) > 0
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
