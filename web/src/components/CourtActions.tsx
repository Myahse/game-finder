import { useState, type MouseEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { errorMessage } from '../lib/api'
import {
  COURT_AT_RADIUS_M,
  isAtCourt,
  notAtCourtMessage,
  notAtCourtTitle,
} from '../lib/courtProximity'
import { directionsUrl, gameHasOpenSpots, gamePlayerCountLabel } from '../lib/format'
import type { Coords } from '../lib/location'
import { useGameAction, useMyPresence, usePresenceAction } from '../lib/queries'
import type { Court, Game } from '../lib/types'
import { Check, Circle, Hourglass, MapPin, Navigation } from 'lucide-react'
import { AppAlert, Button, ErrorText } from './ui'
import { useLocale } from '../i18n/LocaleProvider'
import { burst, buzz, floatText, shake, shockwave } from '../lib/fx'

/** JOIN GAME · I'M HERE · GET DIRECTIONS — shared by the sheet and the details page. */
export function CourtActions({ court, games, me }: { court: Court; games: Game[]; me: Coords | null }) {
  const navigate = useNavigate()
  const { t, locale } = useLocale()
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

  if (court.status === 'pending') {
    return (
      <div className="grid gap-2">
        <p className="rounded-xl bg-players/20 p-3 text-sm font-medium">
          <span className="inline-flex items-center gap-2">
            <Hourglass className="size-4 shrink-0" aria-hidden />
            {t.courts.actions.pendingPreview}
          </span>
        </p>
        <Button type="button" variant="secondary" onClick={() => navigate(`/courts/${court.id}`)}>
          {t.courts.actions.viewProposal}
        </Button>
        <a
          href={directionsUrl(court.latitude, court.longitude)}
          target="_blank"
          rel="noreferrer"
          className="display inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-surface-2 px-4 text-lg font-bold text-ink hover:bg-line"
        >
          <Navigation className="size-5 shrink-0" aria-hidden />
          {t.courts.actions.directions}
        </a>
      </div>
    )
  }

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

  const toggleHere = (e: MouseEvent<HTMLButtonElement>) => {
    if (!hereNow && !atCourt) {
      shake(e.currentTarget)
      buzz([20, 30, 20])
      showNotAtCourt()
      return
    }
    setError('')
    // Where the button is now: the sheet may re-render under us before the request returns.
    const rect = e.currentTarget.getBoundingClientRect()
    const mid = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
    const checkingIn = !hereNow
    presenceAction
      .mutateAsync(hereNow ? { kind: 'leave' } : { kind: 'checkin', courtId: court.id, coords: me })
      .then(() => {
        if (!checkingIn) return
        // Checked in: green rings ripple out, confetti, and the XP it earns floats up.
        shockwave(rect)
        burst(mid, { n: 34, colors: ['#16a34a', '#22c55e', '#ffffff', '#f2b632'], speed: [4, 10], spread: Math.PI * 1.1 })
        floatText(mid, '+2 XP', 'var(--live)')
        buzz([20, 40, 20, 40, 60])
      })
      .catch((err: unknown) => setError(errorMessage(err)))
  }

  return (
    <div className="grid gap-2">
      <AppAlert
        open={farModal}
        title={notAtCourtTitle()}
        message={notAtCourtMessage()}
        onClose={() => setFarModal(false)}
      />
      <ErrorText>{error}</ErrorText>
      {myGame ? (
        <Button variant="live" onClick={() => navigate(`/games/${myGame.id}`)}>
          <span className="inline-flex items-center gap-2">
            <Check className="size-5 shrink-0" aria-hidden />
            {t.courts.actions.youreIn.replace('{count}', gamePlayerCountLabel(myGame.player_count, myGame.max_players))}
          </span>
        </Button>
      ) : (
        <Button variant={joinable ? 'live' : 'primary'} onClick={join} loading={gameAction.isPending}>
          {joinable
            ? t.courts.actions.joinGame.replace('{count}', gamePlayerCountLabel(joinable.player_count, joinable.max_players))
            : live.length
              ? t.courts.actions.startAnother
              : t.courts.actions.createGame}
        </Button>
      )}
      <div className="grid grid-cols-2 gap-2">
        <Button variant={hereNow ? 'danger' : 'secondary'} onClick={toggleHere} loading={presenceAction.isPending}>
          <span className="inline-flex items-center gap-2">
            {!hereNow && <MapPin className="size-4 shrink-0" aria-hidden />}
            {hereNow ? t.courts.actions.left : t.courts.actions.here}
          </span>
        </Button>
        <a
          href={directionsUrl(court.latitude, court.longitude)}
          target="_blank"
          rel="noreferrer"
          className="display inline-flex min-h-12 items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-surface-2 px-4 text-lg font-bold text-ink hover:bg-line"
        >
          <Navigation className="size-5 shrink-0" aria-hidden />
          {t.courts.actions.directions}
        </a>
      </div>
      {hereNow && presence && (
        <p className="flex items-center justify-center gap-2 text-center text-sm text-live">
          <Circle className="size-3 fill-live text-live" aria-hidden />
          {t.courts.actions.checkedInSince.replace('{time}', new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(new Date(presence.started_at)))}
        </p>
      )}
      {!atCourt && !hereNow && (
        <p className="text-center text-xs text-ink-2">
          {t.courts.actions.radiusHint.replace('{m}', String(COURT_AT_RADIUS_M))}
        </p>
      )}
      <Link to={`/courts/${court.id}/report`} className="mt-1 text-center text-xs text-ink-2 hover:text-ink">
        {t.courts.actions.reportProblem}
      </Link>
    </div>
  )
}
