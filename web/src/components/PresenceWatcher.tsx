import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { errorMessage } from '../lib/api'
import { qk, useMyPresence, usePresenceAction } from '../lib/queries'
import { BasketballIcon } from './icons'
import { Button, ErrorText } from './ui'

/**
 * Shows "Are you still playing?" shortly before a check-in expires.
 * If nobody answers, the server expires the check-in on its own.
 */
export function PresenceWatcher() {
  const { data: presence } = useMyPresence()
  const action = usePresenceAction()
  const qc = useQueryClient()
  const [now, setNow] = useState(() => Date.now())
  const [error, setError] = useState('')

  useEffect(() => {
    if (!presence) return
    const t = setInterval(() => setNow(Date.now()), 15_000)
    return () => clearInterval(t)
  }, [presence])

  const expires = presence ? new Date(presence.expires_at).getTime() : 0
  useEffect(() => {
    if (presence && now >= expires) qc.setQueryData(qk.presence, null)
  }, [presence, now, expires, qc])

  if (!presence || now >= expires || expires - now > presence.warning_minutes * 60_000) return null

  const minsLeft = Math.max(1, Math.ceil((expires - now) / 60_000))
  const run = (a: { kind: 'confirm' } | { kind: 'leave' }) =>
    action.mutate(a, { onError: (e) => setError(errorMessage(e)), onSuccess: () => setError('') })

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 p-4 md:items-center" role="dialog" aria-modal="true" aria-labelledby="still-title">
      <div className="w-full max-w-sm rounded-3xl bg-surface p-6 shadow-2xl">
        <BasketballIcon className="size-12 text-brand" />
        <h2 id="still-title" className="display mt-2 text-4xl font-extrabold">
          Are you still playing?
        </h2>
        <p className="mt-1 text-ink-2">
          Your check-in at <b className="text-ink">{presence.court.name}</b> ends in {minsLeft} min.
        </p>
        <div className="mt-5 grid gap-2">
          <ErrorText>{error}</ErrorText>
          <Button variant="live" loading={action.isPending} onClick={() => run({ kind: 'confirm' })}>
            Yes, I'm still here
          </Button>
          <Button variant="secondary" disabled={action.isPending} onClick={() => run({ kind: 'leave' })}>
            I left
          </Button>
        </div>
      </div>
    </div>
  )
}
