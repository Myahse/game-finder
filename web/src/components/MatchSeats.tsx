import { useEffect, useRef, useState } from 'react'
import { User } from 'lucide-react'
import { buzz, burst, shake } from '../lib/fx'
import { Odometer } from './Odometer'
import '../styles/motion-part5.css'

const MAX_SEATS = 12
const SIZE = 220
const RADIUS = 94

/**
 * The court from above with a seat per player: the players already in drop into their seats
 * one by one and the next free seat pulses "Your seat". Tapping it drops you in with confetti
 * and the count rolls (`onTake`). A full game gets a "Full" stamp that slams down.
 * Counts only — the public link never shows who is playing.
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
  labels: { yourSeat: string; you: string; players: (n: number, max: number) => string; fullStamp: string }
}) {
  const [mine, setMine] = useState(false)
  const seats = Math.max(2, Math.min(max, MAX_SEATS))
  const filled = Math.min(seats, max > MAX_SEATS ? Math.round((taken / max) * seats) : taken)
  const free = filled < seats ? filled : -1
  const pos = (i: number) => {
    const a = -Math.PI / 2 + (i / seats) * Math.PI * 2
    return { left: SIZE / 2 + Math.cos(a) * RADIUS, top: SIZE / 2 + Math.sin(a) * RADIUS }
  }

  const box = useRef<HTMLDivElement>(null)
  // Full: the stamp lands after the last player, with a little shake.
  useEffect(() => {
    if (free !== -1) return
    const id = window.setTimeout(() => {
      buzz([20, 30, 20])
      shake(box.current)
    }, 260 + filled * 160 + 380)
    return () => window.clearTimeout(id)
  }, [free, filled])

  const take = (el: HTMLElement) => {
    if (mine) return
    setMine(true)
    window.setTimeout(() => {
      burst(el, { n: 26 })
      buzz([10, 30, 14])
    }, 300)
    onTake?.()
  }

  return (
    <div className="grid justify-items-center gap-2">
      <div className="ftg-seats" ref={box}>
        {free === -1 && (
          <span className="ftg-seat-stamp" style={{ ['--d' as string]: `${260 + filled * 160}ms` }}>
            {labels.fullStamp}
          </span>
        )}
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
      <p className="display text-xl font-extrabold text-ink" aria-live="polite">
        <Odometer value={`${Math.min(max, taken + (mine ? 1 : 0))}/${max}`} />{' '}
        <span className="text-ink-2">{labels.players(taken + (mine ? 1 : 0), max).replace(/^\S+\s*/, '')}</span>
      </p>
    </div>
  )
}
