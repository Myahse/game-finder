// Hand-off between the arena and the match screen (kept in memory: a reload
// sends the player back to the arena, where the teams are picked again).
import type { RosterEntry, Sport } from './engine'
import type { PublicUser } from '../lib/types'

export interface PendingMatch {
  mode: 'solo' | 'host'
  sport: Sport
  code?: string
  court: { id: string; name: string }
  teams: [RosterEntry[], RosterEntry[]]
  /** Real users behind roster ids (for heads and the summary's challenge). */
  users: Record<string, PublicUser>
}

let pending: PendingMatch | null = null
export const setPendingMatch = (m: PendingMatch | null) => { pending = m }
export const pendingMatch = () => pending
