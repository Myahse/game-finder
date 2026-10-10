import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import {
  gamePathForId,
  stashGameShareToken,
  stashResolvedGameTarget,
} from '../lib/gameInvite'
import { gameTimeLabel, gameTypeLabels } from '../lib/format'
import { SportIcon } from '../components/icons'
import { Button, PageHeader, Spinner } from '../components/ui'
import { InviteTicket } from '../components/InviteTicket'
import { MatchSeats } from '../components/MatchSeats'
import type { GameStatus, GameType } from '../lib/types'
import { useLocale } from '../i18n/LocaleProvider'

type Preview = {
  valid: boolean
  game_id: string
  status: GameStatus
  start_time: string
  court_name: string
  sport_name: string
  sport_slug: string
  game_type: GameType
  max_players?: number
  player_count?: number
}

export function GameLinkPage() {
  const { token = '' } = useParams()
  const { user, sessionReady } = useAuth()
  const navigate = useNavigate()
  const { t } = useLocale()
  const tl = t.games.link
  const [seated, setSeated] = useState(false)

  useEffect(() => {
    if (token) stashGameShareToken(token)
  }, [token])

  const { data: preview, isLoading, error } = useQuery({
    queryKey: ['game-share-preview', token],
    enabled: token.length > 0,
    queryFn: () => api<Preview>(`/api/game-links/${encodeURIComponent(token)}`),
    retry: false,
  })

  useEffect(() => {
    if (preview?.game_id) stashResolvedGameTarget(preview.game_id)
  }, [preview?.game_id])

  if (!sessionReady) {
    return (
      <div className="flex min-h-full items-center justify-center p-8">
        <Spinner className="text-brand" />
      </div>
    )
  }

  if (sessionReady && user?.onboarded && preview?.game_id) {
    return <Navigate to={gamePathForId(preview.game_id)} replace />
  }

  const homeTo = user?.onboarded ? '/' : '/?login=1'

  return (
    <div className="mx-auto min-h-full max-w-md p-4 pb-10">
      <PageHeader title={tl.title} back={homeTo} />
      {isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner className="text-brand" />
        </div>
      ) : error || !preview?.valid ? (
        <div className="rounded-2xl border border-line bg-surface p-6 text-center">
          <p className="font-semibold">{tl.invalid}</p>
          <p className="mt-2 text-sm text-ink-2">{tl.invalidHint}</p>
          <Link to={homeTo} className="mt-4 inline-block font-semibold text-brand">
            {user?.onboarded ? tl.backToMap : tl.openApp}
          </Link>
        </div>
      ) : (
        <div className="pt-6">
          <InviteTicket
            stub={tl.stub}
            pull={tl.stubPull}
            actions={
              <div className="rounded-2xl border border-line bg-surface p-5">
                {preview.max_players != null && preview.player_count != null && (
                  <div className="mb-4">
                    <MatchSeats
                      taken={preview.player_count}
                      max={preview.max_players}
                      onTake={() => setSeated(true)}
                      labels={{
                        yourSeat: tl.yourSeat,
                        you: tl.you,
                        full: tl.full,
                        count: tl.seats(preview.player_count + (seated ? 1 : 0), preview.max_players),
                      }}
                    />
                  </div>
                )}
                <p className="text-sm text-ink-2">{tl.signInHint}</p>
                <Button className={`ftg-icta mt-4 w-full ${seated ? 'is-pulse' : ''}`} onClick={() => navigate('/?login=1')}>
                  {tl.signIn}
                </Button>
                <Link to="/register" className="mt-3 block text-center text-sm font-semibold text-brand">
                  {tl.createAccount}
                </Link>
                {user && !user.onboarded ? (
                  <Link to="/" className="mt-3 block text-center text-sm font-semibold text-ink-2">
                    {tl.finishSetup}
                  </Link>
                ) : null}
              </div>
            }
          >
          <div className="flex items-center gap-3">
            <SportIcon slug={preview.sport_slug} className="size-12 text-brand" />
            <div>
              <p className="display text-2xl font-extrabold">{preview.court_name}</p>
              <p className="text-sm text-ink-2">
                {gameTypeLabels[preview.game_type]} {preview.sport_name.toLowerCase()}
              </p>
            </div>
          </div>
          <p className="mt-4 text-sm text-ink-2">
            {gameTimeLabel({ status: preview.status, start_time: preview.start_time })}
          </p>
          </InviteTicket>
        </div>
      )}
    </div>
  )
}
