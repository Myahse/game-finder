import { ImageOff, Star } from 'lucide-react'
import { Link } from 'react-router-dom'
import { DistanceText, Flame, SportIcon, TimeText } from './icons'
import {
  formatDistance,
  gameHasOpenSpots,
  gamePlayerCountLabel,
  gameTimeLabel,
  gameTypeLabels,
  isUnlimitedMaxPlayers,
  playerDisplayLabel,
  skillLabels,
} from '../lib/format'
import { courtPhotoUrl } from '../lib/mediaUrl'
import type { Game } from '../lib/types'

export type GameScheduleAccent = 'upcoming'

/** SPORT + DISTANCE + PLAYER COUNT + STATUS, at a glance. */
export function GameCard({
  game,
  showCourt = true,
  variant = 'list',
  showHost = false,
  viewerIsAdmin = false,
  scheduleAccent,
  className = '',
}: {
  game: Game
  showCourt?: boolean
  variant?: 'list' | 'map'
  /** Show host as @username (map / public game discovery). */
  showHost?: boolean
  viewerIsAdmin?: boolean
  /** Play list: games starting later this week (blue accent). */
  scheduleAccent?: GameScheduleAccent
  className?: string
}) {
  const live = game.status === 'active'
  const upcoming = !live && scheduleAccent === 'upcoming'
  const full = !gameHasOpenSpots(game)
  const photo = courtPhotoUrl(game.court.photos ?? [])
  const mapLayout = variant === 'map'
  const hostLine = (showHost || mapLayout) && game.creator?.username

  return (
    <Link
      to={`/games/${game.id}`}
      className={`flex items-stretch gap-3 rounded-2xl border p-3 shadow-md transition ${mapLayout ? 'flex-col sm:flex-row' : ''} ${
        upcoming
          ? 'border-upcoming/35 bg-upcoming/5 hover:border-upcoming/55'
          : 'border-line bg-surface hover:border-ink-2'
      } ${className}`}
    >
      {mapLayout ? (
        <div className="relative h-28 w-full shrink-0 overflow-hidden rounded-xl bg-surface-2 sm:h-auto sm:w-24 sm:min-h-[5.5rem]">
          {photo ? (
            <img src={photo} alt="" className="size-full object-cover" />
          ) : (
            <div className="flex size-full flex-col items-center justify-center gap-1 text-ink-2">
              <ImageOff className="size-6" aria-hidden />
              <SportIcon slug={game.sport.slug} className="size-6" />
            </div>
          )}
          {live && (
            <span className="display absolute left-2 top-2 inline-flex items-center gap-1 rounded bg-live px-1.5 py-0.5 text-xs font-bold text-white">
              <Flame className="size-3 shrink-0" aria-hidden />
              LIVE
            </span>
          )}
          <span className="display absolute bottom-2 right-2 rounded-lg bg-black/55 px-2 py-0.5 text-lg font-extrabold text-white">
            {gamePlayerCountLabel(game.player_count, game.max_players)}
          </span>
        </div>
      ) : (
        <div
          className={`flex w-16 shrink-0 flex-col items-center justify-center rounded-xl ${
            live ? 'bg-live/15 text-live' : upcoming ? 'bg-upcoming/15 text-upcoming' : 'bg-surface-2 text-ink-2'
          }`}
        >
          <SportIcon slug={game.sport.slug} className="size-8" />
          <span className="display text-2xl font-extrabold">{gamePlayerCountLabel(game.player_count, game.max_players)}</span>
        </div>
      )}
      <div className="min-w-0 flex-1 py-0.5">
        <div className="flex items-center gap-2">
          {live && !mapLayout && (
            <span className="display inline-flex items-center gap-1 rounded bg-live px-1.5 py-0.5 text-sm font-bold text-white">
              <Flame className="size-3.5 shrink-0" aria-hidden />
              LIVE
            </span>
          )}
          {upcoming && !mapLayout && (
            <span className="display inline-flex rounded bg-upcoming px-1.5 py-0.5 text-sm font-bold text-white">
              UPCOMING
            </span>
          )}
          <p className="truncate font-semibold">
            {gameTypeLabels[game.game_type]} {game.sport.name.toLowerCase()}
          </p>
        </div>
        {showCourt && (
          <p className="truncate text-sm text-ink-2">
            <DistanceText>{game.court.name}</DistanceText>
          </p>
        )}
        {hostLine ? (
          <p className="truncate text-sm font-medium text-ink-2">{playerDisplayLabel(game.creator!, viewerIsAdmin)}</p>
        ) : null}
        <p className="mt-1 flex min-w-0 flex-wrap gap-x-3 gap-y-0.5 text-sm text-ink-2">
          <TimeText className="truncate">{gameTimeLabel(game)}</TimeText>
          <span className="inline-flex items-center gap-1">
            <Star className="size-4 shrink-0" aria-hidden />
            {skillLabels[game.skill_level]}
          </span>
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end justify-between py-0.5 text-right">
        {game.distance_m != null && <span className="display text-xl font-bold">{formatDistance(game.distance_m)}</span>}
        <span
          className={`text-xs font-semibold ${full ? 'text-danger' : live ? 'text-live' : upcoming ? 'text-upcoming' : 'text-live'}`}
        >
          {full ? 'Full' : isUnlimitedMaxPlayers(game.max_players) ? 'Open' : `${game.spots_left} spot${game.spots_left === 1 ? '' : 's'}`}
        </span>
      </div>
    </Link>
  )
}
