import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { errorMessage } from '../lib/api'
import { qk, useMyPresence, usePresenceAction } from '../lib/queries'
import type { Presence } from '../lib/types'
import { Spring, buzz, floatText } from '../lib/fx'
import { Button, ErrorText } from './ui'
import { useLocale } from '../i18n/LocaleProvider'
import '../styles/motion-part5.css'

const R = 40
const C = 2 * Math.PI * R

/**
 * Shows "Are you still playing?" shortly before a check-in expires, with a countdown ring.
 * "Yes": the timer beats like a heart, the ring refills and "+N min" floats up before it
 * closes. "I left": the card drops away. If nobody answers, the server expires the check-in.
 */
export function PresenceWatcher() {
  const { data: presence } = useMyPresence()
  const { t } = useLocale()
  const pr = t.account.presence
  const action = usePresenceAction()
  const qc = useQueryClient()
  const [now, setNow] = useState(() => Date.now())
  const [error, setError] = useState('')
  // Keeps the dialog on screen while its answer animation plays.
  const [held, setHeld] = useState<{ presence: Presence; until: number; full: boolean } | null>(null)
  const card = useRef<HTMLDivElement>(null)
  const core = useRef<HTMLSpanElement>(null)
  const ring = useRef<SVGCircleElement>(null)
  const spring = useRef<Spring | null>(null)

  const shown = held?.presence ?? presence
  const expires = shown ? new Date(shown.expires_at).getTime() : 0
  const warnMs = shown ? shown.warning_minutes * 60_000 : 1
  const visible = !!held || (!!presence && now < expires && expires - now <= warnMs)

  useEffect(() => {
    if (!presence) return
    const timer = setInterval(() => setNow(Date.now()), visible ? 1_000 : 15_000)
    return () => clearInterval(timer)
  }, [presence, visible])

  useEffect(() => {
    if (presence && !held && now >= expires) qc.setQueryData(qk.presence, null)
  }, [presence, held, now, expires, qc])

  const left = held?.full ? 1 : Math.max(0, Math.min(1, (expires - now) / warnMs))
  useLayoutEffect(() => {
    if (!visible) {
      spring.current?.stop()
      spring.current = null
      return
    }
    if (!spring.current) {
      spring.current = new Spring(left, (v) => ring.current?.setAttribute('stroke-dashoffset', String(C * (1 - v))), { k: 120, c: 10 })
    } else spring.current.to(left)
  }, [visible, left])
  useEffect(() => () => spring.current?.stop(), [])

  if (!shown || !visible) return null

  const secs = held?.full ? held.until : Math.max(0, Math.ceil((expires - now) / 1000))
  const minsLeft = Math.max(1, Math.ceil((expires - now) / 60_000))
  const clock = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`

  const confirm = () =>
    action.mutate(
      { kind: 'confirm' },
      {
        onError: (e) => setError(errorMessage(e)),
        onSuccess: (p) => {
          setError('')
          const next = p ? new Date(p.expires_at).getTime() : expires
          const gained = Math.max(1, Math.round((next - expires) / 60_000))
          setHeld({ presence: shown, until: Math.max(0, Math.round((next - Date.now()) / 1000)), full: true })
          buzz([20, 60, 20])
          core.current?.animate(
            [{ transform: 'scale(1)' }, { transform: 'scale(1.18)' }, { transform: 'scale(.96)' }, { transform: 'scale(1.1)' }, { transform: 'scale(1)' }],
            { duration: 650 },
          )
          if (core.current) floatText(core.current, pr.extended.replace('{n}', String(gained)), 'var(--live)')
          window.setTimeout(() => setHeld(null), 1300)
        },
      },
    )

  const leave = () => {
    buzz(10)
    setHeld({ presence: shown, until: secs, full: false })
    const drop = card.current?.animate(
      [{ transform: 'none', opacity: 1 }, { transform: 'translateY(300px) rotate(8deg)', opacity: 0 }],
      { duration: 500, easing: 'cubic-bezier(.5,0,.75,0)', fill: 'forwards' },
    )
    action.mutate(
      { kind: 'leave' },
      {
        onError: (e) => {
          setError(errorMessage(e))
          drop?.cancel()
          setHeld(null)
        },
        onSuccess: () => {
          setError('')
          const done = () => setHeld(null)
          if (drop && drop.playState !== 'finished') drop.onfinish = done
          else done()
        },
      },
    )
  }

  return (
    <div className="ftg-safe-overlay ftg-safe-overlay-b ftg-backdrop fixed inset-0 z-40 flex items-end justify-center bg-black/40 p-4 md:items-center" role="dialog" aria-modal="true" aria-labelledby="still-title">
      <div ref={card} className="ftg-dialog w-full max-w-sm rounded-3xl bg-surface p-6 shadow-2xl">
        <div className={`ftg-pring ${!held?.full && secs < 60 ? 'is-low' : ''}`} role="timer" aria-label={clock}>
          <svg viewBox="0 0 96 96" aria-hidden>
            <circle className="bg" cx="48" cy="48" r={R} />
            <circle ref={ring} className="fg" cx="48" cy="48" r={R} strokeDasharray={C} />
          </svg>
          <span ref={core} className="ftg-pring-core" aria-hidden>
            {clock}
          </span>
        </div>
        <h2 id="still-title" className="display mt-2 text-4xl font-extrabold">
          {pr.title}
        </h2>
        <p className="mt-1 text-ink-2">
          {pr.bodyBefore}<b className="text-ink">{shown.court.name}</b>{pr.bodyAfter.replace('{n}', String(minsLeft))}
        </p>
        <div className="mt-5 grid gap-2">
          <ErrorText>{error}</ErrorText>
          <Button variant="live" loading={action.isPending && action.variables?.kind === 'confirm'} disabled={!!held} onClick={confirm}>
            {pr.stillHere}
          </Button>
          <Button variant="secondary" disabled={action.isPending || !!held} onClick={leave}>
            {pr.left}
          </Button>
        </div>
      </div>
    </div>
  )
}
