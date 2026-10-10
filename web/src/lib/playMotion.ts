import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { Spring, buzz, replay } from './fx'

type ViewTransitionDoc = Document & {
  startViewTransition?: (update: () => Promise<void> | void) => { finished: Promise<void> }
}

const sleep = (ms: number) => new Promise((r) => window.setTimeout(r, ms))

async function waitFor(test: () => boolean, ms: number) {
  const end = performance.now() + ms
  while (!test() && performance.now() < end) await sleep(16)
}

export function canMorph(): boolean {
  return typeof document !== 'undefined' && typeof (document as ViewTransitionDoc).startViewTransition === 'function'
}

/**
 * Opens a game with the card growing into the game page (View Transitions API).
 * The card's snapshot morphs into the game page's hero (`.ftg-play-vt-hero`) when it has one,
 * else into the page area (`main`). Returns false when the browser can't do it (caller navigates normally).
 */
export function morphToGame(card: HTMLElement, go: () => void): boolean {
  const doc = document as ViewTransitionDoc
  if (!doc.startViewTransition) return false
  const root = document.documentElement
  card.style.viewTransitionName = 'ftg-play-game'
  root.classList.add('ftg-play-vt')
  let target: HTMLElement | null = null
  try {
    const vt = doc.startViewTransition(async () => {
      // The old snapshot is taken: the name moves to the page we're opening.
      card.style.viewTransitionName = ''
      go()
      await waitFor(() => !card.isConnected, 300)
      // Give the game a moment to render past its loading state (it's usually cached).
      await waitFor(() => !!document.querySelector('.ftg-play-vt-hero, main h1'), 300)
      target = document.querySelector<HTMLElement>('.ftg-play-vt-hero') ?? document.querySelector<HTMLElement>('main')
      if (target) target.style.viewTransitionName = 'ftg-play-game'
    })
    void vt.finished.finally(() => {
      root.classList.remove('ftg-play-vt')
      if (target) target.style.viewTransitionName = ''
    })
  } catch {
    card.style.viewTransitionName = ''
    root.classList.remove('ftg-play-vt')
    return false
  }
  buzz(6)
  return true
}

type Flight = { x: Spring; y: Spring; s: Spring }
const flights = new WeakMap<HTMLElement, Flight>()

function flightOf(el: HTMLElement): Flight {
  let f = flights.get(el)
  if (!f) {
    const draw = () => {
      if (!f) return
      el.style.transform = `translate(${f.x.x}px, ${f.y.x}px) scale(${f.s.x})`
    }
    f = {
      x: new Spring(0, () => draw(), { k: 160, c: 15, precision: 0.2 }),
      y: new Spring(0, () => draw(), { k: 160, c: 15, precision: 0.2 }),
      s: new Spring(1, () => draw(), { k: 300, c: 16, precision: 0.002 }),
    }
    flights.set(el, f)
  }
  return f
}

export type TeamFlightMode = 'swirl' | 'deal' | 'flip'

/**
 * Players (`[data-ftg-play-pid]` inside `root`) fly from where they were to their new team.
 * Call `prepare(mode)` right before the state change that moves them; the flight plays after render.
 * swirl: lift, orbit the middle, then land in the team · deal: come out of the middle · flip: slide over.
 */
export function useTeamFlight(root: RefObject<HTMLElement | null>, onMount?: TeamFlightMode) {
  const pending = useRef<{ mode: TeamFlightMode; from: Map<string, { x: number; y: number }> } | null>(onMount ? { mode: onMount, from: new Map() } : null)
  const orbit = useRef(0)

  useLayoutEffect(() => {
    const job = pending.current
    const box = root.current
    if (!job || !box) return
    pending.current = null
    cancelAnimationFrame(orbit.current)
    const els = [...box.querySelectorAll<HTMLElement>('[data-ftg-play-pid]')]
    const br = box.getBoundingClientRect()
    const cx = br.left + br.width / 2
    const cy = br.top + br.height / 2
    const R = Math.max(30, Math.min(br.width / 2 - 30, 90))
    const items = els.map((el) => {
      const f = flightOf(el)
      // Where it sits now, without any leftover transform.
      const r = el.getBoundingClientRect()
      const ex = r.left + r.width / 2 - f.x.x
      const ey = r.top + r.height / 2 - f.y.x
      const was = job.from.get(el.dataset.ftgPlayPid ?? '')
      if (job.mode === 'flip' && (!was || (Math.abs(was.x - ex) < 2 && Math.abs(was.y - ey) < 2))) return null
      f.x.set(was ? was.x - ex : cx - ex)
      f.y.set(was ? was.y - ey : cy - ey)
      f.s.set(was ? 1 : 0.3)
      el.classList.add('is-flying')
      return { el, f, ex, ey }
    }).filter((x) => !!x)

    const land = (delay: number) =>
      items.forEach(({ el, f }, i) =>
        window.setTimeout(() => {
          f.x.to(0, { k: 160, c: 15 })
          f.y.to(0, { k: 160, c: 15 })
          f.s.to(1, { k: 300, c: 14 })
          const settle = () => {
            if (f.x.x !== 0 || f.y.x !== 0 || f.s.x !== 1) return
            el.classList.remove('is-flying')
            el.style.transform = ''
          }
          f.x.done = f.y.done = f.s.done = settle
          window.setTimeout(() => replay(el, 'ftg-play-land'), 380)
        }, delay + i * 70),
      )

    if (job.mode === 'flip') {
      land(0)
      return
    }
    buzz(8)
    items.forEach(({ f }) => f.s.to(1.25, { k: 260, c: 13 }))
    const t0 = performance.now()
    const n = Math.max(1, items.length)
    const spin = (now: number) => {
      const t = (now - t0) / 1000
      items.forEach(({ f, ex, ey }, i) => {
        const a = (i / n) * Math.PI * 2 + t * 5
        f.x.to(cx + Math.cos(a) * R - ex, { k: 130, c: 15 })
        f.y.to(cy + Math.sin(a) * R * 0.5 - ey, { k: 130, c: 15 })
      })
      if (t < 0.75) orbit.current = requestAnimationFrame(spin)
      else {
        land(0)
        buzz([10, 50, 10, 50, 10])
      }
    }
    orbit.current = requestAnimationFrame(spin)
  })

  return (mode: TeamFlightMode) => {
    const from = new Map<string, { x: number; y: number }>()
    root.current?.querySelectorAll<HTMLElement>('[data-ftg-play-pid]').forEach((el) => {
      const r = el.getBoundingClientRect()
      from.set(el.dataset.ftgPlayPid ?? '', { x: r.left + r.width / 2, y: r.top + r.height / 2 })
    })
    pending.current = { mode, from }
  }
}

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

/** A gold star arcs from one point to another, spinning, then calls `done`. */
export function flyStar(from: { x: number; y: number }, to: { x: number; y: number }, done: () => void): void {
  const s = document.createElement('div')
  s.className = 'ftg-play-flystar'
  s.setAttribute('aria-hidden', 'true')
  s.innerHTML =
    '<svg viewBox="0 0 24 24" width="26" height="26"><path d="M12 2l2.9 6.6 7.1.7-5.4 4.8 1.6 7L12 17.4 5.8 21.1l1.6-7L2 9.3l7.1-.7z" fill="#f2b632" stroke="#fff" stroke-width="1.2" stroke-linejoin="round"/></svg>'
  document.body.appendChild(s)
  const mx = (from.x + to.x) / 2 + 60
  const my = Math.min(from.y, to.y) - 60
  const t0 = performance.now()
  const step = (now: number) => {
    const t = Math.min(1, (now - t0) / 700)
    const e = easeInOut(t)
    const x = (1 - e) * (1 - e) * from.x + 2 * (1 - e) * e * mx + e * e * to.x
    const y = (1 - e) * (1 - e) * from.y + 2 * (1 - e) * e * my + e * e * to.y
    s.style.transform = `translate(${x - 13}px, ${y - 13}px) rotate(${e * 540}deg) scale(${1 + Math.sin(Math.PI * e) * 0.8})`
    if (t < 1) requestAnimationFrame(step)
    else {
      s.remove()
      done()
    }
  }
  requestAnimationFrame(step)
}

const REVEAL_KEY = 'ftg-play-reveal:'

/** The big result reveal plays once per game on this device. */
export function revealSeen(gameId: string): boolean {
  try {
    return localStorage.getItem(REVEAL_KEY + gameId) === '1'
  } catch {
    return true
  }
}

export function markRevealSeen(gameId: string): void {
  try {
    localStorage.setItem(REVEAL_KEY + gameId, '1')
  } catch {
    // Private mode: it may replay, which is fine.
  }
}

/** True for a moment right after `loading` turns false, so a list can morph out of its skeleton. */
export function useLoadMorph(loading: boolean, ms = 1200): boolean {
  const [prev, setPrev] = useState(loading)
  const [morph, setMorph] = useState(false)
  if (prev !== loading) {
    setPrev(loading)
    setMorph(prev && !loading)
  }
  useEffect(() => {
    if (!morph) return
    const id = window.setTimeout(() => setMorph(false), ms)
    return () => window.clearTimeout(id)
  }, [morph, ms])
  return morph
}
