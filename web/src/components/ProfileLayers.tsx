import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Spring } from '../lib/fx'
import type { PublicUser } from '../lib/types'
import { Avatar } from './ui'
import '../styles/motion-part4.css'

// Shared between the header (docked avatar) and the layered card on the same page.
const listeners = new Set<(docked: boolean) => void>()
let dockedNow = false
const setDocked = (v: boolean) => {
  if (v === dockedNow) return
  dockedNow = v
  listeners.forEach((l) => l(v))
}

/**
 * Another player's profile header in layers: a court-lines cover behind the card moves at
 * half the scroll speed, the avatar shrinks and fades as it scrolls up and then docks into
 * the top bar. Pull down at the top (touch) and the cover stretches, then springs back.
 */
export function ProfileLayers({ children }: { children: ReactNode }) {
  const wrap = useRef<HTMLDivElement>(null)
  const cover = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const root = wrap.current
    const cv = cover.current
    if (!root || !cv) return
    const scroller: HTMLElement | null = root.closest('main')
    const av = root.querySelector<HTMLElement>('[data-profile-avatar]')
    let stretch = 0
    let raf = 0
    const paint = () => {
      raf = 0
      const y = scroller ? scroller.scrollTop : window.scrollY
      const k = Math.min(1, Math.max(0, y / 140))
      cv.style.transform = `translateY(${y * 0.5 - stretch}px) scaleY(${1 + stretch / 110})`
      cv.style.opacity = String(1 - Math.min(1, y / 260))
      if (av) {
        av.style.transform = `translateY(${k * 34}px) scale(${1 - k * 0.5})`
        av.style.opacity = String(1 - Math.min(1, Math.max(0, (y - 100) / 50)))
      }
      setDocked(y > 150)
    }
    const queue = () => {
      if (!raf) raf = requestAnimationFrame(paint)
    }
    const back = new Spring(0, (v) => ((stretch = v), queue()), { k: 260, c: 18 })
    let startY: number | null = null
    const touchStart = (e: TouchEvent) => {
      startY = (scroller?.scrollTop ?? window.scrollY) <= 0 ? e.touches[0].clientY : null
    }
    const touchMove = (e: TouchEvent) => {
      if (startY == null) return
      const dy = e.touches[0].clientY - startY
      if (dy > 0) back.set(Math.pow(dy, 0.75))
    }
    const touchEnd = () => {
      startY = null
      back.to(0)
    }
    const target: HTMLElement | Window = scroller ?? window
    target.addEventListener('scroll', queue, { passive: true })
    root.addEventListener('touchstart', touchStart, { passive: true })
    root.addEventListener('touchmove', touchMove, { passive: true })
    root.addEventListener('touchend', touchEnd)
    paint()
    return () => {
      cancelAnimationFrame(raf)
      back.stop()
      setDocked(false)
      target.removeEventListener('scroll', queue)
      root.removeEventListener('touchstart', touchStart)
      root.removeEventListener('touchmove', touchMove)
      root.removeEventListener('touchend', touchEnd)
    }
  }, [])
  return (
    <div ref={wrap} className="ftg-layers">
      <div ref={cover} className="ftg-layers-cover" aria-hidden>
        <svg viewBox="0 0 400 160" preserveAspectRatio="xMidYMid slice">
          <g fill="none" stroke="rgb(255 255 255 / 0.28)" strokeWidth="4">
            <rect x="24" y="22" width="352" height="190" rx="8" />
            <line x1="200" y1="22" x2="200" y2="212" />
            <circle cx="200" cy="117" r="38" />
            <path d="M110 212a90 90 0 0 1 180 0" />
          </g>
        </svg>
      </div>
      <div className="ftg-layers-card">{children}</div>
    </div>
  )
}

/** The small avatar that pops into the top bar once the big one has scrolled away. */
export function DockedAvatar({ user }: { user: PublicUser }) {
  const [on, setOn] = useState(dockedNow)
  useEffect(() => {
    listeners.add(setOn)
    return () => {
      listeners.delete(setOn)
    }
  }, [])
  return (
    <span className={`ftg-dock-av ${on ? 'is-on' : ''}`} aria-hidden>
      <Avatar user={user} size={32} />
    </span>
  )
}
