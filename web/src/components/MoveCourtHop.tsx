import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { buzz, burst, dust, replay } from '../lib/fx'
import '../styles/motion-court.css'

type Spot = { name: string; latitude: number; longitude: number; wet: boolean; dry: boolean }

const PIN =
  '<svg viewBox="0 0 64 70" aria-hidden="true"><path d="M32 4c-11.6 0-21 9.4-21 21 0 15.8 21 35 21 35s21-19.2 21-35c0-11.6-9.4-21-21-21z" fill="#ff5a1f" stroke="#fff" stroke-width="3"/><circle cx="32" cy="25" r="12" fill="#fff"/><circle cx="32" cy="25" r="9.5" fill="#ff5a1f"/></svg>'

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

/** Where the two courts sit on the little map (percent), keeping their real compass direction. */
function layout(from: Spot, to: Spot) {
  let dx = (to.longitude - from.longitude) * Math.cos((from.latitude * Math.PI) / 180)
  let dy = -(to.latitude - from.latitude)
  const d = Math.hypot(dx, dy)
  if (d < 1e-9) {
    dx = 1
    dy = -0.5
  }
  const n = Math.hypot(dx, dy)
  const ux = dx / n
  const uy = dy / n
  const P0: [number, number] = [clamp(50 - ux * 30, 14, 86), clamp(62 - uy * 18, 44, 82)]
  const P1: [number, number] = [clamp(50 + ux * 30, 14, 86), clamp(62 + uy * 18, 44, 82)]
  const C: [number, number] = [(P0[0] + P1[0]) / 2, Math.min(P0[1], P1[1]) - 34]
  return { P0, P1, C }
}

/**
 * After a successful move: on a small illustrative map the game pin shakes off the rain, hops along a
 * dotted arc to the new court and lands with a puff; then the confirmation drops in.
 */
export function MoveCourtHop({ from, to, label, done }: { from: Spot; to: Spot; label: string; done: string }) {
  const map = useRef<HTMLDivElement>(null)
  const pin = useRef<HTMLSpanElement>(null)
  const sun = useRef<HTMLSpanElement>(null)
  const [trail, setTrail] = useState<[number, number][]>([])
  const [landed, setLanded] = useState(false)
  const [banner, setBanner] = useState(false)
  const { P0, P1, C } = layout(from, to)

  const put = (xp: number, yp: number, rot = 0, sx = 1, sy = 1) => {
    const m = map.current
    const p = pin.current
    if (!m || !p) return
    p.style.transform = `translate(${(xp / 100) * m.clientWidth - 18}px, ${(yp / 100) * m.clientHeight - 40}px) rotate(${rot}deg) scale(${sx}, ${sy})`
  }

  useLayoutEffect(() => {
    put(P0[0], P0[1])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const timers: number[] = []
    let raf = 0
    const later = (f: () => void, ms: number) => timers.push(window.setTimeout(f, ms))
    const tween = (ms: number, fn: (t: number) => void, end?: () => void) => {
      const t0 = performance.now()
      const step = (now: number) => {
        const t = clamp((now - t0) / ms, 0, 1)
        fn(t)
        if (t < 1) raf = requestAnimationFrame(step)
        else end?.()
      }
      raf = requestAnimationFrame(step)
    }
    const p = pin.current
    replay(p, 'ftg-court-x-wiggle')
    buzz([8, 30, 8])
    if (from.wet) {
      const drip = () => {
        const r = p?.getBoundingClientRect()
        if (!r) return
        burst(
          { x: r.left + r.width / 2, y: r.top + 12 },
          { n: 6, shape: 'dot', colors: ['#7dd3fc', '#38bdf8', '#e0f2fe'], speed: [1.5, 3.5], angle: -Math.PI / 2, spread: Math.PI * 1.4, gravity: 0.2, size: [3, 5], life: [16, 26] },
        )
      }
      drip()
      later(drip, 160)
      later(drip, 320)
    }
    later(() => {
      let px = P0[0]
      let lastDot = 0
      // Crouch, then the hop along the arc (leaning into the direction of travel), then land.
      tween(
        160,
        (t) => put(P0[0], P0[1] + t * 1.5, 0, 1 + t * 0.15, 1 - t * 0.2),
        () =>
          tween(
            820,
            (t) => {
              const e = easeInOut(t)
              const x = (1 - e) * (1 - e) * P0[0] + 2 * (1 - e) * e * C[0] + e * e * P1[0]
              const y = (1 - e) * (1 - e) * P0[1] + 2 * (1 - e) * e * C[1] + e * e * P1[1]
              const s = 1 + Math.sin(Math.PI * e) * 0.3
              put(x, y, clamp((x - px) * 9, -28, 28), s, s)
              px = x
              if (t - lastDot > 0.05 && t < 0.97) {
                lastDot = t
                setTrail((tr) => [...tr, [x, y]])
              }
            },
            () => {
              put(P1[0], P1[1])
              setLanded(true)
              replay(pin.current, 'ftg-court-x-land')
              replay(sun.current, 'ftg-court-x-glow')
              buzz([18, 30, 10])
              const r = pin.current?.getBoundingClientRect()
              if (r) dust({ x: r.left + r.width / 2, y: r.bottom }, 12)
              later(() => setBanner(true), 450)
            },
          ),
      )
    }, from.wet ? 520 : 300)
    return () => {
      timers.forEach((t) => window.clearTimeout(t))
      cancelAnimationFrame(raf)
    }
    // Plays once per mounted move.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Keep the pin on its court if the sheet changes size.
  useEffect(() => {
    const m = map.current
    if (!m || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => {
      if (landed) put(P1[0], P1[1])
    })
    ro.observe(m)
    return () => ro.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [landed])

  return (
    <div>
      <div ref={map} className="ftg-court-x-mvmap" role="img" aria-label={label}>
        <Court at={P0} name={from.name} wet={from.wet} />
        <Court at={P1} name={to.name} wet={to.wet} lit={landed} />
        {from.wet && <Cloud at={P0} />}
        {to.wet ? <Cloud at={P1} /> : to.dry && <span ref={sun} className="ftg-court-x-sun" style={{ left: `${P1[0]}%`, top: `${P1[1]}%` }} aria-hidden />}
        {trail.map(([x, y], i) => (
          <span key={i} className="ftg-court-x-trail" style={{ left: `${x}%`, top: `${y}%` }} aria-hidden />
        ))}
        <span ref={pin} className="ftg-court-x-gpin" dangerouslySetInnerHTML={{ __html: PIN }} aria-hidden />
        <p className="ftg-court-x-done" data-on={banner || undefined} role="status">
          {banner ? done : ''}
        </p>
      </div>
    </div>
  )
}

function Court({ at, name, wet, lit }: { at: [number, number]; name: string; wet: boolean; lit?: boolean }) {
  return (
    <>
      <span className="ftg-court-x-court" style={{ left: `${at[0]}%`, top: `${at[1]}%` }} data-wet={wet || undefined} data-lit={lit || undefined} aria-hidden>
        <i />
      </span>
      <span className="ftg-court-x-label" style={{ left: `${at[0]}%`, top: `${at[1]}%` }} aria-hidden>
        {name}
      </span>
    </>
  )
}

function Cloud({ at }: { at: [number, number] }) {
  return (
    <span className="ftg-court-x-cloud" style={{ left: `${at[0]}%`, top: `${at[1]}%` }} aria-hidden>
      <svg viewBox="0 0 58 34" width="58" height="34" aria-hidden>
        <path d="M14 30a10 10 0 0 1-1-20 13 13 0 0 1 25-3 9 9 0 0 1 9 9 7 7 0 0 1-1 14z" fill="#94a3b8" />
      </svg>
      <i />
      <i />
      <i />
      <i />
      <i />
    </span>
  )
}
