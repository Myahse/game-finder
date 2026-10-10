import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { useLocale } from '../i18n/LocaleProvider'
import { rubberBand, velocityTracker } from '../lib/courtMotion'
import { Spring, buzz } from '../lib/fx'
import '../styles/motion-court.css'

const layoutClass = {
  /** Maresi properties map: docked sheet, auto height, horizontal card rail */
  dock:
    'z-20 shadow-[0_-8px_24px_rgba(0,0,0,0.12)] pb-[calc(4.25rem+env(safe-area-inset-bottom))] md:pb-3 md:inset-x-4 md:bottom-4 md:max-w-2xl md:mx-auto md:rounded-3xl md:border',
  /** Court / detail panel: docked bottom sheet (may sit under tab bar); scroll area pads content above nav */
  panel:
    'z-10 flex max-h-[78%] flex-col overflow-hidden shadow-[0_-12px_40px_rgba(0,0,0,0.18)] md:inset-x-auto md:bottom-4 md:right-4 md:top-4 md:max-h-none md:w-[400px] md:rounded-3xl md:border',
} as const

/** Keeps court sheet actions above the floating mobile tab bar (AppShell). */
const PANEL_CONTENT_NAV_PAD =
  'pb-[calc(4.75rem+max(0.5rem,env(safe-area-inset-bottom)))] md:pb-0'

const MOBILE = '(max-width: 767.98px)'

function useIsMobile() {
  const [mobile, setMobile] = useState(() => typeof window !== 'undefined' && !!window.matchMedia?.(MOBILE).matches)
  useEffect(() => {
    const mq = window.matchMedia?.(MOBILE)
    if (!mq) return
    const on = () => setMobile(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return mobile
}

/**
 * Phone court panel: drag it between peek / half / full with the finger (rubber band past the top,
 * lands on the detent the throw points at) while the map dims behind it. Content scrolls normally
 * once it is full; from the top of the content, pulling down drags the sheet again.
 */
function useDetents(enabled: boolean) {
  const sheet = useRef<HTMLDivElement>(null)
  const scroll = useRef<HTMLDivElement>(null)
  const dim = useRef<HTMLDivElement>(null)
  const cycle = useRef<() => void>(() => {})

  useLayoutEffect(() => {
    const el = sheet.current
    const sc = scroll.current
    const parent = el?.parentElement
    if (!enabled || !el || !sc || !parent) return

    let det = [0, 0, 0] // translateY for peek, half, full
    let at = 1
    const measure = () => {
      const H = parent.clientHeight
      const S = H - Math.max(16, Math.round(H * 0.05))
      el.style.height = `${S}px`
      el.style.maxHeight = 'none'
      const nav = parseFloat(getComputedStyle(sc).paddingBottom) || 0
      const peek = Math.max(0, S - Math.min(S, nav + 150))
      const half = Math.min(peek, Math.max(0, S - Math.round(H * 0.56)))
      det = [peek, half, 0]
      return S
    }
    const S = measure()
    let lastH = parent.clientHeight
    let full = false
    const ys = new Spring(
      S,
      (y) => {
        el.style.transform = `translate3d(0, ${y}px, 0)`
        const k = det[0] > 0 ? Math.min(1, Math.max(0, (det[0] - y) / det[0])) : 0
        if (dim.current) dim.current.style.opacity = String(k * 0.45)
        // Content scrolls only when the sheet is fully up.
        const f = y < 2
        if (f !== full) {
          full = f
          sc.style.overflowY = f ? '' : 'hidden'
        }
      },
      { k: 300, c: 27, precision: 0.2 },
    )
    sc.style.overflowY = 'hidden'
    ys.to(det[1])

    const go = (i: number, v = 0) => {
      at = i
      // Lowered sheets show the top of the court, not wherever the list was scrolled to.
      if (i !== 2 && sc.scrollTop > 0) sc.scrollTo({ top: 0, behavior: 'smooth' })
      ys.v = v
      ys.to(det[i])
    }
    const nearest = (y: number) => {
      let bi = 0
      det.forEach((d, i) => {
        if (Math.abs(d - y) < Math.abs(det[bi] - y)) bi = i
      })
      return bi
    }
    cycle.current = () => {
      go(at === 0 ? 1 : at === 1 ? 2 : 0)
      buzz(5)
    }

    const vt = velocityTracker()
    let mode: 'idle' | 'pending' | 'drag' | 'skip' = 'idle'
    let sx = 0
    let sy = 0
    let y0 = 0
    let fromHandle = false
    let swallowClick = false
    const begin = (x: number, y: number, target: EventTarget | null) => {
      mode = 'pending'
      sx = x
      sy = y
      fromHandle = !!(target as Element | null)?.closest?.('[data-sheet-handle]')
      vt.reset(y)
    }
    // Returns true while the sheet owns the gesture.
    const move = (x: number, y: number) => {
      const dx = x - sx
      const dy = y - sy
      if (mode === 'pending') {
        if (Math.abs(dx) < 5 && Math.abs(dy) < 5) return false
        if (Math.abs(dx) > Math.abs(dy)) {
          mode = 'skip'
          return false
        }
        const isFull = at === 2 && ys.x < 2
        if (fromHandle || !isFull || (sc.scrollTop <= 0 && dy > 0)) {
          mode = 'drag'
          y0 = ys.x
          ys.stop()
        } else {
          mode = 'skip'
          return false
        }
      }
      if (mode !== 'drag') return false
      vt.push(y)
      const raw = y0 + dy
      const [pk, , fu] = det
      ys.set(raw < fu ? fu - rubberBand(fu - raw) : raw > pk ? pk + rubberBand(raw - pk) * 0.6 : raw)
      return true
    }
    const end = () => {
      if (mode === 'drag') {
        const v = Math.max(-4000, Math.min(4000, vt.v))
        go(nearest(ys.x + v * 0.18), v)
        buzz(4)
        swallowClick = true
        window.setTimeout(() => (swallowClick = false), 0)
      }
      mode = 'idle'
    }

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length > 1) {
        mode = 'skip'
        return
      }
      begin(e.touches[0].clientX, e.touches[0].clientY, e.target)
    }
    const onTouchMove = (e: TouchEvent) => {
      if (mode === 'idle' || mode === 'skip') return
      if (move(e.touches[0].clientX, e.touches[0].clientY) && e.cancelable) e.preventDefault()
    }
    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return
      if ((e.target as Element).closest('input, textarea, select')) return
      begin(e.clientX, e.clientY, e.target)
      const mm = (ev: PointerEvent) => {
        if (move(ev.clientX, ev.clientY)) ev.preventDefault()
      }
      const mu = () => {
        window.removeEventListener('pointermove', mm)
        window.removeEventListener('pointerup', mu)
        end()
      }
      window.addEventListener('pointermove', mm)
      window.addEventListener('pointerup', mu)
    }
    const onClick = (e: MouseEvent) => {
      if (!swallowClick) return
      e.preventDefault()
      e.stopPropagation()
      swallowClick = false
    }
    const onWheel = (e: WheelEvent) => {
      if (at !== 2 && e.deltaY > 0) go(2)
    }
    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    el.addEventListener('touchend', end)
    el.addEventListener('touchcancel', end)
    el.addEventListener('pointerdown', onPointerDown)
    el.addEventListener('click', onClick, true)
    el.addEventListener('wheel', onWheel, { passive: true })
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => {
      if (parent.clientHeight === lastH) return
      lastH = parent.clientHeight
      measure()
      if (mode !== 'drag') ys.set(det[at])
    })
    ro?.observe(parent)

    return () => {
      ys.stop()
      ro?.disconnect()
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', end)
      el.removeEventListener('touchcancel', end)
      el.removeEventListener('pointerdown', onPointerDown)
      el.removeEventListener('click', onClick, true)
      el.removeEventListener('wheel', onWheel)
      el.style.transform = ''
      el.style.height = ''
      el.style.maxHeight = ''
      sc.style.overflowY = ''
      cycle.current = () => {}
    }
  }, [enabled])

  return { sheet, scroll, dim, cycle }
}

/**
 * Map overlay container — matches Maresi `AllPropertiesPage` list sheet on mobile
 * (`rounded-t-3xl border-t bg-card` + handle + horizontal cards).
 */
export function MapBottomSheet({
  children,
  ariaLabel,
  layout = 'dock',
  className = '',
}: {
  children: ReactNode
  ariaLabel: string
  layout?: keyof typeof layoutClass
  className?: string
}) {
  const { t } = useLocale()
  const isPanel = layout === 'panel'
  const mobile = useIsMobile()
  const detents = isPanel && mobile
  const { sheet, scroll, dim, cycle } = useDetents(detents)

  return (
    <>
      {detents && <div ref={dim} className="ftg-court-x-dim" aria-hidden />}
      <div
        ref={sheet}
        role="dialog"
        aria-label={ariaLabel}
        className={`absolute inset-x-0 bottom-0 rounded-t-3xl border-t border-line bg-surface ${layoutClass[layout]} ${detents ? 'ftg-court-x-sheet' : ''} ${className}`}
      >
        {detents ? (
          <button
            type="button"
            data-sheet-handle
            className="ftg-court-x-handle shrink-0 pb-2 pt-2.5"
            aria-label={t.courts.resizeSheet}
            onClick={() => cycle.current()}
          >
            <span className="h-1 w-9 rounded-full bg-line" />
          </button>
        ) : (
          <div className={`flex justify-center ${isPanel ? 'pt-2' : 'pt-1.5 md:pt-2'}`} aria-hidden>
            <span className="h-1 w-9 rounded-full bg-line md:h-1.5 md:w-10" />
          </div>
        )}
        {isPanel ? (
          <div ref={scroll} className={`min-h-0 flex-1 overflow-y-auto overscroll-contain ${PANEL_CONTENT_NAV_PAD}`}>{children}</div>
        ) : (
          children
        )}
      </div>
    </>
  )
}
