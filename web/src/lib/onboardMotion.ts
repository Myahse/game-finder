/** Small helpers for the welcome / sign-up / avatar-studio micro-animations. */

export const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))

/** Pointer velocity (px/s) from the last few moves; reads 0 if the finger stopped before letting go. */
export function velocityTracker() {
  let px = 0
  let pt = 0
  let v = 0
  return {
    reset(x: number) {
      px = x
      pt = performance.now()
      v = 0
    },
    push(x: number) {
      const t = performance.now()
      const dt = t - pt
      if (dt > 0) {
        const nv = ((x - px) / dt) * 1000
        v = dt > 50 ? nv : v * 0.35 + nv * 0.65
      }
      px = x
      pt = t
    },
    get v() {
      return performance.now() - pt > 90 ? 0 : v
    },
  }
}

/** Static, app-owned SVG markup for the welcome-screen balls (no user data goes in here). */
export const BALL_SVG = {
  basket:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="11" fill="#ff5a1f"/><path d="M1 12h22M12 1v22M4.5 4.5c4 4 4 11 0 15M19.5 4.5c-4 4-4 11 0 15" stroke="#12151a" stroke-width="1.3" fill="none"/></svg>',
  foot:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="11" fill="#fff" stroke="#12151a" stroke-width="1.2"/><path d="M12 7.6l4.2 3-1.6 4.9H9.4L7.8 10.6z" fill="#12151a"/><path d="M12 1.2v6.4M16.2 10.6l6.2-2M14.6 15.5l3.8 5.2M9.4 15.5l-3.8 5.2M7.8 10.6l-6.2-2" stroke="#12151a" stroke-width="1.2"/></svg>',
  volley:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="11" fill="#f8fafc"/><path d="M12 12V1a11 11 0 0 1 9.5 16.5z" fill="#fbbf24"/><path d="M12 12L2.5 17.5A11 11 0 0 1 12 1z" fill="#2563eb"/><path d="M12 12V1M12 12l9.5 5.5M12 12l-9.5 5.5" stroke="#12151a" stroke-width=".9" opacity=".45"/><circle cx="12" cy="12" r="11" fill="none" stroke="#12151a" stroke-width="1.1" opacity=".55"/></svg>',
  tennis:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="11" fill="#d4f53c"/><path d="M3.2 5.5c4.2 3.2 4.2 9.8 0 13M20.8 5.5c-4.2 3.2-4.2 9.8 0 13" stroke="#fff" stroke-width="1.7" fill="none"/><circle cx="12" cy="12" r="11" fill="none" stroke="#9cbf1d" stroke-width="1"/></svg>',
} as const

export type BallKind = keyof typeof BALL_SVG

/** A drawn check (stroke animated by CSS via stroke-dashoffset). */
export const CHECK_PATH = 'M5 12.5l4.5 4.5L19 7.5'

/** Floods a box with a colour from a viewport point, then fades so the real page shows through. */
export function floodFrom(box: HTMLElement, at: { x: number; y: number }, color: string, { fixed = false, hold = 260 } = {}) {
  const r = box.getBoundingClientRect()
  const x = at.x - (fixed ? 0 : r.left)
  const y = at.y - (fixed ? 0 : r.top)
  const w = fixed ? window.innerWidth : r.width
  const h = fixed ? window.innerHeight : r.height
  const far = Math.max(Math.hypot(x, y), Math.hypot(w - x, y), Math.hypot(x, h - y), Math.hypot(w - x, h - y)) + 10
  const el = document.createElement('i')
  el.className = fixed ? 'ftg-onboard-flood ftg-onboard-flood-fixed' : 'ftg-onboard-flood'
  el.setAttribute('aria-hidden', 'true')
  el.style.background = color
  el.style.clipPath = `circle(0px at ${x}px ${y}px)`
  ;(fixed ? document.body : box).appendChild(el)
  void el.offsetWidth
  el.classList.add('ftg-onboard-flood-go')
  el.style.clipPath = `circle(${far}px at ${x}px ${y}px)`
  window.setTimeout(() => el.classList.add('ftg-onboard-flood-out'), 560 + hold)
  window.setTimeout(() => el.remove(), 1100 + hold)
}

/** 0 (empty) to 4: length ≥ 8, mixed case, a digit, a symbol or length ≥ 12. Any text is at least 1. */
export function passwordScore(v: string): number {
  let s = 0
  if (v.length >= 8) s++
  if (/[a-z]/.test(v) && /[A-Z]/.test(v)) s++
  if (/\d/.test(v)) s++
  if (/[^A-Za-z0-9]/.test(v) || v.length >= 12) s++
  if (v.length && !s) s = 1
  return s
}
