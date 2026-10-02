import { useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Link } from 'react-router-dom'
import { activityIcons } from './icons'
import { activityMeta } from '../lib/format'
import { resolveMediaUrl } from '../lib/mediaUrl'
import type { Activity, PublicUser } from '../lib/types'

type Variant = 'primary' | 'live' | 'secondary' | 'ghost' | 'danger'

const variants: Record<Variant, string> = {
  primary: 'bg-brand text-brand-ink hover:brightness-110',
  live: 'bg-live text-white hover:brightness-110',
  secondary: 'bg-surface-2 text-ink hover:bg-line',
  ghost: 'text-ink-2 hover:text-ink hover:bg-surface-2',
  danger: 'bg-danger/10 text-danger hover:bg-danger/20',
}

export function Button({
  variant = 'primary',
  loading,
  className = '',
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; loading?: boolean }) {
  return (
    <button
      {...props}
      disabled={props.disabled || loading}
      className={`display inline-flex min-h-12 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-5 text-lg font-bold transition active:scale-[0.98] disabled:opacity-50 ${variants[variant]} ${className}`}
    >
      {loading ? <Spinner /> : children}
    </button>
  )
}

export function Spinner({ className = '' }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={`inline-block size-5 animate-spin rounded-full border-2 border-current border-r-transparent ${className}`}
    />
  )
}

export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-ink">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-ink-2">{hint}</span>}
    </label>
  )
}

const inputCls =
  'w-full rounded-xl border border-line bg-surface px-4 py-3 text-base text-ink outline-none placeholder:text-ink-2/70 focus:border-brand focus:ring-2 focus:ring-brand/25'

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputCls} ${props.className ?? ''}`} />
}

export function PasswordInput({
  className = '',
  autoComplete = 'current-password',
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>) {
  const [visible, setVisible] = useState(false)
  return (
    <div className="relative">
      <input
        {...props}
        type={visible ? 'text' : 'password'}
        autoComplete={autoComplete}
        className={`${inputCls} pr-11 ${className}`}
      />
      <button
        type="button"
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-ink-2 hover:text-ink"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Hide password' : 'Show password'}
      >
        {visible ? <EyeOff className="size-5" aria-hidden /> : <Eye className="size-5" aria-hidden />}
      </button>
    </div>
  )
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${inputCls} appearance-none ${props.className ?? ''}`} />
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${inputCls} min-h-24 ${props.className ?? ''}`} />
}

export function Chip({
  active,
  children,
  onClick,
}: {
  active?: boolean
  children: ReactNode
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border px-4 text-sm font-semibold shadow-sm transition ${
        active ? 'border-ink bg-ink text-bg' : 'border-line bg-surface text-ink hover:border-ink-2'
      }`}
    >
      {children}
    </button>
  )
}

const toneCls: Record<string, string> = {
  live: 'bg-live/15 text-live',
  players: 'bg-players/20 text-[color-mix(in_srgb,var(--players)_70%,var(--ink))]',
  idle: 'bg-surface-2 text-ink-2',
}

export function StatusPill({ activity, className = '' }: { activity: Activity; className?: string }) {
  const m = activityMeta[activity]
  const Icon = activityIcons[activity]
  return (
    <span className={`display inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-base font-bold ${toneCls[m.tone]} ${className}`}>
      <Icon className="size-4 shrink-0" aria-hidden />
      {m.label}
    </span>
  )
}

export function Avatar({ user, size = 40 }: { user: Pick<PublicUser, 'first_name' | 'last_name' | 'avatar_url'>; size?: number }) {
  const initials = `${user.first_name?.[0] ?? ''}${user.last_name?.[0] ?? ''}`.toUpperCase()
  const src = user.avatar_url ? resolveMediaUrl(user.avatar_url) : ''
  const [broken, setBroken] = useState(false)
  const showImg = src && !broken
  return showImg ? (
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      className="shrink-0 rounded-full object-cover"
      style={{ width: size, height: size }}
      onError={() => setBroken(true)}
    />
  ) : (
    <span
      className="display inline-flex shrink-0 items-center justify-center rounded-full bg-brand/15 font-bold text-brand"
      style={{ width: size, height: size, fontSize: size * 0.42 }}
    >
      {initials || '?'}
    </span>
  )
}

export function PageHeader({ title, back, right }: { title: string; back?: string; right?: ReactNode }) {
  return (
    <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-line bg-bg/90 px-4 py-3 backdrop-blur">
      {back && (
        <Link to={back} className="-ml-2 rounded-lg p-2 text-ink-2 hover:text-ink" aria-label="Back">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
            <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
      )}
      <h1 className="display flex-1 truncate text-3xl font-extrabold">{title}</h1>
      {right}
    </header>
  )
}

export function Empty({ icon, title, children }: { icon: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <div className="mb-3 text-ink-2" aria-hidden>
        {icon}
      </div>
      <p className="display text-2xl font-bold">{title}</p>
      {children && <div className="mt-2 max-w-xs text-sm text-ink-2">{children}</div>}
    </div>
  )
}

export function ErrorText({ children }: { children: ReactNode }) {
  if (!children) return null
  return (
    <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm font-medium text-danger">
      {children}
    </p>
  )
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-line bg-surface p-4 ${className}`}>{children}</div>
}

export function AppAlert({
  open,
  title,
  message,
  onClose,
}: {
  open: boolean
  title: string
  message: string
  onClose: () => void
}) {
  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="app-alert-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-line bg-surface p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="app-alert-title" className="display text-lg font-bold">{title}</h2>
        <p className="mt-2 text-sm text-ink-2">{message}</p>
        <Button type="button" className="mt-4 w-full" onClick={onClose}>OK</Button>
      </div>
    </div>
  )
}
