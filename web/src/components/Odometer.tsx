import { useEffect, useState } from 'react'

const DIGITS = '0123456789'

/**
 * A number whose digits roll like a stadium scoreboard: each digit is a 0–9 strip that
 * slides to its value (with a little overshoot), units first. It rolls up from zeros when it
 * first appears and again whenever the value changes. Screen readers get the plain value.
 */
export function Odometer({ value, className = '' }: { value: number | string; className?: string }) {
  const text = String(value)
  const [shown, setShown] = useState(() => text.replace(/\d/g, '0'))
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(text))
    return () => cancelAnimationFrame(id)
  }, [text])
  const chars = [...text]
  const from = [...shown.padStart(chars.length, '0').slice(-chars.length)]
  return (
    <span className={`ftg-odo ${className}`} aria-label={text} role="text">
      {chars.map((ch, i) => {
        const pos = chars.length - 1 - i
        if (!/\d/.test(ch)) return <span key={`s${pos}`} aria-hidden>{ch}</span>
        const d = /\d/.test(from[i]) ? Number(from[i]) : 0
        return (
          <span key={`d${pos}`} className="ftg-odo-col" aria-hidden>
            <span className="ftg-odo-ghost">{ch}</span>
            <span
              className="ftg-odo-strip"
              style={{ transform: `translateY(${-d}em)`, transitionDelay: `${pos * 70}ms` }}
            >
              {[...DIGITS].map((x) => (
                <span key={x}>{x}</span>
              ))}
            </span>
          </span>
        )
      })}
    </span>
  )
}
