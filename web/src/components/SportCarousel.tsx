import { useCallback, useEffect, useRef, useState } from 'react'
import { Check } from 'lucide-react'
import type { Sport } from '../lib/types'
import { useLocale } from '../i18n/LocaleProvider'
import { SportIcon } from './icons'
import { SportMotif } from './SportMotif'

const AUTO_MS = 3600
/** After a swipe / tap, wait this long before auto-sliding again. */
const RESUME_MS = 6000

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * Auto-sliding sport cards. Each card wears its own sport skin (`data-sport`);
 * tapping one makes it the base sport, which locks the carousel on it.
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
  const scroller = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(() => Math.max(0, sports.findIndex((s) => s.id === selectedId)))
  const [hovering, setHovering] = useState(false)
  const [focused, setFocused] = useState(false)
  const [userPaused, setUserPaused] = useState(false)
  const resumeTimer = useRef(0)
  const [reduced] = useState(prefersReducedMotion)
  const [hidden, setHidden] = useState(() => typeof document !== 'undefined' && document.hidden)
  const taglines = t.onboarding.taglines as Record<string, string>

  const autoplay = !selectedId && !reduced && !hovering && !focused && !hidden && !userPaused && sports.length > 1

  const scrollToIndex = useCallback(
    (i: number) => {
      const el = scroller.current
      const card = el?.children[i] as HTMLElement | undefined
      if (!el || !card) return
      el.scrollTo({ left: card.offsetLeft - (el.clientWidth - card.clientWidth) / 2, behavior: reduced ? 'auto' : 'smooth' })
    },
    [reduced],
  )

  const pauseForUser = () => {
    setUserPaused(true)
    window.clearTimeout(resumeTimer.current)
    resumeTimer.current = window.setTimeout(() => setUserPaused(false), RESUME_MS)
  }
  useEffect(() => () => window.clearTimeout(resumeTimer.current), [])

  // Track which card is centred while the user (or autoplay) scrolls.
  useEffect(() => {
    const el = scroller.current
    if (!el) return
    let frame = 0
    const onScroll = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const mid = el.scrollLeft + el.clientWidth / 2
        let best = 0
        let bestDist = Infinity
        Array.from(el.children).forEach((c, i) => {
          const card = c as HTMLElement
          const d = Math.abs(card.offsetLeft + card.clientWidth / 2 - mid)
          if (d < bestDist) {
            bestDist = d
            best = i
          }
        })
        setActive(best)
      })
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      cancelAnimationFrame(frame)
      el.removeEventListener('scroll', onScroll)
    }
  }, [])

  useEffect(() => {
    const on = () => setHidden(document.hidden)
    document.addEventListener('visibilitychange', on)
    return () => document.removeEventListener('visibilitychange', on)
  }, [])

  // Advance one card per tick; a manual swipe pauses autoplay for RESUME_MS.
  useEffect(() => {
    if (!autoplay) return
    const id = window.setTimeout(() => scrollToIndex((active + 1) % sports.length), AUTO_MS)
    return () => window.clearTimeout(id)
  }, [autoplay, active, sports.length, scrollToIndex])

  // Lock onto the chosen base sport.
  useEffect(() => {
    if (!selectedId) return
    const i = sports.findIndex((s) => s.id === selectedId)
    if (i >= 0) scrollToIndex(i)
  }, [selectedId, sports, scrollToIndex])

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
    >
      <div
        ref={scroller}
        onPointerDown={pauseForUser}
        onWheel={pauseForUser}
        className="relative -mx-6 -mb-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-[9%] pb-9 pt-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {sports.map((s, i) => {
          const isBase = s.id === selectedId
          const isActive = i === active
          return (
            <button
              key={s.id}
              type="button"
              data-sport={s.slug}
              aria-roledescription="slide"
              aria-label={`${s.name} — ${i + 1} / ${sports.length}`}
              aria-pressed={isBase}
              onClick={() => {
                pauseForUser()
                onSelect(s)
              }}
              onFocus={() => scrollToIndex(i)}
              className={`sport-card relative flex min-h-60 w-[82%] shrink-0 snap-center flex-col overflow-hidden rounded-3xl p-5 text-left text-white shadow-[0_18px_40px_-18px_var(--sport-deep)] outline-none transition duration-500 ease-out focus-visible:ring-4 focus-visible:ring-sport-accent ${
                isActive ? 'scale-100 opacity-100' : 'scale-[0.92] opacity-70'
              } ${isBase ? 'ring-4 ring-sport-accent ring-offset-2 ring-offset-bg' : ''}`}
            >
              <SportMotif slug={s.slug} className="pointer-events-none absolute inset-0 size-full text-white opacity-[0.16]" />
              <SportIcon
                slug={s.slug}
                className="pointer-events-none absolute -bottom-8 -right-8 size-44 rotate-[-18deg] text-white opacity-[0.13]"
              />

              <div className="relative flex items-start justify-between">
                <span className="flex size-14 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/25 backdrop-blur-sm">
                  <SportIcon slug={s.slug} className={`size-8 text-sport-accent ${isActive && !reduced ? 'ftg-ball-float' : ''}`} />
                </span>
                <span className="display text-lg font-bold tabular-nums text-white/70">
                  {String(i + 1).padStart(2, '0')}
                  <span className="text-white/40"> / {String(sports.length).padStart(2, '0')}</span>
                </span>
              </div>

              <div className="relative mt-auto">
                <p className="display break-words text-[clamp(2.25rem,11vw,3rem)] font-extrabold drop-shadow-sm">{s.name}</p>
                <p className="mt-1.5 line-clamp-2 text-sm font-medium text-white/85">{taglines[s.slug] ?? ''}</p>
                <span
                  className={`mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold transition ${
                    isBase ? 'bg-white text-brand' : 'bg-white/15 text-white ring-1 ring-white/30'
                  }`}
                >
                  {isBase && <Check className="size-3.5" strokeWidth={3} aria-hidden />}
                  {isBase ? t.onboarding.isBase : t.onboarding.makeBase}
                </span>
              </div>

              {isActive && autoplay && (
                <span className="absolute inset-x-5 bottom-0 h-1 overflow-hidden rounded-full bg-white/15">
                  <span
                    key={active}
                    className="ftg-card-progress block h-full rounded-full bg-sport-accent"
                    style={{ animationDuration: `${AUTO_MS}ms` }}
                  />
                </span>
              )}
            </button>
          )
        })}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-1.5">
        {sports.map((s, i) => {
          const on = i === active
          return (
            <button
              key={s.id}
              type="button"
              data-sport={s.slug}
              onClick={() => {
                pauseForUser()
                scrollToIndex(i)
              }}
              aria-label={s.name}
              aria-current={on ? 'true' : undefined}
              className={`inline-flex h-8 items-center gap-1.5 rounded-full text-xs font-bold transition-all duration-300 ${
                on ? 'bg-brand px-3 text-brand-ink' : 'w-8 justify-center bg-surface-2 text-ink-2 hover:text-brand'
              }`}
            >
              <SportIcon slug={s.slug} className="size-4" />
              {on && <span className="display text-sm">{s.name}</span>}
            </button>
          )
        })}
      </div>
    </section>
  )
}

export function SportCarouselSkeleton() {
  return (
    <div className="-mx-6 -mb-4 flex gap-3 overflow-hidden px-[9%] pb-9 pt-2" aria-hidden>
      <div className="h-60 w-[82%] shrink-0 animate-pulse rounded-3xl bg-surface-2" />
      <div className="aspect-[16/11] w-[82%] shrink-0 scale-[0.92] animate-pulse rounded-3xl bg-surface-2 opacity-70" />
    </div>
  )
}
