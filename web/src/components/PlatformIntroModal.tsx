import { MapPin, Plus, Users } from 'lucide-react'
import { useLocale } from '../i18n/LocaleProvider'
import { Button } from './ui'

type Props = {
  open: boolean
  onClose: () => void
  /** Guests on `/` vs members on the map after onboarding */
  variant?: 'guest' | 'member'
}

export function PlatformIntroModal({ open, onClose, variant = 'member' }: Props) {
  const { t } = useLocale()
  if (!open) return null

  const subtitle = variant === 'guest' ? t.intro.guestSubtitle : t.intro.subtitle
  const cta = variant === 'guest' ? t.intro.guestCta : t.intro.cta

  const steps = [
    { icon: MapPin, title: t.intro.step1Title, body: t.intro.step1Body },
    { icon: Users, title: t.intro.step2Title, body: t.intro.step2Body },
    { icon: Plus, title: t.intro.step3Title, body: t.intro.step3Body },
  ]

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 p-4 backdrop-blur-md sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="platform-intro-title"
      onClick={variant === 'guest' ? onClose : undefined}
    >
      <div
        className="w-full max-w-md max-h-[min(90dvh,640px)] overflow-y-auto rounded-2xl border border-line bg-surface p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-xs font-semibold uppercase tracking-wide text-brand">{t.intro.eyebrow}</p>
        <h2 id="platform-intro-title" className="display mt-1 text-3xl font-extrabold">{t.intro.title}</h2>
        <p className="mt-2 text-sm text-ink-2">{subtitle}</p>

        <ol className="mt-5 grid gap-4">
          {steps.map(({ icon: Icon, title, body }, i) => (
            <li key={title} className="flex gap-3">
              <span
                className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand/15 text-brand"
                aria-hidden
              >
                <Icon className="size-5" strokeWidth={2.2} />
              </span>
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-ink-2">Step {i + 1}</p>
                <p className="font-semibold text-ink">{title}</p>
                <p className="mt-0.5 text-sm text-ink-2">{body}</p>
              </div>
            </li>
          ))}
        </ol>

        <Button type="button" className="mt-6 w-full min-h-11 text-base" onClick={onClose}>
          {cta}
        </Button>
      </div>
    </div>
  )
}
