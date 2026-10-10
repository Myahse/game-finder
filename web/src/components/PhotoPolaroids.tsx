import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { resolveMediaUrl } from '../lib/mediaUrl'
import { Spring, buzz, burst, centerOf } from '../lib/fx'
import { X } from './icons'
import '../styles/motion-part4.css'

export type PendingPhoto = { key: string; preview: string; done: boolean }

/** Stable small tilt per photo, so a pile looks hand-placed and doesn't jump on re-render. */
function tiltFor(url: string) {
  let h = 0
  for (let i = 0; i < url.length; i++) h = (h * 31 + url.charCodeAt(i)) | 0
  return ((Math.abs(h) % 13) - 6) * 1.1
}

/**
 * Court photos as polaroids. While a photo uploads, water rises in its square (to ~90 %,
 * then full when the upload finishes). A new photo drops onto the pile with a spin and
 * develops from dark to colour. Throw one off the pile (or use ×) to remove it.
 */
export function PhotoPolaroids({
  photos,
  pending = [],
  onRemove,
  removing,
  removeLabel,
}: {
  photos: string[]
  pending?: PendingPhoto[]
  onRemove?: (url: string) => void
  removing?: string | null
  removeLabel: string
}) {
  // Photos already there when the list first shows stay put; later ones drop in.
  const [initial] = useState(() => new Set(photos))
  if (!photos.length && !pending.length) return null
  return (
    <div className="ftg-pols">
      {photos.map((p) => (
        <Polaroid key={p} url={p} isNew={!initial.has(p)} busy={removing === p} onRemove={onRemove} removeLabel={removeLabel} />
      ))}
      {pending.map((p) => (
        <WaterSlot key={p.key} preview={p.preview} done={p.done} />
      ))}
    </div>
  )
}

function Polaroid({ url, isNew, busy, onRemove, removeLabel }: { url: string; isNew: boolean; busy: boolean; onRemove?: (url: string) => void; removeLabel: string }) {
  const el = useRef<HTMLDivElement>(null)
  const rest = tiltFor(url)
  const s = useRef<{ x: Spring; y: Spring; r: Spring; k: Spring } | null>(null)
  const pos = useRef({ x: 0, y: 0, r: rest, k: 1 })
  useEffect(() => {
    const node = el.current
    if (!node) return
    const paint = () => {
      const { x, y, r, k } = pos.current
      node.style.transform = `translate(${x}px, ${y}px) rotate(${r}deg) scale(${k})`
    }
    const mk = (key: 'x' | 'y' | 'r' | 'k', v: number, k: number, c: number) => new Spring(v, (n) => ((pos.current[key] = n), paint()), { k, c })
    s.current = { x: mk('x', 0, 140, 12), y: mk('y', isNew ? -140 : 0, 140, 11), r: mk('r', isNew ? rest * -4 : rest, 90, 7), k: mk('k', isNew ? 0.5 : 1, 220, 14) }
    if (isNew) {
      s.current.y.to(0)
      s.current.r.to(rest)
      s.current.k.to(1)
      node.classList.add('is-developing')
      const t = window.setTimeout(() => {
        node.classList.remove('is-developing')
        buzz(8)
      }, 60)
      return () => window.clearTimeout(t)
    }
    // isNew only matters on the first render of this photo
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const drag = useRef<{ x: number; y: number; lx: number; ly: number; vx: number; vy: number; t: number } | null>(null)
  const down = (e: ReactPointerEvent) => {
    if (!onRemove || busy || (e.target as HTMLElement).closest('button')) return
    drag.current = { x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, vx: 0, vy: 0, t: performance.now() }
    el.current?.setPointerCapture(e.pointerId)
    s.current?.k.to(1.08)
  }
  const move = (e: ReactPointerEvent) => {
    const d = drag.current
    if (!d || !s.current) return
    const now = performance.now()
    const dt = Math.max(1, now - d.t)
    d.vx = ((e.clientX - d.lx) / dt) * 16
    d.vy = ((e.clientY - d.ly) / dt) * 16
    d.lx = e.clientX
    d.ly = e.clientY
    d.t = now
    s.current.x.set(e.clientX - d.x)
    s.current.y.set(e.clientY - d.y)
    s.current.r.to(rest + Math.max(-25, Math.min(25, (e.clientX - d.x) / 5)))
  }
  const up = () => {
    const d = drag.current
    drag.current = null
    if (!d || !s.current) return
    s.current.k.to(1)
    const { x, y } = pos.current
    if (Math.hypot(x, y) > 70 || Math.hypot(d.vx, d.vy) > 14) {
      // Thrown: it flies off with paper bits, then the photo is removed.
      const a = Math.atan2(y || d.vy, x || d.vx)
      s.current.x.to(x + Math.cos(a) * 420)
      s.current.y.to(y + Math.sin(a) * 420)
      s.current.r.to(pos.current.r + 90)
      if (el.current) burst(centerOf(el.current), { n: 10, shape: 'confetti', colors: ['#fbfaf7', '#e8e2d6'], speed: [1, 4] })
      buzz(10)
      window.setTimeout(() => onRemove?.(url), 260)
    } else {
      s.current.x.to(0)
      s.current.y.to(0)
      s.current.r.to(rest)
    }
  }

  return (
    <div ref={el} className={`ftg-pol ${busy ? 'opacity-50' : ''}`} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
      <div className="ftg-pol-img">
        <img src={resolveMediaUrl(url)} alt="" draggable={false} />
      </div>
      {onRemove && (
        <button type="button" disabled={busy} onClick={() => onRemove(url)} className="ftg-pol-x" aria-label={removeLabel}>
          <X className="size-3.5" aria-hidden />
        </button>
      )}
    </div>
  )
}

/** Water rising inside the square while the photo uploads, over the chosen picture. */
function WaterSlot({ preview, done }: { preview: string; done: boolean }) {
  const cv = useRef<HTMLCanvasElement>(null)
  const pct = useRef<HTMLSpanElement>(null)
  const level = useRef(0)
  const doneRef = useRef(done)
  useEffect(() => {
    doneRef.current = done
  }, [done])
  useEffect(() => {
    let raf = 0
    const t0 = performance.now()
    const step = (now: number) => {
      const c = cv.current
      if (!c) return
      const target = doneRef.current ? 1 : 0.9 * (1 - Math.exp(-(now - t0) / 1400))
      level.current += (target - level.current) * (doneRef.current ? 0.25 : 0.08)
      const r = c.getBoundingClientRect()
      const d = Math.min(2, window.devicePixelRatio || 1)
      if (c.width !== Math.round(r.width * d)) {
        c.width = Math.round(r.width * d)
        c.height = Math.round(r.height * d)
      }
      const g = c.getContext('2d')
      if (!g) return
      g.setTransform(d, 0, 0, d, 0, 0)
      const w = r.width
      const h = r.height
      const y = h * (1 - level.current)
      const t = now - t0
      g.clearRect(0, 0, w, h)
      g.fillStyle = 'rgba(255,90,31,.38)'
      g.beginPath()
      g.moveTo(0, h)
      for (let x = 0; x <= w; x += 2) g.lineTo(x, y + Math.sin(x / 9 + t * 0.012) * 3 + Math.sin(x / 5 - t * 0.02) * 1.5)
      g.lineTo(w, h)
      g.fill()
      g.fillStyle = 'rgba(255,90,31,.6)'
      g.beginPath()
      g.moveTo(0, h)
      for (let x = 0; x <= w; x += 2) g.lineTo(x, y + 2 + Math.sin(x / 7 - t * 0.016) * 2.5)
      g.lineTo(w, h)
      g.fill()
      if (pct.current) pct.current.textContent = `${Math.round(level.current * 100)}%`
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [])
  return (
    <div className="ftg-water" aria-busy="true">
      <img src={preview} alt="" />
      <canvas ref={cv} />
      <span ref={pct} className="ftg-water-pct" />
    </div>
  )
}
