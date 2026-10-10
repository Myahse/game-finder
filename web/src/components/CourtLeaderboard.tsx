import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Trophy } from 'lucide-react'
import { useLocale } from '../i18n/LocaleProvider'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { playerUsernameLabel } from '../lib/format'
import { Spring, buzz } from '../lib/fx'
import type { PublicUser } from '../lib/types'
import { Avatar, Card, SkeletonList } from './ui'
import { Odometer } from './Odometer'
import { useListIntro } from '../lib/motion'
import '../styles/motion-court.css'

type Row = { rank: number; user: PublicUser; games: number; wins: number; points: number; mvps: number; score: number }
type Leaderboard = { players: Row[]; me: Row | null }

const MEDALS = ['#f5b301', '#b8c2cc', '#cd7f32']

type Slot = { el: HTMLDivElement | null; y: Spring; s: Spring; top: number | null; rank: number }

/**
 * FLIP for the ranking: after each new list, every row starts where it was and springs to its new
 * place on its own spring; climbers lift above the others, fallers sink a little.
 */
function useRankFlip(rows: Row[], extra: Row | null) {
  const box = useRef<HTMLDivElement>(null)
  const slots = useRef(new Map<string, Slot>())
  const [moved, setMoved] = useState<Record<string, number>>({})

  const slot = (id: string): Slot => {
    let sl = slots.current.get(id)
    if (!sl) {
      const draw = () => {
        if (!sl?.el) return
        sl.el.style.transform = sl.y.x || sl.s.x !== 1 ? `translateY(${sl.y.x}px) scale(${sl.s.x})` : ''
        sl.el.style.setProperty('--ftg-court-x-sh', `${Math.max(0, (sl.s.x - 1) * 200)}px`)
      }
      sl = { el: null, top: null, rank: 0, y: new Spring(0, () => draw(), { k: 180, c: 19, precision: 0.1 }), s: new Spring(1, () => draw(), { k: 260, c: 16, precision: 0.001 }) }
      slots.current.set(id, sl)
    }
    return sl
  }
  const bind = (id: string) => (el: HTMLDivElement | null) => {
    slot(id).el = el
  }

  const all = extra ? [...rows, extra] : rows
  const sig = all.map((r) => `${r.user.id}:${r.rank}`).join(',')

  useLayoutEffect(() => {
    const root = box.current
    if (!root) return
    const base = root.getBoundingClientRect().top
    const delta: Record<string, number> = {}
    const timers: number[] = []
    let hadPrev = false
    for (const r of all) {
      const sl = slot(r.user.id)
      if (!sl.el) continue
      // Layout top, without the transform the spring is currently adding.
      const top = sl.el.getBoundingClientRect().top - base - sl.y.x
      const d = sl.rank ? sl.rank - r.rank : 0
      if (sl.rank) hadPrev = true
      if (sl.top != null && Math.abs(sl.top - top) > 0.5) {
        sl.y.set(sl.top + sl.y.x - top)
        sl.y.to(0, { k: 150 + Math.min(8, Math.abs(d)) * 25, c: 18 })
      }
      sl.el.style.zIndex = d > 0 ? '3' : d < 0 ? '1' : '2'
      if (d) {
        sl.s.to(d > 0 ? 1.04 : 0.97)
        timers.push(window.setTimeout(() => sl.s.to(1), 380 + Math.min(8, Math.abs(d)) * 60))
        delta[r.user.id] = d
      }
      sl.top = top
      sl.rank = r.rank
    }
    if (hadPrev) setMoved(delta)
    if (Object.keys(delta).length) buzz(6)
    return () => timers.forEach((t) => window.clearTimeout(t))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig])

  useEffect(() => {
    const m = slots.current
    return () => m.forEach((sl) => (sl.y.stop(), sl.s.stop()))
  }, [])

  return { box, bind, moved }
}

/** The period switch: a pill whose leading edge leaps and trailing edge catches up (elastic). */
function PeriodSwitch({ period, onChange }: { period: 'month' | 'all'; onChange: (p: 'month' | 'all') => void }) {
  const { t } = useLocale()
  const wrap = useRef<HTMLDivElement>(null)
  const pill = useRef<HTMLSpanElement>(null)
  const springs = useRef<{ l: Spring; r: Spring } | null>(null)
  const first = useRef(true)

  useLayoutEffect(() => {
    const w = wrap.current
    const p = pill.current
    if (!w || !p) return
    const edge = { l: 0, r: 0 }
    const draw = () => {
      p.style.transform = `translateX(${edge.l}px)`
      p.style.width = `${Math.max(0, edge.r - edge.l)}px`
    }
    springs.current = {
      l: new Spring(0, (v) => ((edge.l = v), draw())),
      r: new Spring(0, (v) => ((edge.r = v), draw())),
    }
    const snap = () => {
      const b = w.querySelector<HTMLElement>('[aria-selected="true"]')
      if (!b || !springs.current) return
      springs.current.l.set(b.offsetLeft)
      springs.current.r.set(b.offsetLeft + b.offsetWidth)
    }
    snap()
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(snap)
    ro?.observe(w)
    return () => {
      ro?.disconnect()
      springs.current?.l.stop()
      springs.current?.r.stop()
    }
  }, [])

  useLayoutEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    const b = wrap.current?.querySelector<HTMLElement>('[aria-selected="true"]')
    const sp = springs.current
    if (!b || !sp) return
    const L = b.offsetLeft
    const R = L + b.offsetWidth
    const lead = { k: 560, c: 32 }
    const trail = { k: 170, c: 18 }
    if (L > sp.l.x) {
      sp.r.to(R, lead)
      sp.l.to(L, trail)
    } else {
      sp.l.to(L, lead)
      sp.r.to(R, trail)
    }
  }, [period])

  return (
    <div ref={wrap} className="ftg-court-x-seg flex rounded-xl bg-surface-2 p-0.5 text-sm font-bold" role="tablist">
      <span ref={pill} className="ftg-court-x-segpill" aria-hidden />
      {(['month', 'all'] as const).map((p) => (
        <button
          key={p}
          type="button"
          role="tab"
          aria-selected={period === p}
          onClick={() => onChange(p)}
          className={`whitespace-nowrap rounded-lg px-3 py-1 ${period === p ? 'text-ink' : 'text-ink-2'}`}
        >
          {t.leaderboard[p]}
        </button>
      ))}
    </div>
  )
}

/** Players ranked at a court: wins, MVPs and games played. */
export function CourtLeaderboard({ courtId }: { courtId: string }) {
  const { t } = useLocale()
  const { user } = useAuth()
  const [period, setPeriod] = useState<'month' | 'all'>('month')
  const { data, isLoading } = useQuery({
    queryKey: ['leaderboard', courtId, period],
    queryFn: () => api<Leaderboard>(`/api/courts/${courtId}/leaderboard?period=${period}`),
    // Keep the old ranking on screen while the other period loads, so rows can slide to their new places.
    placeholderData: keepPreviousData,
  })
  const rows = data?.players ?? []
  const intro = useListIntro(rows.length)
  const meOutside = data?.me && !rows.some((r) => r.user.id === data.me!.user.id) ? data.me : null
  const { box, bind, moved } = useRankFlip(rows, meOutside)

  return (
    <section>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="display flex min-w-0 items-center gap-2 text-2xl font-bold leading-tight">
          <Trophy className="size-6 shrink-0 text-brand" aria-hidden /> {t.leaderboard.title}
        </h2>
        <PeriodSwitch period={period} onChange={setPeriod} />
      </div>
      <Card className="p-2">
        {isLoading ? (
          <div className="grid gap-1.5 p-1">
            <SkeletonList rows={3} className="h-10 rounded-xl" />
          </div>
        ) : rows.length === 0 ? (
          <p className="p-2 text-ink-2">{t.leaderboard.empty}</p>
        ) : (
          <div ref={box}>
            <div className="grid grid-cols-[1.75rem_minmax(0,1fr)_repeat(3,2.4rem)] items-center gap-x-1 px-2 pb-1 text-right text-xs font-semibold text-ink-2">
              <span />
              <span />
              <span>{t.leaderboard.games}</span>
              <span>{t.leaderboard.wins}</span>
              <span>{t.leaderboard.points}</span>
            </div>
            <div className={intro}>
              {rows.map((r) => {
                const mine = r.user.id === user?.id
                return (
                  <div key={r.user.id} ref={bind(r.user.id)} className="ftg-court-x-row">
                    <LeaderRow row={r} mine={mine} moved={mine ? moved[r.user.id] : undefined} />
                  </div>
                )
              })}
            </div>
            {meOutside && (
              <>
                <div className="my-1 text-center text-ink-2">⋯</div>
                <div ref={bind(meOutside.user.id)} className="ftg-court-x-row">
                  <LeaderRow row={meOutside} mine moved={moved[meOutside.user.id]} />
                </div>
              </>
            )}
            <p className="px-2 pt-2 text-xs text-ink-2">{t.leaderboard.how}</p>
          </div>
        )}
      </Card>
    </section>
  )
}

/** Rank disc that flips over (like a scoreboard card) when the rank changes, swapping medal colour mid-flip. */
function RankBadge({ rank }: { rank: number }) {
  const [shown, setShown] = useState(rank)
  const el = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    if (rank === shown) return
    const node = el.current
    node?.classList.remove('ftg-court-x-flip')
    void node?.offsetWidth
    node?.classList.add('ftg-court-x-flip')
    const id = window.setTimeout(() => setShown(rank), 250)
    return () => window.clearTimeout(id)
  }, [rank, shown])
  const medal = MEDALS[shown - 1]
  return (
    <span
      ref={el}
      className={`ftg-court-x-rk display flex size-7 items-center justify-center rounded-full text-base font-extrabold ${medal ? 'text-white' : 'text-ink-2'}`}
      style={medal ? { background: medal } : undefined}
    >
      {shown}
    </span>
  )
}

function LeaderRow({ row, mine, moved }: { row: Row; mine: boolean; moved?: number }) {
  const { t } = useLocale()
  return (
    <Link
      to={`/users/${row.user.id}`}
      className={`ftg-press grid grid-cols-[1.75rem_minmax(0,1fr)_repeat(3,2.4rem)] items-center gap-x-1 rounded-xl px-2 py-1.5 text-right tabular-nums ${mine ? 'bg-brand/10' : 'hover:bg-surface-2'}`}
    >
      <RankBadge rank={row.rank} />
      <span className="flex min-w-0 items-center gap-2 text-left">
        <span className="shrink-0">
          <Avatar user={row.user} size={30} />
        </span>
        <span className="min-w-0">
          <span className="block truncate font-semibold">{playerUsernameLabel(row.user)}</span>
          {(mine || row.mvps > 0) && (
            <span className="flex flex-wrap items-center gap-x-2 text-xs font-bold">
              {mine && <span className="text-brand">{t.leaderboard.you}</span>}
              {mine && !!moved && (
                <span
                  key={`${row.rank}:${moved}`}
                  className="ftg-court-x-mv"
                  data-dir={moved > 0 ? 'up' : 'down'}
                  aria-label={(moved > 0 ? t.leaderboard.movedUp : t.leaderboard.movedDown).replace('{n}', String(Math.abs(moved)))}
                >
                  {moved > 0 ? '▲' : '▼'} {Math.abs(moved)}
                </span>
              )}
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
      <span>
        <Odometer value={row.points} />
      </span>
    </Link>
  )
}
