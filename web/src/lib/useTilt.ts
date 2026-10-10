import { useEffect, useRef } from 'react'
import { Spring } from './fx'

/**
 * Mouse-only 3D tilt: the card leans toward the pointer with a soft light reflection
 * (`--ftg-gx/--ftg-gy/--ftg-go` drive a `.ftg-glare` child), then springs back flat.
 * Touch screens keep their normal press feedback.
 */
export function useTilt<T extends HTMLElement>(max = 8) {
  const ref = useRef<T>(null)
  useEffect(() => {
    const el = ref.current
    if (!el || typeof window === 'undefined' || !window.matchMedia?.('(hover: hover) and (pointer: fine)').matches) return
    // The springs already smooth the motion; a CSS transform transition would only add lag.
    el.style.transitionProperty = 'box-shadow, background-color, border-color'
    const s = { rx: 0, ry: 0, lift: 0 }
    const paint = () => {
      el.style.transform =
        s.lift > 0.001 || Math.abs(s.rx) > 0.01 || Math.abs(s.ry) > 0.01
          ? `perspective(800px) rotateX(${s.rx}deg) rotateY(${s.ry}deg) translateY(${-s.lift * 3}px)`
          : ''
    }
    const rx = new Spring(0, (v) => ((s.rx = v), paint()), { k: 170, c: 14 })
    const ry = new Spring(0, (v) => ((s.ry = v), paint()), { k: 170, c: 14 })
    const lift = new Spring(0, (v) => ((s.lift = v), paint()), { k: 200, c: 22, precision: 0.002 })
    const go = new Spring(0, (v) => el.style.setProperty('--ftg-go', String(v)), { k: 120, c: 20, precision: 0.002 })
    const move = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return
      const r = el.getBoundingClientRect()
      const px = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width))
      const py = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))
      ry.to((px - 0.5) * max * 2)
      rx.to((0.5 - py) * max * 1.6)
      lift.to(1)
      go.to(1)
      el.style.setProperty('--ftg-gx', `${px * 100}%`)
      el.style.setProperty('--ftg-gy', `${py * 100}%`)
    }
    const leave = () => {
      rx.to(0)
      ry.to(0)
      lift.to(0)
      go.to(0)
    }
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerleave', leave)
    return () => {
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerleave', leave)
      ;[rx, ry, lift, go].forEach((x) => x.stop())
      el.style.transform = ''
      el.style.transitionProperty = ''
    }
  }, [max])
  return ref
}
