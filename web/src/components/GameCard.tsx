import { Link } from 'react-router-dom'
import { formatDistance, gameTimeLabel, gameTypeLabels, skillLabels } from '../lib/format'
import type { Game } from '../lib/types'

/** SPORT + DISTANCE + PLAYER COUNT + STATUS, at a glance. */
export function GameCard({ game, showCourt = true }: { game: Game; showCourt?: boolean }) {
  const live = game.status === 'active'
  const full = game.spots_left === 0
  return (
    <Link
      to={`/games/${game.id}`}
      className="flex items-stretch gap-3 rounded-2xl border border-line bg-surface p-3 transition hover:border-ink-2"
    >
      <div
        className={`flex w-16 shrink-0 flex-col items-center justify-center rounded-xl ${
          live ? 'bg-live/15 text-live' : 'bg-surface-2 text-ink-2'
        }`}
      >
        <span className="text-2xl" aria-hidden>
          {game.sport.icon}
        </span>
        <span className="display text-2xl font-extrabold">
          {game.player_count}
          <span className="text-base opacity-60">/{game.max_players}</span>
        </span>
      </div>
      <div className="min-w-0 flex-1 py-0.5">
        <div className="flex items-center gap-2">
          {live && <span className="display rounded bg-live px-1.5 text-sm font-bold text-white">🔥 LIVE</span>}
          <p className="truncate font-semibold">
            {gameTypeLabels[game.game_type]} {game.sport.name.toLowerCase()}
          </p>
        </div>
        {showCourt && <p className="truncate text-sm text-ink-2">📍 {game.court.name}</p>}
        <p className="mt-1 flex flex-wrap gap-x-3 text-sm text-ink-2">
          <span>🕕 {gameTimeLabel(game)}</span>
          <span>⭐ {skillLabels[game.skill_level]}</span>
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end justify-between py-0.5 text-right">
        {game.distance_m != null && <span className="display text-xl font-bold">{formatDistance(game.distance_m)}</span>}
        <span className={`text-xs font-semibold ${full ? 'text-danger' : 'text-live'}`}>
          {full ? 'Full' : `${game.spots_left} spot${game.spots_left === 1 ? '' : 's'}`}
        </span>
      </div>
    </Link>
  )
}
