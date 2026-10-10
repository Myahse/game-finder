import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { KeyRound } from 'lucide-react'
import { toast } from 'sonner'
import { useLocale } from '../i18n/LocaleProvider'
import { api, errorMessage } from '../lib/api'
import type { Me } from '../lib/types'
import { Button, Card, ErrorText, Field } from './ui'
import { PasswordField } from './PasswordStrength'
import { Spring, burst, buzz, shake, sparkle } from '../lib/fx'
import { passwordScore } from '../lib/onboardMotion'
import '../styles/motion-part5.css'

const LIQUID = ['#ef2b54', '#ef2b54', '#f97316', '#f2b632', '#16a34a']
const sleep = (ms: number) => new Promise((r) => window.setTimeout(r, ms))

/**
 * The padlock is the strength meter: each character typed is a coin that flies into its slot,
 * and the lock fills with liquid in the strength colour. `lock()` snaps the shackle shut with
 * a ring and a shine; `rattle()` jiggles it, spills the coins and drains the liquid.
 */
function usePadlock(value: string) {
  const shackle = useRef<SVGPathElement>(null)
  const body = useRef<SVGSVGElement>(null)
  const liquid = useRef<SVGPathElement>(null)
  const spring = useRef<Spring | null>(null)
  const level = useRef<Spring | null>(null)
  const fill = useRef(0)
  const drained = useRef(false)
  const length = useRef(value.length)

  useEffect(() => {
    spring.current = new Spring(-12, (y) => shackle.current?.setAttribute('transform', `translate(0 ${y})`), { k: 500, c: 18 })
    level.current = new Spring(0, (v) => (fill.current = v), { k: 90, c: 12 })
    // The liquid's surface has a small wave; bottom of the body is y 82, top y 38.
    let raf = 0
    let t = 0
    const draw = () => {
      t += 0.08
      const top = 82 - fill.current * 44
      const amp = fill.current > 0.02 ? 1.6 : 0
      const pts: string[] = []
      for (let x = 10; x <= 70; x += 4) pts.push(`${x} ${(top + Math.sin(x / 7 + t) * amp).toFixed(2)}`)
      liquid.current?.setAttribute('d', `M10 86 L${pts.join(' L')} L70 86 Z`)
      raf = requestAnimationFrame(draw)
    }
    draw()
    return () => {
      cancelAnimationFrame(raf)
      spring.current?.stop()
      level.current?.stop()
    }
  }, [])

  // A coin per new character, from the end of the typed text to the lock's slot.
  useEffect(() => {
    const prev = length.current
    length.current = value.length
    const target = Math.min(1, value.length / 12)
    liquid.current?.setAttribute('fill', LIQUID[passwordScore(value)])
    if (value.length <= prev) return void level.current?.to(target)
    const lock = body.current
    const input = document.activeElement as HTMLElement | null
    if (!lock || !input || input.tagName !== 'INPUT') return void level.current?.to(target)
    const from = input.getBoundingClientRect()
    const to = lock.getBoundingClientRect()
    const coin = document.createElement('span')
    coin.className = 'ftg-coin-fly'
    coin.setAttribute('aria-hidden', 'true')
    document.body.appendChild(coin)
    const fx = from.left + Math.min(from.width - 50, 16 + value.length * 8)
    const fy = from.top + from.height / 2
    const tx = to.left + to.width / 2
    const ty = to.top + to.height * 0.45
    const t0 = performance.now()
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / 380)
      coin.style.transform = `translate(${fx + (tx - fx) * k}px, ${fy + (ty - fy) * k - Math.sin(k * Math.PI) * 50}px) scale(${1 - k * 0.35}) rotateY(${k * 540}deg)`
      if (k < 1) return void requestAnimationFrame(step)
      coin.remove()
      buzz(4)
      lock.animate([{ transform: 'none' }, { transform: 'translateY(2px) scale(1.04,.96)' }, { transform: 'none' }], { duration: 160 })
      if (!drained.current) level.current?.to(target)
    }
    requestAnimationFrame(step)
  }, [value])

  const lock = () => {
    spring.current?.to(0, { k: 800, c: 14 })
    window.setTimeout(() => {
      const el = body.current
      if (!el) return
      buzz(16)
      el.animate(
        [{ transform: 'none' }, { transform: 'translateY(3px) scale(1.07,.93)' }, { transform: 'translateY(-2px)' }, { transform: 'none' }],
        { duration: 420, easing: 'cubic-bezier(.34,1.56,.64,1)' },
      )
      el.querySelector('.ftg-lock-shine')?.animate(
        [{ opacity: 0, transform: 'translateX(-60px)' }, { opacity: 1, offset: 0.3 }, { opacity: 0, transform: 'translateX(60px)' }],
        { duration: 700, delay: 120 },
      )
      el.parentElement?.querySelector('.ftg-lock-ring')?.animate(
        [{ transform: 'scale(.5)', opacity: 1 }, { transform: 'scale(4)', opacity: 0 }],
        { duration: 650, easing: 'ease-out' },
      )
      sparkle(el, 16)
    }, 120)
  }

  const rattle = async () => {
    buzz([20, 40, 20])
    for (let i = 0; i < 3; i++) {
      spring.current?.to(-17, { k: 900, c: 10 })
      await sleep(70)
      spring.current?.to(-8)
      await sleep(70)
    }
    spring.current?.to(-12, { k: 500, c: 18 })
    const el = body.current
    if (!el) return
    shake(el)
    const r = el.getBoundingClientRect()
    burst({ x: r.left + r.width / 2, y: r.top + r.height * 0.7 }, { n: 9, colors: ['#f2b632', '#ffd76a', '#c88a00'], shape: 'dot', size: [7, 10], speed: [2, 4], gravity: 0.3, life: [40, 60] })
    drained.current = true
    level.current?.to(0, { k: 60, c: 14 })
    // Fill back up to the typed password once the spill is over.
    await sleep(1400)
    drained.current = false
    level.current?.to(Math.min(1, length.current / 12), { k: 90, c: 12 })
  }

  const node = (
    <span className="ftg-lock-wrap" aria-hidden>
      <svg ref={body} viewBox="0 0 80 86" className="ftg-lock">
        <defs>
          <clipPath id="ftg-lock-body">
            <rect x="10" y="38" width="60" height="44" rx="11" />
          </clipPath>
          <linearGradient id="ftg-lock-sheen" x1="0" x2="1">
            <stop offset=".3" stopColor="#fff" stopOpacity="0" />
            <stop offset=".5" stopColor="#fff" stopOpacity=".75" />
            <stop offset=".7" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path ref={shackle} className="ftg-lock-shackle" d="M24 40V26a16 16 0 0 1 32 0v14" fill="none" stroke="var(--ink-2)" strokeWidth="7" strokeLinecap="round" />
        <rect x="10" y="38" width="60" height="44" rx="11" fill="var(--surface-2)" stroke="var(--line)" strokeWidth="2" />
        <g clipPath="url(#ftg-lock-body)">
          <path ref={liquid} fill={LIQUID[0]} />
          <rect className="ftg-lock-shine" x="10" y="38" width="60" height="44" fill="url(#ftg-lock-sheen)" opacity="0" />
        </g>
        <rect x="32" y="44" width="16" height="4" rx="2" fill="var(--ink-2)" />
        <circle cx="40" cy="62" r="5" fill="var(--ink)" opacity=".7" />
        <rect x="38" y="64" width="4" height="9" rx="2" fill="var(--ink)" opacity=".7" />
      </svg>
      <span className="ftg-lock-ring" />
    </span>
  )
  return { node, lock, rattle }
}

/** Google/Apple accounts can add a password (username login); others can change it. */
export function PasswordCard({ me }: { me: Me }) {
  const { t } = useLocale()
  const qc = useQueryClient()
  const adding = me.has_password === false
  const [open, setOpen] = useState(adding)
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const padlock = usePadlock(next)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      await api('/api/me/password', { method: 'POST', json: { current_password: adding ? undefined : current, new_password: next } })
      toast.success(adding ? t.password.added.replace('{user}', me.username) : t.password.changed)
      padlock.lock()
      await sleep(900)
      setCurrent('')
      setNext('')
      setOpen(false)
      await qc.invalidateQueries({ queryKey: ['me'] })
    } catch (err) {
      setError(errorMessage(err))
      void padlock.rattle()
    } finally {
      setBusy(false)
    }
  }

  if (!open) {
    return (
      <Button type="button" variant="ghost" onClick={() => setOpen(true)}>
        <KeyRound className="size-5" aria-hidden /> {t.password.change}
      </Button>
    )
  }

  return (
    <Card>
      <form onSubmit={submit} className="grid gap-3">
        <div className="flex items-center gap-3">
          {padlock.node}
          <div>
            <p className="font-bold">{adding ? t.password.addTitle : t.password.changeTitle}</p>
            {adding && <p className="text-sm text-ink-2">{t.password.addBody.replace('{user}', me.username)}</p>}
          </div>
        </div>
        {!adding && (
          <Field label={t.password.current}>
            <PasswordField required autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
          </Field>
        )}
        <Field label={t.password.new} hint={t.password.hint}>
          <PasswordField meter required minLength={8} maxLength={72} autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
        </Field>
        <ErrorText>{error}</ErrorText>
        <div className="flex gap-2">
          {!adding && (
            <Button type="button" variant="ghost" className="flex-1" onClick={() => setOpen(false)}>
              {t.scoreboard.cancel}
            </Button>
          )}
          <Button type="submit" className="flex-1" loading={busy} disabled={next.length < 8}>
            {t.password.save}
          </Button>
        </div>
      </form>
    </Card>
  )
}
