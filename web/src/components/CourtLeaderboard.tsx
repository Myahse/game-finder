import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Trophy } from 'lucide-react'
import { useLocale } from '../i18n/LocaleProvider'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { playerUsernameLabel } from '../lib/format'
import type { PublicUser } from '../lib/types'
import { Avatar, Card, Spinner } from './ui'

type Row = { rank: number; user: PublicUser; games: number; wins: number; points: number; mvps: number; score: number }
type Leaderboard = { players: Row[]; me: Row | null }

const MEDALS = ['#f5b301', '#b8c2cc', '#cd7f32']

/** Players ranked at a court: wins, MVPs and games played. */
export function CourtLeaderboard({ courtId }: { courtId: string }) {
  const { t } = useLocale()
  const { user } = useAuth()
  const [period, setPeriod] = useState<'month' | 'all'>('month')
  const { data, isLoading } = useQuery({
    queryKey: ['leaderboard', courtId, period],
    queryFn: () => api<Leaderboard>(`/api/courts/${courtId}/leaderboard?period=${period}`),
  })
  const rows = data?.players ?? []
  const meOutside = data?.me && !rows.some((r) => r.user.id === data.me!.user.id) ? data.me : null

  return (
    <section>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="display flex min-w-0 items-center gap-2 text-2xl font-bold leading-tight">
          <Trophy className="size-6 shrink-0 text-brand" aria-hidden /> {t.leaderboard.title}
        </h2>
        <div className="flex rounded-xl bg-surface-2 p-0.5 text-sm font-bold" role="tablist">
          {(['month', 'all'] as const).map((p) => (
            <button
              key={p}
              type="button"
              role="tab"
              aria-selected={period === p}
              onClick={() => setPeriod(p)}
              className={`whitespace-nowrap rounded-lg px-3 py-1 ${period === p ? 'bg-surface text-ink shadow-sm' : 'text-ink-2'}`}
            >
              {t.leaderboard[p]}
            </button>
          ))}
        </div>
      </div>
      <Card className="p-2">
        {isLoading ? (
          <div className="flex justify-center p-4">
            <Spinner className="text-brand" />
          </div>
        ) : rows.length === 0 ? (
          <p className="p-2 text-ink-2">{t.leaderboard.empty}</p>
        ) : (
          <>
            <div className="grid grid-cols-[1.75rem_minmax(0,1fr)_repeat(3,2.4rem)] items-center gap-x-1 px-2 pb-1 text-right text-xs font-semibold text-ink-2">
              <span />
              <span />
              <span>{t.leaderboard.games}</span>
              <span>{t.leaderboard.wins}</span>
              <span>{t.leaderboard.points}</span>
            </div>
            {rows.map((r) => (
              <LeaderRow key={r.user.id} row={r} mine={r.user.id === user?.id} />
            ))}
            {meOutside && (
              <>
                <div className="my-1 text-center text-ink-2">⋯</div>
                <LeaderRow row={meOutside} mine />
              </>
            )}
            <p className="px-2 pt-2 text-xs text-ink-2">{t.leaderboard.how}</p>
          </>
        )}
      </Card>
    </section>
  )
}

function LeaderRow({ row, mine }: { row: Row; mine: boolean }) {
  const { t } = useLocale()
  const medal = MEDALS[row.rank - 1]
  return (
    <Link
      to={`/users/${row.user.id}`}
      className={`grid grid-cols-[1.75rem_minmax(0,1fr)_repeat(3,2.4rem)] items-center gap-x-1 rounded-xl px-2 py-1.5 text-right tabular-nums ${mine ? 'bg-brand/10' : 'hover:bg-surface-2'}`}
    >
      <span
        className={`display flex size-7 items-center justify-center rounded-full text-base font-extrabold ${medal ? 'text-white' : 'text-ink-2'}`}
        style={medal ? { background: medal } : undefined}
      >
        {row.rank}
      </span>
      <span className="flex min-w-0 items-center gap-2 text-left">
        <span className="shrink-0">
          <Avatar user={row.user} size={30} />
        </span>
        <span className="min-w-0">
          <span className="block truncate font-semibold">{playerUsernameLabel(row.user)}</span>
          {(mine || row.mvps > 0) && (
            <span className="flex gap-2 text-xs font-bold">
              {mine && <span className="text-brand">{t.leaderboard.you}</span>}
              {row.mvps > 0 && (
                <span className="text-amber-600 dark:text-amber-300">
                  ★ {row.mvps} {t.leaderboard.mvps}
                </span>
              )}
            </span>
          )}
        </span>
      </span>
      <span>{row.games}</span>
      <span className="font-bold">{row.wins}</span>
      <span>{row.points}</span>
    </Link>
  )
}
