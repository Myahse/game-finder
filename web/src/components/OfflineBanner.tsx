import { useEffect, useState } from 'react'
import { useLocale } from '../i18n/LocaleProvider'
import '../styles/motion-feedback.css'

type State = 'online' | 'offline' | 'back'

/** Banner while the browser is offline: the ball deflates, then pumps back up when the connection returns. */
export function OfflineBanner() {
  const { t } = useLocale()
  const [state, setState] = useState<State>(() => (typeof navigator !== 'undefined' && navigator.onLine === false ? 'offline' : 'online'))
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    const off = () => {
      setLeaving(false)
      setState('offline')
    }
    const on = () => setState((s) => (s === 'offline' ? 'back' : s))
    window.addEventListener('offline', off)
    window.addEventListener('online', on)
    return () => {
      window.removeEventListener('offline', off)
      window.removeEventListener('online', on)
    }
  }, [])

  useEffect(() => {
    if (state !== 'back') return
    const a = window.setTimeout(() => setLeaving(true), 1800)
    const b = window.setTimeout(() => {
      setState('online')
      setLeaving(false)
    }, 2200)
    return () => {
      window.clearTimeout(a)
      window.clearTimeout(b)
    }
  }, [state])

  if (state === 'online') return null
  const back = state === 'back'
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[65] flex justify-center px-3 pt-[max(0.5rem,env(safe-area-inset-top))]">
      <div
        role="status"
        aria-live="polite"
        className={`ftg-offline pointer-events-auto flex items-center gap-3 rounded-2xl border px-3 py-2 shadow-lg ${
          back ? 'is-online border-live/40 bg-surface' : 'border-line bg-surface'
        } ${leaving ? 'is-leaving' : ''}`}
      >
        <svg width="34" height="30" viewBox="0 0 34 30" aria-hidden className="shrink-0 overflow-visible">
          <ellipse cx="15" cy="28" rx="11" ry="1.6" fill="currentColor" className="text-ink-2" opacity="0.25" />
          <g className="ftg-offline-ball" key={state}>
            <circle cx="15" cy="15" r="12" fill="var(--brand)" />
            <path d="M3 15h24M15 3v24M6.5 6.5c4 3 4 14 0 17M23.5 6.5c-4 3-4 14 0 17" stroke="rgb(0 0 0 / 0.45)" strokeWidth="1.3" fill="none" />
          </g>
          {!back && (
            <g className="ftg-offline-air text-ink-2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
              <path d="M27 9l3-2M28 12l4-1" />
            </g>
          )}
        </svg>
        <span className="min-w-0">
          <span className={`block text-sm font-bold ${back ? 'text-live' : ''}`}>{back ? t.common.backOnline : t.common.offline}</span>
          {!back && <span className="block text-xs text-ink-2">{t.common.offlineHint}</span>}
        </span>
      </div>
    </div>
  )
}
