import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { errorMessage } from '../lib/api'
import { directionsUrl, distanceM } from '../lib/format'
import type { Coords } from '../lib/location'
import { useGameAction, useMyPresence, usePresenceAction } from '../lib/queries'
import type { Court, Game } from '../lib/types'
import { Button, ErrorText } from './ui'

/** JOIN GAME · I'M HERE · GET DIRECTIONS — shared by the sheet and the details page. */
export function CourtActions({ court, games, me }: { court: Court; games: Game[]; me: Coords | null }) {
  const navigate = useNavigate()
  const { data: presence } = useMyPresence()
  const presenceAction = usePresenceAction()
  const gameAction = useGameAction()
  const [error, setError] = useState('')

  const live = games.filter((g) => g.status === 'active')
  const joinable = live.find((g) => !g.joined && g.spots_left > 0)
  const myGame = games.find((g) => g.joined && (g.status === 'active' || g.status === 'scheduled'))
  const hereNow = presence?.court_id === court.id
  const far = me ? distanceM(me.latitude, me.longitude, court.latitude, court.longitude) > 500 : false

  const join = () => {
    if (!joinable) return navigate(`/games/new?court=${court.id}`)
    setError('')
    gameAction.mutate(
      { id: joinable.id, action: 'join' },
      { onSuccess: (g) => navigate(`/games/${g.id}`), onError: (e) => setError(errorMessage(e)) },
    )
  }

  const toggleHere = () => {
    setError('')
    presenceAction.mutate(hereNow ? { kind: 'leave' } : { kind: 'checkin', courtId: court.id, coords: me }, {
      onError: (e) => setError(errorMessage(e)),
    })
  }

  return (
    <div className="grid gap-2">
      <ErrorText>{error}</ErrorText>
      {myGame ? (
        <Button variant="live" onClick={() => navigate(`/games/${myGame.id}`)}>
          ✅ You're in · {myGame.player_count}/{myGame.max_players}
        </Button>
      ) : (
        <Button variant={joinable ? 'live' : 'primary'} onClick={join} loading={gameAction.isPending}>
          {joinable ? `Join game · ${joinable.player_count}/${joinable.max_players}` : live.length ? 'Start another game' : 'Create game'}
        </Button>
      )}
      <div className="grid grid-cols-2 gap-2">
        <Button
          variant={hereNow ? 'danger' : 'secondary'}
          onClick={toggleHere}
          loading={presenceAction.isPending}
          title={far && !hereNow ? 'You need to be at the court to check in' : undefined}
        >
          {hereNow ? "I've left" : "📍 I'm here"}
        </Button>
        <a
          href={directionsUrl(court.latitude, court.longitude)}
          target="_blank"
          rel="noreferrer"
          className="display inline-flex min-h-12 items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-surface-2 px-4 text-lg font-bold text-ink hover:bg-line"
        >
          🧭 Directions
        </a>
      </div>
      {hereNow && presence && (
        <p className="text-center text-sm text-live">
          🟢 You're checked in since {new Date(presence.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>
      )}
      {far && !hereNow && <p className="text-center text-xs text-ink-2">Check-in works when you're at the court.</p>}
      <Link to={`/courts/${court.id}/report`} className="mt-1 text-center text-xs text-ink-2 hover:text-ink">
        Report a problem with this court
      </Link>
    </div>
  )
}
