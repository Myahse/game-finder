import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useLocale } from '../i18n/LocaleProvider'
import { openNow } from '../lib/courtMotion'
import { replay } from '../lib/fx'
import { Odometer } from './Odometer'
import '../styles/motion-court.css'

/** "Open · until 22:00" with a breathing dot, or "Closed · opens at 06:00". Nothing when hours are unknown. */
export function OpenNowPill({ hours, className = '' }: { hours: string | null | undefined; className?: string }) {
  const { t } = useLocale()
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000)
    return () => window.clearInterval(id)
  }, [])
  const s = openNow(hours, now)
  if (!s) return null
  const tp = t.courts.openPill
  return (
    <span className={`ftg-court-x-open ${className}`} data-open={s.open || undefined}>
      <span className="ftg-court-x-dot" aria-hidden />
      {s.open ? tp.open : tp.closed}
      <span className="font-semibold opacity-80">· {s.open ? tp.until.replace('{time}', s.closes) : tp.opensAt.replace('{time}', s.opens)}</span>
    </span>
  )
}

/** A sentence with `{n}` filled by a node (e.g. a rolling number). */
export function CountSentence({ template, n }: { template: string; n: ReactNode }) {
  const i = template.indexOf('{n}')
  if (i < 0) return <>{template}</>
  return (
    <>
      {template.slice(0, i)}
      {n}
      {template.slice(i + 3)}
    </>
  )
}

/** Player count that rolls (Odometer) and makes its live dot beat whenever it changes. */
export function LiveCount({ value, live }: { value: number; live: boolean }) {
  const dot = useRef<HTMLSpanElement>(null)
  const prev = useRef(value)
  useEffect(() => {
    if (prev.current !== value) replay(dot.current, 'ftg-court-x-beat')
    prev.current = value
  }, [value])
  return (
    <>
      {live && <span ref={dot} className="ftg-court-x-ldot" aria-hidden />}
      <Odometer value={value} />
    </>
  )
}
