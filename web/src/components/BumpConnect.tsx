import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Handshake, X } from 'lucide-react'
import { api, errorMessage } from '../lib/api'
import { useAuth } from '../lib/auth'
import { playerUsernameLabel } from '../lib/format'
import type { PublicUser } from '../lib/types'
import { useLocale } from '../i18n/LocaleProvider'
import { Avatar, Button } from './ui'
import { useSheetExit } from '../lib/motion'
import { buzz, burst, cheer, replay, Spring } from '../lib/fx'
import '../styles/motion-social.css'

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

function BumpConnectSheet({ onClose: dismiss }: { onClose: () => void }) {
  const { closing, close: onClose } = useSheetExit(dismiss)
  const { t } = useLocale()
  const { user } = useAuth()
  const qc = useQueryClient()
  const [phase, setPhase] = useState<Phase>({ kind: 'locating' })
  const [attempt, setAttempt] = useState(0)
  const done = useRef(false)
  // Where the two phones hit, once the real match has come back; the screen floods green from there.
  const [hit, setHit] = useState<{ x: number; y: number; attempt: number } | null>(null)
  const matched = phase.kind === 'matched' ? phase : null
  const onImpact = useCallback(
    (p: { x: number; y: number }) => {
      setHit({ ...p, attempt })
      if (matched && !matched.already) window.setTimeout(() => cheer(p), 150)
    },
    [attempt, matched],
  )
  const flooded = matched && hit && hit.attempt === attempt ? hit : null

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
    <div className="ftg-safe-overlay ftg-safe-overlay-b ftg-backdrop fixed inset-0 z-50 flex items-center justify-center bg-bg/95 p-6 backdrop-blur" data-closing={closing || undefined} role="dialog" aria-modal="true" aria-label={t.bump.title}>
      <button type="button" onClick={cancel} className="absolute right-4 top-[max(1rem,env(safe-area-inset-top))] rounded-full p-2 text-ink-2 hover:bg-surface-2 hover:text-ink" aria-label={t.common.close}>
        <X className="size-6" aria-hidden />
      </button>

      <div className="ftg-dialog flex w-full max-w-sm flex-col items-center text-center">
        <>
          {phase.kind === 'none' || phase.kind === 'error' ? (
            <div className="relative flex size-44 items-center justify-center text-brand">
              <span className="relative flex size-24 items-center justify-center rounded-full bg-brand text-brand-ink shadow-xl">
                <Handshake className="size-11" aria-hidden />
              </span>
            </div>
          ) : (
            <BumpStage key={attempt} user={user ?? null} friend={matched?.friend ?? null} left={phase.kind === 'waiting' ? phase.left : null} onImpact={onImpact} />
          )}
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
      </div>

      {matched && flooded && (
        <div className="ftg-social-flood" style={{ '--fx': `${flooded.x}px`, '--fy': `${flooded.y}px` } as CSSProperties}>
          <div className="flex w-full max-w-sm flex-col items-center text-center" role="status">
            <div className="flex items-center">
              {user && (
                <span className="rounded-full bg-white ring-4 ring-white">
                  <Avatar user={user} size={96} />
                </span>
              )}
              <span className="-ml-5 rounded-full bg-white ring-4 ring-white">
                <Avatar user={matched.friend} size={96} />
              </span>
            </div>
            <h2 className="display mt-6 text-5xl font-extrabold uppercase">{matched.already ? t.bump.alreadyTitle : t.bump.matchedTitle}</h2>
            <p className="mt-2 text-white/90">{(matched.already ? t.bump.alreadyBody : t.bump.matchedBody).replace('{user}', playerUsernameLabel(matched.friend))}</p>
            <button type="button" className="display ftg-press mt-8 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-white px-5 text-lg font-bold text-live" onClick={onClose}>
              {t.bump.done}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

type Pos = { x: number; y: number }

/**
 * Two phones while the real bump request is out: a radar sweeps, the other phone counts down.
 * Your phone can be dragged for fun but only bounces back; the collision (shockwave, sparks,
 * green screens) plays only once the server has actually matched you.
 */
function BumpStage({ user, friend, left, onImpact }: { user: PublicUser | null; friend: PublicUser | null; left: number | null; onImpact: (p: Pos) => void }) {
  const stage = useRef<HTMLDivElement>(null)
  const me = useRef<HTMLDivElement>(null)
  const fr = useRef<HTMLDivElement>(null)
  const shock = useRef<HTMLSpanElement>(null)
  const xm = useRef<Spring | null>(null)
  const xf = useRef<Spring | null>(null)
  const s = useRef({ run: false, hit: false, drag: false, sx: 0, touching: false })
  const impactRef = useRef<() => void>(() => {})
  const onImpactRef = useRef(onImpact)
  useEffect(() => {
    onImpactRef.current = onImpact
  }, [onImpact])

  const gap0 = () => (fr.current && me.current ? fr.current.offsetLeft - (me.current.offsetLeft + me.current.offsetWidth) : 0)

  useEffect(() => {
    const timers: number[] = []
    const render = () => {
      const a = xm.current
      const b = xf.current
      if (!a || !b || !me.current || !fr.current) return
      const tilt = (v: number) => Math.max(-8, Math.min(8, v * 0.004))
      me.current.style.transform = `translateX(${a.x}px) rotate(${tilt(a.v)}deg)`
      fr.current.style.transform = `translateX(${b.x}px) rotate(${tilt(b.v)}deg)`
      if (s.current.run && !s.current.hit && gap0() + b.x - a.x <= 0) impactRef.current()
    }
    xm.current = new Spring(0, render, { k: 260, c: 18, precision: 0.1 })
    xf.current = new Spring(0, render, { k: 260, c: 18, precision: 0.1 })
    impactRef.current = () => {
      const st = s.current
      const a = xm.current
      const b = xf.current
      if (st.hit || !a || !b || !me.current || !stage.current) return
      st.hit = true
      st.drag = false
      const cx = me.current.offsetLeft + me.current.offsetWidth + a.x
      if (shock.current) {
        shock.current.style.left = `${cx}px`
        replay(shock.current, 'ftg-social-go')
      }
      a.v = -Math.max(600, a.v) * 0.7
      a.to(0, { k: 200, c: 15 })
      b.v = -Math.min(-300, b.v) * 0.2 + 500
      b.to(0, { k: 200, c: 15 })
      replay(me.current, 'ftg-social-sq')
      replay(fr.current, 'ftg-social-sq')
      buzz([30, 40, 60])
      const r = stage.current.getBoundingClientRect()
      const p = { x: r.left + cx, y: r.top + 95 }
      burst(p, { n: 26, shape: 'spark', colors: ['#ff5a1f', '#f2b632', '#ffffff'], speed: [4, 10], gravity: 0.1, life: [12, 22] })
      timers.push(window.setTimeout(() => stage.current?.setAttribute('data-ok', ''), 200))
      timers.push(window.setTimeout(() => onImpactRef.current(p), 520))
    }
    return () => {
      timers.forEach((id) => window.clearTimeout(id))
      xm.current?.stop()
      xf.current?.stop()
    }
  }, [])

  // The real match came back: wind up, then fly into each other.
  const matched = !!friend
  useEffect(() => {
    if (!matched) return
    const a = xm.current
    const b = xf.current
    if (!a || !b) return
    s.current.run = true
    s.current.drag = false
    a.to(-16, { k: 220, c: 20 })
    b.to(16, { k: 220, c: 20 })
    const go = window.setTimeout(() => {
      const g = gap0() / 2 + 20
      a.to(g, { k: 150, c: 6 })
      b.to(-g, { k: 150, c: 6 })
    }, 280)
    // Whatever happens to the frames, the success screen must not wait.
    const safety = window.setTimeout(() => impactRef.current(), 1100)
    return () => {
      window.clearTimeout(go)
      window.clearTimeout(safety)
    }
  }, [matched])

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (s.current.run || !xm.current || (e.pointerType === 'mouse' && e.button !== 0)) return
    s.current.drag = true
    s.current.sx = e.clientX - xm.current.x
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const st = s.current
    if (!st.drag || !xm.current) return
    // Only the server decides a match: dragging stops just short of the other phone.
    const max = gap0() - 3
    const x = Math.max(-30, Math.min(max, e.clientX - st.sx))
    xm.current.to(x, { k: 900, c: 48 })
    const touching = x >= max
    if (touching && !st.touching) {
      buzz(6)
      xf.current?.kick(220)
    }
    st.touching = touching
  }
  const onPointerUp = () => {
    if (!s.current.drag) return
    s.current.drag = false
    s.current.touching = false
    if (!s.current.run) xm.current?.to(0, { k: 160, c: 9 })
  }

  const check = (
    <span className="ftg-social-ok" aria-hidden>
      <svg viewBox="0 0 24 24" className="size-8">
        <path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  )
  return (
    <div ref={stage} className="ftg-social-bump" aria-hidden>
      <span className="ftg-social-sweep" />
      <div ref={me} className="ftg-social-ph ftg-social-me" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
        <div className="ftg-social-scr">
          {user ? <Avatar user={user} size={36} /> : <span className="ftg-social-q">?</span>}
          {check}
        </div>
      </div>
      <div ref={fr} className="ftg-social-ph ftg-social-fr">
        <div className="ftg-social-scr">
          {friend ? <Avatar user={friend} size={36} /> : <span className="ftg-social-q">?</span>}
          {!friend && left != null && <em>{left} s</em>}
          {check}
        </div>
      </div>
      <span ref={shock} className="ftg-social-shock" />
    </div>
  )
}
