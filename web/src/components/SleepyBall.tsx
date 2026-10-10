import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { buzz, replay, sparkle } from '../lib/fx'
import '../styles/motion-play.css'

/**
 * Empty state: a ball dozes on the ground (floating z's) next to the "find a game" link.
 * Tap it: it wakes up, hops, and rolls over to nudge the link, then rolls back to sleep.
 */
export function SleepyEmpty({ title, linkTo, linkText, wakeLabel }: { title: string; linkTo: string; linkText: string; wakeLabel: string }) {
  const ball = useRef<HTMLButtonElement>(null)
  const link = useRef<HTMLAnchorElement>(null)
  const [awake, setAwake] = useState(false)
  const timers = useRef<number[]>([])
  useEffect(() => () => timers.current.forEach((id) => window.clearTimeout(id)), [])
  const later = (fn: () => void, ms: number) => timers.current.push(window.setTimeout(fn, ms))

  const wake = () => {
    const b = ball.current
    const body = b?.querySelector<HTMLElement>('.ftg-play-sb-body')
    const face = body?.querySelector<SVGElement>('svg')
    const shadow = b?.querySelector<HTMLElement>('.ftg-play-sb-shadow')
    if (awake || !b || !body || !face || !shadow || typeof body.animate !== 'function') return
    setAwake(true)
    buzz([8, 40, 12])
    const lr = link.current?.getBoundingClientRect()
    const br = body.getBoundingClientRect()
    const dx = lr ? Math.max(0, Math.min(160, lr.left - br.right - 4)) : 40
    const roll = (dx / (Math.PI * br.width)) * 360
    const hop = [
      { offset: 0, transform: 'none' },
      { offset: 0.08, transform: 'scale(1.15, 0.82)' },
      { offset: 0.24, transform: 'translateY(-38px) scale(0.92, 1.1) rotate(-10deg)' },
      { offset: 0.4, transform: 'translateY(0) scale(1.15, 0.85)' },
      { offset: 0.5, transform: 'translateY(-12px)' },
      { offset: 0.6, transform: 'none' },
      { offset: 1, transform: `translateX(${dx}px)` },
    ]
    const opts: KeyframeAnimationOptions = { duration: 1700, easing: 'linear', fill: 'forwards' }
    const anims = [
      body.animate(hop, opts),
      face.animate([{ offset: 0, transform: 'none' }, { offset: 0.6, transform: 'none' }, { offset: 1, transform: `rotate(${roll}deg)` }], opts),
      shadow.animate(
        [
          { offset: 0, transform: 'none', opacity: 1 },
          { offset: 0.24, transform: 'scale(0.6)', opacity: 0.5 },
          { offset: 0.4, transform: 'none', opacity: 1 },
          { offset: 0.6, transform: 'none' },
          { offset: 1, transform: `translateX(${dx}px)` },
        ],
        opts,
      ),
    ]
    later(() => {
      const r = body.getBoundingClientRect()
      sparkle({ x: r.left + r.width / 2, y: r.top + 6 }, 10)
    }, 380)
    later(() => {
      link.current?.classList.add('is-hl')
      replay(link.current?.firstElementChild, 'ftg-play-nudge')
      buzz(6)
    }, 1650)
    later(() => {
      link.current?.classList.remove('is-hl')
      const back: KeyframeAnimationOptions = { duration: 900, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'forwards' }
      body.animate([{ transform: `translateX(${dx}px)` }, { transform: 'none' }], back)
      shadow.animate([{ transform: `translateX(${dx}px)` }, { transform: 'none' }], back)
      face.animate([{ transform: `rotate(${roll}deg)` }, { transform: 'none' }], back).onfinish = () => {
        anims.forEach((a) => a.cancel())
        body.getAnimations().forEach((a) => a.cancel())
        shadow.getAnimations().forEach((a) => a.cancel())
        face.getAnimations().forEach((a) => a.cancel())
        setAwake(false)
      }
    }, 4200)
  }

  return (
    <div className="flex flex-col items-center px-4 py-10 text-center">
      <p className="display text-2xl font-bold">{title}</p>
      <div className="ftg-play-ground mt-5 flex w-full max-w-xs items-end justify-between gap-3 pb-1">
        <button ref={ball} type="button" onClick={wake} className={`ftg-play-sleepy ${awake ? 'is-up' : ''}`} aria-label={wakeLabel}>
          <span className="ftg-play-sb-shadow" aria-hidden />
          <span className="ftg-play-sb-body" aria-hidden>
            <svg viewBox="0 0 60 60">
              <circle cx="30" cy="30" r="27" fill="currentColor" />
              <path d="M3 30h54M30 3v54M10 10c9 9 9 31 0 40M50 10c-9 9-9 31 0 40" stroke="#12151a" strokeOpacity=".35" strokeWidth="2" fill="none" />
              <g className="ftg-play-asleep" stroke="#12151a" strokeWidth="2.6" strokeLinecap="round" fill="none">
                <path d="M17 27q4 4 8 0M35 27q4 4 8 0" />
                <path d="M27 38q3 2 6 0" />
              </g>
              <g className="ftg-play-awake" fill="#12151a">
                <circle cx="21" cy="26" r="3.6" />
                <circle cx="39" cy="26" r="3.6" />
                <circle cx="22.2" cy="24.8" r="1.2" fill="#fff" />
                <circle cx="40.2" cy="24.8" r="1.2" fill="#fff" />
                <ellipse cx="30" cy="38.5" rx="3.6" ry="4.4" />
              </g>
            </svg>
          </span>
          <span className="ftg-play-zz" aria-hidden>
            <i>z</i>
            <i>z</i>
            <i>Z</i>
          </span>
        </button>
        <Link ref={link} to={linkTo} className="ftg-play-elink mb-2 min-w-0 text-right text-sm font-semibold text-brand">
          <span>{linkText}</span>
        </Link>
      </div>
    </div>
  )
}
