import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Motion is part of the app's feel, so it always plays, whatever the OS
 * "reduce motion" setting says. Kept as a single switch for JS-driven effects.
 */
export function prefersReducedMotion(): boolean {
  return false
}

/** easeOutCubic on t ∈ [0, 1] (clamped). */
export function easeOutCubic(t: number): number {
  const x = Math.min(1, Math.max(0, t))
  return 1 - (1 - x) ** 3
}

/** The count-up value `elapsed` ms into a `duration` ms run from `from` to `to`, rounded. */
export function countUpAt(from: number, to: number, elapsed: number, duration: number): number {
  if (duration <= 0 || elapsed >= duration) return to
  return Math.round(from + (to - from) * easeOutCubic(elapsed / duration))
}

/**
 * Animates a headline number to `value`: from `from` (0) when it first appears, then from the
 * previous value whenever it changes. Re-renders with the same value do nothing. `delay` (ms)
 * holds the starting value before each count. Reduced motion → the value as-is.
 */
export function useCountUp(value: number, duration = 450, from = 0, delay = 0): number {
  const [shown, setShown] = useState(from)
  const current = useRef(from)
  const reduced = prefersReducedMotion()

  useEffect(() => {
    const start = current.current
    if (reduced || start === value) {
      current.current = value
      if (reduced) return
      const id = requestAnimationFrame(() => setShown(value))
      return () => cancelAnimationFrame(id)
    }
    let raf = 0
    let t0 = -1
    const tick = (now: number) => {
      if (t0 < 0) t0 = now + delay
      const v = now < t0 ? start : countUpAt(start, value, now - t0, duration)
      current.current = v
      setShown(v)
      if (v !== value) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value, duration, delay, reduced])

  return reduced ? value : shown
}

/**
 * A list's entrance class: `ftg-stagger` (children rise in one after another) for the first
 * ~0.9 s after the list first has items, then nothing — so refetches and items added later
 * don't replay it. Pass `resetKey` to replay for a genuinely different list (e.g. a tab change).
 */
export function useListIntro(count: number, resetKey?: unknown): string {
  const [done, setDone] = useState<{ key: unknown } | null>(null)
  const finished = done !== null && done.key === resetKey
  useEffect(() => {
    if (count === 0 || finished) return
    const id = window.setTimeout(() => setDone({ key: resetKey }), 900)
    return () => window.clearTimeout(id)
  }, [count, finished, resetKey])
  return finished ? '' : 'ftg-stagger'
}

/**
 * Sheets/dialogs: `close()` plays the exit (`data-closing`) and then calls `onClose`.
 * Reduced motion → closes at once. Overlays: `ftg-backdrop` + panel `ftg-sheet` / `ftg-dialog`.
 */
export function useSheetExit(onClose: () => void, ms = 200) {
  const [closing, setClosing] = useState(false)
  const latest = useRef(onClose)
  const timer = useRef<number | undefined>(undefined)
  useEffect(() => {
    latest.current = onClose
  }, [onClose])
  useEffect(() => () => window.clearTimeout(timer.current), [])
  const close = useCallback(() => {
    if (prefersReducedMotion()) {
      latest.current()
      return
    }
    setClosing(true)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      latest.current()
      // For sheets that stay mounted while hidden (an `open` prop): ready for next time.
      setClosing(false)
    }, ms)
  }, [ms])
  return { closing, close }
}

/** A stable offset (0–3.9s) per look, so a list of avatars doesn't blink in unison. */
export function idleDelay(key: string): number {
  let h = 0
  for (let i = 0; i < key.length; i += 7) h = (h * 31 + key.charCodeAt(i)) >>> 0
  return (h % 40) * 100
}
