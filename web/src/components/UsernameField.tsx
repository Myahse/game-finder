import { useEffect, useRef, type InputHTMLAttributes } from 'react'
import { useLocale } from '../i18n/LocaleProvider'
import { burst, buzz, replay } from '../lib/fx'
import type { UsernameStatus } from '../lib/useUsernameCheck'
import { Input } from './ui'
import '../styles/motion-onboard.css'

/** The username input with a status mark: spinner → drawn green check, or a red cross with a shake. */
export function UsernameInput({ status, className = '', ...props }: InputHTMLAttributes<HTMLInputElement> & { status: UsernameStatus }) {
  const wrap = useRef<HTMLDivElement>(null)
  const prev = useRef(status)
  useEffect(() => {
    if (status === prev.current) return
    prev.current = status
    const el = wrap.current
    if (!el) return
    if (status === 'taken') {
      replay(el, 'ftg-onboard-fshake')
      buzz([20, 40, 20])
    } else if (status === 'available') {
      buzz(10)
      const id = window.setTimeout(() => {
        const mark = el.querySelector('.ftg-onboard-ust')
        if (mark) burst(mark, { n: 12, shape: 'spark', colors: ['#16a34a', '#86efac', '#ffffff'], speed: [2, 5], gravity: 0.04, life: [12, 22] })
      }, 200)
      return () => window.clearTimeout(id)
    }
  }, [status])

  return (
    <div ref={wrap} className={`ftg-onboard-ufld is-${status}`}>
      <Input {...props} className={`pr-11 ${className}`} />
      <span className="ftg-onboard-ust" aria-hidden>
        <svg className="ftg-onboard-spn" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeDasharray="16 60" />
        </svg>
        <svg className="ftg-onboard-ok" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="11" fill="var(--live)" />
          <path d="M7 12.5l3.2 3.2L17 9" fill="none" stroke="#fff" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <svg className="ftg-onboard-no" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="11" fill="var(--danger)" />
          <path d="M8.5 8.5l7 7M15.5 8.5l-7 7" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" />
        </svg>
      </span>
    </div>
  )
}

/** The line under the username: hint, "taken" (red) or "available" (green), sliding in on change. */
export function UsernameHint({ status }: { status: UsernameStatus }) {
  const { t } = useLocale()
  if (status === 'taken') {
    return (
      <span key="taken" className="ftg-onboard-msg text-danger" aria-live="polite">
        {t.onboarding.usernameTaken}
      </span>
    )
  }
  if (status === 'available') {
    return (
      <span key="ok" className="ftg-onboard-msg font-semibold text-live" aria-live="polite">
        {t.onboarding.usernameAvailable}
      </span>
    )
  }
  return <span key="hint">{t.onboarding.usernameHint}</span>
}

/** Alternatives the server confirmed free; they pop in one after another. */
export function UsernameSuggestions({ list, onPick }: { list: string[]; onPick: (u: string) => void }) {
  const { t } = useLocale()
  if (!list.length) return null
  return (
    <div className="-mt-1 flex flex-wrap items-center gap-1.5">
      <span className="text-xs font-semibold text-ink-2">{t.onboarding.usernameIdeas}</span>
      {list.map((s, i) => (
        <button
          key={s}
          type="button"
          className="ftg-onboard-sugg"
          style={{ animationDelay: `${i * 70}ms` }}
          onClick={() => {
            buzz(5)
            onPick(s)
          }}
        >
          @{s}
        </button>
      ))}
    </div>
  )
}
