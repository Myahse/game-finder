import { useCallback, useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Handshake, X } from 'lucide-react'
import { api, errorMessage } from '../lib/api'
import { useAuth } from '../lib/auth'
import { playerUsernameLabel } from '../lib/format'
import type { PublicUser } from '../lib/types'
import { useLocale } from '../i18n/LocaleProvider'
import { Avatar, Button } from './ui'

/** Keep polling for this long — slightly longer than the server's 12 s match window. */
const WAIT_MS = 15_000
const POLL_MS = 1_200

type Phase = { kind: 'locating' } | { kind: 'waiting'; left: number } | { kind: 'matched'; friend: PublicUser; already: boolean } | { kind: 'none' } | { kind: 'error'; message: string }

type BumpResult = { status: 'waiting' } | { status: 'matched'; friend: PublicUser; already_friends?: boolean }

function currentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) return reject(new Error('unavailable'))
    // First fix from a watch: some browsers answer a watch faster than getCurrentPosition.
    const stop = (fn: () => void) => {
      navigator.geolocation.clearWatch(id)
      window.clearTimeout(timer)
      fn()
    }
    const id = navigator.geolocation.watchPosition(
      (p) => stop(() => resolve(p)),
      (e) => e.code === e.PERMISSION_DENIED && stop(() => reject(e)),
      { enableHighAccuracy: true, maximumAge: 10_000 },
    )
    const timer = window.setTimeout(() => stop(() => reject(new Error('timeout'))), 10_000)
  })
}

/** "Connect on court": both players tap at the same time, close together → friends. */
export function BumpConnectButton() {
  const { t } = useLocale()
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button type="button" onClick={() => setOpen(true)}>
        <Handshake className="size-5" aria-hidden /> {t.bump.button}
      </Button>
      {open && <BumpConnectSheet onClose={() => setOpen(false)} />}
    </>
  )
}

function BumpConnectSheet({ onClose }: { onClose: () => void }) {
  const { t } = useLocale()
  const { user } = useAuth()
  const qc = useQueryClient()
  const [phase, setPhase] = useState<Phase>({ kind: 'locating' })
  const [attempt, setAttempt] = useState(0)
  const done = useRef(false)

  const cancel = useCallback(() => {
    if (!done.current) void api('/api/me/bump', { method: 'DELETE' }).catch(() => {})
    onClose()
  }, [onClose])

  useEffect(() => {
    done.current = false
    let stopped = false
    let timer = 0
    const run = async () => {
      setPhase({ kind: 'locating' })
      let pos: GeolocationPosition
      try {
        pos = await currentPosition()
      } catch {
        if (!stopped) setPhase({ kind: 'error', message: t.bump.needLocation })
        return
      }
      const body = { latitude: pos.coords.latitude, longitude: pos.coords.longitude }
      const until = Date.now() + WAIT_MS
      const poll = async () => {
        if (stopped) return
        try {
          const r = await api<BumpResult>('/api/me/bump', { method: 'POST', json: body })
          if (stopped) return
          if (r.status === 'matched') {
            done.current = true
            navigator.vibrate?.([60, 40, 120])
            void qc.invalidateQueries({ queryKey: ['friends'] })
            void qc.invalidateQueries({ queryKey: ['friend-requests'] })
            setPhase({ kind: 'matched', friend: r.friend, already: !!r.already_friends })
            return
          }
        } catch (e) {
          if (!stopped) setPhase({ kind: 'error', message: errorMessage(e) })
          return
        }
        const left = until - Date.now()
        if (left <= 0) {
          void api('/api/me/bump', { method: 'DELETE' }).catch(() => {})
          setPhase({ kind: 'none' })
          return
        }
        setPhase({ kind: 'waiting', left: Math.ceil(left / 1000) })
        timer = window.setTimeout(() => void poll(), POLL_MS)
      }
      await poll()
    }
    void run()
    return () => {
      stopped = true
      window.clearTimeout(timer)
    }
  }, [attempt, qc, t.bump.needLocation])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && cancel()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [cancel])

  return (
    <div className="ftg-safe-overlay ftg-safe-overlay-b fixed inset-0 z-50 flex items-center justify-center bg-bg/95 p-6 backdrop-blur" role="dialog" aria-modal="true" aria-label={t.bump.title}>
      <button type="button" onClick={cancel} className="absolute right-4 top-[max(1rem,env(safe-area-inset-top))] rounded-full p-2 text-ink-2 hover:bg-surface-2 hover:text-ink" aria-label={t.common.close}>
        <X className="size-6" aria-hidden />
      </button>

      <div className="flex w-full max-w-sm flex-col items-center text-center">
        {phase.kind === 'matched' ? (
          <>
            <div className="ftg-av-pop flex items-center">
              {user && (
                <span className="rounded-full ring-4 ring-bg">
                  <Avatar user={user} size={96} />
                </span>
              )}
              <span className="-ml-5 rounded-full ring-4 ring-bg">
                <Avatar user={phase.friend} size={96} />
              </span>
            </div>
            <h2 className="display mt-6 text-4xl font-extrabold">{phase.already ? t.bump.alreadyTitle : t.bump.matchedTitle}</h2>
            <p className="mt-2 text-ink-2">{(phase.already ? t.bump.alreadyBody : t.bump.matchedBody).replace('{user}', playerUsernameLabel(phase.friend))}</p>
            <Button type="button" className="mt-8 w-full" onClick={onClose}>
              {t.bump.done}
            </Button>
          </>
        ) : (
          <>
            <div className="relative flex size-44 items-center justify-center text-brand">
              {phase.kind !== 'none' && phase.kind !== 'error' && (
                <>
                  <span className="ftg-loc-ring absolute size-24 rounded-full bg-current opacity-30" />
                  <span className="ftg-loc-ring ftg-loc-ring-delay absolute size-24 rounded-full bg-current opacity-30" />
                </>
              )}
              <span className="relative flex size-24 items-center justify-center rounded-full bg-brand text-brand-ink shadow-xl">
                <Handshake className="size-11" aria-hidden />
              </span>
            </div>
            <h2 className="display mt-6 text-4xl font-extrabold">
              {phase.kind === 'none' ? t.bump.noneTitle : phase.kind === 'error' ? t.bump.errorTitle : t.bump.title}
            </h2>
            <p aria-live="polite" className="mt-2 min-h-12 text-ink-2">
              {phase.kind === 'locating' && t.bump.locating}
              {phase.kind === 'waiting' && t.bump.waiting.replace('{s}', String(phase.left))}
              {phase.kind === 'none' && t.bump.noneBody}
              {phase.kind === 'error' && phase.message}
            </p>
            {(phase.kind === 'none' || phase.kind === 'error') && (
              <Button type="button" className="mt-6 w-full" onClick={() => setAttempt((a) => a + 1)}>
                {t.bump.retry}
              </Button>
            )}
            <p className="mt-6 text-xs text-ink-2">{t.bump.hint}</p>
          </>
        )}
      </div>
    </div>
  )
}
