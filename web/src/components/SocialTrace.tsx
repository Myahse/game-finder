import { useLayoutEffect, useRef } from 'react'
import '../styles/motion-part5.css'

/**
 * A light that runs around a pill button's edge while it is busy (`.ftg-soc.is-busy`).
 * Put it inside a `relative` button with the `ftg-soc` class.
 */
export function SocialTrace() {
  const svg = useRef<SVGSVGElement>(null)
  useLayoutEffect(() => {
    const el = svg.current
    const btn = el?.parentElement
    if (!el || !btn) return
    const fit = () => {
      const r = el.querySelector('rect')
      const w = btn.clientWidth
      const h = btn.clientHeight
      if (!r || !w || !h) return
      r.setAttribute('width', String(w - 3))
      r.setAttribute('height', String(h - 3))
      r.setAttribute('rx', String((h - 3) / 2))
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(btn)
    return () => ro.disconnect()
  }, [])
  return (
    <svg ref={svg} className="ftg-soc-trace" aria-hidden>
      <rect x="1.5" y="1.5" />
    </svg>
  )
}
