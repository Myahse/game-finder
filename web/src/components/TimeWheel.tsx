import { useEffect, useRef, type KeyboardEvent, type PointerEvent } from 'react'
import { buzz, replay, Spring } from '../lib/fx'
import '../styles/motion-create.css'

const IH = 36 // row height (px)
const R = IH / 2 / Math.tan(Math.PI / 18) // cylinder radius for 20° per row
const POOL = 11
const pad = (n: number) => String(n).padStart(2, '0')
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))

/** Pointer speed (px/s) over the last moves; 0 if the finger stopped before letting go. */
function velocity() {
  let px = 0, pt = 0, v = 0
  return {
    reset(x: number) { px = x; pt = performance.now(); v = 0 },
    push(x: number) {
      const t = performance.now(), dt = t - pt
      if (dt > 0) { const nv = ((x - px) / dt) * 1000; v = dt > 50 ? nv : v * 0.35 + nv * 0.65 }
      px = x
      pt = t
    },
    get v() { return performance.now() - pt > 90 ? 0 : v },
  }
}

type WheelProps = {
  count: number
  value: number
  fmt: (i: number) => string
  label: string
  onCommit: (i: number) => void
  onTick: (i: number) => void
}

/** One 3D drum: drag/flick with momentum, snaps to a row, mouse wheel and arrow keys step it. */
function Wheel({ count, value, fmt, label, onCommit, onTick }: WheelProps) {
  const elRef = useRef<HTMLDivElement>(null)
  const rows = useRef<(HTMLSpanElement | null)[]>([])
  const spRef = useRef<Spring | null>(null)
  const cb = useRef({ fmt, onCommit, onTick })
  useEffect(() => {
    cb.current = { fmt, onCommit, onTick }
  }, [fmt, onCommit, onTick])
  const mod = (k: number) => ((k % count) + count) % count

  useEffect(() => {
    let last = value
    const sp = new Spring(value, (p) => {
      const base = Math.round(p)
      rows.current.forEach((s, j) => {
        if (!s) return
        const k = base + j - (POOL >> 1), d = k - p
        if (Math.abs(d) > 4.4) { s.style.visibility = 'hidden'; return }
        s.style.visibility = ''
        s.textContent = cb.current.fmt(mod(k))
        s.style.transform = `rotateX(${-d * 20}deg) translateZ(${R}px)`
        s.style.opacity = String(clamp(1 - Math.abs(d) * 0.2, 0, 1))
      })
      if (base !== last) {
        last = base
        buzz(2)
        cb.current.onTick(mod(base))
      }
    }, { k: 120, c: 22, precision: 0.002 })
    spRef.current = sp
    return () => { sp.stop(); spRef.current = null }
    // The drum is built once; later values arrive through the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // A value set from outside (the date-time field): turn the short way round to it.
  useEffect(() => {
    const sp = spRef.current
    if (!sp || mod(Math.round(sp.t)) === value) return
    let d = value - mod(Math.round(sp.t))
    if (d > count / 2) d -= count
    if (d < -count / 2) d += count
    sp.to(Math.round(sp.t) + d, { k: 220, c: 24 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  const go = (target: number, opts: { k: number; c: number }) => {
    spRef.current?.to(target, opts)
    if (mod(target) !== value) cb.current.onCommit(mod(target))
  }

  useEffect(() => {
    const el = elRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      const sp = spRef.current
      if (!sp || e.deltaY === 0) return
      e.preventDefault()
      const target = Math.round(sp.t) + Math.sign(e.deltaY)
      sp.to(target, { k: 220, c: 24 })
      cb.current.onCommit(mod(target))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const drag = useRef<{ y: number; p0: number; vv: ReturnType<typeof velocity> } | null>(null)
  const down = (e: PointerEvent<HTMLDivElement>) => {
    const sp = spRef.current
    if (!sp || e.button !== 0) return
    const vv = velocity()
    vv.reset(e.clientY)
    drag.current = { y: e.clientY, p0: sp.x, vv }
    sp.set(sp.x)
    e.currentTarget.setPointerCapture(e.pointerId)
    e.currentTarget.focus({ preventScroll: true })
  }
  const move = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (!d) return
    d.vv.push(e.clientY)
    spRef.current?.set(d.p0 - (e.clientY - d.y) / IH)
  }
  const up = () => {
    const d = drag.current, sp = spRef.current
    if (!d || !sp) return
    drag.current = null
    const v = clamp(-d.vv.v / IH, -60, 60)
    sp.v = v
    go(Math.round(sp.x + v * 0.34), { k: 55, c: 14.5 })
  }
  const key = (e: KeyboardEvent) => {
    const step: Record<string, number> = { ArrowUp: 1, ArrowDown: -1, PageUp: 3, PageDown: -3 }
    const sp = spRef.current
    if (!sp || step[e.key] == null) return
    e.preventDefault()
    go(Math.round(sp.t) + step[e.key], { k: 220, c: 24 })
  }

  return (
    <div
      ref={elRef}
      className="ftg-create-wh"
      role="spinbutton"
      tabIndex={0}
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={count - 1}
      aria-valuenow={value}
      aria-valuetext={fmt(value)}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      onKeyDown={key}
    >
      <div className="ftg-create-cyl" style={{ transform: `translateZ(${-R}px)` }} aria-hidden>
        {Array.from({ length: POOL }, (_, i) => (
          <span key={i} ref={(el) => { rows.current[i] = el }} />
        ))}
      </div>
    </div>
  )
}

const fmtHour = (i: number) => pad(i)
const fmtMin = (i: number) => pad(i * 5)

/**
 * Start-time picker: an hour drum and a minute drum (5-minute steps) with inertia.
 * Controlled: `hour`/`minute` come from the page's start time, `onChange` writes it back.
 */
export function TimeWheel({
  hour,
  minute,
  onChange,
  dayLabel,
  title,
  hourLabel,
  minuteLabel,
  past,
}: {
  hour: number
  minute: number
  onChange: (hour: number, minute: number) => void
  dayLabel: string
  title: string
  hourLabel: string
  minuteLabel: string
  past: boolean
}) {
  const bandRef = useRef<HTMLSpanElement>(null)
  const outRef = useRef<HTMLElement>(null)
  const live = useRef({ h: hour, m: minute })
  const flashT = useRef(0)
  const dayRef = useRef(dayLabel)
  const mIndex = Math.round(minute / 5) % 12

  // The label shows the real start time, and ticks along while a drum spins.
  useEffect(() => {
    live.current = { h: hour, m: minute }
    dayRef.current = dayLabel
    if (outRef.current) outRef.current.textContent = `${dayLabel} ${pad(hour)}:${pad(minute)}`
  }, [hour, minute, dayLabel])
  useEffect(() => () => window.clearTimeout(flashT.current), [])

  const tick = (h: number, m: number) => {
    live.current = { h, m }
    const band = bandRef.current
    if (band) {
      band.classList.add('ftg-create-flash')
      window.clearTimeout(flashT.current)
      flashT.current = window.setTimeout(() => band.classList.remove('ftg-create-flash'), 60)
    }
    if (outRef.current) {
      outRef.current.textContent = `${dayRef.current} ${pad(h)}:${pad(m)}`
      replay(outRef.current, 'ftg-create-tick')
    }
  }

  return (
    <div>
      <div className={`ftg-create-whlab ${past ? 'ftg-create-past' : ''}`}>
        <b ref={outRef} />
      </div>
      <div className="ftg-create-wheels" role="group" aria-label={title}>
        <span ref={bandRef} className="ftg-create-band" />
        <Wheel
          count={24}
          value={hour}
          fmt={fmtHour}
          label={hourLabel}
          onTick={(h) => tick(h, live.current.m)}
          onCommit={(h) => onChange(h, minute)}
        />
        <span className="ftg-create-colon" aria-hidden>:</span>
        <Wheel
          count={12}
          value={mIndex}
          fmt={fmtMin}
          label={minuteLabel}
          onTick={(i) => tick(live.current.h, i * 5)}
          onCommit={(i) => onChange(hour, i * 5)}
        />
      </div>
    </div>
  )
}
