import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from './api'
import type { Challenge } from './challenges'
import { getSession } from './api'
import { qk } from './queries'
import type { Court, Game, PublicUser, Sport } from './types'

export type CourtMoveReason = 'rain' | 'other'

/** A game/challenge I'm in was moved to another court and I haven't seen it yet. */
export type CourtChange = {
  id: string
  game_id: string | null
  challenge_id: string | null
  reason: CourtMoveReason | null
  created_at: string
  changed_by: PublicUser | null
  from_court: Pick<Court, 'id' | 'name'> | null
  to_court: Pick<Court, 'id' | 'name' | 'address' | 'latitude' | 'longitude'>
  sport: Sport | null
  start_time: string | null
}

const KEY = ['court-changes'] as const

export function useCourtChanges(enabled: boolean) {
  return useQuery({
    queryKey: KEY,
    queryFn: () => api<CourtChange[]>('/api/me/court-changes'),
    enabled: enabled && !!getSession(),
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    retry: 0,
  })
}

export function useAckCourtChange() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api<void>(`/api/me/court-changes/${id}/seen`, { method: 'POST' }),
    onMutate: (id) => qc.setQueryData<CourtChange[]>(KEY, (old) => old?.filter((c) => c.id !== id)),
    onSettled: () => void qc.invalidateQueries({ queryKey: KEY }),
  })
}

/** Move a game (host) or a challenge (challenger) to another court. */
export function useMoveCourt() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ kind, id, court_id, reason }: { kind: 'game' | 'challenge'; id: string; court_id: string; reason: CourtMoveReason }) =>
      api<Game | Challenge>(`/api/${kind === 'game' ? 'games' : 'challenges'}/${id}/court`, { method: 'POST', json: { court_id, reason } }),
    onSuccess: (res, v) => {
      if (v.kind === 'game') qc.setQueryData(qk.game(v.id), (old: Game | undefined) => ({ ...old, ...(res as Game) }))
      void qc.invalidateQueries({ queryKey: ['game'] })
      void qc.invalidateQueries({ queryKey: ['challenges'] })
      void qc.invalidateQueries({ queryKey: qk.myGames })
    },
  })
}
