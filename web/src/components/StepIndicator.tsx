import { useEffect, useLayoutEffect, useRef } from 'react'
import { useLocale } from '../i18n/LocaleProvider'
import { burst, buzz, replay, Spring } from '../lib/fx'
import { CHECK_PATH, clamp } from '../lib/onboardMotion'
import '../styles/motion-onboard.css'

/**
 * Step dots joined by a line that flows like liquid to the next dot (a droplet rides its head).
 * Passed dots fill and turn into a drawn check; the dot it reaches pulses and throws sparks.
 */
export function StepIndicator({ current, total }: { current: number; total: number }) {
  const { t } = useLocale()
  const line = useRef<HTMLSpanElement>(null)
  const fill = useRef<HTMLElement>(null)
  const drop = useRef<HTMLElement>(null)
  const dots = useRef<(HTMLSpanElement | null)[]>([])
  const spring = useRef<Spring | null>(null)
  const state = useRef({ step: current - 1, arrived: true })
  const span = Math.max(1, total - 1)

  useLayoutEffect(() => {
    const s = new Spring(state.current.step / span, (v) => {
      const w = line.current?.clientWidth ?? 0
      if (fill.current) fill.current.style.width = `${Math.max(0, v * w)}px`
      const sp = spring.current ? Math.abs(spring.current.v) : 0
      if (drop.current) {
        drop.current.style.left = `${clamp(v, 0, 1) * w}px`
        drop.current.style.opacity = String(clamp(sp * 2.5, 0, 1))
        drop.current.style.transform = `scale(${1 + Math.min(sp * 1.6, 1.3)}, ${1 - Math.min(sp * 0.5, 0.4)})`
      }
      const { step, arrived } = state.current
      dots.current.forEach((d, i) => {
        if (d && i < step && v >= i / span - 0.02) d.classList.add('is-done')
      })
      if (!arrived && v >= step / span - 0.03) {
        state.current.arrived = true
        const d = dots.current[step]
        if (d) {
          replay(d, 'ftg-onboard-pulse')
          buzz(6)
          const brand = getComputedStyle(d).getPropertyValue('--brand').trim() || '#ff5a1f'
          burst(d, { n: 10, shape: 'spark', colors: [brand, '#f2b632', '#ffffff'], speed: [2, 5], gravity: 0.05, life: [10, 18] })
        }
      }
    }, { k: 110, c: 15, precision: 0.001 })
    spring.current = s
    const ro = new ResizeObserver(() => s.onUpdate(s.x))
    if (line.current) ro.observe(line.current)
    return () => {
      ro.disconnect()
      s.stop()
    }
  }, [span])

  useEffect(() => {
    const step = current - 1
    const fwd = step > state.current.step
    state.current = { step, arrived: !fwd }
    dots.current.forEach((d, i) => {
      if (!d) return
      d.classList.toggle('is-cur', i === step)
      if (i >= step) d.classList.remove('is-done')
    })
    spring.current?.to(step / span)
  }, [current, span])

  return (
    <div
      className="ftg-onboard-steps mx-auto w-full max-w-[280px]"
      aria-label={t.account.stepOf.replace('{n}', String(current)).replace('{total}', String(total))}
    >
      <span ref={line} className="ftg-onboard-sline" aria-hidden>
        <i ref={fill} className="ftg-onboard-sfill" />
        <b ref={drop} className="ftg-onboard-sdrop" />
      </span>
      {Array.from({ length: total }, (_, i) => {
        const n = i + 1
        return (
          <span
            key={n}
            ref={(el) => {
              dots.current[i] = el
            }}
            // Classes are driven by the spring (is-done / pulse) and the effect (is-cur), not by React.
            className="ftg-onboard-sdot"
            aria-current={n === current ? 'step' : undefined}
          >
            <em>{n}</em>
            <svg viewBox="0 0 24 24" aria-hidden>
              <path d={CHECK_PATH} fill="none" stroke="var(--brand-ink)" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        )
      })}
    </div>
  )
}
