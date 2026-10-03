import { useState } from 'react'
import { GameInviteField } from '../components/GameInviteField'
import { errorMessage } from '../lib/api'
import { Clock, Navigation, Star, Timer } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { Check, DistanceText, Flame, SearchX, SportName, TimeText, X } from '../components/icons'
import { useAuth } from '../lib/auth'
import {
  directionsUrl,
  formatDistance,
  gamePlayerCountLabel,
  gameTimeLabel,
  gameTypeLabels,
  gameHasOpenSpots,
  isUnlimitedMaxPlayers,
  playerDisplayLabel,
  skillLabels,
} from '../lib/format'
import { isAtCourt, NOT_AT_COURT_MESSAGE, NOT_AT_COURT_TITLE } from '../lib/courtProximity'
import { useLocation } from '../lib/location'
import { useGame, useGameAction } from '../lib/queries'
import { AppAlert, Avatar, Button, Card, Empty, ErrorText, PageHeader } from '../components/ui'
import { Loading } from './CourtPage'

const statusLabel = {
  active: { text: 'ACTIVE', cls: 'bg-live text-white', Icon: Flame },
  scheduled: { text: 'UPCOMING', cls: 'bg-surface-2 text-ink', Icon: Clock },
  completed: { text: 'FINISHED', cls: 'bg-surface-2 text-ink-2', Icon: Check },
  cancelled: { text: 'CANCELLED', cls: 'bg-danger/15 text-danger', Icon: X },
}

export function GamePage() {
  const { id } = useParams()
  const { user } = useAuth()
  const { coords } = useLocation()
  const { data: game, isLoading } = useGame(id, coords)
  const action = useGameAction()
  const [error, setError] = useState('')
  const [farModal, setFarModal] = useState(false)

  if (isLoading) return <Loading />
  if (!game) return <Empty icon={<SearchX className="size-14" strokeWidth={1.5} />} title="Game not found" />

  const open = game.status === 'active' || game.status === 'scheduled'
  const isCreator = game.creator_id === user?.id
  const viewerIsAdmin = user?.role === 'admin'
  const unlimited = isUnlimitedMaxPlayers(game.max_players)
  const pct = unlimited ? 0 : Math.min(100, (game.player_count / game.max_players) * 100)
  const { cls: statusCls, text: statusText, Icon: StatusIcon } = statusLabel[game.status]
  const run = (a: 'join' | 'leave' | 'cancel') => {
    setError('')
    if (a === 'cancel' && !confirm('Cancel this game for everyone?')) return
    if (a === 'join' && game.status === 'active' && !isAtCourt(coords, game.court)) {
      setFarModal(true)
      return
    }
    action.mutate(
      { id: game.id, action: a, coords: a === 'join' ? coords : undefined },
      { onError: (e) => setError(errorMessage(e)) },
    )
  }

  return (
    <div className="pb-10">
      <PageHeader title={`${gameTypeLabels[game.game_type]} ${game.sport.name}`} back={`/?court=${game.court_id}`} />
      <div className="mx-auto grid max-w-2xl gap-4 p-4">
        <AppAlert
          open={farModal}
          title={NOT_AT_COURT_TITLE}
          message={NOT_AT_COURT_MESSAGE}
          onClose={() => setFarModal(false)}
        />
        <Card>
          <span className={`display inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-lg font-bold ${statusCls}`}>
            <StatusIcon className="size-5 shrink-0" aria-hidden />
            {statusText}
          </span>
          <Link to={`/courts/${game.court_id}`} className="mt-3 block">
            <p className="display flex flex-wrap items-center gap-2 text-4xl font-extrabold">
              <SportName sport={game.sport} iconClassName="size-8" />
              {game.court.name}
            </p>
            {game.distance_m != null && (
              <p className="text-ink-2">
                <DistanceText>{formatDistance(game.distance_m)} away</DistanceText>
              </p>
            )}
          </Link>

          <div className="mt-5">
            <div className="flex items-end justify-between">
              <p className="display text-5xl font-extrabold">{gamePlayerCountLabel(game.player_count, game.max_players)}</p>
              <p className={`font-semibold ${unlimited || game.spots_left ? 'text-live' : 'text-danger'}`}>
                {unlimited
                  ? 'Open to all'
                  : game.spots_left
                    ? `${game.spots_left} spot${game.spots_left === 1 ? '' : 's'} left`
                    : 'Full'}
              </p>
            </div>
            {!unlimited && (
              <div
                className="mt-2 h-3 overflow-hidden rounded-full bg-surface-2"
                role="progressbar"
                aria-valuenow={game.player_count}
                aria-valuemax={game.max_players}
              >
                <div className="h-full rounded-full bg-live transition-all duration-500" style={{ width: `${pct}%` }} />
              </div>
            )}
          </div>

          <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-ink-2">
            <span className="inline-flex items-center gap-1">
              <Star className="size-4 shrink-0" aria-hidden />
              {skillLabels[game.skill_level]}
            </span>
            <TimeText>{gameTimeLabel(game)}</TimeText>
            <span className="inline-flex items-center gap-1">
              <Timer className="size-4 shrink-0" aria-hidden />
              {game.duration_minutes} min
            </span>
          </div>
          {game.cancelled_reason && <p className="mt-2 text-sm text-danger">Reason: {game.cancelled_reason}</p>}

          <div className="mt-5 grid gap-2">
            <ErrorText>{error}</ErrorText>
            {open &&
              (game.joined ? (
                <Button variant="danger" onClick={() => run('leave')} loading={action.isPending}>
                  Leave game
                </Button>
              ) : (
                <Button variant="live" onClick={() => run('join')} loading={action.isPending} disabled={!gameHasOpenSpots(game)}>
                  {gameHasOpenSpots(game) ? 'Join game' : 'Game full'}
                </Button>
              ))}
            <a
              href={directionsUrl(game.court.latitude, game.court.longitude)}
              target="_blank"
              rel="noreferrer"
              className="display inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-surface-2 px-4 text-lg font-bold hover:bg-line"
            >
              <Navigation className="size-5 shrink-0" aria-hidden />
              Get directions
            </a>
            {open && isCreator && (
              <Button variant="ghost" onClick={() => run('cancel')}>
                Cancel game
              </Button>
            )}
          </div>
        </Card>

        {open && game.joined && <GameInviteField gameId={game.id} />}

        <section>
          <h2 className="display mb-2 text-2xl font-bold">Players</h2>
          <div className="grid gap-2">
            {game.players?.map((p) => (
              <Link key={p.id} to={`/users/${p.id}`} className="flex items-center gap-3 rounded-xl bg-surface p-2.5">
                <Avatar user={p} size={36} />
                <span className="flex-1 font-medium">{playerDisplayLabel(p, viewerIsAdmin)}</span>
                {p.id === game.creator_id && <span className="text-xs font-semibold text-brand">HOST</span>}
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}

