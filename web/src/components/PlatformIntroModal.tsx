import { useEffect, useRef, useState } from 'react'
import { MapPin, Plus, Users } from 'lucide-react'
import { buzz, burst, sparkle } from '../lib/fx'
import '../styles/motion-part5.css'
import { useLocale } from '../i18n/LocaleProvider'
import { Button } from './ui'

type Props = {
  open: boolean
  onClose: () => void
  /** Guests on `/` vs members on the map after onboarding */
  variant?: 'guest' | 'member'
}

const sleep = (ms: number) => new Promise((r) => window.setTimeout(r, ms))

/**
 * A dotted path runs down the three steps; each one lights up (with a little sparkle) as the
 * line reaches it, then the path keeps marching and the button pulses.
 */
function useIntroPath(open: boolean) {
  const list = useRef<HTMLOListElement>(null)
  const path = useRef<SVGPathElement>(null)
  const [lit, setLit] = useState(0)
  const [done, setDone] = useState(false)
  useEffect(() => {
    if (!open) return
    let alive = true
    const run = async () => {
      await sleep(350)
      const box = list.current
      const line = path.current
      if (!box || !line || !alive) return
      const b = box.getBoundingClientRect()
      const pts = [...box.querySelectorAll('.ftg-istep-ic')].map((el) => {
        const r = el.getBoundingClientRect()
        return [r.left - b.left + r.width / 2, r.top - b.top + r.height / 2] as const
      })
      if (pts.length < 2) return
      const first = pts[0]
      const last = pts[pts.length - 1]
      line.setAttribute('d', `M${first[0]} ${first[1]} L${last[0]} ${last[1]}`)
      const L = line.getTotalLength()
      line.style.strokeDasharray = `${L}`
      line.style.strokeDashoffset = `${L}`
      let drawn = 0
      for (let i = 0; i < pts.length && alive; i++) {
        const target = ((pts[i][1] - first[1]) / Math.max(1, last[1] - first[1])) * L
        const from = drawn
        const t0 = performance.now()
        const ms = i === 0 ? 1 : 550
        await new Promise<void>((resolve) => {
          const step = (now: number) => {
            const k = Math.min(1, (now - t0) / ms)
            const e = 1 - Math.pow(1 - k, 3)
            drawn = from + (target - from) * e
            line.style.strokeDashoffset = `${L - drawn}`
            if (k < 1 && alive) requestAnimationFrame(step)
            else resolve()
          }
          requestAnimationFrame(step)
        })
        if (!alive) return
        setLit(i + 1)
        buzz(6)
        sparkle({ x: b.left + pts[i][0], y: b.top + pts[i][1] }, 8)
        await sleep(260)
      }
      if (!alive) return
      line.style.strokeDashoffset = '0'
      setDone(true)
    }
    void run()
    return () => {
      alive = false
      setLit(0)
      setDone(false)
    }
  }, [open])
  return { list, path, lit, done }
}

export function PlatformIntroModal({ open, onClose, variant = 'member' }: Props) {
  const { t } = useLocale()
  const { list, path, lit, done } = useIntroPath(open)
  if (!open) return null

  const subtitle = variant === 'guest' ? t.intro.guestSubtitle : t.intro.subtitle
  const ctaLabel = variant === 'guest' ? t.intro.guestCta : t.intro.cta

  const steps = [
    { icon: MapPin, title: t.intro.step1Title, body: t.intro.step1Body },
    { icon: Users, title: t.intro.step2Title, body: t.intro.step2Body },
    { icon: Plus, title: t.intro.step3Title, body: t.intro.step3Body },
  ]

  return (
    <div
      className="ftg-safe-overlay ftg-safe-overlay-b ftg-backdrop fixed inset-0 z-[60] flex items-end justify-center bg-black/50 p-4 backdrop-blur-md sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="platform-intro-title"
      onClick={variant === 'guest' ? onClose : undefined}
    >
      <div
        className="ftg-dialog w-full max-w-md max-h-[min(90dvh,640px)] overflow-y-auto rounded-2xl border border-line bg-surface p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-xs font-semibold uppercase tracking-wide text-brand">{t.intro.eyebrow}</p>
        <h2 id="platform-intro-title" className="display mt-1 text-3xl font-extrabold">{t.intro.title}</h2>
        <p className="mt-2 text-sm text-ink-2">{subtitle}</p>

        <ol ref={list} className="relative mt-5 grid gap-4">
          <svg className={`ftg-ipath ${done ? 'is-done' : ''}`} aria-hidden>
            <path ref={path} />
          </svg>
          {steps.map(({ icon: Icon, title, body }, i) => (
            <li key={title} className={`ftg-istep flex gap-3 ${i < lit ? 'is-on' : ''}`}>
              <span
                className="ftg-istep-ic flex size-10 shrink-0 items-center justify-center rounded-xl bg-surface text-brand"
                aria-hidden
              >
                <Icon className="relative size-5" strokeWidth={2.2} />
              </span>
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-ink-2">{t.account.step.replace('{n}', String(i + 1))}</p>
                <p className="font-semibold text-ink">{title}</p>
                <p className="mt-0.5 text-sm text-ink-2">{body}</p>
              </div>
            </li>
          ))}
        </ol>

        <Button
          type="button"
          className={`ftg-icta mt-6 w-full min-h-11 text-base ${done ? 'is-pulse' : ''}`}
          onClick={(e) => {
            burst(e.currentTarget, { n: 22 })
            onClose()
          }}
        >
          {ctaLabel}
        </Button>
      </div>
    </div>
  )
}
