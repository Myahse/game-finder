import { type FormEvent, type ReactNode, useState } from 'react'
import { Button } from './ui'

const DEFAULT_STEP_COUNT = 3

export function StepFlow({
  step,
  onStepChange,
  onStepAdvance,
  children,
  onSubmit,
  canNext,
  busy,
  nextLabel = 'Next',
  submitLabel = 'Continue',
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
  const panels = children.slice(0, stepCount)
  const last = stepCount - 1

  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <div className="flex items-center justify-center gap-2" aria-hidden>
        {Array.from({ length: stepCount }, (_, i) => (
          <span
            key={i}
            className={`h-1.5 rounded-full transition-all ${i === step ? 'w-8 bg-brand' : i < step ? 'w-4 bg-brand/50' : 'w-4 bg-line'}`}
          />
        ))}
      </div>
      <p className="text-center text-xs font-semibold uppercase tracking-wide text-ink-2">
        Step {step + 1} of {stepCount}
      </p>

      <div className="overflow-hidden rounded-2xl border border-line bg-surface/80 p-4 shadow-sm">
        <div
          className="flex transition-transform duration-300 ease-out motion-reduce:transition-none"
          style={{ transform: `translateX(-${step * 100}%)` }}
        >
          {panels.map((panel, i) => (
            <div key={i} className="min-w-full shrink-0 px-0.5">
              {panel}
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-2">
        {step > 0 ? (
          <Button type="button" variant="secondary" className="min-h-12 flex-1" onClick={() => onStepChange(step - 1)} disabled={busy}>
            Back
          </Button>
        ) : (
          <span className="flex-1" />
        )}
        {step < last ? (
          <Button type="button" className="min-h-12 flex-1" disabled={!canNext || busy} onClick={() => void onStepAdvance()}>
            {nextLabel}
          </Button>
        ) : (
          <Button type="submit" className="min-h-12 flex-1" loading={busy} disabled={!canNext || busy}>
            {submitLabel}
          </Button>
        )}
      </div>
    </form>
  )
}

export function useStepFlow(initial = 0) {
  const [step, setStep] = useState(initial)
  return { step, setStep, isFirst: step === 0, isLast: step === DEFAULT_STEP_COUNT - 1 }
}
