import { useEffect, useRef } from 'react'
import { buzz, dust } from '../lib/fx'
import { BALL_SVG, clamp, velocityTracker, type BallKind } from '../lib/onboardMotion'
import '../styles/motion-onboard.css'

type Ball = {
  el: HTMLDivElement
  r: number
  e: number
  x: number
  y: number
  vx: number
  vy: number
  a: number
  sq: number
  sqv: number
  na: number
  m: number
}

/** [kind, radius, bounciness] */
const KINDS: [BallKind, number, number][] = [
  ['basket', 27, 0.72],
  ['foot', 25, 0.6],
  ['volley', 24, 0.64],
  ['tennis', 14, 0.8],
  ['basket', 21, 0.72],
  ['foot', 19, 0.6],
  ['tennis', 13, 0.8],
]
const MAX_BALLS = 12

/**
 * Sport balls that fall into the welcome hero, bounce off each other and can be grabbed and thrown.
 * The layer only covers the hero (never the sign-in buttons); a tap on an empty spot drops another
 * ball. Only the balls block scrolling, so the page still scrolls everywhere else.
 * Sleeps when every ball is at rest, off-screen, or the tab is hidden.
 */
export function WelcomeBalls({ className = '' }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const st = ref.current
    if (!st) return
    let balls: Ball[] = []
    let W = 0
    let H = 0
    let visible = false
    let seen = false
    let raf = 0
    let last = 0
    let grab: (Ball & { off: [number, number]; id: number }) | null = null
    let drops: number[] = []
    let pending = 0
    const gx = velocityTracker()
    const gy = velocityTracker()
    // Bigger screens get slightly bigger balls.
    let scale = 1
    const size = () => {
      W = st.clientWidth
      H = st.clientHeight
      scale = clamp(W / 340, 1, 1.7)
    }

    const render = () => {
      for (const b of balls) {
        const s = clamp(b.sq, -0.35, 0.3)
        b.el.style.transform = `translate(${b.x - b.r}px, ${b.y - b.r}px) rotate(${b.na}rad) scale(${1 + s}, ${1 - s * 0.7}) rotate(${-b.na}rad) rotate(${b.a}rad)`
      }
    }

    const onBallDown = (b: Ball) => (e: PointerEvent) => {
      e.preventDefault()
      e.stopPropagation()
      const [x, y] = local(e)
      b.el.setPointerCapture(e.pointerId)
      grab = Object.assign(b, { off: [b.x - x, b.y - y] as [number, number], id: e.pointerId })
      gx.reset(x)
      gy.reset(y)
      b.na = Math.PI / 2
      b.sqv -= 4
      b.el.classList.add('ftg-onboard-ball-grab')
      buzz(5)
      wake()
    }

    function add(kind: BallKind, r0: number, e: number, x: number, y: number) {
      const r = r0 * scale
      const el = document.createElement('div')
      el.className = 'ftg-onboard-ball'
      el.style.width = el.style.height = `${r * 2}px`
      el.innerHTML = BALL_SVG[kind]
      st!.appendChild(el)
      const b: Ball = { el, r, e, x: clamp(x, r, Math.max(r, W - r)), y, vx: (Math.random() - 0.5) * 160, vy: 0, a: Math.random() * 6.28, sq: 0, sqv: 0, na: Math.PI / 2, m: r * r }
      el.addEventListener('pointerdown', onBallDown(b))
      balls.push(b)
      render()
      return b
    }

    function hit(b: Ball, speed: number, ang: number) {
      if (speed < 140) return
      b.na = ang
      b.sqv -= Math.min(0.32, speed / 2600) * 30
      // No dust while a dialog covers the page: the particle canvas draws above it.
      if (speed > 520 && ang === Math.PI / 2 && !document.querySelector('[aria-modal="true"]')) {
        const r = st!.getBoundingClientRect()
        dust({ x: r.left + b.x, y: r.top + H - 2 }, 6)
        buzz(3)
      }
    }

    function step(dt: number) {
      for (const b of balls) {
        b.sqv += (-900 * b.sq - 20 * b.sqv) * dt
        b.sq += b.sqv * dt
        if (b === grab) {
          b.a += (b.vx / b.r) * dt * 0.4
          continue
        }
        b.vy += 1500 * dt
        b.x += b.vx * dt
        b.y += b.vy * dt
        if (b.y > H - b.r) {
          b.y = H - b.r
          if (b.vy > 0) {
            hit(b, b.vy, Math.PI / 2)
            b.vy = -b.vy * b.e
            if (Math.abs(b.vy) < 50) b.vy = 0
          }
          b.vx *= Math.pow(0.4, dt)
        }
        if (b.x < b.r) {
          b.x = b.r
          if (b.vx < 0) {
            hit(b, -b.vx, Math.PI)
            b.vx = -b.vx * b.e
          }
        }
        if (b.x > W - b.r) {
          b.x = W - b.r
          if (b.vx > 0) {
            hit(b, b.vx, 0)
            b.vx = -b.vx * b.e
          }
        }
        b.a += (b.vx / b.r) * dt
      }
      for (let i = 0; i < balls.length; i++) {
        for (let j = i + 1; j < balls.length; j++) {
          const a = balls[i]
          const c = balls[j]
          const dx = c.x - a.x
          const dy = c.y - a.y
          const d = Math.hypot(dx, dy)
          const min = a.r + c.r
          if (d <= 0 || d >= min) continue
          const nx = dx / d
          const ny = dy / d
          const ia = a === grab ? 0 : 1 / a.m
          const ic = c === grab ? 0 : 1 / c.m
          const tot = ia + ic
          if (!tot) continue
          const ov = min - d
          a.x -= (nx * ov * ia) / tot
          a.y -= (ny * ov * ia) / tot
          c.x += (nx * ov * ic) / tot
          c.y += (ny * ov * ic) / tot
          const rv = (c.vx - a.vx) * nx + (c.vy - a.vy) * ny
          if (rv < 0) {
            const jj = (-(1 + Math.min(a.e, c.e)) * rv) / tot
            a.vx -= jj * nx * ia
            a.vy -= jj * ny * ia
            c.vx += jj * nx * ic
            c.vy += jj * ny * ic
            if (-rv > 260) {
              hit(a, -rv * 0.6, Math.atan2(ny, nx))
              hit(c, -rv * 0.6, Math.atan2(-ny, -nx))
            }
          }
        }
      }
    }

    // Still for half a second → stop the loop until something wakes it.
    let still = 0
    const resting = () => {
      const calm = !grab && !pending && balls.every((b) => Math.abs(b.vx) < 20 && Math.abs(b.vy) < 20 && Math.abs(b.sq) < 0.01)
      still = calm ? still + 1 : 0
      return still > 30
    }

    const running = () => visible && !document.hidden

    function loop(now: number) {
      const dt = Math.min(0.033, (now - last) / 1000)
      last = now
      for (let i = 0; i < 4; i++) step(dt / 4)
      render()
      raf = running() && !resting() ? requestAnimationFrame(loop) : 0
    }
    function wake() {
      still = 0
      if (!raf && running()) {
        last = performance.now()
        raf = requestAnimationFrame(loop)
      }
    }

    function drop() {
      drops.forEach(clearTimeout)
      balls.forEach((b) => b.el.remove())
      balls = []
      size()
      pending = KINDS.length
      drops = KINDS.map(([k, r, e], i) =>
        window.setTimeout(() => {
          pending--
          add(k, r, e, r * scale + Math.random() * Math.max(0, W - 2 * r * scale), -r * scale - 10)
          wake()
        }, 250 + i * 200),
      )
      wake()
    }

    const local = (e: PointerEvent): [number, number] => {
      const r = st.getBoundingClientRect()
      return [e.clientX - r.left, e.clientY - r.top]
    }

    const onMove = (e: PointerEvent) => {
      if (!grab || e.pointerId !== grab.id) return
      const [x, y] = local(e)
      gx.push(x)
      gy.push(y)
      grab.x = clamp(x + grab.off[0], grab.r, W - grab.r)
      grab.y = clamp(y + grab.off[1], -60, H - grab.r)
      grab.vx = gx.v
      grab.vy = gy.v
      wake()
    }
    const onUp = (e: PointerEvent) => {
      if (!grab || e.pointerId !== grab.id) return
      grab.vx = clamp(gx.v, -2600, 2600)
      grab.vy = clamp(gy.v, -2600, 2600)
      grab.el.classList.remove('ftg-onboard-ball-grab')
      grab = null
      wake()
    }
    // A plain tap on an empty spot drops one more ball there.
    const onClick = (e: MouseEvent) => {
      if (e.target !== st) return
      const r = st.getBoundingClientRect()
      if (balls.length >= MAX_BALLS) balls.shift()?.el.remove()
      const k = KINDS[(Math.random() * KINDS.length) | 0]
      add(k[0], k[1], k[2], e.clientX - r.left, -k[1] * scale - 4)
      buzz(4)
      wake()
    }

    st.addEventListener('pointermove', onMove)
    st.addEventListener('pointerup', onUp)
    st.addEventListener('pointercancel', onUp)
    st.addEventListener('click', onClick)
    const io = new IntersectionObserver(([en]) => {
      visible = en.isIntersecting
      if (visible && !seen) {
        seen = true
        drop()
      }
      wake()
    })
    io.observe(st)
    const onVis = () => wake()
    document.addEventListener('visibilitychange', onVis)
    const ro = new ResizeObserver(() => {
      size()
      for (const b of balls) b.x = clamp(b.x, b.r, Math.max(b.r, W - b.r))
      wake()
    })
    ro.observe(st)

    return () => {
      io.disconnect()
      ro.disconnect()
      document.removeEventListener('visibilitychange', onVis)
      st.removeEventListener('pointermove', onMove)
      st.removeEventListener('pointerup', onUp)
      st.removeEventListener('pointercancel', onUp)
      st.removeEventListener('click', onClick)
      drops.forEach(clearTimeout)
      cancelAnimationFrame(raf)
      balls.forEach((b) => b.el.remove())
    }
  }, [])

  return <div ref={ref} aria-hidden className={`ftg-onboard-balls ${className}`} />
}
