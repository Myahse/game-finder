import { useLocale } from '../i18n/LocaleProvider'

export function StepIndicator({ current, total }: { current: number; total: number }) {
  const { t } = useLocale()
  return (
    <div className="flex items-center justify-center gap-1.5" aria-label={t.account.stepOf.replace('{n}', String(current)).replace('{total}', String(total))}>
      {Array.from({ length: total }, (_, i) => {
        const n = i + 1
        return (
          <span
            key={n}
            className={`flex size-8 items-center justify-center rounded-full text-sm font-extrabold tabular-nums ${
              n === current ? 'bg-brand text-brand-ink' : n < current ? 'bg-brand/25 text-brand' : 'bg-surface-2 text-ink-2'
            }`}
            aria-current={n === current ? 'step' : undefined}
          >
            {n}
          </span>
        )
      })}
    </div>
  )
}
