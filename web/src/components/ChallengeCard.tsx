import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Crown, MapPin, Zap } from 'lucide-react'
import { useLocale } from '../i18n/LocaleProvider'
import { errorMessage } from '../lib/api'
import { useAuth } from '../lib/auth'
import { useChallengeActions, type Challenge } from '../lib/challenges'
import { playerUsernameLabel } from '../lib/format'
import type { PublicUser } from '../lib/types'
import { Avatar, Button, Card, ErrorText, Input } from './ui'

const STATUS_CLS: Record<string, string> = {
  pending: 'bg-amber-400/20 text-amber-700 dark:text-amber-300',
  accepted: 'bg-live/15 text-live',
  reported: 'bg-sky-500/15 text-sky-700 dark:text-sky-300',
  completed: 'bg-surface-2 text-ink-2',
  declined: 'bg-danger/10 text-danger',
  cancelled: 'bg-danger/10 text-danger',
  expired: 'bg-surface-2 text-ink-2',
}

function Side({ user, won, fallback }: { user: PublicUser | null; won: boolean; fallback: string }) {
  return (
    <span className="flex min-w-0 flex-1 flex-col items-center gap-1">
      <span className="relative">
        {user ? <Avatar user={user} size={52} /> : <span className="display flex size-[52px] items-center justify-center rounded-full border-2 border-dashed border-line text-xl text-ink-2">?</span>}
        {won && <Crown className="absolute -right-2 -top-2 size-6 rotate-12 text-amber-500" fill="currentColor" aria-hidden />}
      </span>
      <span className="w-full truncate text-center text-sm font-bold">{user ? playerUsernameLabel(user) : fallback}</span>
    </span>
  )
}

/** One challenge: VS header, format, place/time and the actions for my role. */
export function ChallengeCard({ c }: { c: Challenge }) {
  const { t, locale } = useLocale()
  const { user } = useAuth()
  const { act, report } = useChallengeActions()
  const [error, setError] = useState('')
  const [reporting, setReporting] = useState(false)
  const me = user?.id
  const iAmChallenger = me === c.challenger.id
  const iAmOpponent = !!c.opponent && me === c.opponent.id
  const meta = t.challenge.formats[c.format]
  const start = new Date(c.start_time)
  const soon = start.getTime() <= Date.now() + 10 * 60_000
  const when = soon && c.status === 'pending' ? t.challenge.nowLabel : new Intl.DateTimeFormat(locale, { weekday: 'short', hour: '2-digit', minute: '2-digit' }).format(start)
  const run = (action: 'accept' | 'decline' | 'cancel' | 'confirm' | 'dispute') => {
    setError('')
    act.mutate({ id: c.id, action }, { onError: (e) => setError(errorMessage(e)) })
  }
  const reporter = c.reported_by === c.challenger.id ? c.challenger : c.opponent
  const winner = c.winner_id === c.challenger.id ? c.challenger : c.opponent
  const score = c.score_challenger || c.score_opponent ? `(${c.score_challenger ?? '–'}–${c.score_opponent ?? '–'})` : ''

  return (
    <Card className="grid gap-3">
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5 font-bold">
          <span className="text-lg">{meta?.emoji}</span>
          <span className="truncate">
            {c.sport.name} · {meta?.name ?? c.format}
          </span>
        </span>
        <span className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-bold ${STATUS_CLS[c.status]}`}>{c.is_open && c.status === 'pending' ? t.challenge.open : t.challenge.status[c.status]}</span>
      </div>

      <div className="flex items-center gap-2">
        <Side user={c.challenger} won={c.status === 'completed' && c.winner_id === c.challenger.id} fallback="" />
        <span className="flex flex-col items-center">
          <span className="display text-3xl font-extrabold italic text-brand">{t.challenge.vs}</span>
          {c.status === 'completed' && score && <span className="text-sm font-bold tabular-nums">{score.slice(1, -1)}</span>}
        </span>
        <Side user={c.opponent} won={c.status === 'completed' && !!c.opponent && c.winner_id === c.opponent.id} fallback={t.challenge.open} />
      </div>

      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-sm text-ink-2">
        <Link to={`/courts/${c.court.id}`} className="inline-flex items-center gap-1 font-semibold hover:text-ink">
          <MapPin className="size-4" aria-hidden /> {c.court.name}
        </Link>
        <span className={`inline-flex items-center gap-1 font-semibold ${soon && c.status === 'pending' ? 'text-live' : ''}`}>
          {soon && c.status === 'pending' && <Zap className="size-4" aria-hidden />} {when}
        </span>
      </div>
      {c.message && <p className="rounded-xl bg-surface-2 px-3 py-2 text-center text-sm italic">“{c.message}”</p>}

      {c.status === 'reported' && reporter && winner && (
        <p className="text-center text-sm font-semibold">
          {t.challenge.confirmPrompt.replace('{user}', playerUsernameLabel(reporter)).replace('{winner}', playerUsernameLabel(winner)).replace('{score}', score)}
        </p>
      )}

      {reporting && c.opponent ? (
        <ReportForm
          c={c}
          pending={report.isPending}
          onCancel={() => setReporting(false)}
          onSubmit={(winnerId, a, b) =>
            report.mutate(
              { id: c.id, winner_id: winnerId, score_challenger: a, score_opponent: b },
              { onSuccess: () => setReporting(false), onError: (e) => setError(errorMessage(e)) },
            )
          }
        />
      ) : (
        <div className="grid grid-cols-2 gap-2 empty:hidden">
          {c.status === 'pending' && !iAmChallenger && (c.is_open || iAmOpponent) && (
            <>
              <Button type="button" variant="live" className={c.is_open ? 'col-span-2' : ''} onClick={() => run('accept')} loading={act.isPending}>
                {c.is_open ? t.challenge.take : t.challenge.accept}
              </Button>
              {!c.is_open && (
                <Button type="button" variant="secondary" onClick={() => run('decline')}>
                  {t.challenge.decline}
                </Button>
              )}
            </>
          )}
          {(c.status === 'pending' || c.status === 'accepted') && iAmChallenger && (
            <Button type="button" variant="ghost" className="col-span-2" onClick={() => run('cancel')}>
              {t.challenge.cancel}
            </Button>
          )}
          {c.status === 'accepted' && (iAmChallenger || iAmOpponent) && (
            <Button type="button" className="col-span-2" onClick={() => setReporting(true)}>
              {t.challenge.report}
            </Button>
          )}
          {c.status === 'reported' && (iAmChallenger || iAmOpponent) && c.reported_by !== me && (
            <>
              <Button type="button" variant="live" onClick={() => run('confirm')} loading={act.isPending}>
                {t.challenge.confirm}
              </Button>
              <Button type="button" variant="danger" onClick={() => run('dispute')}>
                {t.challenge.dispute}
              </Button>
            </>
          )}
          {c.status === 'reported' && c.reported_by === me && <p className="col-span-2 text-center text-sm text-ink-2">{t.challenge.waitingConfirm}</p>}
          {c.game_id && ['accepted', 'reported', 'completed'].includes(c.status) && (
            <Link to={`/games/${c.game_id}`} className="display col-span-2 flex min-h-12 items-center justify-center rounded-xl bg-surface-2 text-lg font-bold">
              {t.challenge.goToGame}
            </Link>
          )}
        </div>
      )}
      <ErrorText>{error}</ErrorText>
    </Card>
  )
}

function ReportForm({ c, pending, onSubmit, onCancel }: { c: Challenge; pending: boolean; onSubmit: (winnerId: string, a: string, b: string) => void; onCancel: () => void }) {
  const { t } = useLocale()
  const [winner, setWinner] = useState('')
  const [a, setA] = useState('')
  const [b, setB] = useState('')
  const unit = t.challenge.formats[c.format]?.unit ?? ''
  const sides = [c.challenger, c.opponent!]
  return (
    <div className="grid gap-3 rounded-2xl bg-surface-2 p-3">
      <p className="text-center font-bold">{t.challenge.whoWon}</p>
      <div className="grid grid-cols-2 gap-2">
        {sides.map((u) => (
          <button
            key={u.id}
            type="button"
            onClick={() => setWinner(u.id)}
            className={`flex flex-col items-center gap-1 rounded-xl p-2 ${winner === u.id ? 'bg-brand/15 ring-2 ring-brand' : 'bg-surface'}`}
            aria-pressed={winner === u.id}
          >
            <Avatar user={u} size={44} />
            <span className="w-full truncate text-center text-sm font-bold">{playerUsernameLabel(u)}</span>
          </button>
        ))}
      </div>
      <p className="text-center text-xs font-semibold text-ink-2">
        {t.challenge.scoreOptional} · {unit}
      </p>
      <div className="grid grid-cols-2 gap-2">
        <Input value={a} maxLength={12} onChange={(e) => setA(e.target.value)} aria-label={`${playerUsernameLabel(c.challenger)} ${unit}`} className="text-center text-xl font-bold" />
        <Input value={b} maxLength={12} onChange={(e) => setB(e.target.value)} aria-label={`${playerUsernameLabel(c.opponent!)} ${unit}`} className="text-center text-xl font-bold" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          {t.scoreboard.cancel}
        </Button>
        <Button type="button" disabled={!winner} loading={pending} onClick={() => onSubmit(winner, a, b)}>
          {t.challenge.submit}
        </Button>
      </div>
    </div>
  )
}
