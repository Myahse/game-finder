import { isUnlimitedMaxPlayers } from './format'
import type { Game } from './types'

function openSpotsSortKey(g: Game): number {
  if (isUnlimitedMaxPlayers(g.max_players)) return Number.MAX_SAFE_INTEGER
  return g.spots_left ?? 0
}

/**
 * "I want to play" ordering: closest first, then the liveliest game,
 * then the one with most room. Distances are bucketed (250 m) so a game
 * 20 m further away but with 6 more players still wins.
 */
export function sortPlayable(games: Game[]): Game[] {
  const bucket = (m: number | null) => (m == null ? Number.MAX_SAFE_INTEGER : Math.floor(m / 250))
  return games
    .filter((g) => g.status === 'active' || g.status === 'scheduled')
    .slice()
    .sort(
      (a, b) =>
        bucket(a.distance_m) - bucket(b.distance_m) ||
        Number(b.status === 'active') - Number(a.status === 'active') ||
        b.player_count - a.player_count ||
        openSpotsSortKey(b) - openSpotsSortKey(a),
    )
}
