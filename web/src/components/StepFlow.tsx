import { type FormEvent, type ReactNode, useCallback, useLayoutEffect, useRef, useState } from 'react'
import { Button } from './ui'
import { StepIndicator } from './StepIndicator'
import { useLocale } from '../i18n/LocaleProvider'
import { cheer, buzz, replay, Spring } from '../lib/fx'
import '../styles/motion-onboard.css'

const DEFAULT_STEP_COUNT = 3

export function StepFlow({
  step,
  onStepChange,
  onStepAdvance,
  children,
  onSubmit,
  canNext,
  busy,
  nextLabel,
  submitLabel,
  stepCount = DEFAULT_STEP_COUNT,
}: {
  step: number
  onStepChange: (step: number) => void
  onStepAdvance: () => void | Promise<void>
  children: ReactNode[]
  onSubmit: (e: FormEvent) => void
  canNext: boolean
  busy?: boolean
  nextLabel?: string
  submitLabel?: string
  stepCount?: number
}) {
  const { t } = useLocale()
  const panels = children.slice(0, stepCount)
  const last = stepCount - 1
  const paneRefs = useRef<(HTMLDivElement | null)[]>([])
  const page = useRef<Spring | null>(null)

  // Panes slide on a spring: the leaving one tips and shrinks a little.
  useLayoutEffect(() => {
    const draw = (p: number) =>
      paneRefs.current.forEach((el, i) => {
        if (!el) return
        const d = i - p
        const ad = Math.min(Math.abs(d), 1)
        el.style.transform = `translateX(${d * 106}%) scale(${1 - ad * 0.12}) rotate(${d * 3}deg)`
        el.style.opacity = String(1 - ad * 0.7)
        el.style.visibility = Math.abs(d) > 1.2 ? 'hidden' : ''
      })
    if (!page.current) page.current = new Spring(step, draw, { k: 190, c: 21, precision: 0.001 })
    else page.current.to(step)
  }, [step])
  useLayoutEffect(() => () => page.current?.stop(), [])

  const submitWithConfetti = (e: FormEvent) => {
    const btn = (e.currentTarget as HTMLFormElement).querySelector('button[type="submit"]')
    if (btn) {
      replay(btn, 'ftg-onboard-boing')
      buzz([12, 40, 20])
      cheer(btn, 40)
    }
    onSubmit(e)
  }

  return (
    <form onSubmit={submitWithConfetti} className="grid gap-4">
      <div aria-hidden>
        <StepIndicator current={step + 1} total={stepCount} />
      </div>
      <p className="text-center text-xs font-semibold uppercase tracking-wide text-ink-2">
        {t.account.stepOf.replace('{n}', String(step + 1)).replace('{total}', String(stepCount))}
      </p>

      <div className="overflow-hidden rounded-2xl border border-line bg-surface/80 p-4 shadow-sm">
        {/* All panes share one grid cell, so the box takes the tallest; the spring moves them sideways. */}
        <div className="grid">
          {panels.map((panel, i) => (
            <div
              key={i}
              ref={(el) => {
                paneRefs.current[i] = el
              }}
              className="ftg-onboard-pane col-start-1 row-start-1 min-w-0 px-0.5"
              aria-hidden={i !== step || undefined}
              inert={i !== step || undefined}
            >
              {panel}
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-2">
        {step > 0 ? (
          <Button type="button" variant="secondary" className="min-h-12 flex-1" onClick={() => onStepChange(step - 1)} disabled={busy}>
            {t.account.back}
          </Button>
        ) : (
          <span className="flex-1" />
        )}
        {step < last ? (
          <Button key="next" type="button" className="min-h-12 flex-1" disabled={!canNext || busy} onClick={() => void onStepAdvance()}>
            {nextLabel ?? t.account.next}
          </Button>
        ) : (
          <Button key="submit" type="submit" className="min-h-12 flex-1" loading={busy} disabled={!canNext || busy}>
            {submitLabel ?? t.account.continue}
          </Button>
        )}
      </div>
    </form>
  )
}

export function useStepFlow(initial = 0) {
  const [{ step, dir }, setState] = useState({ step: initial, dir: 0 })
  const setStep = useCallback((n: number) => setState((s) => ({ step: n, dir: n === s.step ? s.dir : n > s.step ? 1 : -1 })), [])
  /** `dir`: 1 after moving forward, -1 after going back, 0 at first. */
  return { step, dir, setStep, isFirst: step === 0, isLast: step === DEFAULT_STEP_COUNT - 1 }
}

/**
 * One step's content that slides in on a spring from the side it comes from.
 * Give it `key={step}` so each step mounts fresh.
 */
export function StepPane({ dir, children, className = '' }: { dir: number; children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el || !dir) return
    const s = new Spring(dir, (p) => {
      const ad = Math.min(Math.abs(p), 1)
      el.style.transform = p ? `translateX(${p * 60}%) scale(${1 - ad * 0.1}) rotate(${p * 3}deg)` : ''
      el.style.opacity = String(1 - ad * 0.8)
    }, { k: 190, c: 21, precision: 0.001 })
    s.to(0)
    return () => s.stop()
  }, [dir])
  return (
    <div ref={ref} className={`ftg-onboard-pane ${className}`}>
      {children}
    </div>
  )
}
