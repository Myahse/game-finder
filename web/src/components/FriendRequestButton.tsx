import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Spring, buzz, burst, centerOf, shake, sparkle } from '../lib/fx'
import '../styles/motion-part4.css'

type Relation = 'none' | 'outgoing' | 'friends'
type Phase = 'idle' | 'wait' | 'sent' | 'friends'

const toPhase = (r: Relation): Phase => (r === 'friends' ? 'friends' : r === 'outgoing' ? 'sent' : 'idle')

/**
 * "Add friend" that changes with the request. Tap: the button squashes and folds into a
 * circle while a paper plane flies off with a trail; it opens again as "Request sent" with a
 * ticking clock (tap it to cancel: it shakes and unfolds). When the friend accepts, green
 * liquid fills it from the left and a check draws itself.
 */
export function FriendRequestButton({
  relation,
  sending,
  cancelling,
  failed,
  onSend,
  onCancel,
  labels,
}: {
  relation: Relation
  sending: boolean
  cancelling: boolean
  failed: boolean
  onSend: () => void
  onCancel: () => void
  labels: { add: string; pending: string; friends: string; cancel: string; friendsTitle: string }
}) {
  const wrap = useRef<HTMLDivElement>(null)
  const btn = useRef<HTMLButtonElement>(null)
  const liquid = useRef<HTMLSpanElement>(null)
  const width = useRef<Spring | null>(null)
  const squash = useRef<Spring | null>(null)
  const [phase, setPhase] = useState<Phase>(() => toPhase(relation))
  const prev = useRef(relation)
  // Keep the folded circle long enough for the paper plane, even when the server is instant.
  const waitUntil = useRef(0)
  const [ready, setReady] = useState(relation)
  useEffect(() => {
    const left = waitUntil.current - performance.now()
    if (left <= 0) return setReady(relation)
    const t = window.setTimeout(() => setReady(relation), left)
    return () => window.clearTimeout(t)
  }, [relation])

  useLayoutEffect(() => {
    const full = () => wrap.current?.clientWidth ?? 300
    width.current = new Spring(full(), (w) => btn.current && (btn.current.style.width = `${w}px`), { k: 380, c: 22 })
    squash.current = new Spring(1, (s) => btn.current && (btn.current.style.transform = `scale(${s})`), { k: 520, c: 18 })
    const ro = new ResizeObserver(() => {
      const w = width.current
      if (w && Math.abs(w.t - full()) > 1 && w.t > 60) w.set(full())
    })
    if (wrap.current) ro.observe(wrap.current)
    return () => {
      ro.disconnect()
      width.current?.stop()
      squash.current?.stop()
    }
  }, [])

  // React to the real relation as the server confirms it.
  useEffect(() => {
    const relation = ready
    const was = prev.current
    prev.current = relation
    if (relation === was) return
    const full = wrap.current?.clientWidth ?? 300
    if (relation === 'outgoing') {
      setPhase('sent')
      width.current?.to(full, { k: 300, c: 16 })
    } else if (relation === 'friends' && was === 'outgoing') {
      // Accepted while watching: liquid fill, then the check.
      const l = liquid.current
      if (l) l.animate([{ transform: 'translateX(-101%)' }, { transform: 'translateX(0)' }], { duration: 650, easing: 'cubic-bezier(.3,.7,.4,1)', fill: 'forwards' })
      window.setTimeout(() => {
        setPhase('friends')
        if (btn.current) {
          sparkle(centerOf(btn.current), 24)
          burst(centerOf(btn.current), { n: 18 })
        }
        buzz([12, 40, 20])
        if (squash.current) {
          squash.current.set(1.08)
          squash.current.to(1, { k: 380, c: 12 })
        }
      }, 650)
    } else {
      setPhase(toPhase(relation))
      width.current?.to(full, { k: 260, c: 14 })
    }
  }, [ready])

  // The send failed: unfold back to "Add friend" with a shake.
  useEffect(() => {
    if (!failed || phase !== 'wait') return
    setPhase('idle')
    width.current?.to(wrap.current?.clientWidth ?? 300)
    shake(btn.current)
  }, [failed, phase])

  const fly = () => {
    const b = btn.current
    if (!b) return
    const from = centerOf(b)
    const plane = document.createElement('span')
    plane.className = 'ftg-plane'
    plane.innerHTML = '<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M2 11l20-8-6 19-4-8-10-3z"/></svg>'
    document.body.appendChild(plane)
    const t0 = performance.now()
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / 900)
      const x = from.x + k * 190 - 40 * Math.sin(k * Math.PI)
      const y = from.y - Math.sin(k * Math.PI) * 120 - k * 40
      const ang = (Math.atan2(-Math.cos(k * Math.PI) * 120, 190) * 180) / Math.PI
      plane.style.transform = `translate(${x - 12}px, ${y - 12}px) rotate(${ang}deg) scale(${1 - k * 0.3})`
      plane.style.opacity = String(k > 0.85 ? (1 - k) / 0.15 : 1)
      if (Math.random() < 0.6) burst({ x, y }, { n: 1, colors: ['#ff5a1f', '#f2b632'], shape: 'dot', speed: [0, 0.4], gravity: 0, life: [14, 22], size: [2, 4] })
      if (k < 1) requestAnimationFrame(step)
      else plane.remove()
    }
    requestAnimationFrame(step)
  }

  const click = () => {
    if (phase === 'idle') {
      if (sending) return
      buzz(10)
      squash.current?.set(0.9)
      squash.current?.to(1)
      setPhase('wait')
      waitUntil.current = performance.now() + 1100
      width.current?.to(46, { k: 420, c: 22 })
      window.setTimeout(fly, 260)
      onSend()
    } else if (phase === 'sent') {
      if (cancelling) return
      shake(btn.current)
      buzz(8)
      onCancel()
    }
  }

  const label =
    phase === 'idle' ? (
      <>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden>
          <path d="M12 5v14M5 12h14" />
        </svg>
        {labels.add}
      </>
    ) : phase === 'wait' ? (
      <span className="ftg-fr-spin" aria-hidden />
    ) : phase === 'sent' ? (
      <>
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden>
          <circle cx="12" cy="12" r="9" />
          <path className="ftg-fr-hand" d="M12 12V7" strokeLinecap="round" />
        </svg>
        {labels.pending}
      </>
    ) : (
      <>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path className="ftg-fr-check" d="M5 12.5l4.5 4.5L19 7.5" />
        </svg>
        {labels.friends}
      </>
    )

  return (
    <div ref={wrap} className="flex justify-center">
      <button
        ref={btn}
        type="button"
        onClick={click}
        disabled={phase === 'friends' || phase === 'wait'}
        aria-label={phase === 'sent' ? `${labels.pending} · ${labels.cancel}` : phase === 'friends' ? labels.friendsTitle : undefined}
        title={phase === 'sent' ? labels.cancel : undefined}
        className={`ftg-fr is-${phase}`}
      >
        <span ref={liquid} className="ftg-fr-liquid" aria-hidden />
        <span key={phase} className="ftg-fr-label">
          {label}
        </span>
      </button>
    </div>
  )
}
