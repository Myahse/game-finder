import { useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { gamePathForId, stashPendingGameId } from '../lib/gameInvite'
import { Button, PageHeader, Spinner } from '../components/ui'

/** Legacy /games/:id links for logged-out visitors. */
export function GameJoinLanding({ gameId }: { gameId: string }) {
  const { user, sessionReady } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    stashPendingGameId(gameId)
  }, [gameId])

  useEffect(() => {
    if (sessionReady && user?.onboarded) {
      navigate(gamePathForId(gameId), { replace: true })
    }
  }, [sessionReady, user, gameId, navigate])

  if (!sessionReady || user?.onboarded) {
    return (
      <div className="flex min-h-full items-center justify-center p-8">
        <Spinner className="text-brand" />
      </div>
    )
  }

  return (
    <div className="mx-auto min-h-full max-w-md p-4 pb-10">
      <PageHeader title="Join game" back="/" />
      <div className="rounded-2xl border border-line bg-surface p-6 shadow-md">
        <p className="font-semibold">Someone shared a game with you.</p>
        <p className="mt-2 text-sm text-ink-2">Sign in to open it and join if there&apos;s room.</p>
        <Button className="mt-4 w-full" onClick={() => navigate('/?login=1')}>
          Sign in
        </Button>
        <Link to="/register" className="mt-3 block text-center text-sm font-semibold text-brand">
          Create account
        </Link>
      </div>
    </div>
  )
}
