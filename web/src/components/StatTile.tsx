import { useEffect, useRef, type ReactNode } from 'react'
import { Card } from './ui'
import { Odometer } from './Odometer'
import { replay } from '../lib/fx'
import '../styles/motion-part5.css'

/** A number tile whose digits roll; it gives a little bump when a refresh changes it. */
export function StatTile({ label, value, live, liveLabel, highlight, footer }: {
  label: string
  value: number
  live?: boolean
  liveLabel?: string
  highlight?: boolean
  footer?: ReactNode
}) {
  const el = useRef<HTMLDivElement>(null)
  const prev = useRef(value)
  useEffect(() => {
    if (prev.current !== value) replay(el.current, 'ftg-tile-bump')
    prev.current = value
  }, [value])
  return (
    <div ref={el}>
      <Card className={highlight ? 'border-brand/50' : ''}>
        <p className="flex items-center gap-2 text-xs font-semibold uppercase text-ink-2">
          {label}
          {live && <span className="ftg-live-dot" title={liveLabel} aria-label={liveLabel} />}
        </p>
        <p className="display mt-1 text-5xl font-extrabold tabular-nums">
          <Odometer value={value} />
        </p>
        {footer}
      </Card>
    </div>
  )
}
