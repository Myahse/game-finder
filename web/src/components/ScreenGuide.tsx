import { useCallback, useEffect, useLayoutEffect, useState, type ComponentType } from 'react'
import { useLocale } from '../i18n/LocaleProvider'
import { useAuth } from '../lib/auth'
import { guideSeen, isNewPlayer, markGuideSeen, turnOffGuide, type GuideScreen } from '../lib/guide'
import { Button } from './ui'

export type GuideTip = {
  /** `data-guide` value of the element to spotlight; none = a centred card. */
  target?: string
  /** One icon, or a row of them (e.g. the app's sports). */
  icon: GuideIcon | GuideIcon[]
  title: string
  body: string
}

type GuideIcon = ComponentType<{ className?: string }>

type Rect = { top: number; left: number; width: number; height: number }

const PAD = 6

function findTarget(target?: string): HTMLElement | null {
  if (!target) return null
  const el = document.querySelector<HTMLElement>(`[data-guide="${target}"]`)
  if (!el) return null
  const r = el.getBoundingClientRect()
  return r.width > 0 && r.height > 0 ? el : null
}

/**
 * First-visit tips for one screen: a short card per tip, with the element it
 * talks about lit up. Shown once per screen to new players; "Skip tips" stops
 * them everywhere.
 */
export function ScreenGuide({ screen, tips, delay = 700 }: { screen: GuideScreen; tips: GuideTip[]; delay?: number }) {
  const { t } = useLocale()
  const tg = t.guide
  const { user } = useAuth()
  const [index, setIndex] = useState<number | null>(null)
  const [rect, setRect] = useState<Rect | null>(null)

  const eligible = !!user?.id && !!user.onboarded && isNewPlayer(user.created_at) && tips.length > 0
  useEffect(() => {
    if (!eligible || !user || guideSeen(user.id, screen)) return
    const timer = window.setTimeout(() => setIndex(0), delay)
    return () => window.clearTimeout(timer)
  }, [eligible, user, screen, delay])

  const tip = index === null ? null : tips[index]

  // Follow the spotlighted element (scrolls, resizes, late layout).
  useLayoutEffect(() => {
    if (!tip) return
    let frame = 0
    const el = findTarget(tip.target)
    if (el) {
      const r = el.getBoundingClientRect()
      if (r.top < 0 || r.bottom > window.innerHeight) el.scrollIntoView({ block: 'center' })
    }
    const measure = () => {
      const node = findTarget(tip.target)
      if (!node) {
        setRect(null)
        return
      }
      const r = node.getBoundingClientRect()
      setRect((prev) =>
        prev && prev.top === r.top && prev.left === r.left && prev.width === r.width && prev.height === r.height
          ? prev
          : { top: r.top, left: r.left, width: r.width, height: r.height },
      )
    }
    const loop = () => {
      measure()
      frame = window.requestAnimationFrame(loop)
    }
    loop()
    return () => window.cancelAnimationFrame(frame)
  }, [tip])

  const finish = useCallback(() => {
    if (user) markGuideSeen(user.id, screen)
    setIndex(null)
  }, [user, screen])

  const skipAll = () => {
    if (user) {
      markGuideSeen(user.id, screen)
      turnOffGuide(user.id)
    }
    setIndex(null)
  }

  const next = () => {
    if (index !== null && index + 1 < tips.length) setIndex(index + 1)
    else finish()
  }

  useEffect(() => {
    if (!tip) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && finish()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [tip, finish])

  if (!tip || index === null) return null
  const last = index === tips.length - 1
  // Card goes on the side away from the spotlight.
  const cardOnTop = !!rect && rect.top + rect.height / 2 > window.innerHeight / 2

  return (
    <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true" aria-labelledby="screen-guide-title">
      {rect ? (
        <div
          className="pointer-events-none fixed rounded-2xl ring-2 ring-brand transition-all duration-300 motion-reduce:transition-none"
          style={{
            top: rect.top - PAD,
            left: rect.left - PAD,
            width: rect.width + PAD * 2,
            height: rect.height + PAD * 2,
            boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.55)',
          }}
          aria-hidden
        />
      ) : (
        <div className="fixed inset-0 bg-black/55 backdrop-blur-sm" aria-hidden />
      )}

      <div
        className={`ftg-safe-overlay ftg-safe-overlay-b fixed inset-x-0 flex justify-center p-4 ${
          rect ? (cardOnTop ? 'top-0' : 'bottom-0') : 'inset-y-0 items-center'
        }`}
      >
        <div key={index} className="w-full max-w-md rounded-2xl border border-line bg-surface p-5 shadow-xl">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-brand">
              {tips.length > 1 ? tg.count.replace('{n}', String(index + 1)).replace('{total}', String(tips.length)) : tg.eyebrow}
            </p>
            <button type="button" onClick={skipAll} className="text-xs font-semibold text-ink-2 hover:text-ink">
              {tg.skip}
            </button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2" aria-hidden>
            {(Array.isArray(tip.icon) ? tip.icon : [tip.icon]).map((Icon, i) => (
              <span key={i} className="flex size-10 items-center justify-center rounded-xl bg-brand/15 text-brand">
                <Icon className="size-5" />
              </span>
            ))}
          </div>
          <h2 id="screen-guide-title" className="display mt-2 text-3xl font-extrabold leading-tight">
            {tip.title}
          </h2>
          <p className="mt-1 text-sm text-ink-2">{tip.body}</p>
          <div className="mt-4 flex items-center gap-3">
            {tips.length > 1 && (
              <span className="flex gap-1.5" aria-hidden>
                {tips.map((_, i) => (
                  <span key={i} className={`size-2 rounded-full ${i === index ? 'bg-brand' : 'bg-line'}`} />
                ))}
              </span>
            )}
            <Button autoFocus type="button" className="ml-auto min-h-11 px-6 text-base" onClick={next}>
              {last ? tg.done : tg.next}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
