// Mode Jeu data: players' attributes from the server, arenas, open online
// matches, and how a team of real players becomes a match roster.
import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import { resolveMediaUrl } from '../lib/mediaUrl'
import type { PublicUser } from '../lib/types'
import { playerAvatarForUser } from '../avatar/resolve'
import { avataaarsSvg } from '../avatar/render/avataaars'
import type { Attrs, RosterEntry } from './engine'

export interface Sources {
  elo: number; games: number; wins: number; stat_games: number
  ppg: number; rpg: number; apg: number; spg: number; bpg: number; best_points: number
  big_games: number; games_30d: number; check_ins_30d: number; mvps: number; challenges_won: number; streak_weeks: number
}
export interface GamePlayer {
  user: PublicUser
  number: number
  level: number
  attributes: Attrs
  ovr: number
  sources: Sources
}
export interface HistoryItem {
  kind: 'game'
  id: string
  at: string
  court: string
  players: number
  won: boolean | null
  mvp: boolean
  stats: Record<string, number> | null
  xp: number
}
export interface GameMe extends GamePlayer {
  before: Attrs
  progress: { xp: number; level: number; level_xp: number; next_level_xp: number; streak: { current: number; best: number } }
  history: HistoryItem[]
}
export interface Arena {
  court: { id: string; name: string; latitude: number; longitude: number; players_here: number }
  king_id: string | null
  rivals: GamePlayer[]
  friends: GamePlayer[]
  me: GamePlayer
}
export interface OpenRoom { code: string; court_id: string; host_id: string; created_at: string; players: number; started: boolean }

export const jeuKeys = {
  me: ['jeu', 'me'] as const,
  arena: (id: string) => ['jeu', 'arena', id] as const,
  players: (ids: string[]) => ['jeu', 'players', [...ids].sort().join(',')] as const,
  rooms: (court: string) => ['jeu', 'rooms', court] as const,
}

export function useJeuMe(enabled = true) {
  return useQuery({ queryKey: jeuKeys.me, queryFn: () => api<GameMe>('/api/jeu/me'), enabled, staleTime: 60_000 })
}
export function useArena(courtId: string | undefined) {
  return useQuery({ queryKey: jeuKeys.arena(courtId ?? ''), queryFn: () => api<Arena>(`/api/jeu/arenas/${courtId}`), enabled: !!courtId, staleTime: 60_000 })
}
export function useGamePlayers(ids: string[]) {
  const real = ids.filter((id) => !id.startsWith('bot-'))
  return useQuery({
    queryKey: jeuKeys.players(real),
    queryFn: () => api<GamePlayer[]>(`/api/jeu/players?ids=${real.join(',')}`),
    enabled: real.length > 0,
    staleTime: 60_000,
  })
}
export function useOpenRooms(courtId: string | undefined) {
  return useQuery({
    queryKey: jeuKeys.rooms(courtId ?? ''),
    queryFn: () => api<OpenRoom[]>(`/api/jeu/rooms${courtId ? `?court_id=${courtId}` : ''}`),
    refetchInterval: 8_000,
  })
}
/** Opens an online match the server plays: team A (led by the caller) against team B, by player id. */
export function createRoom(courtId: string, a: string[], b: string[]) {
  return api<OpenRoom>('/api/jeu/rooms', { method: 'POST', json: { court_id: courtId, a, b } })
}

export const firstName = (u: Pick<PublicUser, 'first_name' | 'username'>) => (u.first_name?.trim() || u.username || '?').split(' ')[0]

export function rosterOf(p: GamePlayer): RosterEntry {
  return { id: p.user.id, name: firstName(p.user), num: p.number, big: p.sources.rpg >= 5 || p.attributes.def + p.attributes.pen >= 150, a: p.attributes }
}

/** Stand-ins when a court or a friend list is short: average players of the court. */
export function botRoster(n: number, name: string, seed = 0): RosterEntry {
  const v = (k: number) => 52 + ((n * 7 + k * 13 + seed) % 11)
  return { id: `bot-${n}`, name: `${name} ${n}`, num: 40 + n, big: n % 3 === 2, a: { tir: v(1), pen: v(2), col: v(3), def: v(4), end: v(5), men: v(6) } }
}

/** Average of a team's overall ratings, and A's chances against B. */
export function odds(a: { a: Attrs }[], b: { a: Attrs }[]) {
  const ovr = (t: { a: Attrs }[]) => t.reduce((s, p) => s + (p.a.tir + p.a.pen + p.a.col + p.a.def + p.a.end + p.a.men) / 6, 0) / Math.max(1, t.length)
  const oa = Math.round(ovr(a)), ob = Math.round(ovr(b))
  return { oa, ob, pa: Math.max(12, Math.min(88, Math.round(50 + (oa - ob) * 3.2 + 3))) }
}

const heads = new Map<string, HTMLImageElement | null>()
/** A player's head for the canvas: their avatar, else their uploaded photo, else none. */
export function headImage(user: PublicUser | null | undefined): HTMLImageElement | null {
  if (!user) return null
  const key = user.id + (user.avatar_url ?? '') + JSON.stringify(user.player_avatar_public ?? user.player_avatar ?? null)
  if (heads.has(key)) return heads.get(key)!
  let src = ''
  const cfg = playerAvatarForUser(user)
  if (cfg) src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(avataaarsSvg(cfg))
  else if (user.avatar_url && /^(https?:|\/)/.test(user.avatar_url)) src = resolveMediaUrl(user.avatar_url)
  if (!src) { heads.set(key, null); return null }
  const img = new Image()
  img.decoding = 'async'
  img.src = src
  heads.set(key, img)
  return img
}
