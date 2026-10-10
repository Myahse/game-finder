import { useEffect, useRef, type KeyboardEvent, type PointerEvent } from 'react'
import { buzz, sparkle, Spring } from '../lib/fx'
import { MAX_PLAYERS_SLIDER_MIN, MAX_PLAYERS_SLIDER_UNLIMITED } from '../lib/format'
import { Odometer } from './Odometer'
import '../styles/motion-create.css'

const MIN = MAX_PLAYERS_SLIDER_MIN
const MAX = MAX_PLAYERS_SLIDER_UNLIMITED
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))
const toVal = (p: number) => MIN + Math.round(clamp(p, 0, 1) * (MAX - MIN))
const toP = (v: number) => (v - MIN) / (MAX - MIN)

/**
 * Max-players slider (2–30, then unlimited at the far end). The value bubble swings like a
 * pendulum with the drag speed, the thumb squashes when moving fast, and reaching the end
 * turns the bubble gold with stars. Slider value = the page's slider scale (31 = unlimited).
 */
export function MaxPlayersSlider({
  value,
  onChange,
  labelledBy,
  unlimitedLabel,
}: {
  value: number
  onChange: (v: number) => void
  labelledBy: string
  unlimitedLabel: string
}) {
  const trackRef = useRef<HTMLDivElement>(null)
  const thumbRef = useRef<HTMLButtonElement>(null)
  const fillRef = useRef<HTMLElement>(null)
  const bubRef = useRef<HTMLSpanElement>(null)
  const valRef = useRef(value)
  const changeRef = useRef(onChange)
  const posRef = useRef<Spring | null>(null)
  const dragging = useRef(false)
  useEffect(() => {
    changeRef.current = onChange
  }, [onChange])

  useEffect(() => {
    const tr = trackRef.current, th = thumbRef.current, fill = fillRef.current, bub = bubRef.current
    if (!tr || !th || !fill || !bub) return
    let lastX: number | null = null
    let lastT = 0
    let rest = 0
    const tilt = new Spring(0, (v) => { bub.style.rotate = `${v}deg` }, { k: 240, c: 8, precision: 0.05 })
    const setVal = (v: number) => {
      if (v === valRef.current) return
      const wasInf = valRef.current >= MAX
      valRef.current = v
      changeRef.current(v)
      if (v >= MAX && !wasInf) {
        buzz([10, 30, 40])
        window.setTimeout(() => sparkle(bub, 18), 60)
      } else buzz(2)
    }
    const ps = new Spring(toP(valRef.current), (p) => {
      th.style.left = `${p * 100}%`
      fill.style.width = `${p * 100}%`
      const x = p * tr.clientWidth
      const now = performance.now()
      if (lastX !== null && now > lastT) {
        const v = ((x - lastX) / (now - lastT)) * 1000
        tilt.to(clamp(-v * 0.03, -40, 40))
        const s = 1 + Math.min(Math.abs(v) / 2600, 0.3)
        th.style.transform = `scale(${s}, ${1 / s})`
      }
      lastX = x
      lastT = now
      window.clearTimeout(rest)
      rest = window.setTimeout(() => {
        tilt.to(0)
        th.style.transform = ''
        lastX = null
      }, 70)
      setVal(toVal(p))
    }, { k: 300, c: 26, precision: 0.0005 })
    posRef.current = ps
    return () => {
      ps.stop()
      tilt.stop()
      window.clearTimeout(rest)
      posRef.current = null
    }
  }, [])

  // Follow a value set from outside (not from this slider).
  useEffect(() => {
    if (value === valRef.current || dragging.current) return
    valRef.current = value
    posRef.current?.to(toP(value), { k: 300, c: 22 })
  }, [value])

  const pFrom = (e: PointerEvent) => {
    const r = trackRef.current!.getBoundingClientRect()
    return clamp((e.clientX - r.left) / r.width, 0, 1)
  }
  const down = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    dragging.current = true
    e.currentTarget.setPointerCapture(e.pointerId)
    posRef.current?.to(pFrom(e), { k: 500, c: 34 })
    thumbRef.current?.focus({ preventScroll: true })
    e.preventDefault()
  }
  const move = (e: PointerEvent<HTMLDivElement>) => {
    if (dragging.current) posRef.current?.to(pFrom(e), { k: 900, c: 50 })
  }
  const up = () => {
    if (!dragging.current) return
    dragging.current = false
    window.setTimeout(() => posRef.current?.to(toP(valRef.current), { k: 300, c: 22 }), 30)
  }
  const key = (e: KeyboardEvent) => {
    const d: Record<string, number> = {
      ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1, PageUp: 5, PageDown: -5,
      Home: -MAX, End: MAX,
    }
    if (d[e.key] == null) return
    e.preventDefault()
    posRef.current?.to(toP(clamp(valRef.current + d[e.key], MIN, MAX)), { k: 300, c: 22 })
  }

  const inf = value >= MAX
  return (
    <div
      ref={trackRef}
      className={`ftg-create-mtrack ${inf ? 'ftg-create-inf' : ''}`}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
    >
      <i ref={fillRef} className="ftg-create-mfill" />
      <span className="ftg-create-mend" aria-hidden>∞</span>
      <button
        ref={thumbRef}
        type="button"
        className="ftg-create-mthumb"
        role="slider"
        aria-labelledby={labelledBy}
        aria-valuemin={MIN}
        aria-valuemax={MAX}
        aria-valuenow={value}
        aria-valuetext={inf ? unlimitedLabel : String(value)}
        onKeyDown={key}
      >
        <span ref={bubRef} className="ftg-create-mbub" aria-hidden>
          {inf ? (
            <span className="ftg-create-mbub-inf"><b>∞</b>{unlimitedLabel}</span>
          ) : (
            <Odometer value={value} />
          )}
        </span>
      </button>
    </div>
  )
}
