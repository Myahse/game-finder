import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { errorMessage } from '../lib/api'
import {
  COURT_AT_RADIUS_M,
  isAtCourt,
  NOT_AT_COURT_MESSAGE,
  NOT_AT_COURT_TITLE,
} from '../lib/courtProximity'
import { directionsUrl, gameHasOpenSpots, gamePlayerCountLabel } from '../lib/format'
import type { Coords } from '../lib/location'
import { useGameAction, useMyPresence, usePresenceAction } from '../lib/queries'
import type { Court, Game } from '../lib/types'
import { Check, Circle, MapPin, Navigation } from 'lucide-react'
import { AppAlert, Button, ErrorText } from './ui'

/** JOIN GAME · I'M HERE · GET DIRECTIONS — shared by the sheet and the details page. */
export function CourtActions({ court, games, me }: { court: Court; games: Game[]; me: Coords | null }) {
  const navigate = useNavigate()
  const { data: presence } = useMyPresence()
  const presenceAction = usePresenceAction()
  const gameAction = useGameAction()
  const [error, setError] = useState('')
  const [farModal, setFarModal] = useState(false)

  const live = games.filter((g) => g.status === 'active')
  const joinable = live.find((g) => !g.joined && gameHasOpenSpots(g))
  const myGame = games.find((g) => g.joined && (g.status === 'active' || g.status === 'scheduled'))
  const hereNow = presence?.court_id === court.id
  const atCourt = isAtCourt(me, court)

  const showNotAtCourt = () => setFarModal(true)

  const join = () => {
    if (!joinable) return navigate(`/games/new?court=${court.id}`)
    if (!atCourt) {
      showNotAtCourt()
      return
    }
    setError('')
    gameAction.mutate(
      { id: joinable.id, action: 'join', coords: me },
      { onSuccess: (g) => navigate(`/games/${g.id}`), onError: (e) => setError(errorMessage(e)) },
    )
  }

  const toggleHere = () => {
    if (!hereNow && !atCourt) {
      showNotAtCourt()
      return
    }
    setError('')
    presenceAction.mutate(hereNow ? { kind: 'leave' } : { kind: 'checkin', courtId: court.id, coords: me }, {
      onError: (e) => setError(errorMessage(e)),
    })
  }

  return (
    <div className="grid gap-2">
      <AppAlert
        open={farModal}
        title={NOT_AT_COURT_TITLE}
        message={NOT_AT_COURT_MESSAGE}
        onClose={() => setFarModal(false)}
      />
      <ErrorText>{error}</ErrorText>
      {myGame ? (
        <Button variant="live" onClick={() => navigate(`/games/${myGame.id}`)}>
          <span className="inline-flex items-center gap-2">
            <Check className="size-5 shrink-0" aria-hidden />
            You're in · {gamePlayerCountLabel(myGame.player_count, myGame.max_players)}
          </span>
        </Button>
      ) : (
        <Button variant={joinable ? 'live' : 'primary'} onClick={join} loading={gameAction.isPending}>
          {joinable
            ? `Join game · ${gamePlayerCountLabel(joinable.player_count, joinable.max_players)}`
            : live.length
              ? 'Start another game'
              : 'Create game'}
        </Button>
      )}
      <div className="grid grid-cols-2 gap-2">
        <Button variant={hereNow ? 'danger' : 'secondary'} onClick={toggleHere} loading={presenceAction.isPending}>
          <span className="inline-flex items-center gap-2">
            {!hereNow && <MapPin className="size-4 shrink-0" aria-hidden />}
            {hereNow ? "I've left" : "I'm here"}
          </span>
        </Button>
        <a
          href={directionsUrl(court.latitude, court.longitude)}
          target="_blank"
          rel="noreferrer"
          className="display inline-flex min-h-12 items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-surface-2 px-4 text-lg font-bold text-ink hover:bg-line"
        >
          <Navigation className="size-5 shrink-0" aria-hidden />
          Directions
        </a>
      </div>
      {hereNow && presence && (
        <p className="flex items-center justify-center gap-2 text-center text-sm text-live">
          <Circle className="size-3 fill-live text-live" aria-hidden />
          You're checked in since {new Date(presence.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>
      )}
      {!atCourt && !hereNow && (
        <p className="text-center text-xs text-ink-2">
          Check-in and live games require you to be within about {COURT_AT_RADIUS_M} m of the court.
        </p>
      )}
      <Link to={`/courts/${court.id}/report`} className="mt-1 text-center text-xs text-ink-2 hover:text-ink">
        Report a problem with this court
      </Link>
    </div>
  )
}
