import { useQuery } from '@tanstack/react-query'
import { api } from './api'
import type { PublicUser, Sport } from './types'

export type CardTier = 'bronze' | 'argent' | 'or' | 'feu'
export type CardStyle = 'card' | 'poster' | 'scoreboard' | 'pass'

export const CARD_STYLES: CardStyle[] = ['card', 'poster', 'scoreboard', 'pass']

/** Frame colour per tier (from the sport's Elo: < 1200, < 1400, < 1600, above). */
export const TIER_COLORS: Record<CardTier, string> = {
  bronze: '#cd7f4b',
  argent: '#c9ced6',
  or: '#f2b632',
  feu: '#ff5a1f',
}

export type PlayerCard = {
  user: PublicUser
  serial: number
  sport: Sport | null
  sports: Sport[]
  elo: number
  elo_delta_30d: number
  rated_games: number
  rating: number
  tier: CardTier
  level: number
  games: number
  wins: number
  losses: number
  win_pct: number
  win_streak: number
  challenges_won: number
  challenges_lost: number
  courts: number
  badges: number
  mvps: number
  points_total: number
  points_per_game: number
  best_points: number
  home_court: { id: string; name: string } | null
  king_of: { id: string; name: string } | null
}

/** A player's card for one sport (null = their main sport). `userId` may be "me". */
export function usePlayerCard(userId: string, sport: string | null) {
  return useQuery({
    queryKey: ['card', userId, sport],
    queryFn: () => api<PlayerCard>(`/api/users/${userId}/card${sport ? `?sport=${encodeURIComponent(sport)}` : ''}`),
  })
}

export function tierColor(tier: string | null | undefined): string {
  return TIER_COLORS[tier as CardTier] ?? TIER_COLORS.bronze
}

/** Sign-up number, at least 4 digits: 42 → "0042". */
export function formatSerial(n: number): string {
  return String(Math.max(0, Math.floor(n || 0))).padStart(4, '0')
}

/** Elo change with its sign: "+64", "−12", "±0". */
export function formatEloDelta(d: number): string {
  const n = Math.round(d || 0)
  if (n > 0) return `+${n}`
  if (n < 0) return `−${-n}`
  return '±0'
}

/** The name printed on the card: legal name when allowed, else the username. */
export function cardNameLines(user: Pick<PublicUser, 'username' | 'first_name' | 'last_name'>, legalName: boolean): string[] {
  const first = user.first_name?.trim() ?? ''
  const last = user.last_name?.trim() ?? ''
  if (legalName && (first || last)) return [first, last].filter(Boolean).map((s) => s.toUpperCase())
  return [user.username.toUpperCase()]
}
