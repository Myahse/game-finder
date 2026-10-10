import { useEffect, useRef, useState, type InputHTMLAttributes } from 'react'
import { useLocale } from '../i18n/LocaleProvider'
import { burst, buzz, replay } from '../lib/fx'
import { Input } from './ui'
import { passwordScore } from '../lib/onboardMotion'
import '../styles/motion-onboard.css'

const COLORS = ['', '#ef2b54', '#f97316', '#f2b632', '#16a34a']

/** Four segments that fill one by one (Weak / Fair / Good / Strong); sparks when it hits Strong. */
export function PasswordStrength({ value }: { value: string }) {
  const { t } = useLocale()
  const u = t.account.ui
  const labels = ['', u.pwWeak, u.pwFair, u.pwGood, u.pwStrong]
  const score = passwordScore(value)
  const meter = useRef<HTMLDivElement>(null)
  const last = useRef(score)

  useEffect(() => {
    const prev = last.current
    last.current = score
    const el = meter.current
    if (!el || score === prev) return
    el.querySelectorAll('i').forEach((g, i) => {
      if (i >= prev && i < score) replay(g, 'ftg-onboard-mpop')
    })
    buzz(4)
    if (score === 4) {
      const r = el.getBoundingClientRect()
      burst({ x: r.left + r.width * 0.6, y: r.top + 8 }, { n: 18, shape: 'spark', colors: ['#16a34a', '#86efac', '#ffffff'], speed: [2, 6], gravity: 0.05, life: [12, 24] })
    }
  }, [score])

  return (
    <div
      ref={meter}
      className="ftg-onboard-meter"
      style={{ ['--ftg-onboard-mc' as string]: COLORS[score] || 'var(--line)' }}
      role="meter"
      aria-label={u.pwStrength}
      aria-valuemin={0}
      aria-valuemax={4}
      aria-valuenow={score}
      aria-valuetext={labels[score] || undefined}
    >
      {[0, 1, 2, 3].map((i) => (
        <i key={i} className={i < score ? 'is-on' : undefined} />
      ))}
      <span key={score} className="ftg-onboard-swap" aria-hidden>
        {labels[score]}
      </span>
    </div>
  )
}

/**
 * A password input whose eye blinks when it toggles (the slash draws itself in / out).
 * Same props as `PasswordInput`; `meter` adds the strength bar under it.
 */
export function PasswordField({
  className = '',
  autoComplete = 'current-password',
  meter = false,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & { meter?: boolean }) {
  const [visible, setVisible] = useState(false)
  const eye = useRef<SVGSVGElement>(null)
  const { t } = useLocale()
  return (
    <>
      <div className="relative">
        <Input {...props} type={visible ? 'text' : 'password'} autoComplete={autoComplete} className={`pr-11 ${className}`} />
        <button
          type="button"
          className={`ftg-onboard-eye absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-ink-2 hover:text-ink ${visible ? 'is-shown' : ''}`}
          onClick={() => {
            setVisible((v) => !v)
            const svg = eye.current
            if (svg) {
              svg.classList.remove('ftg-onboard-blink')
              void svg.getBoundingClientRect()
              svg.classList.add('ftg-onboard-blink')
            }
            buzz(4)
          }}
          aria-label={visible ? t.account.ui.hidePassword : t.account.ui.showPassword}
        >
          <svg ref={eye} viewBox="0 0 24 24" className="size-5" aria-hidden>
            <path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z" fill="none" stroke="currentColor" strokeWidth="2" />
            <circle className="ftg-onboard-pupil" cx="12" cy="12" r="3.2" fill="currentColor" />
            <path className="ftg-onboard-slash" d="M4 4l16 16" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      {meter && <PasswordStrength value={typeof props.value === 'string' ? props.value : ''} />}
    </>
  )
}
