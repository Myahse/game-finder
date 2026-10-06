import { useEffect, useState } from 'react'
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
import { isAtCourt, notAtCourtMessage, notAtCourtTitle } from '../lib/courtProximity'
import { useLocation } from '../lib/location'
import { useGame, useGameAction } from '../lib/queries'
import { clearPendingGameNavigation } from '../lib/gameInvite'
import { ShareGameButton } from '../components/ShareGameButton'
import { GameWeather } from '../components/GameWeather'
import { GameScoreboard } from '../components/GameScoreboard'
import { AppAlert, Avatar, Button, Card, Empty, ErrorText, PageHeader } from '../components/ui'
import { Loading } from './CourtPage'
import { useLocale } from '../i18n/LocaleProvider'

const statusLabel = {
  active: { cls: 'bg-live text-white', Icon: Flame },
  scheduled: { cls: 'bg-surface-2 text-ink', Icon: Clock },
  completed: { cls: 'bg-surface-2 text-ink-2', Icon: Check },
  cancelled: { cls: 'bg-danger/15 text-danger', Icon: X },
}

export function GamePage() {
  const { id } = useParams()
  const { user } = useAuth()
  const { t } = useLocale()
  const tp = t.games.page

  useEffect(() => {
    clearPendingGameNavigation()
  }, [])
  const { coords } = useLocation()
  const { data: game, isLoading } = useGame(id, coords)
  const action = useGameAction()
  const [error, setError] = useState('')
  const [farModal, setFarModal] = useState(false)

  if (isLoading) return <Loading />
  if (!game) return <Empty icon={<SearchX className="size-14" strokeWidth={1.5} />} title={tp.notFound} />

  const open = game.status === 'active' || game.status === 'scheduled'
  const isCreator = game.creator_id === user?.id
  const viewerIsAdmin = user?.role === 'admin'
  const unlimited = isUnlimitedMaxPlayers(game.max_players)
  const pct = unlimited ? 0 : Math.min(100, (game.player_count / game.max_players) * 100)
  const { cls: statusCls, Icon: StatusIcon } = statusLabel[game.status]
  const statusText = t.games.status[game.status]
  const run = (a: 'join' | 'leave' | 'cancel') => {
    setError('')
    if (a === 'cancel' && !confirm(tp.cancelConfirm)) return
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
      <PageHeader
        title={`${gameTypeLabels[game.game_type]} ${game.sport.name}`}
        back="/"
        right={
          <ShareGameButton
            gameId={game.id}
            title={`${game.court.name} · ${gameTypeLabels[game.game_type]}`}
            variant="ghost"
            className="min-h-9 px-2"
            compact
          />
        }
      />
      <div className="mx-auto grid max-w-2xl gap-4 p-4">
        <AppAlert
          open={farModal}
          title={notAtCourtTitle()}
          message={notAtCourtMessage()}
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
                <DistanceText>{tp.away.replace('{distance}', formatDistance(game.distance_m))}</DistanceText>
              </p>
            )}
          </Link>

          <div className="mt-5">
            <div className="flex items-end justify-between">
              <p className="display text-5xl font-extrabold">{gamePlayerCountLabel(game.player_count, game.max_players)}</p>
              <p className={`font-semibold ${unlimited || game.spots_left ? 'text-live' : 'text-danger'}`}>
                {unlimited
                  ? tp.openToAll
                  : game.spots_left
                    ? (game.spots_left === 1 ? tp.spotLeft : tp.spotsLeft).replace('{n}', String(game.spots_left))
                    : tp.full}
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
              {t.games.time.minutes.replace('{n}', String(game.duration_minutes))}
            </span>
          </div>
          {game.cancelled_reason && <p className="mt-2 text-sm text-danger">{tp.reason.replace('{reason}', game.cancelled_reason)}</p>}

          <div className="mt-5 grid gap-2">
            <ErrorText>{error}</ErrorText>
            {open &&
              (game.joined ? (
                <Button variant="danger" onClick={() => run('leave')} loading={action.isPending}>
                  {tp.leave}
                </Button>
              ) : (
                <Button variant="live" onClick={() => run('join')} loading={action.isPending} disabled={!gameHasOpenSpots(game)}>
                  {gameHasOpenSpots(game) ? tp.join : tp.gameFull}
                </Button>
              ))}
            <a
              href={directionsUrl(game.court.latitude, game.court.longitude)}
              target="_blank"
              rel="noreferrer"
              className="display inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-surface-2 px-4 text-lg font-bold hover:bg-line"
            >
              <Navigation className="size-5 shrink-0" aria-hidden />
              {tp.directions}
            </a>
            {open && isCreator && (
              <Button variant="ghost" onClick={() => run('cancel')}>
                {tp.cancel}
              </Button>
            )}
          </div>
        </Card>

        <GameWeather game={game} isHost={isCreator || viewerIsAdmin} />

        {open && game.joined && <GameInviteField gameId={game.id} />}

        <GameScoreboard game={game} canEdit={isCreator || game.joined || viewerIsAdmin} />

        <section>
          <h2 className="display mb-2 text-2xl font-bold">{tp.players}</h2>
          <div className="grid gap-2">
            {game.players?.map((p) => (
              <Link key={p.id} to={`/users/${p.id}`} className="flex items-center gap-3 rounded-xl bg-surface p-2.5">
                <Avatar user={p} size={36} />
                <span className="flex-1 font-medium">{playerDisplayLabel(p, viewerIsAdmin)}</span>
                {p.id === game.creator_id && <span className="text-xs font-semibold text-brand">{tp.host}</span>}
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}

