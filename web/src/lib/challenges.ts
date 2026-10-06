import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from './api'
import type { Court, PublicUser, Sport } from './types'

export type ChallengeStatus = 'pending' | 'accepted' | 'declined' | 'cancelled' | 'expired' | 'reported' | 'completed'

export type Challenge = {
  id: string
  sport: Sport
  format: string
  team_size: number
  challenger: PublicUser
  opponent: PublicUser | null
  court: Pick<Court, 'id' | 'name' | 'latitude' | 'longitude'>
  start_time: string
  message: string | null
  status: ChallengeStatus
  is_open: boolean
  game_id: string | null
  winner_id: string | null
  score_challenger: string | null
  score_opponent: string | null
  reported_by: string | null
  created_at: string
  players?: { user: PublicUser; side: 'challenger' | 'opponent'; status: 'invited' | 'accepted' }[]
  my_side?: 'challenger' | 'opponent' | null
  my_status?: 'invited' | 'accepted' | 'declined' | null
}

export type ChallengeList = {
  incoming: Challenge[]
  outgoing: Challenge[]
  active: Challenge[]
  history: Challenge[]
  record: { wins: number; losses: number }
}

/** Formats per sport slug (mirrors challenge_formats() on the server). */
export const CHALLENGE_FORMATS: Record<string, { id: string; teamSize: number; minutes: number }[]> = {
  basketball: [
    { id: 'bball_1v1_11', teamSize: 1, minutes: 30 },
    { id: 'bball_1v1_21', teamSize: 1, minutes: 45 },
    { id: 'bball_horse', teamSize: 1, minutes: 30 },
    { id: 'bball_3pt', teamSize: 1, minutes: 20 },
    { id: 'bball_2v2', teamSize: 2, minutes: 60 },
    { id: 'bball_3v3', teamSize: 3, minutes: 60 },
  ],
  football: [
    { id: 'foot_1v1', teamSize: 1, minutes: 30 },
    { id: 'foot_penalties', teamSize: 1, minutes: 20 },
    { id: 'foot_juggling', teamSize: 1, minutes: 15 },
    { id: 'foot_2v2', teamSize: 2, minutes: 45 },
    { id: 'foot_5v5', teamSize: 5, minutes: 60 },
  ],
  volleyball: [
    { id: 'volley_1v1', teamSize: 1, minutes: 30 },
    { id: 'volley_serve', teamSize: 1, minutes: 20 },
    { id: 'volley_2v2', teamSize: 2, minutes: 60 },
    { id: 'volley_3v3', teamSize: 3, minutes: 60 },
  ],
  tennis: [
    { id: 'tennis_tiebreak', teamSize: 1, minutes: 30 },
    { id: 'tennis_1set', teamSize: 1, minutes: 60 },
    { id: 'tennis_bo3', teamSize: 1, minutes: 120 },
    { id: 'tennis_doubles', teamSize: 2, minutes: 90 },
  ],
  badminton: [
    { id: 'badm_21', teamSize: 1, minutes: 30 },
    { id: 'badm_bo3', teamSize: 1, minutes: 60 },
    { id: 'badm_doubles', teamSize: 2, minutes: 60 },
  ],
}

export function useChallenges(enabled = true) {
  return useQuery({ queryKey: ['challenges'], queryFn: () => api<ChallengeList>('/api/challenges'), enabled })
}

export function useOpenChallenges(courtId: string) {
  return useQuery({ queryKey: ['challenges', 'court', courtId], queryFn: () => api<Challenge[]>(`/api/courts/${courtId}/challenges`) })
}

export function useHeadToHead(userId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ['challenges', 'h2h', userId],
    queryFn: () => api<{ wins: number; losses: number; played: number }>(`/api/users/${userId}/head-to-head`),
    enabled: !!userId && enabled,
  })
}

export type NewChallenge = { opponent_id?: string | null; sport_id: string; format: string; court_id: string; start_time?: string | null; message?: string }

/** All challenge mutations refresh the lists and games. */
export function useChallengeActions() {
  const qc = useQueryClient()
  const done = () => {
    void qc.invalidateQueries({ queryKey: ['challenges'] })
    void qc.invalidateQueries({ queryKey: ['my-games'] })
    void qc.invalidateQueries({ queryKey: ['progress'] })
  }
  const create = useMutation({ mutationFn: (c: NewChallenge) => api<Challenge>('/api/challenges', { method: 'POST', json: c }), onSuccess: done })
  const act = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'accept' | 'decline' | 'cancel' | 'confirm' | 'dispute' }) =>
      api<Challenge>(`/api/challenges/${id}/${action}`, { method: 'POST' }),
    onSuccess: done,
  })
  const addPlayer = useMutation({
    mutationFn: ({ id, username, side }: { id: string; username: string; side: 'challenger' | 'opponent' }) =>
      api<Challenge>(`/api/challenges/${id}/players`, { method: 'POST', json: { username, side } }),
    onSuccess: done,
  })
  const report = useMutation({
    mutationFn: ({ id, ...body }: { id: string; winner_id: string; score_challenger: string; score_opponent: string }) =>
      api<Challenge>(`/api/challenges/${id}/result`, { method: 'POST', json: body }),
    onSuccess: done,
  })
  return { create, act, report, addPlayer }
}
