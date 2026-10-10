import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CalendarDays, ChevronLeft, ChevronRight, Download, Share2, X } from 'lucide-react'
import { playerAvatarForUser } from '../avatar/resolve'
import { useLocale } from '../i18n/LocaleProvider'
import { api } from '../lib/api'
import { renderRecapStory, type MonthlyRecap } from '../lib/recapStory'
import type { Me } from '../lib/types'
import { Avatar, Button, Spinner } from './ui'
import { Odometer } from './Odometer'
import { useSheetExit } from '../lib/motion'
import { buzz } from '../lib/fx'
import '../styles/motion-social.css'

function monthKey(d: Date) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

function shiftMonth(key: string, delta: number) {
  const [y, m] = key.split('-').map(Number)
  return monthKey(new Date(Date.UTC(y, m - 1 + delta, 1)))
}

/** "My month": a shareable story image with the player's monthly stats. */
export function RecapButton({ me }: { me: Me }) {
  const { t } = useLocale()
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button type="button" variant="secondary" onClick={() => setOpen(true)}>
        <CalendarDays className="size-5" aria-hidden /> {t.recap.button}
      </Button>
      {open && <RecapSheet me={me} onClose={() => setOpen(false)} />}
    </>
  )
}

function RecapSheet({ me, onClose: dismiss }: { me: Me; onClose: () => void }) {
  const { closing, close: onClose } = useSheetExit(dismiss)
  const { t, locale } = useLocale()
  const current = monthKey(new Date())
  const [month, setMonth] = useState(current)
  const { data: recap, isError } = useQuery({ queryKey: ['recap', month], queryFn: () => api<MonthlyRecap>(`/api/me/recap?month=${month}`) })
  const [story, setStory] = useState<{ blob: Blob; src: string; month: string } | null>(null)
  const [failed, setFailed] = useState(false)

  const [y, m] = month.split('-').map(Number)
  const monthLabel = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, 1)))

  useEffect(() => {
    if (!recap) return
    let src = ''
    let cancelled = false
    setFailed(false)
    renderRecapStory({
      recap,
      username: me.username,
      avatar: playerAvatarForUser(me),
      teammateAvatar: recap.top_teammate ? playerAvatarForUser(recap.top_teammate.user) : null,
      monthLabel,
      labels: t.recap,
    })
      .then((blob) => {
        if (cancelled) return
        src = URL.createObjectURL(blob)
        setStory({ blob, src, month: recap.month })
      })
      .catch(() => !cancelled && setFailed(true))
    return () => {
      cancelled = true
      if (src) URL.revokeObjectURL(src)
    }
  }, [recap, me, monthLabel, t.recap])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const ready = story && story.month === month ? story : null
  const fileName = `out-for-ground-${me.username}-${month}.png`

  const share = async () => {
    if (!ready) return
    const file = new File([ready.blob], fileName, { type: 'image/png' })
    try {
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: t.recap.title, text: `${t.recap.text} ${monthLabel}` })
        return
      }
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') return
    }
    save()
  }

  const save = () => {
    if (!ready) return
    const a = document.createElement('a')
    a.href = ready.src
    a.download = fileName
    a.click()
  }

  return (
    <div className="ftg-safe-overlay ftg-backdrop fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4" data-closing={closing || undefined} role="dialog" aria-modal="true" aria-label={t.recap.title} onClick={onClose}>
      <div className="ftg-sheet max-h-[96dvh] w-full max-w-sm overflow-y-auto rounded-t-3xl bg-surface p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="display text-2xl font-extrabold">{t.recap.title}</h2>
          <button type="button" onClick={onClose} className="rounded-full p-1.5 text-ink-2 hover:bg-surface-2 hover:text-ink" aria-label={t.common.close}>
            <X className="size-5" aria-hidden />
          </button>
        </div>
        <div className="mb-3 flex items-center justify-between">
          <button type="button" onClick={() => setMonth((k) => shiftMonth(k, -1))} className="rounded-full p-2 text-ink-2 hover:bg-surface-2 hover:text-ink" aria-label={t.recap.prev}>
            <ChevronLeft className="size-5" aria-hidden />
          </button>
          <span className="font-bold capitalize">{monthLabel}</span>
          <button
            type="button"
            onClick={() => setMonth((k) => shiftMonth(k, 1))}
            disabled={month >= current}
            className="rounded-full p-2 text-ink-2 hover:bg-surface-2 hover:text-ink disabled:opacity-30"
            aria-label={t.recap.next}
          >
            <ChevronRight className="size-5" aria-hidden />
          </button>
        </div>
        <div className="relative mx-auto flex aspect-[9/16] w-full max-w-[15rem] items-center justify-center overflow-hidden rounded-2xl bg-surface-2">
          {recap && recap.month === month ? (
            <RecapStory key={month} recap={recap} me={me} monthLabel={monthLabel} image={ready?.src ?? null} failed={failed} />
          ) : isError ? (
            <p className="p-4 text-center text-sm text-ink-2">{t.recap.failed}</p>
          ) : (
            <div className="flex flex-col items-center gap-2 p-4 text-center text-sm text-ink-2">
              <Spinner className="text-brand" />
              {t.recap.loading}
            </div>
          )}
        </div>
        {recap && recap.month === month && <p className="mt-2 text-center text-xs text-ink-2">{t.recap.storyHint}</p>}
        {recap && recap.month === month && recap.games === 0 && <p className="mt-3 text-center text-sm text-ink-2">{t.recap.empty}</p>}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button type="button" onClick={() => void share()} disabled={!ready}>
            <Share2 className="size-5" aria-hidden /> {t.recap.share}
          </Button>
          <Button type="button" variant="secondary" className="text-base" onClick={save} disabled={!ready}>
            <Download className="size-5" aria-hidden /> {t.recap.save}
          </Button>
        </div>
      </div>
    </div>
  )
}

const SLIDE_MS = 3400

/** A number that rolls up from zeros once its slide has turned in. */
function RollNum({ value }: { value: string }) {
  const [on, setOn] = useState(false)
  useEffect(() => {
    const id = window.setTimeout(() => setOn(true), 380)
    return () => window.clearTimeout(id)
  }, [])
  return <Odometer value={on ? value : value.replace(/\d/g, '0')} />
}

function Clock() {
  return (
    <svg viewBox="0 0 80 80" className="ftg-social-clock" aria-hidden>
      <circle cx="40" cy="40" r="35" fill="none" stroke="#fff" strokeWidth="5" />
      <line className="ftg-social-hand" x1="40" y1="40" x2="40" y2="17" stroke="#fff" strokeWidth="5" strokeLinecap="round" />
      <line className="ftg-social-hand2" x1="40" y1="40" x2="56" y2="40" stroke="var(--sport-accent)" strokeWidth="5" strokeLinecap="round" />
      <circle cx="40" cy="40" r="4" fill="#fff" />
    </svg>
  )
}

type StoryNav = { cur: number; prev: number; dir: number; visits: number[] }

/**
 * The month as a story: progress bars fill, slides turn like a cube, numbers roll.
 * Tap the left third to go back, elsewhere to skip; press and hold to pause.
 * The last slide is the shareable image itself.
 */
function RecapStory({ recap, me, monthLabel, image, failed }: { recap: MonthlyRecap; me: Me; monthLabel: string; image: string | null; failed: boolean }) {
  const { t } = useLocale()
  const slides = useMemo(() => {
    const out: { key: string; cls: string; body: ReactNode }[] = [
      {
        key: 'games',
        cls: 'ftg-social-s1',
        body: (
          <>
            <span className="ftg-social-pill capitalize">{monthLabel}</span>
            <span className="ftg-social-big"><RollNum value={String(recap.games)} /></span>
            <span className="ftg-social-lbl">{t.recap.games}</span>
          </>
        ),
      },
      {
        key: 'hours',
        cls: 'ftg-social-s2',
        body: (
          <>
            <Clock />
            <span className="ftg-social-big"><RollNum value={String(recap.hours).replace('.0', '')} /></span>
            <span className="ftg-social-lbl">{t.recap.hours}</span>
          </>
        ),
      },
      {
        key: 'courts',
        cls: 'ftg-social-s3',
        body: (
          <>
            <span className="ftg-social-big"><RollNum value={String(recap.courts)} /></span>
            <span className="ftg-social-lbl">{t.recap.courts}</span>
            {recap.show_up_pct != null && <span className="ftg-social-pill">{recap.show_up_pct}% {t.recap.showUp}</span>}
            {recap.games_created > 0 && <span className="ftg-social-pill">{recap.games_created} {t.recap.created}</span>}
          </>
        ),
      },
    ]
    if (recap.top_teammate || recap.top_court) {
      const mate = recap.top_teammate
      out.push({
        key: 'people',
        cls: 'ftg-social-s4',
        body: (
          <>
            {mate && (
              <span className="rounded-full ring-4 ring-white">
                <Avatar user={mate.user} size={76} />
              </span>
            )}
            {mate && <span className="ftg-social-mid">@{mate.user.username}</span>}
            {mate && <span className="ftg-social-lbl">{t.recap.together.replace('{n}', String(mate.games))}</span>}
            {recap.top_court && <span className="ftg-social-pill mt-2">{t.recap.topCourt}</span>}
            {recap.top_court && <span className="ftg-social-mid">{recap.top_court.name}</span>}
          </>
        ),
      })
    }
    out.push({
      key: 'card',
      cls: 'ftg-social-card',
      body: image ? (
        <img src={image} alt={t.recap.title} className="h-full w-full object-cover" draggable={false} />
      ) : failed ? (
        <p className="self-center p-4 text-center text-sm">{t.recap.failed}</p>
      ) : (
        <div className="flex flex-col items-center justify-center gap-2 p-4 text-center text-sm">
          <Spinner />
          {t.recap.loading}
        </div>
      ),
    })
    return out
  }, [recap, monthLabel, image, failed, t.recap])
  const count = slides.length

  const [nav, setNav] = useState<StoryNav>(() => ({ cur: 0, prev: -1, dir: 1, visits: slides.map(() => 0) }))
  const [paused, setPaused] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const slideEls = useRef<(HTMLDivElement | null)[]>([])
  const barEls = useRef<(HTMLElement | null)[]>([])
  const cur = useRef(0)
  const elapsed = useRef(0)
  const ended = useRef(false)
  const pausedRef = useRef(false)

  const show = useCallback(
    (to: number) => {
      const n = Math.max(0, Math.min(count - 1, to))
      const from = cur.current
      cur.current = n
      elapsed.current = 0
      ended.current = false
      setNav((s) => ({ cur: n, prev: from !== n ? from : -1, dir: n >= from ? 1 : -1, visits: s.visits.map((v, i) => (i === n ? v + 1 : v)) }))
    },
    [count],
  )
  const back = () => show(cur.current - 1)
  const forward = () => {
    if (cur.current < count - 1) show(cur.current + 1)
    else {
      ended.current = true
      elapsed.current = SLIDE_MS
    }
  }
  const setPause = (p: boolean) => {
    pausedRef.current = p
    setPaused(p)
  }

  // Cube turn between the outgoing and incoming slide.
  useLayoutEffect(() => {
    if (nav.prev < 0) return
    const a = slideEls.current[nav.prev]
    const b = slideEls.current[nav.cur]
    if (!a || !b || typeof a.animate !== 'function') return
    const d = nav.dir
    const o = { duration: 560, easing: 'cubic-bezier(.45,0,.2,1)' }
    a.style.transformOrigin = d > 0 ? '100% 50%' : '0% 50%'
    b.style.transformOrigin = d > 0 ? '0% 50%' : '100% 50%'
    const out = a.animate([{ transform: 'none', filter: 'brightness(1)' }, { transform: `translateX(${-d * 100}%) rotateY(${-d * 90}deg)`, filter: 'brightness(.45)' }], o)
    const inn = b.animate([{ transform: `translateX(${d * 100}%) rotateY(${d * 90}deg)`, filter: 'brightness(.45)' }, { transform: 'none', filter: 'brightness(1)' }], o)
    const prev = nav.prev
    out.onfinish = () => setNav((s) => (s.prev === prev ? { ...s, prev: -1 } : s))
    return () => {
      out.onfinish = null
      out.cancel()
      inn.cancel()
    }
  }, [nav])

  // Progress bars and auto-advance.
  useEffect(() => {
    let raf = 0
    let last = performance.now()
    const loop = (now: number) => {
      const dt = Math.min(100, now - last)
      last = now
      if (!pausedRef.current && !ended.current) {
        elapsed.current += dt
        if (elapsed.current >= SLIDE_MS) {
          if (cur.current < count - 1) show(cur.current + 1)
          else {
            ended.current = true
            elapsed.current = SLIDE_MS
          }
        }
      }
      const c = cur.current
      barEls.current.forEach((b, i) => {
        if (b) b.style.width = `${i < c ? 100 : i > c ? 0 : Math.min(100, (elapsed.current / SLIDE_MS) * 100)}%`
      })
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [count, show])

  const hold = useRef(0)
  const held = useRef(false)
  const down = useRef<{ x: number; y: number } | null>(null)
  useEffect(() => () => window.clearTimeout(hold.current), [])

  const onPointerDown = (e: ReactPointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    down.current = { x: e.clientX, y: e.clientY }
    held.current = false
    window.clearTimeout(hold.current)
    hold.current = window.setTimeout(() => {
      held.current = true
      setPause(true)
      buzz(5)
    }, 220)
  }
  const onPointerMove = (e: ReactPointerEvent) => {
    // A scroll or swipe is not a tap and does not pause.
    if (down.current && !held.current && Math.hypot(e.clientX - down.current.x, e.clientY - down.current.y) > 10) {
      window.clearTimeout(hold.current)
      down.current = null
    }
  }
  const end = (e: ReactPointerEvent, tap: boolean) => {
    window.clearTimeout(hold.current)
    if (held.current) {
      held.current = false
      down.current = null
      setPause(false)
      return
    }
    const d = down.current
    down.current = null
    if (!d || !tap || !root.current) return
    const r = root.current.getBoundingClientRect()
    buzz(4)
    if (e.clientX - r.left < r.width * 0.35) back()
    else forward()
  }
  const onKeyDown = (e: ReactKeyboardEvent) => {
    if (e.key === 'ArrowLeft') back()
    else if (e.key === 'ArrowRight') forward()
    else if (e.key === ' ') setPause(!pausedRef.current)
    else return
    e.preventDefault()
  }

  const onCard = slides[nav.cur]?.key === 'card'
  return (
    <div
      ref={root}
      className="ftg-social-story absolute inset-0 rounded-2xl"
      data-paused={paused || undefined}
      tabIndex={0}
      role="group"
      aria-label={`${t.recap.title} · ${monthLabel} (${nav.cur + 1}/${count})`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={(e) => end(e, true)}
      onPointerCancel={(e) => end(e, false)}
      onPointerLeave={(e) => held.current && end(e, false)}
      onContextMenu={(e) => e.preventDefault()}
      onKeyDown={onKeyDown}
    >
      <div className="ftg-social-bars" aria-hidden>
        {slides.map((s, i) => (
          <i key={s.key}>
            <b ref={(el) => void (barEls.current[i] = el)} />
          </i>
        ))}
      </div>
      {!onCard && (
        <div className="ftg-social-head" aria-hidden>
          <span className="overflow-hidden rounded-full">
            <Avatar user={me} size={24} />
          </span>
          <span className="truncate">@{me.username}</span>
        </div>
      )}
      <div className="ftg-social-slides">
        {slides.map((s, i) => {
          const visible = i === nav.cur || i === nav.prev
          return (
            <div
              key={s.key}
              ref={(el) => void (slideEls.current[i] = el)}
              className={`ftg-social-slide ${s.cls}`}
              data-cur={visible || undefined}
              data-on={visible || undefined}
              aria-hidden={i !== nav.cur}
            >
              {visible && <SlideBody key={nav.visits[i]}>{s.body}</SlideBody>}
            </div>
          )
        })}
      </div>
      <div className="ftg-social-pause" aria-hidden>
        <i />
        <i />
      </div>
    </div>
  )
}

/** Keyed per visit so each slide's numbers roll again when it comes back. */
function SlideBody({ children }: { children: ReactNode }) {
  return <>{children}</>
}
