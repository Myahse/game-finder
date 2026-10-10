import { prefersReducedMotion } from '../lib/motion'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Check } from 'lucide-react'
import type { Sport } from '../lib/types'
import { useLocale } from '../i18n/LocaleProvider'
import { SportCourt } from './SportCourt'
import { burst, buzz, centerOf, replay, Spring } from '../lib/fx'
import { clamp, floodFrom, velocityTracker } from '../lib/onboardMotion'
import '../styles/motion-onboard.css'

const AUTO_MS = 3200
/** After a swipe / tap, wait this long before auto-sliding again. */
const RESUME_MS = 6000
const SNAP = { k: 200, c: 23 }

/**
 * Auto-sliding 3D sport cards: drag with momentum, they snap to the nearest one. Tapping one makes it
 * the base sport (its colour floods the screen), which stops the slide on it.
 * Each card carries `data-sport` so it wears that sport's colours.
 */
export function SportCarousel({
  sports,
  selectedId,
  onSelect,
}: {
  sports: Sport[]
  selectedId: string | null
  onSelect: (sport: Sport) => void
}) {
  const { t } = useLocale()
  const stage = useRef<HTMLDivElement>(null)
  const cards = useRef<(HTMLButtonElement | null)[]>([])
  const [active, setActive] = useState(() => Math.max(0, sports.findIndex((s) => s.id === selectedId)))
  const activeRef = useRef(active)
  const [hovering, setHovering] = useState(false)
  const [focused, setFocused] = useState(false)
  const [userPaused, setUserPaused] = useState(false)
  const resumeTimer = useRef(0)
  const [reduced] = useState(prefersReducedMotion)
  const [hidden, setHidden] = useState(() => typeof document !== 'undefined' && document.hidden)
  const pos = useRef<Spring | null>(null)
  const gap = useRef(240)
  const touched = useRef(false)
  const count = sports.length

  const autoplay = !selectedId && !reduced && !hovering && !focused && !hidden && !userPaused && count > 1

  const draw = useCallback(
    (p: number) => {
      cards.current.forEach((c, i) => {
        if (!c) return
        const d = i - p
        const ad = Math.abs(d)
        c.style.transform = `translateX(calc(-50% + ${d * gap.current}px)) translateZ(${-ad * 90}px) rotateY(${clamp(-d * 24, -55, 55)}deg)`
        c.style.zIndex = String(10 - Math.round(ad * 2))
        // The front card stays opaque; the far ones fade out.
        c.style.opacity = String(clamp(1.6 - ad * 0.6, 0, 1))
      })
      const n = clamp(Math.round(p), 0, count - 1)
      if (n !== activeRef.current) {
        activeRef.current = n
        setActive(n)
        if (touched.current) buzz(3)
      }
    },
    [count],
  )

  // One spring holds the carousel position (in cards).
  useLayoutEffect(() => {
    pos.current = new Spring(activeRef.current, draw, { precision: 0.001, ...SNAP })
    const el = stage.current
    const measure = () => {
      const first = cards.current[0]
      if (first) gap.current = first.offsetWidth * 0.8
      pos.current?.onUpdate(pos.current.x)
    }
    measure()
    const ro = new ResizeObserver(measure)
    if (el) ro.observe(el)
    return () => {
      ro.disconnect()
      pos.current?.stop()
    }
  }, [draw])

  const goTo = useCallback((i: number, soft = false) => {
    pos.current?.to(clamp(i, 0, count - 1), soft ? { k: 120, c: 20 } : SNAP)
  }, [count])

  const pauseForUser = () => {
    touched.current = true
    setUserPaused(true)
    window.clearTimeout(resumeTimer.current)
    resumeTimer.current = window.setTimeout(() => setUserPaused(false), RESUME_MS)
  }
  useEffect(() => () => window.clearTimeout(resumeTimer.current), [])

  useEffect(() => {
    const on = () => setHidden(document.hidden)
    document.addEventListener('visibilitychange', on)
    return () => document.removeEventListener('visibilitychange', on)
  }, [])

  useEffect(() => {
    if (!autoplay) return
    const id = window.setTimeout(() => goTo((active + 1) % count, true), AUTO_MS)
    return () => window.clearTimeout(id)
  }, [autoplay, active, count, goTo])

  // Stop on the chosen base sport.
  useEffect(() => {
    if (!selectedId) return
    const i = sports.findIndex((s) => s.id === selectedId)
    if (i >= 0) goTo(i)
  }, [selectedId, sports, goTo])

  // Drag with momentum. The page still scrolls vertically (touch-action: pan-y).
  const drag = useRef<{ x: number; p0: number; moved: boolean } | null>(null)
  const suppressClick = useRef(false)
  const vv = useRef(velocityTracker())
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return
    pauseForUser()
    drag.current = { x: e.clientX, p0: pos.current?.x ?? 0, moved: false }
    vv.current.reset(e.clientX)
  }
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current
    const sp = pos.current
    if (!d || !sp) return
    const dx = e.clientX - d.x
    if (!d.moved && Math.abs(dx) > 6) {
      d.moved = true
      stage.current?.setPointerCapture(e.pointerId)
    }
    if (!d.moved) return
    vv.current.push(e.clientX)
    let p = d.p0 - dx / gap.current
    const max = count - 1
    // Rubber band past either end.
    if (p < 0) p = -(1 - Math.exp(p * 1.4)) * 0.45
    else if (p > max) p = max + (1 - Math.exp(-(p - max) * 1.4)) * 0.45
    sp.set(p)
  }
  const onPointerUp = () => {
    const d = drag.current
    const sp = pos.current
    drag.current = null
    if (!d?.moved || !sp) return
    suppressClick.current = true
    window.setTimeout(() => (suppressClick.current = false), 0)
    const v = vv.current.v / gap.current
    sp.v = -v
    goTo(Math.round(sp.x - v * 0.3))
  }

  const wheelAt = useRef(0)
  const onWheel = (e: React.WheelEvent) => {
    pauseForUser()
    if (Math.abs(e.deltaX) <= Math.abs(e.deltaY) || Math.abs(e.deltaX) < 4) return
    const now = e.timeStamp
    if (now - wheelAt.current < 350) return
    wheelAt.current = now
    goTo(Math.round(pos.current?.t ?? active) + Math.sign(e.deltaX))
  }

  const pick = (s: Sport, i: number) => {
    goTo(i)
    const card = cards.current[i]
    if (card) replay(card.firstElementChild, 'ftg-onboard-hop')
    if (s.id !== selectedId && card) {
      // The base sport re-skins the app: its colour floods out from the card.
      const cs = getComputedStyle(card)
      const col = cs.getPropertyValue('--brand').trim() || '#ff5a1f'
      const accent = cs.getPropertyValue('--sport-accent').trim() || '#f2b632'
      const c = centerOf(card)
      floodFrom(document.body, c, col, { fixed: true, hold: 60 })
      buzz([10, 40, 20])
      window.setTimeout(() => burst({ x: c.x, y: c.y - 30 }, { n: 36, colors: [col, accent, '#ffffff'], speed: [4, 10], spread: Math.PI * 1.1 }), 250)
    }
    onSelect(s)
  }

  const cardBody = (s: Sport, isBase: boolean) => (
    <span className="block overflow-hidden rounded-2xl">
      <SportCourt slug={s.slug} className="block aspect-[200/110] w-full" />
      <span className="flex items-center justify-between gap-3 px-4 py-3">
        <span className="display min-w-0 truncate text-3xl font-extrabold">{s.name}</span>
        <span className="relative flex size-6 shrink-0 items-center justify-center rounded-full border-2 border-line">
          <span
            className={`ftg-onboard-chk absolute -inset-0.5 flex items-center justify-center rounded-full bg-brand text-brand-ink ${
              isBase ? 'ftg-onboard-chk-on' : ''
            }`}
          >
            <Check className="size-3.5" strokeWidth={3.5} aria-hidden />
          </span>
        </span>
      </span>
    </span>
  )

  return (
    <section
      aria-roledescription="carousel"
      aria-label={t.onboarding.sport}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      onFocus={() => setFocused(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false)
      }}
      onKeyDown={(e) => {
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
        e.preventDefault()
        pauseForUser()
        const i = clamp(active + (e.key === 'ArrowRight' ? 1 : -1), 0, count - 1)
        goTo(i)
        cards.current[i]?.focus({ preventScroll: true })
      }}
      className="-mx-6 overflow-hidden"
    >
      <div
        ref={stage}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
        className="ftg-onboard-sc pb-2 pt-5"
      >
        {/* Invisible copy of a card: gives the stage its height. */}
        <span aria-hidden className="invisible mx-auto block w-[78%] max-w-[340px] rounded-2xl border-2">
          {sports[0] && cardBody(sports[0], false)}
        </span>
        {sports.map((s, i) => {
          const isBase = s.id === selectedId
          return (
            <button
              key={s.id}
              ref={(el) => {
                cards.current[i] = el
              }}
              type="button"
              data-sport={s.slug}
              aria-roledescription="slide"
              aria-label={`${s.name}, ${i + 1} / ${count}`}
              aria-pressed={isBase}
              onClick={() => {
                if (suppressClick.current) return
                pauseForUser()
                pick(s, i)
              }}
              onFocus={() => goTo(i)}
              className="ftg-onboard-sc-card top-5 w-[78%] max-w-[340px] text-left focus-visible:outline-none [&:focus-visible>span]:outline [&:focus-visible>span]:outline-2 [&:focus-visible>span]:outline-offset-2 [&:focus-visible>span]:outline-brand"
            >
              <span
                className={`block rounded-2xl border-2 bg-surface shadow-[0_14px_28px_-16px_rgba(0,0,0,0.55)] transition-colors duration-300 ${
                  isBase ? 'border-brand' : 'border-line'
                }`}
              >
                {cardBody(s, isBase)}
              </span>
            </button>
          )
        })}
      </div>

      <div className="mt-1 flex items-center justify-center gap-1.5">
        {sports.map((s, i) => (
          <button
            key={s.id}
            type="button"
            onClick={() => {
              pauseForUser()
              goTo(i)
            }}
            aria-label={s.name}
            aria-current={i === active ? 'true' : undefined}
            className="flex h-6 items-center"
          >
            <span className={`block h-1.5 rounded-full transition-all duration-300 ${i === active ? 'w-5 bg-ink' : 'w-1.5 bg-line'}`} />
          </button>
        ))}
      </div>
    </section>
  )
}

export function SportCarouselSkeleton() {
  return (
    <div className="-mx-6 flex justify-center overflow-hidden pb-2 pt-5" aria-hidden>
      <div className="aspect-[200/150] w-[78%] max-w-[340px] shrink-0 animate-pulse rounded-2xl bg-surface-2" />
    </div>
  )
}
