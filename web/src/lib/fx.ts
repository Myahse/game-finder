/**
 * Physical motion helpers shared by the app's micro-animations:
 * a damped spring, one full-screen particle canvas (confetti, sparks, stars, dust, embers),
 * a short vibration on Android, and a CSS shake. All silent; all no-ops outside a browser.
 */

export type SpringOpts = { k?: number; c?: number; precision?: number }

/** A value that chases its target with momentum and overshoot (stiffness k, damping c). */
export class Spring {
  x: number
  t: number
  v = 0
  k: number
  c: number
  p: number
  onUpdate: (v: number) => void
  done?: () => void
  private raf = 0

  constructor(value: number, onUpdate: (v: number) => void, { k = 300, c = 22, precision = 0.01 }: SpringOpts = {}) {
    this.x = value
    this.t = value
    this.k = k
    this.c = c
    this.p = precision
    this.onUpdate = onUpdate
    onUpdate(value)
  }

  to(target: number, opts?: SpringOpts) {
    if (opts?.k != null) this.k = opts.k
    if (opts?.c != null) this.c = opts.c
    this.t = target
    this.run()
  }

  set(v: number) {
    this.x = this.t = v
    this.v = 0
    this.stop()
    this.onUpdate(v)
  }

  kick(velocity: number) {
    this.v += velocity
    this.run()
  }

  stop() {
    if (this.raf) cancelAnimationFrame(this.raf)
    this.raf = 0
  }

  private run() {
    if (this.raf || typeof requestAnimationFrame === 'undefined') return
    let last = performance.now()
    const step = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const n = Math.max(1, Math.ceil(dt * 240))
      const h = dt / n
      for (let i = 0; i < n; i++) {
        const a = -this.k * (this.x - this.t) - this.c * this.v
        this.v += a * h
        this.x += this.v * h
      }
      if (Math.abs(this.v) < this.p * 10 && Math.abs(this.x - this.t) < this.p) {
        this.x = this.t
        this.v = 0
        this.raf = 0
        this.onUpdate(this.x)
        this.done?.()
        return
      }
      this.onUpdate(this.x)
      this.raf = requestAnimationFrame(step)
    }
    this.raf = requestAnimationFrame(step)
  }
}

/** A short vibration (Android), only once the person has touched the page. */
export function buzz(pattern: number | number[]): void {
  try {
    if (typeof navigator === 'undefined' || !navigator.vibrate) return
    const ua = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation
    if (ua && !ua.hasBeenActive) return
    navigator.vibrate(pattern)
  } catch {
    // Some browsers throw when vibration is blocked; it's only a nicety.
  }
}

/** Replays a one-shot CSS animation class. */
export function replay(el: Element | null | undefined, cls: string): void {
  if (!el) return
  el.classList.remove(cls)
  void (el as HTMLElement).offsetWidth
  el.classList.add(cls)
}

/** A short shake of the element (`ftg-shake`). */
export function shake(el: Element | null | undefined): void {
  replay(el, 'ftg-shake')
}

export function centerOf(el: Element): { x: number; y: number } {
  const r = el.getBoundingClientRect()
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
}

export type BurstShape = 'confetti' | 'spark' | 'star' | 'dot'
export type BurstOpts = {
  n?: number
  colors?: string[]
  speed?: [number, number]
  angle?: number
  spread?: number
  gravity?: number
  drag?: number
  life?: [number, number]
  size?: [number, number]
  shape?: BurstShape
}

type Part = {
  x: number; y: number; vx: number; vy: number; g: number; drag: number; rot: number; vr: number
  life: number; max: number; size: number; color: string; shape: BurstShape; flip: number
}

export const FX_COLORS = ['#ff5a1f', '#f2b632', '#16a34a', '#0ea5e9', '#ffffff', '#ef2b54']
export const FX_GOLD = ['#f2b632', '#ff5a1f', '#ffffff']
export const FX_DUST = ['#9ca3af', '#d1d5db', '#6b7280']

let canvas: HTMLCanvasElement | null = null
let ctx: CanvasRenderingContext2D | null = null
let parts: Part[] = []
let raf = 0

function ensureCanvas() {
  if (canvas || typeof document === 'undefined') return
  canvas = document.createElement('canvas')
  canvas.className = 'ftg-fx'
  canvas.setAttribute('aria-hidden', 'true')
  document.body.appendChild(canvas)
  ctx = canvas.getContext('2d')
  const size = () => {
    if (!canvas || !ctx) return
    const d = Math.min(2, window.devicePixelRatio || 1)
    canvas.width = window.innerWidth * d
    canvas.height = window.innerHeight * d
    ctx.setTransform(d, 0, 0, d, 0, 0)
  }
  size()
  window.addEventListener('resize', size)
}

const rand = (a: number, b: number) => a + Math.random() * (b - a)

function star(c: CanvasRenderingContext2D, r: number) {
  c.beginPath()
  for (let i = 0; i < 10; i++) {
    const a = (i * Math.PI) / 5 - Math.PI / 2
    const rr = i % 2 ? r * 0.45 : r
    c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr)
  }
  c.closePath()
  c.fill()
}

function draw(f: number) {
  if (!ctx) return
  ctx.clearRect(0, 0, window.innerWidth, window.innerHeight)
  parts = parts.filter((p) => p.life < p.max)
  for (const p of parts) {
    p.vy += p.g * f
    p.vx *= p.drag ** f
    p.vy *= p.drag ** f
    p.x += p.vx * f
    p.y += p.vy * f
    p.rot += p.vr * f
    p.flip += 0.2 * f
    p.life += f
    const k = p.life / p.max
    ctx.save()
    ctx.globalAlpha = Math.max(0, k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3)
    ctx.translate(p.x, p.y)
    ctx.rotate(p.rot)
    ctx.fillStyle = p.color
    ctx.strokeStyle = p.color
    if (p.shape === 'confetti') {
      ctx.scale(1, Math.cos(p.flip))
      ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2)
    } else if (p.shape === 'spark') {
      ctx.rotate(-p.rot + Math.atan2(p.vy, p.vx))
      ctx.lineWidth = 2.5
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(0, 0)
      ctx.lineTo(-Math.hypot(p.vx, p.vy) * 2.2, 0)
      ctx.stroke()
    } else if (p.shape === 'star') {
      star(ctx, p.size * (1 - k * 0.5))
    } else {
      ctx.beginPath()
      ctx.arc(0, 0, (p.size / 2) * (1 - k * 0.6), 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.restore()
  }
}

/** Throws particles from a viewport point (or an element's centre). */
export function burst(from: { x: number; y: number } | Element, o: BurstOpts = {}): void {
  if (typeof window === 'undefined') return
  // An element that has already left the page has no position to burst from.
  if ('getBoundingClientRect' in from && !from.isConnected) return
  ensureCanvas()
  if (!ctx) return
  const { x, y } = 'getBoundingClientRect' in from ? centerOf(from) : from
  const {
    n = 24, colors = FX_COLORS, speed = [3, 9], angle = -Math.PI / 2, spread = Math.PI * 2,
    gravity = 0.32, drag = 0.975, life = [40, 75], size = [5, 9], shape = 'confetti',
  } = o
  for (let i = 0; i < n; i++) {
    const a = angle + rand(-spread / 2, spread / 2)
    const s = rand(speed[0], speed[1])
    parts.push({
      x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, g: gravity, drag, rot: rand(0, 6.28), vr: rand(-0.3, 0.3),
      life: 0, max: rand(life[0], life[1]), size: rand(size[0], size[1]), color: colors[i % colors.length], shape, flip: rand(0, 6.28),
    })
  }
  if (!raf) {
    let last = performance.now()
    const loop = (now: number) => {
      const f = Math.min(3, (now - last) / 16.67)
      last = now
      draw(f)
      raf = parts.length ? requestAnimationFrame(loop) : 0
      if (!raf && ctx) ctx.clearRect(0, 0, window.innerWidth, window.innerHeight)
    }
    raf = requestAnimationFrame(loop)
  }
}

/** A big celebratory burst: confetti from the point plus a ring of sparks. */
export function cheer(from: { x: number; y: number } | Element, n = 44): void {
  burst(from, { n, speed: [5, 12], spread: Math.PI * 1.1 })
  burst(from, { n: 12, shape: 'spark', colors: FX_GOLD, speed: [4, 8], gravity: 0.08, life: [14, 24] })
}

/** Stars popping around a point (badges, avatars, friendship). */
export function sparkle(from: { x: number; y: number } | Element, n = 16, colors = FX_GOLD): void {
  burst(from, { n, shape: 'star', colors, speed: [2.5, 6.5], gravity: 0.1, size: [7, 12], life: [30, 50] })
}

/** A little puff of dust under something that lands. */
export function dust(from: { x: number; y: number }, n = 10): void {
  burst(from, { n, colors: FX_DUST, speed: [0.6, 2.2], spread: Math.PI * 0.9, gravity: 0.04, size: [3, 6], shape: 'dot', life: [20, 35] })
}

/** A big word slams onto the screen (e.g. "VS" when a challenge is sent), with sparks and a jolt. */
export function slam(text: string, at?: { x: number; y: number }): void {
  if (typeof document === 'undefined') return
  const x = at?.x ?? window.innerWidth / 2
  const y = at?.y ?? window.innerHeight * 0.42
  const el = document.createElement('div')
  el.className = 'ftg-slam'
  el.setAttribute('aria-hidden', 'true')
  el.textContent = text
  el.style.left = `${x}px`
  el.style.top = `${y}px`
  document.body.appendChild(el)
  window.setTimeout(() => {
    burst({ x, y }, { n: 26, shape: 'spark', colors: FX_GOLD, speed: [5, 12], gravity: 0.12, life: [14, 26] })
    sparkle({ x, y }, 12, ['#f2b632', '#ffffff'])
    buzz([40, 20, 60])
  }, 160)
  window.setTimeout(() => el.remove(), 1300)
}

/** Rings ripple out from an element (e.g. a check-in that worked). */
export function shockwave(from: Element | DOMRect, color = '#16a34a'): void {
  if (typeof document === 'undefined' || ('isConnected' in from && !from.isConnected)) return
  const r = 'getBoundingClientRect' in from ? from.getBoundingClientRect() : from
  for (const delay of [0, 180]) {
    const ring = document.createElement('div')
    ring.className = 'ftg-shockwave'
    ring.setAttribute('aria-hidden', 'true')
    Object.assign(ring.style, {
      left: `${r.left}px`,
      top: `${r.top}px`,
      width: `${r.width}px`,
      height: `${r.height}px`,
      borderColor: color,
      animationDelay: `${delay}ms`,
    })
    document.body.appendChild(ring)
    window.setTimeout(() => ring.remove(), 900 + delay)
  }
}

/** A short label (e.g. "+2 XP") floats up from an element and fades. */
export function floatText(from: Element | { x: number; y: number }, text: string, color = 'var(--brand)'): void {
  if (typeof document === 'undefined' || ('isConnected' in from && !from.isConnected)) return
  const { x, y } = 'getBoundingClientRect' in from ? centerOf(from) : from
  const f = document.createElement('div')
  f.className = 'ftg-float-text'
  f.setAttribute('aria-hidden', 'true')
  f.textContent = text
  Object.assign(f.style, { left: `${x}px`, top: `${y - 20}px`, color })
  document.body.appendChild(f)
  window.setTimeout(() => f.remove(), 1000)
}
