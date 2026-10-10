import { useEffect, useRef, type RefObject } from 'react'
import type { MapRef } from 'react-map-gl/mapbox'
import '../styles/motion-part4.css'

export type WetCourt = { longitude: number; latitude: number }

type Drop = { x: number; y: number; v: number; z: number }
type Ripple = { x: number; y: number; t: number; s: number }

/**
 * Rain over the map while it rains near the visible courts (lighter when it's only forecast).
 * Drops lean with the wind (follow your finger or mouse across the map), splash and ripple
 * on the pins of wet courts, and those pins glisten. Stops gently when it's dry.
 */
export function RainLayer({ mapRef, wet, intensity }: { mapRef: RefObject<MapRef | null>; wet: WetCourt[]; intensity: number }) {
  const cv = useRef<HTMLCanvasElement>(null)
  const wetRef = useRef(wet)
  const target = useRef(intensity)
  useEffect(() => {
    wetRef.current = wet
    target.current = intensity
  }, [wet, intensity])

  useEffect(() => {
    const canvas = cv.current
    const host = canvas?.parentElement
    if (!canvas || !host) return
    let raf = 0
    let level = 0
    let wind = -0.25
    let windTarget = -0.25
    let drops: Drop[] = []
    let ripples: Ripple[] = []
    const onMove = (e: PointerEvent) => {
      const r = host.getBoundingClientRect()
      windTarget = ((e.clientX - r.left) / r.width - 0.5) * 1.6
    }
    const onLeave = () => (windTarget = -0.25)
    host.addEventListener('pointermove', onMove, { passive: true })
    host.addEventListener('pointerleave', onLeave)
    const rand = (a: number, b: number) => a + Math.random() * (b - a)
    const step = () => {
      raf = requestAnimationFrame(step)
      const r = host.getBoundingClientRect()
      const d = Math.min(2, window.devicePixelRatio || 1)
      if (canvas.width !== Math.round(r.width * d) || canvas.height !== Math.round(r.height * d)) {
        canvas.width = Math.round(r.width * d)
        canvas.height = Math.round(r.height * d)
      }
      const c = canvas.getContext('2d')
      if (!c) return
      c.setTransform(d, 0, 0, d, 0, 0)
      const w = r.width
      const h = r.height
      level += (target.current - level) * 0.03
      wind += (windTarget - wind) * 0.05
      c.clearRect(0, 0, w, h)
      if (level < 0.01 && !drops.length && !ripples.length) return
      c.fillStyle = `rgba(28,52,84,${0.16 * level})`
      c.fillRect(0, 0, w, h)
      const map = mapRef.current?.getMap()
      const pins = map ? wetRef.current.map((p) => map.project([p.longitude, p.latitude])) : []
      // Wet pins glisten.
      for (const p of pins) {
        c.fillStyle = `rgba(255,255,255,${0.5 * level})`
        c.beginPath()
        c.ellipse(p.x - 5, p.y - 30, 3, 6, -0.5, 0, Math.PI * 2)
        c.fill()
      }
      const n = Math.round(4 * level + (Math.random() < 4 * level % 1 ? 1 : 0))
      for (let i = 0; i < n; i++) drops.push({ x: rand(-w * 0.4, w * 1.4), y: rand(-40, -5), v: rand(7, 11), z: rand(0.6, 1) })
      c.lineCap = 'round'
      drops = drops.filter((dr) => {
        dr.y += dr.v * dr.z
        dr.x += wind * dr.v * dr.z
        c.strokeStyle = `rgba(150,190,235,${0.7 * dr.z})`
        c.lineWidth = 1.3 * dr.z
        c.beginPath()
        c.moveTo(dr.x, dr.y)
        c.lineTo(dr.x - wind * 9 * dr.z, dr.y - 9 * dr.z)
        c.stroke()
        for (const p of pins) {
          if (Math.abs(dr.x - p.x) < 13 && dr.y > p.y - 40 && dr.y < p.y - 16) {
            ripples.push({ x: dr.x, y: dr.y, t: 0, s: 0.6 })
            return false
          }
        }
        if (dr.y > h * rand(0.3, 1.2)) {
          ripples.push({ x: dr.x, y: dr.y, t: 0, s: dr.z })
          return false
        }
        return dr.y < h + 10
      })
      ripples = ripples.filter((p) => {
        p.t++
        c.strokeStyle = `rgba(170,205,240,${(1 - p.t / 16) * 0.75})`
        c.lineWidth = 1
        c.beginPath()
        c.ellipse(p.x, p.y, p.t * 0.9 * p.s, p.t * 0.35 * p.s, 0, 0, Math.PI * 2)
        c.stroke()
        return p.t < 16
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
