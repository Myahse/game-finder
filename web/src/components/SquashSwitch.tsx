import { useEffect, useRef } from 'react'
import { Spring, buzz } from '../lib/fx'
import '../styles/motion-part4.css'

const TRAVEL = 18

/**
 * An on/off switch whose knob is a soft ball: it stretches with its speed while it travels
 * and squashes when it lands. Tap it, or drag the knob.
 */
export function SquashSwitch({
  checked,
  onChange,
  label,
  disabled,
  className = '',
}: {
  checked: boolean
  onChange: (next: boolean) => void
  label: string
  disabled?: boolean
  className?: string
}) {
  const knob = useRef<HTMLSpanElement>(null)
  const spring = useRef<Spring | null>(null)
  const drag = useRef<{ x: number; x0: number; moved: boolean } | null>(null)

  useEffect(() => {
    let last = checked ? TRAVEL : 0
    spring.current = new Spring(
      last,
      (x) => {
        const el = knob.current
        if (!el) return
        const vel = x - last
        last = x
        const stretch = Math.min(10, Math.abs(vel) * 2.4)
        el.style.width = `${22 + stretch}px`
        el.style.transform = `translateX(${x - (vel < 0 ? stretch : 0)}px)`
      },
      { k: 420, c: 24 },
    )
    return () => spring.current?.stop()
    // The spring is created once; later changes go through the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const s = spring.current
    if (!s) return
    s.done = () => {
      s.done = undefined
      knob.current?.animate([{ scale: '1.25 0.78' }, { scale: '1 1' }], { duration: 260, easing: 'cubic-bezier(.34,1.56,.64,1)' })
    }
    s.to(checked ? TRAVEL : 0)
  }, [checked])

  const flip = (next: boolean) => {
    if (disabled) return
    buzz(6)
    if (next === checked) spring.current?.to(checked ? TRAVEL : 0)
    else onChange(next)
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      className={`ftg-sw ${checked ? 'is-on' : ''} ${className}`}
      onPointerDown={(e) => {
        if (disabled) return
        drag.current = { x: e.clientX, x0: spring.current?.x ?? 0, moved: false }
        e.currentTarget.setPointerCapture(e.pointerId)
      }}
      onPointerMove={(e) => {
        const d = drag.current
        if (!d) return
        const dx = e.clientX - d.x
        if (Math.abs(dx) > 3) d.moved = true
        if (d.moved) spring.current?.set(Math.min(TRAVEL, Math.max(0, d.x0 + dx)))
      }}
      onPointerUp={() => {
        const d = drag.current
        drag.current = null
        if (!d) return
        flip(d.moved ? (spring.current?.x ?? 0) > TRAVEL / 2 : !checked)
      }}
      onPointerCancel={() => {
        drag.current = null
        spring.current?.to(checked ? TRAVEL : 0)
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          flip(!checked)
        }
      }}
    >
      <span ref={knob} className="ftg-sw-k" />
    </button>
  )
}
