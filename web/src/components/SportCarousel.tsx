import { prefersReducedMotion } from '../lib/motion'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Check } from 'lucide-react'
import type { Sport } from '../lib/types'
import { useLocale } from '../i18n/LocaleProvider'
import { SportCourt } from './SportCourt'

const AUTO_MS = 3200
/** After a swipe / tap, wait this long before auto-sliding again. */
const RESUME_MS = 6000


/**
 * Auto-sliding sport cards. Tapping one makes it the base sport, which stops the slide on it.
 * Each card carries `data-sport` so its selected state uses that sport's colour.
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

  useEffect(() => {
    if (!autoplay) return
    const id = window.setTimeout(() => scrollToIndex((active + 1) % sports.length), AUTO_MS)
    return () => window.clearTimeout(id)
  }, [autoplay, active, sports.length, scrollToIndex])

  // Stop on the chosen base sport.
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
        className="relative -mx-6 flex snap-x snap-mandatory gap-3 overflow-x-auto px-[11%] py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {sports.map((s, i) => {
          const isBase = s.id === selectedId
          return (
            <button
              key={s.id}
              type="button"
              data-sport={s.slug}
              aria-roledescription="slide"
              aria-label={`${s.name}, ${i + 1} / ${sports.length}`}
              aria-pressed={isBase}
              onClick={() => {
                pauseForUser()
                onSelect(s)
              }}
              onFocus={() => scrollToIndex(i)}
              className={`w-[78%] shrink-0 snap-center overflow-hidden rounded-2xl border-2 bg-surface text-left transition duration-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
                isBase ? 'border-brand' : 'border-line'
              } ${i === active ? 'opacity-100' : 'opacity-55'}`}
            >
              <SportCourt slug={s.slug} className="block aspect-[200/110] w-full" />
              <span className="flex items-center justify-between gap-3 px-4 py-3">
                <span className="display min-w-0 truncate text-3xl font-extrabold">{s.name}</span>
                <span
                  className={`flex size-6 shrink-0 items-center justify-center rounded-full border-2 ${
                    isBase ? 'border-brand bg-brand text-brand-ink' : 'border-line'
                  }`}
                >
                  {isBase && <Check className="size-3.5" strokeWidth={3.5} aria-hidden />}
                </span>
              </span>
            </button>
          )
        })}
      </div>

      <div className="mt-3 flex items-center justify-center gap-1.5">
        {sports.map((s, i) => (
          <button
            key={s.id}
            type="button"
            onClick={() => {
              pauseForUser()
              scrollToIndex(i)
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
    <div className="-mx-6 flex gap-3 overflow-hidden px-[11%] py-1" aria-hidden>
      <div className="aspect-[200/150] w-[78%] shrink-0 animate-pulse rounded-2xl bg-surface-2" />
      <div className="aspect-[200/150] w-[78%] shrink-0 animate-pulse rounded-2xl bg-surface-2 opacity-55" />
    </div>
  )
}
