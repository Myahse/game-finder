import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { Crown, Minus, Pencil, Plus, Shuffle, Star, Trash2, Users } from 'lucide-react'
import { useLocale } from '../i18n/LocaleProvider'
import { errorMessage } from '../lib/api'
import { playerUsernameLabel } from '../lib/format'
import { hasResult, TEAM_COLORS, useSaveScoreboard, useScoreboard, type Scoreboard, type ScoreTeam } from '../lib/scoreboard'
import type { Game, PublicUser } from '../lib/types'
import { ShareResultButton } from './GameResultShare'
import { balancedTeams } from '../lib/progress'
import { Avatar, Button, Card, CountUp, ErrorText, Input, Skeleton } from './ui'
import { Odometer } from './Odometer'
import { buzz, centerOf, cheer, dust, replay, sparkle } from '../lib/fx'
import { flyStar, markRevealSeen, revealSeen, useTeamFlight } from '../lib/playMotion'
import '../styles/motion-play.css'

type Player = PublicUser & { joined_at?: string }

/** Teams, score, player stats and MVP for a game — editable by the players in it. */
export function GameScoreboard({ game, canEdit }: { game: Game; canEdit: boolean }) {
  const { t } = useLocale()
  const { data: sb, isLoading } = useScoreboard(game.id)
  const [editing, setEditing] = useState(false)
  // Just saved from the editor: the result reveal plays again for the person who saved it.
  const [justSaved, setJustSaved] = useState(false)
  const players: Player[] = game.players ?? []
  const started = new Date(game.start_time).getTime() <= Date.now() + 15 * 60_000

  if (game.status === 'cancelled') return null
  if (isLoading || !sb) {
    return (
      <section role="status" aria-label={t.account.ui.loading}>
        <Skeleton className="mb-2 h-7 w-40 rounded-lg" />
        <Skeleton className="h-28" />
      </section>
    )
  }
  if (editing)
    return (
      <ScoreboardEditor
        sb={sb}
        game={game}
        players={players}
        started={started}
        onDone={(saved) => {
          setEditing(false)
          setJustSaved(!!saved)
        }}
      />
    )

  const byId = new Map(players.map((p) => [p.id, p]))
  const empty = sb.teams.length === 0 && Object.keys(sb.stats).length === 0 && !sb.mvp_user_id

  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="display text-2xl font-bold">{t.scoreboard.title}</h2>
        {canEdit && !empty && (
          <Button variant="ghost" className="min-h-9 px-3 text-base" onClick={() => setEditing(true)}>
            <Pencil className="size-4" aria-hidden /> {t.scoreboard.edit}
          </Button>
        )}
      </div>
      {empty ? (
        <Card>
          <p className="text-ink-2">{canEdit ? t.scoreboard.empty : t.scoreboard.emptyViewer}</p>
          {canEdit && players.length >= 2 && (
            <Button className="mt-3 w-full" onClick={() => setEditing(true)}>
              <Users className="size-5" aria-hidden /> {t.scoreboard.makeTeams}
            </Button>
          )}
        </Card>
      ) : (
        <Card className="grid gap-4">
          {sb.teams.length > 0 && <ScoreHeader sb={sb} byId={byId} gameId={game.id} reveal={justSaved ? 'force' : game.status === 'completed' ? 'auto' : 'off'} />}
          <StatsTable sb={sb} byId={byId} />
          {sb.updated_by && <p className="text-xs text-ink-2">{t.scoreboard.updatedBy.replace('{user}', playerUsernameLabel(sb.updated_by))}</p>}
          {hasResult(sb) && <ShareResultButton game={game} sb={sb} />}
        </Card>
      )}
    </section>
  )
}

type RevealMode = 'auto' | 'force' | 'off'

/**
 * Teams and scores. The first time a final result is shown on this device (or right after saving it),
 * the scores spin like a slot machine and slam down, the winner gets a ribbon and confetti, and a
 * star flies to the MVP.
 */
function ScoreHeader({ sb, byId, gameId, reveal }: { sb: Scoreboard; byId: Map<string, Player>; gameId: string; reveal: RevealMode }) {
  const { t } = useLocale()
  const anyScore = sb.teams.some((x) => x.score > 0)
  const root = useRef<HTMLDivElement>(null)
  const [stage, setStage] = useState<'off' | 'wait' | 'spin'>(() =>
    anyScore && sb.teams.length >= 2 && (reveal === 'force' || (reveal === 'auto' && !revealSeen(gameId))) ? 'wait' : 'off',
  )
  const [stopped, setStopped] = useState(0)
  const revealed = stage === 'spin' && stopped >= sb.teams.length
  const mvp = sb.mvp_user_id

  // Starts once the scores are on screen.
  useEffect(() => {
    const el = root.current
    if (stage !== 'wait' || !el) return
    const go = () => {
      markRevealSeen(gameId)
      setStage('spin')
    }
    if (typeof IntersectionObserver === 'undefined') {
      const id = window.setTimeout(go, 0)
      return () => window.clearTimeout(id)
    }
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e?.isIntersecting) return
        io.disconnect()
        go()
      },
      { threshold: 0.6 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [stage, gameId])

  useEffect(() => {
    const el = root.current
    if (!revealed || !el) return
    const win = el.querySelector('[data-ftg-play-win]')
    if (win) {
      cheer(win, 50)
      buzz([20, 30, 40])
    }
    if (!mvp) return
    const id = window.setTimeout(() => {
      const target =
        el.closest('section')?.querySelector<HTMLElement>('[data-ftg-play-mvp]') ?? el.querySelector<HTMLElement>(`[data-ftg-play-pid="${mvp}"]`)
      if (!target) return
      flyStar(centerOf(win ?? el), centerOf(target), () => {
        if (!target.isConnected) return
        replay(target, 'ftg-play-hop')
        sparkle(target, 18)
        buzz([10, 30, 20])
      })
    }, 550)
    return () => window.clearTimeout(id)
  }, [revealed, mvp])

  return (
    <div ref={root} className="grid grid-cols-2 gap-2">
      {sb.teams.map((team, i) => {
        const won = sb.winner_position === team.position
        return (
          <div
            key={team.id ?? team.name}
            data-ftg-play-win={revealed && won ? '' : undefined}
            className={`ftg-play-team relative overflow-hidden rounded-2xl bg-surface-2 p-3 ${revealed && sb.winner_position != null ? (won ? 'is-win' : 'is-lose') : ''}`}
            style={{ boxShadow: `inset 0 4px 0 ${team.color}` }}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="display truncate text-lg font-bold" style={{ color: team.color }}>
                {team.name}
              </p>
              {won && (stage === 'off' || revealed) && (
                <span className="ftg-crown-in inline-flex shrink-0 items-center rounded-md bg-brand p-1 text-brand-ink" title={t.scoreboard.winner}>
                  <Crown className="size-4" aria-hidden />
                  <span className="sr-only">{t.scoreboard.winner}</span>
                </span>
              )}
            </div>
            {anyScore &&
              (stage === 'off' ? (
                <p key={team.score} className="ftg-score-hit display text-5xl font-extrabold leading-tight tabular-nums">
                  <CountUp value={team.score} />
                </p>
              ) : (
                <div className="flex items-center justify-between gap-1">
                  <p className="display text-5xl font-extrabold leading-tight tabular-nums">
                    <SlotScore value={team.score} run={stage === 'spin'} stopAt={1000 + i * 450} onStop={() => setStopped((n) => n + 1)} />
                    <span className="sr-only">{team.score}</span>
                  </p>
                  {revealed && won && (
                    <span className="ftg-play-ribbon display" aria-hidden>
                      {t.scoreboard.winner}
                    </span>
                  )}
                </div>
              ))}
            <div className="mt-1 flex flex-wrap gap-1">
              {team.players.map((id) => {
                const p = byId.get(id)
                return p ? (
                  <span key={id} title={playerUsernameLabel(p)} data-ftg-play-pid={id} className="inline-flex rounded-full">
                    <Avatar user={p} size={28} />
                  </span>
                ) : null
              })}
            </div>
          </div>
        )
      })}
      {anyScore && sb.teams.length >= 2 && sb.winner_position == null && <p className="col-span-2 text-center text-sm font-semibold text-ink-2">{t.scoreboard.draw}</p>}
    </div>
  )
}

/** A score that flicks through random numbers, slows down and slams onto the real value. */
function SlotScore({ value, run, stopAt, onStop }: { value: number; run: boolean; stopAt: number; onStop: () => void }) {
  const ref = useRef<HTMLSpanElement>(null)
  const stop = useRef(onStop)
  useEffect(() => {
    stop.current = onStop
  })
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    if (!run) {
      el.textContent = '?'
      return
    }
    const top = Math.max(9, Math.round(value * 1.5))
    const t0 = performance.now()
    let last = -1e9
    let raf = 0
    el.classList.add('is-spin')
    const step = (now: number) => {
      const t = now - t0
      if (t >= stopAt) {
        el.classList.remove('is-spin')
        el.textContent = String(value)
        replay(el, 'is-slam')
        buzz(14)
        const r = el.getBoundingClientRect()
        dust({ x: r.left + r.width / 2, y: r.bottom }, 12)
        stop.current()
        return
      }
      if (t - last > 40 + Math.pow(t / stopAt, 3) * 170) {
        last = t
        el.textContent = String(Math.floor(Math.random() * (top + 1)))
      }
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [run, value, stopAt])
  return <span ref={ref} className="ftg-play-slot" aria-hidden />
}

function StatsTable({ sb, byId }: { sb: Scoreboard; byId: Map<string, Player> }) {
  const { t } = useLocale()
  const key = sb.stat_keys[0]
  const rows = Object.entries(sb.stats)
    .filter(([id]) => byId.has(id))
    .sort(([, a], [, b]) => (b[key] ?? 0) - (a[key] ?? 0))
  if (sb.mvp_user_id && !sb.stats[sb.mvp_user_id] && byId.has(sb.mvp_user_id)) rows.unshift([sb.mvp_user_id, {}])
  if (rows.length === 0) return null
  const keys = sb.stat_keys.filter((k) => rows.some(([, s]) => (s[k] ?? 0) > 0))
  return (
    <div className="-mx-1 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-ink-2">
            <th className="px-1 py-1 font-semibold">{t.scoreboard.stats}</th>
            {keys.map((k) => (
              <th key={k} className="px-1.5 py-1 text-right font-semibold" title={t.scoreboard.statNames[k]}>
                {t.scoreboard.statLabels[k] ?? k}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(([id, s]) => {
            const p = byId.get(id)!
            return (
              <tr key={id} className="border-t border-line">
                <td className="px-1 py-1.5">
                  <span className="flex items-center gap-2">
                    <Avatar user={p} size={26} />
                    <span className="truncate font-medium">{playerUsernameLabel(p)}</span>
                    {sb.mvp_user_id === id && (
                      <span data-ftg-play-mvp className="inline-flex items-center gap-0.5 rounded bg-amber-400/20 px-1 text-xs font-bold text-amber-700 dark:text-amber-300">
                        <Star className="size-3" aria-hidden fill="currentColor" /> {t.scoreboard.mvp}
                      </span>
                    )}
                  </span>
                </td>
                {keys.map((k) => (
                  <td key={k} className={`px-1.5 py-1.5 text-right tabular-nums ${k === key ? 'font-bold' : ''}`}>
                    {s[k] ?? 0}
                  </td>
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function Stepper({ value, onChange, label, big }: { value: number; onChange: (n: number) => void; label: string; big?: boolean }) {
  const set = (n: number) => onChange(Math.max(0, Math.min(999, n)))
  return (
    <div className="flex items-center gap-1">
      <button type="button" onClick={() => set(value - 1)} className="rounded-lg bg-surface-2 p-1.5 hover:bg-line disabled:opacity-40" disabled={value <= 0} aria-label={`${label} −1`}>
        <Minus className="size-4" aria-hidden />
      </button>
      <input
        inputMode="numeric"
        value={value}
        aria-label={label}
        onChange={(e) => set(Number(e.target.value.replace(/\D/g, '')) || 0)}
        className={`${big ? 'w-16 text-2xl' : 'w-11 text-base'} display rounded-lg bg-surface-2 py-1 text-center font-bold tabular-nums`}
      />
      <button type="button" onClick={() => set(value + 1)} className="rounded-lg bg-surface-2 p-1.5 hover:bg-line" aria-label={`${label} +1`}>
        <Plus className="size-4" aria-hidden />
      </button>
    </div>
  )
}

function ScoreboardEditor({ sb, game, players, started, onDone }: { sb: Scoreboard; game: Game; players: Player[]; started: boolean; onDone: (saved?: boolean) => void }) {
  const { t } = useLocale()
  const save = useSaveScoreboard(game.id)
  const [error, setError] = useState('')
  const defaultNames = [t.scoreboard.teamA, t.scoreboard.teamB, t.scoreboard.teamC, t.scoreboard.teamD]
  const ids = players.map((p) => p.id)
  const [teams, setTeams] = useState<ScoreTeam[]>(() =>
    sb.teams.length > 0
      ? sb.teams.map((x) => ({ ...x, players: x.players.filter((id) => ids.includes(id)) }))
      : balancedTeams(ids, sb.ratings ?? {}, 2).map((ps, i) => ({ name: defaultNames[i], color: TEAM_COLORS[i], score: 0, players: ps })),
  )
  const [stats, setStats] = useState<Record<string, Record<string, number>>>(() => structuredClone(sb.stats))
  const [mvp, setMvp] = useState<string | null>(sb.mvp_user_id)
  const [open, setOpen] = useState<string | null>(null)
  // Players fly between the team cards: dealt out of the middle when the teams are first made,
  // swirled on Shuffle, slid over when moved by hand.
  const grid = useRef<HTMLDivElement>(null)
  const fly = useTeamFlight(grid, sb.teams.length === 0 ? 'deal' : undefined)
  const playerById = new Map(players.map((p) => [p.id, p]))

  const teamOf = (id: string) => teams.findIndex((x) => x.players.includes(id))
  const assign = (id: string, idx: number) => {
    fly('flip')
    setTeams((ts) => ts.map((x, i) => ({ ...x, players: i === idx ? [...x.players.filter((p) => p !== id), id] : x.players.filter((p) => p !== id) })))
  }
  const patchTeam = (idx: number, patch: Partial<ScoreTeam>) => setTeams((ts) => ts.map((x, i) => (i === idx ? { ...x, ...patch } : x)))
  const shuffle = () => {
    const split = balancedTeams(ids, sb.ratings ?? {}, Math.max(teams.length, 2))
    fly('swirl')
    setTeams((ts) => split.map((ps, i) => ({ ...(ts[i] ?? { name: defaultNames[i], color: TEAM_COLORS[i], score: 0 }), players: ps })))
  }
  const setStat = (id: string, key: string, n: number) => setStats((s) => ({ ...s, [id]: { ...s[id], [key]: n } }))

  const submit = () => {
    setError('')
    const cleanStats = Object.fromEntries(
      Object.entries(stats)
        .map(([id, s]) => [id, Object.fromEntries(Object.entries(s).filter(([, v]) => v > 0))] as const)
        .filter(([id, s]) => ids.includes(id) && Object.keys(s).length > 0),
    )
    save.mutate(
      {
        teams: teams.map((x) => ({ name: x.name.trim() || 'Team', color: x.color, score: started ? x.score : 0, players: x.players })),
        stats: started ? cleanStats : {},
        mvp_user_id: started ? mvp : null,
      },
      { onSuccess: () => onDone(true), onError: (e) => setError(errorMessage(e)) },
    )
  }

  return (
    <section>
      <h2 className="display mb-2 text-2xl font-bold">{t.scoreboard.title}</h2>
      <Card className="grid gap-4">
        <div ref={grid} className="grid grid-cols-2 gap-2">
          {teams.map((team, i) => (
            <div key={i} className="grid gap-2 rounded-2xl bg-surface-2 p-2.5" style={{ boxShadow: `inset 0 4px 0 ${team.color}` }}>
              <Input value={team.name} maxLength={24} aria-label={t.scoreboard.teamName} onChange={(e) => patchTeam(i, { name: e.target.value })} className="!min-h-10 !py-1 font-bold" />
              <div className="flex flex-wrap gap-1">
                {TEAM_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => patchTeam(i, { color: c })}
                    className={`size-6 rounded-full ring-offset-2 ring-offset-surface-2 ${team.color === c ? 'ring-2 ring-ink' : ''}`}
                    style={{ background: c }}
                    aria-label={c}
                    aria-pressed={team.color === c}
                  />
                ))}
              </div>
              <div className="flex min-h-8 flex-wrap gap-1.5">
                {team.players.map((id) => {
                  const p = playerById.get(id)
                  return p ? (
                    <span key={id} data-ftg-play-pid={id} className="ftg-play-tok" style={{ '--ftg-play-team': team.color } as CSSProperties} title={playerUsernameLabel(p)}>
                      <Avatar user={p} size={28} />
                    </span>
                  ) : null
                })}
              </div>
              <p className="flex items-center justify-between gap-2 text-xs font-semibold text-ink-2">
                <span className="inline-flex items-center gap-1" aria-label={t.scoreboard.teamCount.replace('{n}', String(team.players.length))}>
                  <Users className="size-3.5" aria-hidden />
                  <span aria-hidden>
                    <Odometer value={team.players.length} />
                  </span>
                </span>
                {team.players.length > 0 && <span>≈ {Math.round(team.players.reduce((sum, id) => sum + (sb.ratings?.[id] ?? 1000), 0) / team.players.length)}</span>}
              </p>
              {started && <Stepper value={team.score} onChange={(n) => patchTeam(i, { score: n })} label={`${team.name} ${t.scoreboard.score}`} big />}
              {teams.length > 2 && (
                <button
                  type="button"
                  onClick={() => {
                    fly('flip')
                    setTeams((ts) => ts.filter((_, j) => j !== i))
                  }}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-danger"
                >
                  <Trash2 className="size-3.5" aria-hidden /> {t.scoreboard.removeTeam}
                </button>
              )}
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="secondary" className="flex-1 text-base" onClick={shuffle}>
            <Shuffle className="size-4" aria-hidden /> {t.scoreboard.shuffle}
          </Button>
          {teams.length < 4 && (
            <Button
              type="button"
              variant="secondary"
              className="flex-1 text-base"
              onClick={() => setTeams((ts) => [...ts, { name: defaultNames[ts.length], color: TEAM_COLORS[ts.length], score: 0, players: [] }])}
            >
              <Plus className="size-4" aria-hidden /> {t.scoreboard.addTeam}
            </Button>
          )}
        </div>
        <p className="-mt-2 text-xs text-ink-2">{t.progress.balanced}</p>
        {!started && <p className="text-sm text-ink-2">{t.scoreboard.notStarted}</p>}

        <div className="grid gap-2">
          {players.map((p) => {
            const ti = teamOf(p.id)
            const s = stats[p.id] ?? {}
            const expanded = open === p.id
            return (
              <div key={p.id} className="rounded-xl border border-line p-2">
                <div className="flex items-center gap-2">
                  <Avatar user={p} size={32} />
                  <span className="min-w-0 flex-1 truncate font-medium">{playerUsernameLabel(p)}</span>
                  {started && (
                    <button
                      type="button"
                      onClick={() => setMvp((m) => (m === p.id ? null : p.id))}
                      className={`rounded-lg p-1.5 ${mvp === p.id ? 'bg-amber-400/25 text-amber-600' : 'text-ink-2 hover:bg-surface-2'}`}
                      aria-label={t.scoreboard.mvp}
                      aria-pressed={mvp === p.id}
                    >
                      <Star className="size-5" aria-hidden fill={mvp === p.id ? 'currentColor' : 'none'} />
                    </button>
                  )}
                </div>
                <div className="mt-2 flex flex-wrap gap-1" role="group" aria-label={t.scoreboard.teamName}>
                  {teams.map((team, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => assign(p.id, i)}
                      className={`rounded-lg px-2.5 py-1 text-sm font-bold ${ti === i ? 'text-white' : 'bg-surface-2 text-ink-2'}`}
                      style={ti === i ? { background: team.color } : undefined}
                      aria-pressed={ti === i}
                    >
                      {team.name || '—'}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => assign(p.id, -1)}
                    className={`rounded-lg px-2.5 py-1 text-sm font-bold ${ti === -1 ? 'bg-ink text-bg' : 'bg-surface-2 text-ink-2'}`}
                    aria-pressed={ti === -1}
                  >
                    {t.scoreboard.bench}
                  </button>
                  {started && (
                    <button type="button" onClick={() => setOpen(expanded ? null : p.id)} className="ml-auto rounded-lg bg-surface-2 px-2.5 py-1 text-sm font-bold text-ink">
                      {t.scoreboard.statLabels[sb.stat_keys[0]]} {s[sb.stat_keys[0]] ?? 0} {expanded ? '▴' : '▾'}
                    </button>
                  )}
                </div>
                {started && expanded && (
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {sb.stat_keys.map((k) => (
                      <div key={k} className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold">{t.scoreboard.statNames[k] ?? k}</span>
                        <Stepper value={s[k] ?? 0} onChange={(n) => setStat(p.id, k, n)} label={`${playerUsernameLabel(p)} ${t.scoreboard.statNames[k] ?? k}`} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <ErrorText>{error}</ErrorText>
        <div className="grid grid-cols-2 gap-2">
          <Button type="button" variant="secondary" onClick={() => onDone()}>
            {t.scoreboard.cancel}
          </Button>
          <Button type="button" onClick={submit} loading={save.isPending}>
            {t.scoreboard.save}
          </Button>
        </div>
      </Card>
    </section>
  )
}
