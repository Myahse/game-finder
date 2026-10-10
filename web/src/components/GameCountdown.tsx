import { useEffect, useRef, useState } from 'react'
import { useLocale } from '../i18n/LocaleProvider'
import { replay } from '../lib/fx'

const DAY = 24 * 3600

function pad(n: number) {
  return String(n).padStart(2, '0')
}

/**
 * Split-flap stadium clock counting down to a game that starts within 24h: each digit
 * folds in half when it changes, and the last minute turns orange and pulses.
 */
export function GameCountdown({ start }: { start: string }) {
  const { t } = useLocale()
  const at = new Date(start).getTime()
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [])
  const left = Math.max(0, Math.floor((at - now) / 1000))
  const clock = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (left > 0 && left <= 60) replay(clock.current, 'ftg-clock-tick')
  }, [left])
  if (left <= 0 || left > DAY) return null
  const h = Math.floor(left / 3600)
  const m = Math.floor((left % 3600) / 60)
  const s = left % 60
  const urgent = left <= 60
  const groups = h > 0 ? [pad(h), pad(m), pad(s)] : [pad(m), pad(s)]
  return (
    <div className="mt-4 grid justify-items-center gap-2" role="timer" aria-label={`${t.games.page.startsIn} ${groups.join(':')}`}>
      <p className="text-xs font-bold uppercase tracking-wider text-ink-2">{t.games.page.startsIn}</p>
      <div ref={clock} className={`ftg-clock flex items-center gap-1 ${urgent ? 'ftg-clock-urgent' : ''}`} aria-hidden>
        {groups.map((g, gi) => (
          <span key={gi} className="flex items-center gap-1">
            {gi > 0 && <span className="ftg-clock-sep">:</span>}
            {[...g].map((d, di) => (
              <Flap key={di} digit={d} />
            ))}
          </span>
        ))}
      </div>
    </div>
  )
}

/** One digit: the top half folds down over the old value, the new bottom half swings in. */
function Flap({ digit }: { digit: string }) {
  const prev = useRef(digit)
  const [flip, setFlip] = useState<{ from: string; to: string; n: number } | null>(null)
  useEffect(() => {
    if (prev.current === digit) return
    const from = prev.current
    prev.current = digit
    setFlip((f) => ({ from, to: digit, n: (f?.n ?? 0) + 1 }))
    const id = window.setTimeout(() => setFlip(null), 650)
    return () => window.clearTimeout(id)
  }, [digit])
  return (
    <span className="ftg-flap">
      <span className="ftg-flap-h ftg-flap-t">
        <span>{digit}</span>
      </span>
      <span className="ftg-flap-h ftg-flap-b">
        <span>{flip ? flip.from : digit}</span>
      </span>
      {flip && (
        <span key={flip.n}>
          <span className="ftg-flap-h ftg-flap-t ftg-flap-lt">
            <span>{flip.from}</span>
          </span>
          <span className="ftg-flap-h ftg-flap-b ftg-flap-lb">
            <span>{flip.to}</span>
          </span>
        </span>
      )}
    </span>
  )
}
