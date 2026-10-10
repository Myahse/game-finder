import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { KeyRound } from 'lucide-react'
import { toast } from 'sonner'
import { useLocale } from '../i18n/LocaleProvider'
import { api, errorMessage } from '../lib/api'
import type { Me } from '../lib/types'
import { Button, Card, ErrorText, Field } from './ui'
import { PasswordField } from './PasswordStrength'
import { Spring, buzz, shake, sparkle } from '../lib/fx'
import { passwordScore } from '../lib/onboardMotion'
import '../styles/motion-part5.css'

const COIN_COLORS = ['var(--line)', '#ef2b54', '#f97316', '#f2b632', '#16a34a']
const sleep = (ms: number) => new Promise((r) => window.setTimeout(r, ms))

/** Padlock whose shackle is a spring: `lock()` snaps it shut, `rattle()` jiggles it. */
function usePadlock() {
  const shackle = useRef<SVGPathElement>(null)
  const body = useRef<SVGSVGElement>(null)
  const spring = useRef<Spring | null>(null)
  useEffect(() => {
    spring.current = new Spring(-4, (y) => shackle.current?.setAttribute('transform', `translate(0 ${y})`), { k: 500, c: 18 })
    return () => spring.current?.stop()
  }, [])
  const lock = () => {
    spring.current?.to(0, { k: 700, c: 14 })
    window.setTimeout(() => {
      buzz(16)
      body.current?.animate(
        [{ transform: 'none' }, { transform: 'translateY(2px) scale(1.08,.92)' }, { transform: 'translateY(-2px)' }, { transform: 'none' }],
        { duration: 420, easing: 'cubic-bezier(.34,1.56,.64,1)' },
      )
      body.current?.querySelector('.ftg-lock-shine')?.animate(
        [{ opacity: 0, transform: 'translateX(-14px)' }, { opacity: 1, offset: 0.3 }, { opacity: 0, transform: 'translateX(14px)' }],
        { duration: 700, delay: 120 },
      )
      if (body.current) sparkle(body.current, 14)
    }, 120)
  }
  const rattle = async () => {
    buzz([20, 40, 20])
    for (let i = 0; i < 3; i++) {
      spring.current?.to(-6, { k: 900, c: 10 })
      await sleep(70)
      spring.current?.to(-2)
      await sleep(70)
    }
    spring.current?.to(-4, { k: 500, c: 18 })
  }
  const node = (
    <svg ref={body} viewBox="0 0 24 24" className="ftg-lock mt-0.5 size-7 text-brand" aria-hidden>
      <defs>
        <clipPath id="ftg-lock-body">
          <rect x="4" y="10.5" width="16" height="11.5" rx="3" />
        </clipPath>
      </defs>
      <path ref={shackle} className="ftg-lock-shackle" d="M8 11V7.5a4 4 0 0 1 8 0V11" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      <rect x="4" y="10.5" width="16" height="11.5" rx="3" fill="currentColor" />
      <g clipPath="url(#ftg-lock-body)">
        <rect className="ftg-lock-shine" x="9" y="8" width="4" height="16" fill="#fff" opacity="0" transform="rotate(20 12 16)" />
      </g>
      <circle cx="12" cy="15.5" r="1.6" fill="var(--surface)" />
      <path d="M12 16.5v2" stroke="var(--surface)" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
  return { node, lock, rattle, el: body }
}

/** One coin per character, dropping in; they take the strength colour. */
function PasswordCoins({ value }: { value: string }) {
  const n = Math.min(value.length, 32)
  return (
    <span className="ftg-coins" aria-hidden style={{ ['--ftg-coin' as string]: COIN_COLORS[passwordScore(value)] }}>
      {Array.from({ length: n }, (_, i) => (
        <b key={i} />
      ))}
    </span>
  )
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
  const padlock = usePadlock()

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
      shake(padlock.el.current)
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
        <div className="flex items-start gap-3">
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
          <PasswordCoins value={next} />
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
