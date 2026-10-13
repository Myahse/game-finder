import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarPlus, Check, ChevronRight, Flame, Gamepad2, Gift, MapPin, Swords, Trophy, UserPlus, Users, type LucideIcon } from 'lucide-react'
import { toast } from 'sonner'
import { useLocale } from '../i18n/LocaleProvider'
import { api } from '../lib/api'
import { GAME_MODE_ENABLED } from '../lib/features'

interface Quest { id: string; xp: number; done: boolean; claimed: boolean }
export interface DailyQuestsState {
  day: string
  resets_at: string
  quests: Quest[]
  all: { xp: number; done: boolean; claimed: boolean }
  streak: { current: number; best: number; today: boolean }
  milestones: { days: number; xp: number }[]
  today_xp: number
  total_xp: number
  gained?: number
  bonus?: number
}

// Mode Jeu quests only while Mode Jeu is shown in the app.
const JEU = GAME_MODE_ENABLED ? '?jeu=1' : ''
const KEY = ['quests', 'me'] as const

const ICON: Record<string, LucideIcon> = {
  checkin: MapPin, join: Users, play: Trophy, create: CalendarPlus, friend: UserPlus, challenge: Swords,
  jeu_play: Gamepad2, jeu_win: Gamepad2, jeu_online: Gamepad2,
}
const GO: Record<string, string> = {
  checkin: '/', join: '/play', play: '/play', create: '/games/new', friend: '/profile', challenge: '/challenges',
  jeu_play: '/jeu/arenes', jeu_win: '/jeu/arenes', jeu_online: '/jeu/arenes',
}

export function useDailyQuests() {
  return useQuery({ queryKey: KEY, queryFn: () => api<DailyQuestsState>(`/api/me/quests${JEU}`), staleTime: 30_000 })
}

function useCountdown(to: string | undefined) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 30_000); return () => clearInterval(id) }, [])
  const left = Math.max(0, (to ? Date.parse(to) : now) - now)
  return { h: Math.floor(left / 3_600_000), m: Math.floor((left % 3_600_000) / 60_000) }
}

/** Today's 3 quests, the bonus for doing all of them, and the daily streak. */
export function DailyQuests({ className = '' }: { className?: string }) {
  const { t } = useLocale()
  const tq = t.quests
  const qc = useQueryClient()
  const { data } = useDailyQuests()
  const left = useCountdown(data?.resets_at)
  const claim = useMutation({
    mutationFn: (id: string) => api<DailyQuestsState>(`/api/me/quests/${id}/claim${JEU}`, { method: 'POST' }),
    onSuccess: (res) => {
      qc.setQueryData(KEY, res)
      void qc.invalidateQueries({ queryKey: ['progress'] })
      void qc.invalidateQueries({ queryKey: ['jeu', 'me'] })
      if (res.bonus) toast.success(tq.bonusToast.replace('{n}', String(res.streak.current)).replace('{xp}', String(res.bonus)))
      else if (res.gained) toast.success(tq.gained.replace('{n}', String(res.gained)))
    },
    onError: () => toast.error(tq.failed),
  })
  if (!data) return null
  const nextText = (m: { days: number; xp: number }) => (m.days - data.streak.current === 1 ? tq.nextOne : tq.next.replace('{n}', String(m.days - data.streak.current))).replace('{xp}', String(m.xp))

  const s = data.streak
  const doneCount = data.quests.filter((q) => q.done).length
  const next = data.milestones.find((m) => m.days > s.current)
  const streakText = s.current === 0 ? tq.streakNone : s.current === 1 ? tq.streakOne : tq.streak.replace('{n}', String(s.current))

  return (
    <section className={`grid gap-2.5 rounded-2xl border border-line bg-surface p-3.5 ${className}`} aria-label={tq.title}>
      <div className="flex items-center gap-3">
        <span className={`grid size-12 shrink-0 place-items-center rounded-full ${s.today ? 'bg-brand text-white' : 'bg-surface-2 text-ink-2'}`}>
          <Flame className={`size-7 ${s.today ? 'ftg-flame' : ''}`} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <b className="display block text-lg font-extrabold uppercase leading-tight">{tq.title}</b>
          <span className="block text-sm text-ink-2">
            <b className={s.current ? 'text-brand' : ''}>{streakText}</b>
            {' · '}{s.today ? tq.streakSafe : tq.streakHint}
          </span>
        </div>
        <span className="display shrink-0 text-2xl font-black tabular-nums">{doneCount}/3</span>
      </div>

      <div className="flex h-1.5 gap-1" aria-hidden>
        {data.quests.map((q) => <i key={q.id} className={`flex-1 rounded-full transition-colors ${q.done ? 'bg-brand' : 'bg-surface-2'}`} />)}
      </div>

      <ul className="grid gap-1.5">
        {data.quests.map((q) => {
          const Icon = ICON[q.id] ?? Trophy
          return (
            <li key={q.id} className={`flex items-center gap-2.5 rounded-xl p-2 ${q.claimed ? 'bg-surface-2/60' : 'bg-surface-2'}`}>
              <span className={`grid size-9 shrink-0 place-items-center rounded-lg ${q.done ? 'bg-brand/15 text-brand' : 'bg-surface text-ink-2'}`}><Icon className="size-5" aria-hidden /></span>
              <span className={`min-w-0 flex-1 text-sm font-semibold ${q.claimed ? 'text-ink-2 line-through decoration-2' : ''}`}>{tq.q[q.id] ?? q.id}</span>
              {q.claimed ? (
                <span className="display inline-flex shrink-0 items-center gap-1 text-sm font-bold uppercase text-live"><Check className="size-4" aria-hidden />{tq.claimed}</span>
              ) : q.done ? (
                <button type="button" disabled={claim.isPending} onClick={() => claim.mutate(q.id)}
                  className="ftg-press display shrink-0 rounded-full bg-brand px-3 py-1.5 text-sm font-bold uppercase text-white disabled:opacity-60">
                  {tq.claim.replace('{n}', String(q.xp))}
                </button>
              ) : (
                <Link to={GO[q.id] ?? '/play'} className="display inline-flex shrink-0 items-center gap-0.5 rounded-full border border-line px-2.5 py-1 text-sm font-bold uppercase text-ink-2">
                  +{q.xp} XP<ChevronRight className="size-4" aria-hidden />
                </Link>
              )}
            </li>
          )
        })}
        <li className="flex items-center gap-2.5 rounded-xl border border-dashed border-line p-2">
          <span className={`grid size-9 shrink-0 place-items-center rounded-lg ${data.all.done ? 'bg-[var(--gold)]/20 text-[var(--gold)]' : 'bg-surface-2 text-ink-2'}`}><Gift className="size-5" aria-hidden /></span>
          <span className="min-w-0 flex-1 text-sm"><b className="block font-semibold">{tq.all}</b><span className="text-ink-2">{tq.allBody}</span></span>
          {data.all.claimed ? (
            <span className="display inline-flex shrink-0 items-center gap-1 text-sm font-bold uppercase text-live"><Check className="size-4" aria-hidden />{tq.claimed}</span>
          ) : data.all.done ? (
            <button type="button" disabled={claim.isPending} onClick={() => claim.mutate('all')}
              className="ftg-press display shrink-0 rounded-full bg-[var(--gold)] px-3 py-1.5 text-sm font-bold uppercase text-[#12151a] disabled:opacity-60">
              {tq.claim.replace('{n}', String(data.all.xp))}
            </button>
          ) : (
            <span className="display shrink-0 text-sm font-bold uppercase text-ink-2">+{data.all.xp} XP</span>
          )}
        </li>
      </ul>

      <div className="grid gap-1.5">
        <div className="flex items-center gap-1" aria-label={next ? nextText(next) : tq.best.replace('{n}', String(s.best))}>
          {data.milestones.map((m, i) => {
            const prev = i ? data.milestones[i - 1].days : 0
            const fill = Math.max(0, Math.min(1, (s.current - prev) / (m.days - prev)))
            return (
              <div key={m.days} className="grid flex-1 gap-0.5">
                <div className="h-1.5 overflow-hidden rounded-full bg-surface-2"><i className="block h-full bg-brand transition-all" style={{ width: `${fill * 100}%` }} /></div>
                <span className={`text-[10px] font-semibold ${s.current >= m.days ? 'text-brand' : 'text-ink-2'}`}>{tq.milestone.replace('{n}', String(m.days))} · +{m.xp}</span>
              </div>
            )
          })}
        </div>
        <span className="flex justify-between text-xs text-ink-2">
          <span>{next ? nextText(next) : tq.best.replace('{n}', String(s.best))}</span>
          <span className="tabular-nums">{tq.resetsIn.replace('{h}', String(left.h)).replace('{m}', String(left.m))}</span>
        </span>
      </div>
    </section>
  )
}
