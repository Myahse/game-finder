import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Spring, buzz, burst, centerOf } from '../lib/fx'
import '../styles/motion-part4.css'

/**
 * An invitation shown as a ticket hanging from a nail: it swings in and settles like a
 * pendulum. Pull the stub down (or tap it) to tear it off along the dashes; it also tears
 * itself after a moment. The actions pop in once the stub is gone.
 */
export function InviteTicket({ children, actions, stub, pull }: { children: ReactNode; actions: ReactNode; stub: string; pull: string }) {
  const ticket = useRef<HTMLDivElement>(null)
  const stubEl = useRef<HTMLButtonElement>(null)
  const swing = useRef<Spring | null>(null)
  const pullState = useRef({ r: 0, y: 0 })
  const [torn, setTorn] = useState(false)
  const tornRef = useRef(false)

  const paintStub = (x: number, y: number, r: number) => {
    if (stubEl.current) stubEl.current.style.transform = `translate(${x}px, ${y}px) rotate(${r}deg)`
  }

  const tear = () => {
    if (tornRef.current || !stubEl.current) return
    tornRef.current = true
    const el = stubEl.current
    const c = centerOf(el)
    burst({ x: c.x - 30, y: c.y }, { n: 18, colors: ['#ff5a1f', '#ffffff', '#ffd7c2'], speed: [1, 4], gravity: 0.18, life: [30, 60], size: [3, 6] })
    buzz([10, 20, 10])
    swing.current?.kick(-60)
    let x = 0
    let y = pullState.current.y
    let r = pullState.current.r
    let vx = 1.5
    let vy = -2
    const t0 = performance.now()
    const fall = (now: number) => {
      vy += 0.55
      x += vx
      y += vy
      r += 3
      paintStub(x, y, r)
      if (now - t0 < 900) requestAnimationFrame(fall)
      else {
        el.style.visibility = 'hidden'
        setTorn(true)
      }
    }
    requestAnimationFrame(fall)
  }

  useEffect(() => {
    const el = ticket.current
    if (!el) return
    let angle = 0
    let y = -220
    const paint = () => (el.style.transform = `translateY(${y}px) rotate(${angle}deg)`)
    swing.current = new Spring(0, (a) => ((angle = a), paint()), { k: 90, c: 3.2 })
    const drop = new Spring(-220, (v) => ((y = v), paint()), { k: 180, c: 16 })
    drop.to(0)
    swing.current.set(22)
    swing.current.to(0)
    const auto = window.setTimeout(tear, 1800)
    return () => {
      window.clearTimeout(auto)
      drop.stop()
      swing.current?.stop()
    }
    // tear() only touches refs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const drag = useRef<number | null>(null)
  return (
    <div className="grid justify-items-center gap-4">
      <span className="ftg-tk-nail" aria-hidden />
      <div ref={ticket} className="ftg-tk">
        <div className="ftg-tk-main">{children}</div>
        <button
          ref={stubEl}
          type="button"
          className="ftg-tk-stub"
          aria-label={stub}
          onClick={tear}
          onPointerDown={(e) => {
            drag.current = e.clientY
            e.currentTarget.setPointerCapture(e.pointerId)
          }}
          onPointerMove={(e) => {
            if (drag.current == null || tornRef.current) return
            const dy = Math.min(80, Math.max(0, e.clientY - drag.current))
            pullState.current = { r: dy * 0.35, y: dy * 0.3 }
            paintStub(0, pullState.current.y, pullState.current.r)
            if (dy > 60) {
              drag.current = null
              tear()
            }
          }}
          onPointerUp={() => {
            if (drag.current == null || tornRef.current) return
            drag.current = null
            const back = new Spring(pullState.current.r, (r) => paintStub(0, r * 0.85, r), { k: 300, c: 12 })
            back.to(0)
            pullState.current = { r: 0, y: 0 }
          }}
        >
          {stub}
          <small>{pull}</small>
        </button>
      </div>
      <div className={`ftg-tk-actions w-full ${torn ? 'is-in' : ''}`}>{actions}</div>
    </div>
  )
}
