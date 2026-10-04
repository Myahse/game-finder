import { Star } from 'lucide-react'
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
      className={`flex items-stretch rounded-2xl border shadow-md transition ${
        mapLayout ? 'flex-row gap-2 p-2' : 'gap-3 p-3'
      } ${
        upcoming
          ? 'border-upcoming/35 bg-upcoming/5 hover:border-upcoming/55'
          : 'border-line bg-surface hover:border-ink-2'
      } ${className}`}
    >
      {mapLayout ? (
        <div className="relative size-[3.75rem] shrink-0 overflow-hidden rounded-lg bg-surface-2">
          {photo ? (
            <img src={photo} alt="" className="size-full object-cover" />
          ) : (
            <div className="flex size-full flex-col items-center justify-center text-ink-2">
              <SportIcon slug={game.sport.slug} className="size-5" />
            </div>
          )}
          {live && (
            <span className="display absolute left-0.5 top-0.5 rounded bg-live px-1 py-px text-[9px] font-bold leading-none text-white">
              LIVE
            </span>
          )}
          {upcoming && (
            <span className="display absolute left-0.5 top-0.5 rounded bg-upcoming px-1 py-px text-[9px] font-bold leading-none text-white">
              LATER
            </span>
          )}
          <span className="display absolute inset-x-0 bottom-0 bg-black/60 py-px text-center text-[10px] font-extrabold leading-tight text-white">
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
      <div className={`min-w-0 flex-1 ${mapLayout ? 'py-0' : 'py-0.5'}`}>
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
          <p className={`truncate font-semibold ${mapLayout ? 'text-sm leading-tight' : ''}`}>
            {mapLayout ? game.sport.name : `${gameTypeLabels[game.game_type]} ${game.sport.name.toLowerCase()}`}
          </p>
        </div>
        {showCourt && (
          <p className={`truncate text-ink-2 ${mapLayout ? 'text-xs' : 'text-sm'}`}>
            <DistanceText>{game.court.name}</DistanceText>
          </p>
        )}
        {hostLine && !mapLayout ? (
          <p className="truncate text-sm font-medium text-ink-2">{playerDisplayLabel(game.creator!, viewerIsAdmin)}</p>
        ) : null}
        <p
          className={`flex min-w-0 flex-wrap gap-x-2 gap-y-0 text-ink-2 ${mapLayout ? 'text-[11px] leading-tight' : 'mt-1 gap-x-3 text-sm'}`}
        >
          <TimeText className="truncate">{gameTimeLabel(game)}</TimeText>
          {!mapLayout && (
            <span className="inline-flex items-center gap-1">
              <Star className="size-4 shrink-0" aria-hidden />
              {skillLabels[game.skill_level]}
            </span>
          )}
        </p>
      </div>
      <div
        className={`flex shrink-0 flex-col items-end justify-center text-right ${mapLayout ? 'pl-0.5' : 'justify-between py-0.5'}`}
      >
        {game.distance_m != null && (
          <span className={`display font-bold ${mapLayout ? 'text-sm' : 'text-xl'}`}>{formatDistance(game.distance_m)}</span>
        )}
        <span
          className={`font-semibold ${mapLayout ? 'text-[10px]' : 'text-xs'} ${full ? 'text-danger' : live ? 'text-live' : upcoming ? 'text-upcoming' : 'text-live'}`}
        >
          {full ? 'Full' : isUnlimitedMaxPlayers(game.max_players) ? 'Open' : `${game.spots_left} spot${game.spots_left === 1 ? '' : 's'}`}
        </span>
      </div>
    </Link>
  )
}
