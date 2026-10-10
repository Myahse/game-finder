import { useEffect, useRef, useState } from 'react'
import { useLocale } from '../i18n/LocaleProvider'
import { isIos, isStandalonePwa } from '../lib/promptDismiss'
import { registerWebPush } from '../lib/webPush'
import { Spring, buzz, shake } from '../lib/fx'
import { Card } from './ui'
import { SquashSwitch } from './SquashSwitch'
import '../styles/motion-part4.css'

type Perm = NotificationPermission | 'unsupported'

function currentPermission(): Perm {
  return 'Notification' in window ? Notification.permission : 'unsupported'
}

/** A bell that swings like a pendulum when `ring` changes; the clapper lags behind the body. */
function SwingBell({ ring, on }: { ring: number; on: boolean }) {
  const body = useRef<SVGGElement>(null)
  const clap = useRef<SVGGElement>(null)
  const waves = useRef<HTMLSpanElement>(null)
  const spring = useRef<Spring | null>(null)
  useEffect(() => {
    let cl = 0
    let clv = 0
    spring.current = new Spring(
      0,
      (a) => {
        body.current?.setAttribute('transform', `rotate(${a} 16 3)`)
        clv = (clv + (a * 1.3 - cl) * 0.14) * 0.86
        cl += clv
        clap.current?.setAttribute('transform', `rotate(${cl} 16 3)`)
      },
      { k: 90, c: 2.8, precision: 0.05 },
    )
    return () => spring.current?.stop()
  }, [])
  useEffect(() => {
    if (!ring) return
    spring.current?.kick(520)
    waves.current?.querySelectorAll('i').forEach((w, i) =>
      w.animate([{ transform: 'scale(.6)', opacity: 0.85 }, { transform: 'scale(1.9)', opacity: 0 }], { duration: 900, delay: i * 220, easing: 'ease-out' }),
    )
    buzz([30, 60, 30, 60, 30])
  }, [ring])
  return (
    <span className={`ftg-bell ${on ? 'text-live' : 'text-brand'}`} aria-hidden>
      <span ref={waves} className="ftg-bell-waves">
        <i />
        <i />
        <i />
      </span>
      <svg viewBox="0 0 32 32" className="size-7 overflow-visible">
        <g ref={clap}>
          <circle cx="16" cy="27" r="2.6" fill="currentColor" />
        </g>
        <g ref={body} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round">
          <path d="M16 3a1.6 1.6 0 0 1 1.6 1.6v1c4 1 6.6 4.6 6.6 8.6 0 6 2 7.6 3 8.6H4.8c1-1 3-2.6 3-8.6 0-4 2.6-7.6 6.6-8.6v-1A1.6 1.6 0 0 1 16 3z" fill="var(--surface)" />
        </g>
      </svg>
    </span>
  )
}

/** Turn on push for this device + send a test, with the iPhone "add to Home Screen" hint. */
export function PushSetupCard() {
  const { t } = useLocale()
  const [perm, setPerm] = useState<Perm>(currentPermission)
  const [busy, setBusy] = useState(false)
  const [detail, setDetail] = useState('')
  const [pending, setPending] = useState(false)
  const [ring, setRing] = useState(0)
  const [sample, setSample] = useState(false)
  const card = useRef<HTMLDivElement>(null)
  const iosBrowser = isIos() && !isStandalonePwa()

  const enable = async () => {
    setBusy(true)
    setPending(true)
    try {
      const p = 'Notification' in window ? await Notification.requestPermission() : 'unsupported'
      setPerm(p)
      if (p === 'granted') {
        // Yes: the bell rings and an example alert drops in.
        setRing((r) => r + 1)
        setSample(true)
        const reg = await registerWebPush()
        if (!reg.ok) setDetail(reg.reason)
      } else {
        shake(card.current)
      }
    } finally {
      setPending(false)
      setBusy(false)
    }
  }

  const text = iosBrowser
    ? t.pushSetup.iosInstall
    : perm === 'unsupported'
      ? t.pushSetup.unsupported
      : perm === 'denied'
        ? t.pushSetup.blocked
        : perm === 'granted'
          ? t.pushSetup.on
          : t.pushSetup.off

  return (
    <div ref={card} className="relative mb-4">
      {sample && <SampleAlert title={t.pushSetup.sampleTitle} body={t.pushSetup.sampleBody} tag={t.pushSetup.sample} onGone={() => setSample(false)} />}
      <Card className="flex items-start gap-3">
        <SwingBell ring={ring} on={perm === 'granted'} />
        <div className="min-w-0 flex-1">
          <p className="font-bold">{t.pushSetup.title}</p>
          <p className="text-sm text-ink-2">
            <span key={text} className="ftg-roll">{text}</span>
          </p>
          {detail && (
            <p className="mt-2 break-words rounded-lg bg-surface-2 px-2 py-1 text-xs text-ink-2">
              {t.pushSetup.details}: {detail}
            </p>
          )}
        </div>
        {!iosBrowser && (perm === 'default' || perm === 'granted') && (
          <SquashSwitch
            checked={perm === 'granted' || pending}
            disabled={busy || perm === 'granted'}
            onChange={(next) => next && void enable()}
            label={t.pushSetup.enable}
            className="mt-0.5"
          />
        )}
      </Card>
    </div>
  )
}

/** The example alert: drops in from above on a spring, swipe it sideways or up to dismiss. */
function SampleAlert({ title, body, tag, onGone }: { title: string; body: string; tag: string; onGone: () => void }) {
  const el = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const node = el.current
    if (!node) return
    let x = 0
    let y = -60
    const paint = () => {
      node.style.transform = `translate(${x}px, ${y}px) rotate(${x / 18}deg)`
      node.style.opacity = String(Math.max(0, 1 - Math.abs(x) / 240 - Math.max(0, -y - 20) / 80))
    }
    const sx = new Spring(0, (v) => ((x = v), paint()), { k: 230, c: 20 })
    const sy = new Spring(-60, (v) => ((y = v), paint()), { k: 230, c: 17 })
    const show = window.setTimeout(() => sy.to(0), 600)
    const leave = (dx: number, dy: number) => {
      sx.to(dx)
      sy.to(dy)
      window.setTimeout(onGone, 350)
    }
    const auto = window.setTimeout(() => leave(0, -90), 6000)
    let d: { x: number; y: number } | null = null
    const down = (e: PointerEvent) => {
      d = { x: e.clientX, y: e.clientY }
      node.setPointerCapture(e.pointerId)
    }
    const move = (e: PointerEvent) => {
      if (!d) return
      sx.set(e.clientX - d.x)
      sy.set(Math.min(0, e.clientY - d.y))
    }
    const up = () => {
      if (!d) return
      d = null
      if (Math.abs(x) > 70) leave(Math.sign(x) * 320, y)
      else if (y < -30) leave(x, -90)
      else {
        sx.to(0)
        sy.to(0)
      }
    }
    node.addEventListener('pointerdown', down)
    node.addEventListener('pointermove', move)
    node.addEventListener('pointerup', up)
    node.addEventListener('pointercancel', up)
    return () => {
      window.clearTimeout(show)
      window.clearTimeout(auto)
      sx.stop()
      sy.stop()
      node.removeEventListener('pointerdown', down)
      node.removeEventListener('pointermove', move)
      node.removeEventListener('pointerup', up)
      node.removeEventListener('pointercancel', up)
    }
  }, [onGone])
  return (
    <div ref={el} className="ftg-sample" role="status">
      <span className="ftg-sample-ic">OFG</span>
      <span className="min-w-0">
        <b className="block text-sm">{title}</b>
        <span className="block text-xs text-ink-2">{body}</span>
      </span>
      <span className="ml-auto shrink-0 rounded-md bg-surface-2 px-1.5 py-0.5 text-[10px] font-bold uppercase text-ink-2">{tag}</span>
    </div>
  )
}
