import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from './api'
import { useAuth } from './auth'
import type { Coords } from './location'
import { coarse, type Coords } from './location'
import { LIST_NEARBY_RADIUS_KM, MAP_NEARBY_RADIUS_KM } from './nearby'
import type { AppNotification, Court, CourtDetail, Game, Me, Presence, PublicUser, Sport } from './types'

export const qk = {
  sports: ['sports'] as const,
  courts: (lat: number, lng: number, sport: string | null) => ['courts', lat, lng, sport] as const,
  court: (id: string) => ['court', id] as const,
  game: (id: string) => ['game', id] as const,
  gamesNearby: (lat: number, lng: number, sport: string | null) => ['games-nearby', lat, lng, sport] as const,
  myGames: ['my-games'] as const,
  presence: ['presence'] as const,
  notifications: ['notifications'] as const,
  user: (id: string) => ['user', id] as const,
  profileUsername: (username: string) => ['profile-username', username] as const,
}

const loc = (c: Coords | null) => (c ? `lat=${c.latitude}&lng=${c.longitude}` : '')

export function useSports() {
  return useQuery({ queryKey: qk.sports, queryFn: () => api<Sport[]>('/api/sports'), staleTime: 60 * 60_000 })
}

export function useCourtsNearby(center: Coords, sport: string | null, radiusKm = MAP_NEARBY_RADIUS_KM) {
  const c = coarse(center)
  return useQuery({
    queryKey: [...qk.courts(c.lat, c.lng, sport), radiusKm],
    queryFn: () =>
      api<Court[]>(
        `/api/courts/nearby?lat=${center.latitude}&lng=${center.longitude}&radius_km=${radiusKm}${sport ? `&sport=${sport}` : ''}`,
      ),
    placeholderData: (prev) => prev,
  })
}

/** Merge nearby courts for several sport slugs (deduped by id). */
export function useCourtsNearbySports(center: Coords, slugs: string[], radiusKm = MAP_NEARBY_RADIUS_KM) {
  const c = coarse(center)
  const keys = slugs.length ? slugs : [null as string | null]
  const results = useQueries({
    queries: keys.map((sport) => ({
      queryKey: [...qk.courts(c.lat, c.lng, sport), radiusKm, 'multi'],
      queryFn: () =>
        api<Court[]>(
          `/api/courts/nearby?lat=${center.latitude}&lng=${center.longitude}&radius_km=${radiusKm}${sport ? `&sport=${sport}` : ''}`,
        ),
      placeholderData: (prev: Court[] | undefined) => prev,
    })),
  })
  const merged = new Map<string, Court>()
  for (const r of results) {
    for (const court of r.data ?? []) merged.set(court.id, court)
  }
  return {
    data: [...merged.values()],
    isLoading: results.some((r) => r.isLoading),
    error: results.find((r) => r.error)?.error,
  }
}

export function useCourt(id: string | undefined, coords: Coords | null) {
  return useQuery({
    queryKey: qk.court(id ?? ''),
    queryFn: () => api<CourtDetail>(`/api/courts/${id}?${loc(coords)}`),
    enabled: !!id,
  })
}

export function useGame(id: string | undefined, coords: Coords | null) {
  return useQuery({
    queryKey: qk.game(id ?? ''),
    queryFn: () => api<Game>(`/api/games/${id}?${loc(coords)}`),
    enabled: !!id,
  })
}

export function useGamesNearby(center: Coords, sport: string | null, radiusKm = LIST_NEARBY_RADIUS_KM) {
  const c = coarse(center)
  return useQuery({
    queryKey: [...qk.gamesNearby(c.lat, c.lng, sport), radiusKm],
    queryFn: () =>
      api<Game[]>(
        `/api/games/nearby?lat=${center.latitude}&lng=${center.longitude}&radius_km=${radiusKm}${sport ? `&sport=${sport}` : ''}`,
      ),
    placeholderData: (prev) => prev,
  })
}

export function useMyGames(coords: Coords | null) {
  return useQuery({
    queryKey: qk.myGames,
    queryFn: () => api<{ current: Game[]; past: Game[] }>(`/api/me/games?${loc(coords)}`),
  })
}

export function useMyPresence(enabled = true) {
  return useQuery({ queryKey: qk.presence, queryFn: () => api<Presence | null>('/api/me/presence'), enabled })
}

export function useNotifications(enabled = true) {
  return useQuery({
    queryKey: qk.notifications,
    queryFn: () => api<{ unread: number; items: AppNotification[] }>('/api/notifications'),
    enabled,
    refetchInterval: enabled ? 90_000 : false,
  })
}

export function useUser(id: string) {
  return useQuery({ queryKey: qk.user(id), queryFn: () => api<PublicUser>(`/api/users/${id}`) })
}

function normalizeUsername(username: string) {
  return username.trim().replace(/^@/, '')
}

export function usePublicProfileByUsername(username: string, opts?: { enabled?: boolean }) {
  const u = normalizeUsername(username)
  return useQuery({
    queryKey: qk.profileUsername(u),
    enabled: (opts?.enabled ?? true) && u.length >= 3,
    queryFn: () => api<PublicUser>(`/api/profiles/${encodeURIComponent(u)}`),
    retry: 1,
  })
}

/** Share link /u/:username — public API, or /api/me when the viewer is that user. */
export function useProfileByUsername(username: string) {
  const u = normalizeUsername(username)
  const { user } = useAuth()
  const isSelf = !!user && user.username.toLowerCase() === u.toLowerCase()

  const meQ = useQuery({
    queryKey: ['me'],
    queryFn: () => api<Me>('/api/me'),
    enabled: isSelf,
  })

  const pubQ = usePublicProfileByUsername(u, { enabled: !isSelf })

  if (isSelf) {
    return {
      data: meQ.data ?? user,
      isLoading: meQ.isLoading,
      isError: meQ.isError,
      isSelf: true,
    }
  }
  return { data: pubQ.data, isLoading: pubQ.isLoading, isError: pubQ.isError, isSelf: false }
}

export function useFriends(enabled = true) {
  return useQuery({
    queryKey: ['friends'],
    queryFn: () => api<PublicUser[]>('/api/me/friends'),
    enabled,
    staleTime: 60_000,
  })
}

export type FriendRequestRow = { id: string; user: PublicUser; created_at: string }

export function useFriendRequests(enabled = true) {
  return useQuery({
    queryKey: ['friend-requests'],
    queryFn: () => api<{ incoming: FriendRequestRow[]; outgoing: FriendRequestRow[] }>('/api/me/friend-requests'),
    enabled,
    staleTime: 30_000,
  })
}

/** Join / leave / cancel share the same cache updates. */
export function useGameAction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      action,
      reason,
      coords,
    }: {
      id: string
      action: 'join' | 'leave' | 'cancel'
      reason?: string
      coords?: Coords | null
    }) =>
      api<Game>(`/api/games/${id}/${action}`, {
        method: 'POST',
        json:
          action === 'cancel'
            ? { reason }
            : action === 'join'
              ? { latitude: coords?.latitude ?? null, longitude: coords?.longitude ?? null }
              : undefined,
      }),
    onSuccess: (game) => {
      qc.setQueryData(qk.game(game.id), (old: Game | undefined) => ({ ...old, ...game }))
      qc.invalidateQueries({ queryKey: qk.court(game.court_id) })
      qc.invalidateQueries({ queryKey: qk.myGames })
      qc.invalidateQueries({ queryKey: ['games-nearby'] })
    },
  })
}

export function usePresenceAction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (
      a: { kind: 'checkin'; courtId: string; coords: Coords | null } | { kind: 'confirm' } | { kind: 'leave' },
    ) => {
      if (a.kind === 'checkin')
        return api<Presence>('/api/presence', {
          method: 'POST',
          json: { court_id: a.courtId, latitude: a.coords?.latitude ?? null, longitude: a.coords?.longitude ?? null },
        })
      if (a.kind === 'confirm') return api<Presence>('/api/presence/confirm', { method: 'POST' })
      await api('/api/presence', { method: 'DELETE' })
      return null
    },
    onSuccess: (p) => {
      qc.setQueryData(qk.presence, p)
      qc.invalidateQueries({ queryKey: ['court'] })
    },
  })
}

export function useUpdateMe() {
  return useMutation({
    mutationFn: (patch: Partial<Me> & { onboarded?: boolean; extra_sport_ids?: string[] }) =>
      api<Me>('/api/me', { method: 'PATCH', json: patch }),
  })
}
