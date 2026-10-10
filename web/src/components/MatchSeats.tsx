import { useState } from 'react'
import { User } from 'lucide-react'
import { buzz, burst } from '../lib/fx'
import '../styles/motion-part5.css'

const MAX_SEATS = 12
const SIZE = 220
const RADIUS = 94

/**
 * The court from above with a seat per player: the players already in drop into their seats
 * one by one and the next free seat pulses "Your seat". Tapping it drops you in with confetti
 * (`onTake`). Counts only — the public link never shows who is playing.
 */
export function MatchSeats({
  taken,
  max,
  onTake,
  labels,
}: {
  taken: number
  max: number
  onTake?: () => void
  labels: { yourSeat: string; you: string; count: string; full: string }
}) {
  const [mine, setMine] = useState(false)
  const seats = Math.max(2, Math.min(max, MAX_SEATS))
  const filled = Math.min(seats, max > MAX_SEATS ? Math.round((taken / max) * seats) : taken)
  const free = filled < seats ? filled : -1
  const pos = (i: number) => {
    const a = -Math.PI / 2 + (i / seats) * Math.PI * 2
    return { left: SIZE / 2 + Math.cos(a) * RADIUS, top: SIZE / 2 + Math.sin(a) * RADIUS }
  }

  const take = (el: HTMLElement) => {
    if (mine) return
    setMine(true)
    window.setTimeout(() => {
      burst(el, { n: 24 })
      buzz([10, 30, 14])
    }, 300)
    onTake?.()
  }

  return (
    <div className="grid justify-items-center gap-2">
      <div className="ftg-seats">
        <svg viewBox="0 0 150 150" aria-hidden>
          <rect x="8" y="8" width="134" height="134" rx="8" fill="color-mix(in srgb, var(--brand) 12%, var(--surface))" stroke="var(--brand)" strokeWidth="3" />
          <line x1="8" y1="75" x2="142" y2="75" stroke="var(--brand)" strokeWidth="3" />
          <circle cx="75" cy="75" r="18" fill="none" stroke="var(--brand)" strokeWidth="3" />
        </svg>
        {Array.from({ length: seats }, (_, i) => {
          const p = pos(i)
          if (i < filled)
            return (
              <span key={i} className="ftg-seat is-taken" style={{ ...p, ['--d' as string]: `${200 + i * 160}ms` }} aria-hidden>
                <User className="size-4" strokeWidth={2.6} />
              </span>
            )
          if (i === free)
            return (
              <span key={i}>
                <button
                  type="button"
                  className={`ftg-seat ${mine ? 'is-me' : 'is-free'}`}
                  style={p}
                  onClick={(e) => take(e.currentTarget)}
                  aria-label={labels.yourSeat}
                  aria-pressed={mine}
                >
                  {mine ? labels.you : '+'}
                </button>
                {!mine && (
                  <span className="ftg-seat-lbl" style={{ left: p.left, top: p.top + 22 }}>
                    {labels.yourSeat}
                  </span>
                )}
              </span>
            )
          return <span key={i} className="ftg-seat" style={p} aria-hidden />
        })}
      </div>
      <p className="text-sm font-semibold text-ink-2">{free === -1 && !mine ? labels.full : labels.count}</p>
    </div>
  )
}
