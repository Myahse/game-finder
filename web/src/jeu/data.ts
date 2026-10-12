// Mode Jeu data: players' attributes from the server, arenas, open online
// matches, and how a team of real players becomes a match roster.
import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import { resolveMediaUrl } from '../lib/mediaUrl'
import type { PublicUser } from '../lib/types'
import { playerAvatarForUser } from '../avatar/resolve'
import { avataaarsSvg } from '../avatar/render/avataaars'
import type { Attrs, RosterEntry, Sport } from './engine'

/** The real games behind the attributes: s1…s5 are the averages of the sport's stat keys. */
export interface Sources {
  keys: string[]
  elo: number; games: number; wins: number; stat_games: number
  s1: number; s2: number; s3: number; s4: number; s5: number; best: number
  big_games: number; games_30d: number; check_ins_30d: number; mvps: number; challenges_won: number; streak_weeks: number
}
export interface GameXp {
  total: number; week: number; cap: number; wins: number; matches: number; week_ends_at: string
  avatar_xp: number; avatar_level: number
  badges: { id: string; earned_at: string }[]
}
/** Team sizes each sport plays in Mode Jeu, the default first. */
export const SIZES: Record<Sport, number[]> = { basketball: [3, 2, 1], football: [3, 2, 1], volleyball: [3, 2], tennis: [1, 2], badminton: [1, 2] }
export interface GamePlayer {
  sport: Sport
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
  stat_keys: string[]
  xp: number
}
export interface GameMe extends GamePlayer {
  before: Attrs
  progress: { xp: number; level: number; level_xp: number; next_level_xp: number; streak: { current: number; best: number } }
  game: GameXp
  played_sports: Sport[]
  history: HistoryItem[]
}
export interface Arena {
  sport: Sport
  court: { id: string; name: string; latitude: number; longitude: number; players_here: number; sports: Sport[] }
  king_id: string | null
  rivals: GamePlayer[]
  friends: GamePlayer[]
  me: GamePlayer
}
export interface OpenRoom { code: string; court_id: string; host_id: string; created_at: string; players: number; started: boolean; sport: Sport; size: number; filled: number }
export interface AwardResult extends GameXp { xp: number; raw: number; capped?: boolean; duplicate?: boolean; new_badges?: string[] }

export const jeuKeys = {
  me: (sport: Sport) => ['jeu', 'me', sport] as const,
  arena: (id: string, sport: Sport) => ['jeu', 'arena', id, sport] as const,
  players: (ids: string[], sport: Sport) => ['jeu', 'players', sport, [...ids].sort().join(',')] as const,
  rooms: (court: string) => ['jeu', 'rooms', court] as const,
}

export function useJeuMe(enabled = true, sport: Sport = 'basketball') {
  return useQuery({ queryKey: jeuKeys.me(sport), queryFn: () => api<GameMe>(`/api/jeu/me?sport=${sport}`), enabled, staleTime: 60_000 })
}
export function useArena(courtId: string | undefined, sport: Sport = 'basketball') {
  return useQuery({ queryKey: jeuKeys.arena(courtId ?? '', sport), queryFn: () => api<Arena>(`/api/jeu/arenas/${courtId}?sport=${sport}`), enabled: !!courtId, staleTime: 60_000 })
}
export function useGamePlayers(ids: string[], sport: Sport = 'basketball') {
  const real = ids.filter((id) => !id.startsWith('bot-'))
  return useQuery({
    queryKey: jeuKeys.players(real, sport),
    queryFn: () => api<GamePlayer[]>(`/api/jeu/players?sport=${sport}&ids=${real.join(',')}`),
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
/** Opens an online match between real players: {size} against {size}, the caller in the first spot. */
export function createRoom(courtId: string, sport: Sport, size: number) {
  return api<OpenRoom>('/api/jeu/rooms', { method: 'POST', json: { court_id: courtId, sport, size } })
}
/** Records a simulated match: the server gives the avatar XP (weekly limit) and badges. */
export function postResult(sport: Sport, won: boolean, mvp: boolean, stats: Record<string, number>) {
  return api<AwardResult>('/api/jeu/results', { method: 'POST', json: { sport, won, mvp, stats } })
}
/** The stats a result sends, in the server's names. */
export function resultStats(sport: Sport, st: { pts: number; tpm: number }): Record<string, number> {
  if (sport === 'football') return { goals: st.pts }
  if (sport === 'basketball') return { pts: st.pts, tpm: st.tpm }
  if (sport === 'badminton') return { pts: st.pts, smashes: st.tpm }
  return { pts: st.pts, aces: st.tpm }
}

export const firstName = (u: Pick<PublicUser, 'first_name' | 'username'>) => (u.first_name?.trim() || u.username || '?').split(' ')[0]

export function rosterOf(p: GamePlayer): RosterEntry {
  return { id: p.user.id, name: firstName(p.user), num: p.number, big: p.attributes.def + p.attributes.pen >= 150, a: p.attributes }
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
