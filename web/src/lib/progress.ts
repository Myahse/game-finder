import { useQuery } from '@tanstack/react-query'
import { api, getSession } from './api'
import type { Sport } from './types'

export type Badge = { id: string; goal: number; have: number; earned_at: string | null }

export type Progress = {
  xp: number
  level: number
  level_xp: number
  next_level_xp: number
  stats: Record<string, number>
  streak: { current: number; best: number; active_this_week: boolean; week_ends_at: string }
  ratings: { sport: Sport; rating: number; games: number }[]
  badges: Badge[]
  crowns: { court_id: string; court_name: string }[]
  new_badges?: string[]
}

export type King = { user_id: string; court_id: string; court_name: string }

export function useMyProgress() {
  return useQuery({ queryKey: ['progress', 'me'], queryFn: () => api<Progress>('/api/me/progress') })
}

export function useUserProgress(userId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ['progress', userId],
    queryFn: () => api<Progress>(`/api/users/${userId}/progress`),
    enabled: !!userId && enabled,
  })
}

/** This week's Kings of the Court — shared by every avatar on screen. */
export function useKings() {
  return useQuery({
    queryKey: ['kings'],
    queryFn: () => api<King[]>('/api/kings'),
    enabled: !!getSession(),
    staleTime: 10 * 60_000,
  })
}

/** Title index for a level: Rookie, Starter, Hooper, Pro, All-Star, Legend. */
export function levelTier(level: number): number {
  if (level >= 15) return 5
  if (level >= 11) return 4
  if (level >= 8) return 3
  if (level >= 5) return 2
  if (level >= 3) return 1
  return 0
}

export const TIER_COLORS = ['#8a94a6', '#16a34a', '#1f6fff', '#9333ea', '#e11d48', '#f5b301']

/** Badge art: an emoji on a coloured medal. */
export const BADGE_ART: Record<string, { emoji: string; color: string }> = {
  first_game: { emoji: '👟', color: '#16a34a' },
  games_10: { emoji: '🔟', color: '#0891b2' },
  games_50: { emoji: '💪', color: '#1f6fff' },
  games_100: { emoji: '💯', color: '#9333ea' },
  first_win: { emoji: '🏅', color: '#f5b301' },
  wins_10: { emoji: '🏆', color: '#eab308' },
  first_mvp: { emoji: '⭐', color: '#f59e0b' },
  mvp_5: { emoji: '🌟', color: '#e11d48' },
  host_5: { emoji: '📣', color: '#ff5a1f' },
  courts_5: { emoji: '🧭', color: '#0d9488' },
  early_bird: { emoji: '🌅', color: '#fb923c' },
  night_owl: { emoji: '🦉', color: '#4338ca' },
  rain_player: { emoji: '🌧️', color: '#0284c7' },
  streak_4: { emoji: '🔥', color: '#ea580c' },
  king: { emoji: '👑', color: '#ca8a04' },
  social_10: { emoji: '🤝', color: '#db2777' },
  duelist: { emoji: '⚔️', color: '#dc2626' },
  gunslinger: { emoji: '🎯', color: '#7c2d12' },
}

/** Recently earned (last 3 days) — highlighted as "new". */
export function isNewBadge(b: Badge, now = Date.now()) {
  return !!b.earned_at && now - Date.parse(b.earned_at) < 3 * 24 * 3600_000
}

/**
 * Balanced split: players sorted by rating (with a little noise so re-shuffles differ),
 * each one goes to the team with the lowest total so far.
 */
export function balancedTeams(players: string[], ratings: Record<string, number>, n: number): string[][] {
  const noisy = players.map((id) => ({ id, r: (ratings[id] ?? 1000) + (Math.random() - 0.5) * 60 })).sort((a, b) => b.r - a.r)
  const teams = Array.from({ length: n }, () => ({ ids: [] as string[], total: 0 }))
  for (const p of noisy) {
    const t = teams.reduce((best, x) => (x.ids.length < best.ids.length || (x.ids.length === best.ids.length && x.total < best.total) ? x : best))
    t.ids.push(p.id)
    t.total += ratings[p.id] ?? 1000
  }
  return teams.map((t) => t.ids)
}
