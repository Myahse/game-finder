import { useEffect, useRef, type RefObject } from 'react'
import type { MapRef } from 'react-map-gl/mapbox'
import '../styles/motion-part4.css'

/** A court where it rains (`now`) or where rain is forecast. */
export type WetCourt = { longitude: number; latitude: number; now: boolean }

type Drop = { ci: number; dx: number; dy: number; v: number; z: number }
type Ripple = { ci: number; dx: number; t: number; s: number }

const REDUCE = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * Rain only where it rains: a small cloud over each wet court's pin, drops
 * falling on it and ripples at its foot (heavier when it rains now, light
 * when it's forecast). The rest of the map stays dry. Drops lean with the
 * wind (follow your finger or mouse across the map).
 */
export function RainLayer({ mapRef, wet }: { mapRef: RefObject<MapRef | null>; wet: WetCourt[] }) {
  const cv = useRef<HTMLCanvasElement>(null)
  const wetRef = useRef(wet)
  useEffect(() => {
    wetRef.current = wet
  }, [wet])

  useEffect(() => {
    const canvas = cv.current
    const host = canvas?.parentElement
    if (!canvas || !host) return
    let raf = 0
    let wind = -0.2
    let windTarget = -0.2
    let drops: Drop[] = []
    let ripples: Ripple[] = []
    let t = 0
    const onMove = (e: PointerEvent) => {
      const r = host.getBoundingClientRect()
      windTarget = ((e.clientX - r.left) / r.width - 0.5) * 1.2
    }
    const onLeave = () => (windTarget = -0.2)
    host.addEventListener('pointermove', onMove, { passive: true })
    host.addEventListener('pointerleave', onLeave)
    const rand = (a: number, b: number) => a + Math.random() * (b - a)
    const cloud = (c: CanvasRenderingContext2D, x: number, y: number, s: number, heavy: boolean) => {
      c.fillStyle = heavy ? 'rgba(92,108,128,.92)' : 'rgba(150,164,180,.85)'
      for (const [ox, oy, r] of [[-14, 4, 10], [0, -3, 13], [14, 3, 10], [6, 7, 9], [-6, 7, 9]] as const) {
        c.beginPath(); c.arc(x + ox * s, y + oy * s, r * s, 0, Math.PI * 2); c.fill()
      }
    }
    const step = () => {
      raf = requestAnimationFrame(step)
      t++
      const r = host.getBoundingClientRect()
      const d = Math.min(2, window.devicePixelRatio || 1)
      if (canvas.width !== Math.round(r.width * d) || canvas.height !== Math.round(r.height * d)) {
        canvas.width = Math.round(r.width * d)
        canvas.height = Math.round(r.height * d)
      }
      const c = canvas.getContext('2d')
      if (!c) return
      c.setTransform(d, 0, 0, d, 0, 0)
      c.clearRect(0, 0, r.width, r.height)
      const courts = wetRef.current
      const map = mapRef.current?.getMap()
      if (!map || !courts.length) { drops = []; ripples = []; return }
      wind += (windTarget - wind) * 0.05
      // Pin tip on screen; the cloud floats above the pin.
      const pins = courts.map((p) => map.project([p.longitude, p.latitude]))
      const s = Math.max(0.7, Math.min(1.2, map.getZoom() / 13))
      courts.forEach((ct, ci) => {
        const p = pins[ci]
        if (p.x < -60 || p.y < -60 || p.x > r.width + 60 || p.y > r.height + 120) return
        const n = REDUCE ? 0 : ct.now ? 0.9 : 0.3
        if (Math.random() < n) drops.push({ ci, dx: rand(-17, 17) * s, dy: 0, v: rand(3.2, 4.6), z: rand(0.6, 1) })
      })
      c.lineCap = 'round'
      drops = drops.filter((dr) => {
        const p = pins[dr.ci]
        if (!p) return false
        dr.dy += dr.v * dr.z
        const top = p.y - 92 * s, fall = 92 * s - 6
        const x = p.x + dr.dx + wind * dr.dy * 0.35, y = top + 8 * s + dr.dy
        c.strokeStyle = `rgba(150,190,235,${0.8 * dr.z})`
        c.lineWidth = 1.2 * dr.z
        c.beginPath(); c.moveTo(x, y); c.lineTo(x - wind * 5, y - 6 * dr.z); c.stroke()
        if (dr.dy > fall) { ripples.push({ ci: dr.ci, dx: dr.dx + wind * dr.dy * 0.35, t: 0, s: dr.z }); return false }
        return true
      })
      ripples = ripples.filter((rp) => {
        const p = pins[rp.ci]
        if (!p) return false
        rp.t++
        c.strokeStyle = `rgba(170,205,240,${(1 - rp.t / 14) * 0.75})`
        c.lineWidth = 1
        c.beginPath(); c.ellipse(p.x + rp.dx, p.y - 2, rp.t * 0.8 * rp.s, rp.t * 0.3 * rp.s, 0, 0, Math.PI * 2); c.stroke()
        return rp.t < 14
      })
      courts.forEach((ct, ci) => {
        const p = pins[ci]
        const bob = REDUCE ? 0 : Math.sin(t / 40 + ci) * 1.5
        cloud(c, p.x, p.y - 96 * s + bob, s, ct.now)
        // the wet pin glistens
        c.fillStyle = 'rgba(255,255,255,.45)'
        c.beginPath(); c.ellipse(p.x - 5, p.y - 30, 3, 6, -0.5, 0, Math.PI * 2); c.fill()
      })
    }
    raf = requestAnimationFrame(step)
    return () => {
      cancelAnimationFrame(raf)
      host.removeEventListener('pointermove', onMove)
      host.removeEventListener('pointerleave', onLeave)
    }
  }, [mapRef])

  return <canvas ref={cv} className="ftg-rain" aria-hidden />
}
