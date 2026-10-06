import { useEffect, useMemo, useState } from 'react'
import { Swords, X, Zap, CalendarClock } from 'lucide-react'
import { toast } from 'sonner'
import { useLocale } from '../i18n/LocaleProvider'
import { errorMessage } from '../lib/api'
import { CHALLENGE_FORMATS, useChallengeActions } from '../lib/challenges'
import { formatDistance, playerUsernameLabel } from '../lib/format'
import { useLocation } from '../lib/location'
import { useMySports } from '../lib/mySport'
import { useCourtsNearby } from '../lib/queries'
import type { PublicUser } from '../lib/types'
import { useAuth } from '../lib/auth'
import { Avatar, Button, ErrorText, Input, Spinner } from './ui'

/** Next whole hour, as a value for <input type="datetime-local">. */
function nextHourLocal() {
  const d = new Date(Date.now() + 60 * 60_000)
  d.setMinutes(0, 0, 0)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:00`
}

/** Button that opens the composer — for a player (direct) or a court (open challenge). */
export function ChallengeButton({ opponent, court, className = '', label }: { opponent?: PublicUser; court?: { id: string; name: string }; className?: string; label?: string }) {
  const { t } = useLocale()
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button type="button" className={className} onClick={() => setOpen(true)}>
        <Swords className="size-5" aria-hidden /> {label ?? t.challenge.button}
      </Button>
      {open && <ChallengeComposer opponent={opponent} court={court} onClose={() => setOpen(false)} />}
    </>
  )
}

export function ChallengeComposer({ opponent, court: fixedCourt, onClose }: { opponent?: PublicUser; court?: { id: string; name: string }; onClose: () => void }) {
  const { t } = useLocale()
  const { user } = useAuth()
  const sports = useMySports()
  const { center } = useLocation()
  const { create } = useChallengeActions()
  const [sportId, setSportId] = useState<string>('')
  const [format, setFormat] = useState('')
  const [live, setLive] = useState(true)
  const [when, setWhen] = useState(nextHourLocal)
  const [courtId, setCourtId] = useState(fixedCourt?.id ?? '')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  // Default sport: the opponent's sport if we share it, else my main one.
  useEffect(() => {
    if (sportId || sports.length === 0) return
    const shared = opponent?.preferred_sport_id && sports.find((s) => s.id === opponent.preferred_sport_id)
    setSportId((shared || sports[0]).id)
  }, [sports, sportId, opponent])

  const sport = sports.find((s) => s.id === sportId)
  const formats = useMemo(() => (sport ? (CHALLENGE_FORMATS[sport.slug] ?? []) : []), [sport])
  useEffect(() => {
    if (formats.length && !formats.some((f) => f.id === format)) setFormat(formats[0].id)
  }, [formats, format])

  const { data: courts, isLoading: courtsLoading } = useCourtsNearby(center, sport?.slug ?? null, 15)
  const nearby = (courts ?? []).filter((c) => c.sports?.some((s) => s.id === sportId)).slice(0, 8)
  useEffect(() => {
    if (fixedCourt || !nearby.length) return
    if (!nearby.some((c) => c.id === courtId)) setCourtId(nearby[0].id)
  }, [nearby, courtId, fixedCourt])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const submit = () => {
    setError('')
    create.mutate(
      {
        opponent_id: opponent?.id ?? null,
        sport_id: sportId,
        format,
        court_id: courtId,
        start_time: live ? null : new Date(when).toISOString(),
        message: message.trim() || undefined,
      },
      {
        onSuccess: () => {
          toast.success(t.challenge.sent)
          onClose()
        },
        onError: (e) => setError(errorMessage(e)),
      },
    )
  }

  return (
    <div className="ftg-safe-overlay fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={t.challenge.newTitle} onClick={onClose}>
      <div className="max-h-[94dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-surface p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="display text-2xl font-extrabold">{opponent ? t.challenge.newTitle : t.challenge.openTitle}</h2>
          <button type="button" onClick={onClose} className="rounded-full p-1.5 text-ink-2 hover:bg-surface-2 hover:text-ink" aria-label={t.common.close}>
            <X className="size-5" aria-hidden />
          </button>
        </div>

        {/* VS banner */}
        <div className="mb-4 flex items-center justify-center gap-4 rounded-2xl bg-gradient-to-br from-brand to-[var(--sport-deep,#7a1f00)] p-4 text-white">
          {user && (
            <span className="flex flex-col items-center gap-1">
              <Avatar user={user} size={56} />
              <span className="max-w-24 truncate text-xs font-bold">{playerUsernameLabel(user)}</span>
            </span>
          )}
          <span className="display text-4xl font-extrabold italic">{t.challenge.vs}</span>
          <span className="flex flex-col items-center gap-1">
            {opponent ? <Avatar user={opponent} size={56} /> : <span className="display flex size-14 items-center justify-center rounded-full border-2 border-dashed border-white/70 text-2xl">?</span>}
            <span className="max-w-24 truncate text-xs font-bold">{opponent ? playerUsernameLabel(opponent) : t.challenge.open}</span>
          </span>
        </div>
        {!opponent && <p className="-mt-2 mb-3 text-center text-xs text-ink-2">{t.challenge.openHint}</p>}

        {sports.length > 1 && (
          <>
            <p className="mb-1 text-sm font-semibold text-ink-2">{t.challenge.sport}</p>
            <div className="mb-3 flex flex-wrap gap-2">
              {sports.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSportId(s.id)}
                  className={`rounded-xl px-3 py-1.5 font-bold ${s.id === sportId ? 'bg-brand text-brand-ink' : 'bg-surface-2'}`}
                  aria-pressed={s.id === sportId}
                >
                  {s.name}
                </button>
              ))}
            </div>
          </>
        )}

        <p className="mb-1 text-sm font-semibold text-ink-2">{t.challenge.format}</p>
        <div className="mb-3 grid grid-cols-2 gap-2">
          {formats.map((f) => {
            const meta = t.challenge.formats[f.id]
            const on = f.id === format
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setFormat(f.id)}
                className={`rounded-xl border-2 p-2.5 text-left transition ${on ? 'border-brand bg-brand/10' : 'border-transparent bg-surface-2'}`}
                aria-pressed={on}
              >
                <span className="text-xl">{meta?.emoji}</span>
                <span className="display block text-lg font-bold leading-tight">{meta?.name ?? f.id}</span>
                <span className="block text-xs text-ink-2">{meta?.desc}</span>
                {f.teamSize > 1 && <span className="mt-1 block text-[11px] font-semibold text-brand">{t.challenge.perSide.replace('{n}', String(f.teamSize))}</span>}
              </button>
            )
          })}
        </div>

        <p className="mb-1 text-sm font-semibold text-ink-2">{t.challenge.when}</p>
        <div className="mb-2 grid grid-cols-2 gap-2">
          <button type="button" onClick={() => setLive(true)} className={`flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 font-bold ${live ? 'bg-live text-white' : 'bg-surface-2'}`} aria-pressed={live}>
            <Zap className="size-4" aria-hidden /> {t.challenge.live}
          </button>
          <button type="button" onClick={() => setLive(false)} className={`flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 font-bold ${!live ? 'bg-ink text-bg' : 'bg-surface-2'}`} aria-pressed={!live}>
            <CalendarClock className="size-4" aria-hidden /> {t.challenge.later}
          </button>
        </div>
        {!live && <Input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className="mb-3" aria-label={t.challenge.when} />}

        <p className="mb-1 mt-2 text-sm font-semibold text-ink-2">{t.challenge.court}</p>
        {fixedCourt ? (
          <p className="mb-3 rounded-xl bg-surface-2 px-3 py-2 font-bold">{fixedCourt.name}</p>
        ) : courtsLoading ? (
          <Spinner className="mb-3 text-brand" />
        ) : nearby.length === 0 ? (
          <p className="mb-3 text-sm text-ink-2">{t.challenge.noCourts}</p>
        ) : (
          <div className="mb-3 grid gap-1.5">
            {nearby.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCourtId(c.id)}
                className={`flex items-center justify-between rounded-xl px-3 py-2 text-left ${c.id === courtId ? 'bg-brand/10 ring-2 ring-brand' : 'bg-surface-2'}`}
                aria-pressed={c.id === courtId}
              >
                <span className="truncate font-semibold">{c.name}</span>
                {c.distance_m != null && <span className="shrink-0 text-xs text-ink-2">{formatDistance(c.distance_m)}</span>}
              </button>
            ))}
          </div>
        )}

        <p className="mb-1 text-sm font-semibold text-ink-2">{t.challenge.message}</p>
        <Input value={message} maxLength={140} placeholder={t.challenge.messagePh} onChange={(e) => setMessage(e.target.value)} />
        <div className="mt-2 flex flex-wrap gap-1.5">
          {t.challenge.messageIdeas.map((idea) => (
            <button key={idea} type="button" onClick={() => setMessage(idea)} aria-pressed={message === idea} className={`rounded-full px-2.5 py-1 text-xs font-semibold ${message === idea ? 'bg-brand text-brand-ink' : 'bg-surface-2 text-ink-2 hover:text-ink'}`}>
              {idea}
            </button>
          ))}
        </div>

        <ErrorText>{error}</ErrorText>
        <Button type="button" className="mt-4 w-full" onClick={submit} loading={create.isPending} disabled={!sportId || !format || !courtId}>
          <Swords className="size-5" aria-hidden /> {opponent ? t.challenge.send : t.challenge.post}
        </Button>
      </div>
    </div>
  )
}
