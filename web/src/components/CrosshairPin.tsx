import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import { Spring, buzz, centerOf, dust } from '../lib/fx'
import '../styles/motion-part4.css'

export type CrosshairPinHandle = {
  /** The map started moving under the pin. */
  lift: () => void
  /** Map moved by dx screen pixels since the last frame: the pin leans against it. */
  lean: (dx: number) => void
  /** The map stopped: the pin drops with a squash, dust and a ping. */
  drop: () => void
}

/**
 * The court pin, fixed in the middle of the map over a crosshair. It lifts and leans while
 * the map moves underneath, then drops with a squash, a puff of dust and a radar ping, and
 * "Here?" pops above it.
 */
export const CrosshairPin = forwardRef<CrosshairPinHandle, { label: string; placed: boolean }>(function CrosshairPin({ label, placed }, ref) {
  const pin = useRef<HTMLSpanElement>(null)
  const shadow = useRef<HTMLSpanElement>(null)
  const rings = useRef<HTMLSpanElement>(null)
  const tag = useRef<HTMLSpanElement>(null)
  const s = useRef<{ lift: Spring; lean: Spring; sq: Spring; tag: Spring } | null>(null)
  const lifted = useRef(false)

  useEffect(() => {
    const st = { lift: 0, lean: 0, sq: 1 }
    const paint = () => {
      if (pin.current) pin.current.style.transform = `translateY(${-st.lift}px) rotate(${st.lean}deg) scale(${2 - st.sq}, ${st.sq})`
      if (shadow.current) {
        shadow.current.style.transform = `scale(${1 - st.lift / 40})`
        shadow.current.style.opacity = String(0.9 - st.lift / 40)
      }
    }
    s.current = {
      lift: new Spring(0, (v) => ((st.lift = v), paint()), { k: 320, c: 18 }),
      lean: new Spring(0, (v) => ((st.lean = v), paint()), { k: 200, c: 14 }),
      sq: new Spring(1, (v) => ((st.sq = v), paint()), { k: 600, c: 14 }),
      tag: new Spring(0, (v) => tag.current && (tag.current.style.transform = `translate(-50%, -88px) scale(${Math.max(0, v)})`), { k: 420, c: 16 }),
    }
    return () => Object.values(s.current ?? {}).forEach((x) => x.stop())
  }, [])

  useImperativeHandle(ref, () => ({
    lift() {
      if (lifted.current || !s.current) return
      lifted.current = true
      s.current.lift.to(18, { k: 320, c: 18 })
      s.current.tag.to(0)
    },
    lean(dx) {
      if (!lifted.current) return
      s.current?.lean.to(Math.max(-16, Math.min(16, -dx * 1.4)))
    },
    drop() {
      if (!lifted.current || !s.current) return
      lifted.current = false
      const sp = s.current
      sp.lift.to(0, { k: 520, c: 26 })
      sp.lean.to(0)
      window.setTimeout(() => {
        sp.sq.set(0.72)
        sp.sq.to(1, { k: 520, c: 12 })
        if (shadow.current) dust(centerOf(shadow.current), 14)
        buzz(12)
        rings.current?.querySelectorAll('i').forEach((r, i) =>
          r.animate([{ transform: 'scale(.3)', opacity: 0.9 }, { transform: 'scale(1.8)', opacity: 0 }], { duration: 1200, delay: i * 250, easing: 'cubic-bezier(.22,1,.36,1)' }),
        )
        sp.tag.set(0)
        sp.tag.to(1)
      }, 120)
    },
  }))

  return (
    <div className="ftg-xh" aria-hidden>
      <span ref={rings} className="ftg-xh-rings">
        <i />
        <i />
      </span>
      <span className="ftg-xh-cross" />
      <span ref={shadow} className="ftg-xh-shadow" />
      <span ref={pin} className={`ftg-xh-pin ${placed ? '' : 'is-ghost'}`}>
        <svg viewBox="0 0 36 48" width="36" height="48">
          <path d="M18 47C18 47 3 30 3 17a15 15 0 0 1 30 0c0 13-15 30-15 30z" fill="var(--brand)" stroke="#fff" strokeWidth="2.5" />
          <circle cx="18" cy="17" r="6" fill="#fff" />
        </svg>
      </span>
      <span ref={tag} className="ftg-xh-tag">
        {label}
      </span>
    </div>
  )
})
