import { useEffect } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { clearPendingGameNavigation, stashGameShareToken } from '../lib/gameInvite'
import { gameTimeLabel, gameTypeLabels } from '../lib/format'
import { SportIcon } from '../components/icons'
import { Button, PageHeader, Spinner } from '../components/ui'
import type { GameStatus, GameType } from '../lib/types'

type Preview = {
  valid: boolean
  game_id: string
  status: GameStatus
  start_time: string
  court_name: string
  sport_name: string
  sport_slug: string
  game_type: GameType
}

export function GameLinkPage() {
  const { token = '' } = useParams()
  const { user, sessionReady } = useAuth()
  const navigate = useNavigate()

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
    if (!sessionReady || !user?.onboarded || !preview?.game_id) return
    clearPendingGameNavigation()
    navigate(`/games/${preview.game_id}`, { replace: true })
  }, [sessionReady, user, preview?.game_id, navigate])

  if (!sessionReady || (user?.onboarded && preview?.game_id)) {
    return (
      <div className="flex min-h-full items-center justify-center p-8">
        <Spinner className="text-brand" />
      </div>
    )
  }

  return (
    <div className="mx-auto min-h-full max-w-md p-4 pb-10">
      <PageHeader title="Join game" back="/" />
      {isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner className="text-brand" />
        </div>
      ) : error || !preview?.valid ? (
        <div className="rounded-2xl border border-line bg-surface p-6 text-center">
          <p className="font-semibold">This game link isn&apos;t valid anymore.</p>
          <p className="mt-2 text-sm text-ink-2">It may have ended or been cancelled.</p>
          <Link to="/" className="mt-4 inline-block font-semibold text-brand">
            Back to map
          </Link>
        </div>
      ) : (
        <div className="rounded-2xl border border-line bg-surface p-6 shadow-md">
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
          <p className="mt-4 text-sm text-ink-2">Sign in to view details and join.</p>
          <Button className="mt-4 w-full" onClick={() => navigate('/login')}>
            Sign in
          </Button>
          <Link to="/register" className="mt-3 block text-center text-sm font-semibold text-brand">
            Create account
          </Link>
        </div>
      )}
    </div>
  )
}
