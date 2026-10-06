import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from './api'
import type { PublicUser } from './types'

export type ScoreTeam = { id?: string; position?: number; name: string; color: string; score: number; players: string[] }

export type Scoreboard = {
  game_id: string
  stat_keys: string[]
  teams: ScoreTeam[]
  stats: Record<string, Record<string, number>>
  winner_position: number | null
  mvp_user_id: string | null
  updated_at: string | null
  updated_by: PublicUser | null
}

export type ScoreboardInput = Pick<Scoreboard, 'teams' | 'stats' | 'mvp_user_id'>

export const TEAM_COLORS = ['#ff5a1f', '#1f6fff', '#16a34a', '#eab308', '#9333ea', '#12151a', '#e11d48', '#0891b2']

export const scoreboardKey = (gameId: string) => ['scoreboard', gameId] as const

export function useScoreboard(gameId: string) {
  return useQuery({ queryKey: scoreboardKey(gameId), queryFn: () => api<Scoreboard>(`/api/games/${gameId}/scoreboard`) })
}

export function useSaveScoreboard(gameId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: ScoreboardInput) => api<Scoreboard>(`/api/games/${gameId}/scoreboard`, { method: 'PUT', json: input }),
    onSuccess: (sb) => {
      qc.setQueryData(scoreboardKey(gameId), sb)
      void qc.invalidateQueries({ queryKey: ['leaderboard'] })
    },
  })
}

export function hasResult(sb: Scoreboard | undefined): boolean {
  if (!sb) return false
  return sb.teams.some((t) => t.score > 0) || Object.keys(sb.stats).length > 0 || !!sb.mvp_user_id
}

/** Players sorted by the headline stat (points / goals), best first. */
export function topPerformers(sb: Scoreboard, limit = 3): { userId: string; value: number }[] {
  const key = sb.stat_keys[0]
  return Object.entries(sb.stats)
    .map(([userId, s]) => ({ userId, value: s[key] ?? 0 }))
    .filter((p) => p.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, limit)
}

/** Fisher–Yates split of players into `n` balanced teams. */
export function splitTeams(players: string[], n: number): string[][] {
  const a = [...players]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  const teams: string[][] = Array.from({ length: n }, () => [])
  a.forEach((p, i) => teams[i % n].push(p))
  return teams
}
