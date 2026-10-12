import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { BicepsFlexed, Flame, Gamepad2, LayoutGrid, PartyPopper, PauseCircle, RotateCcw, Tv, Volume2, VolumeX, Zap, type LucideIcon } from 'lucide-react'
import { useLocale } from '../../i18n/LocaleProvider'
import { useAuth } from '../../lib/auth'
import { useCourt } from '../../lib/queries'
import type { PublicUser } from '../../lib/types'
import { Avatar } from '../../components/ui'
import { Match, isThree, rating, type Banner, type Choice, type FeedLine, type Moment, type Shot, type Tactics } from '../../jeu/engine'
import { Stage, type Scene, type ScenePlayer } from '../../jeu/stage'
import { sound } from '../../jeu/sound'
import { applySnap, glide, type ClientView } from '../../jeu/snapshot'
import { firstName, headImage, useGamePlayers } from '../../jeu/data'
import { pendingMatch, type PendingMatch } from '../../jeu/session'
import { FeedText, type FeedContext } from '../../jeu/FeedText'
import { useJeuSocket } from './JeuLayout'
import { MatchSummary, type SummaryData } from './MatchSummary'

type Mode = 'solo' | 'host' | 'client'
const REACTS: { e: string; icon: LucideIcon; tone: string }[] = [
  { e: 'fire', icon: Flame, tone: 'text-brand' },
  { e: 'clap', icon: PartyPopper, tone: 'text-[var(--gold)]' },
  { e: 'wow', icon: Zap, tone: 'text-upcoming' },
  { e: 'strong', icon: BicepsFlexed, tone: 'text-live' },
]
const VIEW_KEY = 'ftg.jeu.view'
const lc = (s: string | undefined | null) => (s ?? '').toLowerCase()

export function JeuMatchPage() {
  const { code } = useParams<{ code: string }>()
  const pending = pendingMatch()
  const [round, setRound] = useState(0)
  const mode: Mode = !code ? 'solo' : pending?.mode === 'host' && pending.code === code ? 'host' : 'client'
  if (code && !/^[a-z0-9]{4}$/.test(code)) return <Navigate to="/jeu/arenes" replace />
  if (mode === 'solo' && !pending) return <Navigate to="/jeu/arenes" replace />
  return <MatchScreen key={`${code ?? 'solo'}-${round}`} mode={mode} code={code ?? null} pending={mode === 'client' ? null : pending} onAgain={() => setRound((r) => r + 1)} />
}

function MatchScreen({ mode, code, pending, onAgain }: { mode: Mode; code: string | null; pending: PendingMatch | null; onAgain: () => void }) {
  const { t } = useLocale()
  const tm = t.jeu.match
  const navigate = useNavigate()
  const { user } = useAuth()
  const myId = lc(user?.id)
  const socket = useJeuSocket()

  const cvRef = useRef<HTMLCanvasElement>(null)
  const stageRef = useRef<Stage | null>(null)
  const matchRef = useRef<Match | null>(null)
  const viewRef = useRef<ClientView | null>(null)
  const controlRef = useRef(false)
  const speedRef = useRef(1)
  const toutRef = useRef(false)
  const answeredRef = useRef(0)
  const shotsRef = useRef<Shot[][]>([[], [], [], [], [], []])

  const [, setTick] = useState(0)
  const [feed, setFeed] = useState<FeedLine[]>([])
  const [banner, setBanner] = useState<Banner | null>(null)
  const [acts, setActs] = useState<{ list: Choice[]; k: number; q: number; secs: number; online: boolean } | null>(null)
  const [finished, setFinished] = useState(false)
  const [summary, setSummary] = useState(false)
  const [tout, setTout] = useState(false)
  const [view, setView] = useState<'tv' | 'top'>(() => { try { return localStorage.getItem(VIEW_KEY) === 'top' ? 'top' : 'tv' } catch { return 'tv' } })
  const [soundOn, setSoundOn] = useState(sound.on)
  const [hasClip, setHasClip] = useState(false)
  const [control, setControl] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [tactics, setTactics] = useState<Tactics>({ pace: 'norm', focus: 'bal', def: 'man' })
  const [members, setMembers] = useState<string[]>([])
  const [claims, setClaims] = useState<Record<string, string>>({})
  const [hostId, setHostId] = useState<string | null>(pending ? myId : null)
  const [courtId, setCourtId] = useState<string | null>(pending?.court.id ?? null)
  const [problem, setProblem] = useState<'gone' | 'full' | null>(null)
  const [timeoutUsed, setTimeoutUsed] = useState(false)
  const [floats, setFloats] = useState<{ id: number; e: string; who: string; x: number }[]>([])
  const [rosterIds, setRosterIds] = useState<string[]>(pending ? [...pending.teams[0], ...pending.teams[1]].map((r) => r.id) : [])

  // People on screen: the six players and whoever is connected.
  const lookupIds = useMemo(() => [...new Set([...rosterIds, ...members])].filter((id) => !id.startsWith('bot-')), [rosterIds, members])
  const peopleQ = useGamePlayers(mode === 'solo' ? [] : lookupIds)
  const people = useMemo(() => {
    const out: Record<string, PublicUser> = {}
    for (const [id, u] of Object.entries(pending?.users ?? {})) out[lc(id)] = u
    for (const g of peopleQ.data ?? []) out[lc(g.user.id)] = g.user
    if (user) out[myId] = user
    return out
  }, [pending, peopleQ.data, user, myId])
  const peopleRef = useRef(people)
  peopleRef.current = people
  const nameOf = useCallback((id: string) => { const u = peopleRef.current[lc(id)]; return u ? firstName(u) : '…' }, [])
  const { data: court } = useCourt(courtId ?? undefined, null)
  const courtName = pending?.court.name ?? court?.name ?? ''

  const addFloat = useCallback((e: string, who: string) => {
    if (!REACTS.some((r) => r.e === e)) return
    const id = Math.random()
    setFloats((f) => (f.length > 14 ? f : [...f, { id, e, who, x: 8 + Math.random() * 74 }]))
    setTimeout(() => setFloats((f) => f.filter((x) => x.id !== id)), 1900)
  }, [])

  const showBanner = useCallback((b: Banner) => {
    setBanner(b)
    setTimeout(() => setBanner((cur) => (cur?.n === b.n ? null : cur)), b.ms)
  }, [])

  const onFinished = useCallback(() => {
    setFinished(true)
    setTimeout(() => setSummary(true), matchMedia('(prefers-reduced-motion: reduce)').matches ? 3200 : 5600)
  }, [])

  // ── the engine (solo only: the server plays online matches) ──
  useEffect(() => {
    if (!pending || mode !== 'solo') return
    let m: Match | null = null
    m = new Match(pending.teams, {
      humanFor: (p) => {
        const i = m!.idx(p)
        return i === 0 && controlRef.current ? 'me' : null
      },
      onAwait: (aw) => {
        if (aw && aw.who === 'me') setActs({ list: aw.list, k: aw.k, q: aw.q, secs: 0, online: false })
        else setActs(null)
      },
      onFx: (f) => {
        const [, type, i, x, y, e] = f
        if (type === 'mk') shotsRef.current[i]?.push({ x, y, made: true })
        if (type === 'ms' || type === 'bk') shotsRef.current[i]?.push({ x, y, made: false })
        stageRef.current?.fx(type, i, x, y, e, m ? m.P : [])
      },
      onBanner: showBanner,
      onFeed: () => setFeed([...(m?.feed ?? [])]),
      onFinish: onFinished,
    })
    setFeed([...m.feed])
    matchRef.current = m
    return () => { matchRef.current = null }
  }, [pending, mode, showBanner, onFinished])

  // ── the stage and the frame loop ──
  useEffect(() => {
    const cv = cvRef.current
    if (!cv) return
    const stage = new Stage(cv)
    stage.view = view
    stage.onClip = () => setHasClip(true)
    stageRef.current = stage
    let raf = 0, last = 0, hudT = 0
    const loop = (now: number) => {
      const raw = Math.min(0.05, (now - (last || now)) / 1000); last = now
      const m = matchRef.current, v = viewRef.current
      if (m) {
        const paused = toutRef.current || (stage.replaying && mode === 'solo')
        const dt = paused ? 0 : raw * speedRef.current * m.slow
        if (dt) m.update(dt)
        stage.frame(sceneOf(m.P, m.ball, m.idx(m.handler), m.phase, m.shotClock, !!m.aw, m.score, 0, m.ball.mode === 'pass' && m.ball.from && m.ball.to ? [m.idx(m.ball.from), m.idx(m.ball.to)] : null, m.slow), dt, raw)
      } else if (v) {
        glide(v, raw)
        stage.frame(sceneOf(v.P, v.ball, v.handler, v.phase, v.shotClock, !!v.aw, v.score, myIdxRef.current, v.lane, 1), raw, raw)
      } else stage.message(problemRef.current ? tm.gone : tm.connecting)
      hudT += raw; if (hudT > 0.25) { hudT = 0; setTick((x) => x + 1) }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, socket])
  useEffect(() => { if (stageRef.current) stageRef.current.view = view }, [view])

  // Scene pieces that change rarely, kept in refs for the loop.
  const namesRef = useRef<[string, string]>(['', ''])
  const tagsRef = useRef<string[]>([])
  const headsRef = useRef<(HTMLImageElement | null)[]>([])
  const myIdxRef = useRef(0)
  const problemRef = useRef(problem)
  problemRef.current = problem
  function sceneOf(P: ScenePlayer[], ball: Scene['ball'], handler: number, phase: string, shotClock: number, awaiting: boolean, score: [number, number], me: number, lane: [number, number] | null, slow: number): Scene {
    return { P, ball, handler, phase, shotClock, awaiting, score, names: namesRef.current, lane, me, tags: tagsRef.current, heads: headsRef.current, slow }
  }

  // ── online: every phone, the host's included, draws the server's match ──
  useEffect(() => {
    if (mode === 'solo' || !code) return
    socket.join(code)
    let lastFeed = '', lastBanner = -1
    const apply = (raw: unknown) => {
      const res = applySnap(viewRef.current, raw)
      if (!res) return
      const v = res.view
      viewRef.current = v
      if (res.newRoster) { setRosterIds(v.P.map((p) => lc(p.id))); shotsRef.current = [[], [], [], [], [], []] }
      for (const f of res.fx) {
        const [, type, i, x, y, e] = f
        if (type === 'mk') shotsRef.current[i]?.push({ x, y, made: true })
        if (type === 'ms' || type === 'bk') shotsRef.current[i]?.push({ x, y, made: false })
        stageRef.current?.fx(type, i, x, y, e, v.P)
      }
      const fk = JSON.stringify(v.feed); if (fk !== lastFeed) { lastFeed = fk; setFeed(v.feed) }
      if (v.banner && v.banner.n !== lastBanner) { const first = lastBanner < 0; lastBanner = v.banner.n; if (!first) showBanner(v.banner) }
      setClaims((c) => (JSON.stringify(c) === JSON.stringify(v.claims) ? c : v.claims))
      const mine = Object.entries(v.claims).find(([, u]) => lc(u) === myId)?.[0]
      myIdxRef.current = mine !== undefined ? Number(mine) : v.hostIdx
      setTactics((x) => (JSON.stringify(x) === JSON.stringify(v.tactics) ? x : v.tactics))
      setSpeed(v.speed); setTimeoutUsed(v.timeoutUsed); setTout(v.paused)
      setControl(lc(v.claims['0']) === myId)
      if (v.aw && v.aw.who && lc(v.aw.who) === myId && v.aw.q !== answeredRef.current && v.aw.o.length) setActs({ list: v.aw.o, k: v.aw.k, q: v.aw.q, secs: v.aw.t, online: true })
      else setActs(null)
      if (v.finished) setFinished((was) => { if (!was) onFinished(); return true })
    }
    const off = socket.onRoom((ev) => {
      if (ev.t === 'joined') { setHostId(lc(ev.host_id)); setCourtId(ev.court_id); if (ev.state) apply(ev.state) }
      else if (ev.t === 'state') { setProblem(null); apply(ev.s) }
      else if (ev.t === 'members') setMembers(ev.members)
      else if (ev.t === 'closed') setProblem('gone')
      else if (ev.t === 'error') setProblem(ev.code === 'room_full' ? 'full' : 'gone')
      else if (ev.t === 'react') addFloat(ev.e, nameOf(ev.from))
    })
    return () => { off(); socket.leave() }
  }, [mode, code, socket, myId, addFloat, nameOf, showBanner, onFinished])

  // ── what the screen shows (refreshed 4 times a second) ──
  const m = matchRef.current, v = viewRef.current
  const P: (ScenePlayer & { id: string; st: { pts: number; reb: number; ast: number; fgm: number; fga: number; stl: number; blk: number; to: number; tpm: number; tpa: number } })[] = (m?.P ?? v?.P ?? []) as never
  const score: [number, number] = m?.score ?? v?.score ?? [0, 0]
  const off = m?.off ?? v?.off ?? 0
  const poss = m?.poss ?? v?.poss ?? 0
  const momentum = m ? m.momentum() : v?.momentum ?? 50
  const hostIdx = v?.hostIdx ?? 0
  const myIdx = mode === 'solo' ? 0 : myIdxRef.current
  const teamNames: [string, string] = [P[0] ? `Team ${P[0].name}` : '', P[3] ? `Team ${P[3].name}` : '']
  namesRef.current = teamNames
  headsRef.current = P.map((p) => headImage(people[lc(p.id)]))
  tagsRef.current = P.map((_, i) => {
    if (mode === 'solo') return i === 0 && control ? tm.you.toUpperCase() : ''
    const u = claims[String(i)]
    if (u) return lc(u) === myId ? tm.you.toUpperCase() : nameOf(u).toUpperCase()
    return ''
  })
  const ctx: FeedContext = { names: P.map((p) => p.name), teams: teamNames, side: P.map((p) => p.team) }
  const me = P[myIdx]

  const pickAct = (i: number) => {
    if (!acts) return
    if (acts.online) { answeredRef.current = acts.q; socket.intent(acts.q, i) }
    else matchRef.current?.choose(acts.q, i, 'me')
    setActs(null)
  }
  const react = (e: string) => { addFloat(e, tm.you); sound.play('pop'); if (mode !== 'solo') socket.react(e) }
  const claim = (i: number) => { socket.claim(claims[String(i)] && lc(claims[String(i)]) === myId ? null : String(i)) }
  // The coach (solo: this phone; online: the host, through the server).
  const setTactic = <K extends keyof Tactics>(k: K, val: Tactics[K]) => {
    if (mode === 'solo') matchRef.current?.setTactic(k, val); else socket.tactic(k, val)
    setTactics((x) => ({ ...x, [k]: val }))
  }
  const timeout = () => {
    if (mode !== 'solo') { socket.timeout(); return }
    if (!matchRef.current?.timeout()) return
    toutRef.current = true; setTout(true); setTimeoutUsed(true)
    setTimeout(() => { toutRef.current = false; setTout(false) }, 1600)
  }
  const setPlaying = (on: boolean) => {
    if (mode !== 'solo') { socket.claim(on ? '0' : null); return }
    controlRef.current = on; setControl(on)
    if (!on && matchRef.current?.aw?.who === 'me') matchRef.current.aiTakesOver()
  }
  const changeSpeed = () => {
    const s = speed === 1 ? 2 : speed === 2 ? 4 : 1
    if (mode === 'solo') { speedRef.current = s; setSpeed(s) } else socket.speed(s)
  }

  if (summary && P.length === 6) {
    const data: SummaryData = {
      P: P.map((p) => ({ id: p.id, name: p.name, team: p.team, st: p.st })),
      score, names: teamNames, moments: (m?.moments ?? v?.moments ?? []) as Moment[], me: myIdx, shots: shotsRef.current[myIdx] ?? [],
      tir: m?.P[myIdx]?.a.tir ?? peopleQ.data?.find((g) => lc(g.user.id) === lc(P[myIdx]?.id))?.attributes.tir ?? null, court: { id: courtId ?? '', name: courtName }, online: mode !== 'solo', users: people,
    }
    return <MatchSummary data={data} onAgain={mode === 'solo' ? onAgain : undefined} onArena={() => navigate(courtId ? `/jeu/arene/${courtId}` : '/jeu/arenes')} />
  }

  const leaderA = people[lc(P[0]?.id)], leaderB = people[lc(P[3]?.id)]
  const won = finished ? score[0] > score[1] : null
  return (
    <div className="mx-auto grid max-w-xl gap-1.5 pb-6">
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-3">
        <div className="flex min-w-0 items-center gap-1.5">
          {leaderA ? <Avatar user={leaderA} size={26} /> : <i className="size-6 rounded-full bg-brand" />}
          <b className="display truncate text-sm font-extrabold uppercase">{teamNames[0]}</b>
        </div>
        <div className="display flex items-center gap-2 rounded-xl bg-black/60 px-3 py-0.5 text-3xl font-black tabular-nums">
          <em key={`a${score[0]}`} className="jeu-bump not-italic">{score[0]}</em><span className="text-ink-2">:</span><em key={`b${score[1]}`} className="jeu-bump not-italic">{score[1]}</em>
        </div>
        <div className="flex min-w-0 items-center justify-end gap-1.5">
          <b className="display truncate text-right text-sm font-extrabold uppercase">{teamNames[1]}</b>
          {leaderB ? <Avatar user={leaderB} size={26} /> : <i className="size-6 rounded-full bg-upcoming" />}
        </div>
      </div>
      <div className="flex justify-between px-4 text-xs text-ink-2">
        <span>{finished ? tm.final : tm.possession.replace('{n}', String(poss))}</span>
        <span className={`font-bold ${off ? 'text-upcoming' : 'text-brand'}`}>● {teamNames[off]}</span>
      </div>
      <div className="mx-3 flex h-1.5 overflow-hidden rounded-full"><i className="block bg-brand transition-all" style={{ width: `${momentum}%` }} /><i className="block flex-1 bg-upcoming" /></div>

      <div className="relative mx-2 overflow-hidden rounded-2xl">
        <canvas ref={cvRef} className="block aspect-[370/380] w-full bg-[#22303f]" aria-label={t.jeu.title} />
        <div className="absolute right-2 top-2 z-10 flex gap-1.5">
          {hasClip && (
            <button type="button" onClick={() => stageRef.current?.startReplay()} className="display inline-flex items-center gap-1 rounded-lg border border-white/20 bg-black/60 px-2 py-1 text-xs font-extrabold uppercase text-white backdrop-blur">
              <RotateCcw className="size-3.5" aria-hidden />{tm.replay}
            </button>
          )}
          <button type="button" onClick={() => { const nv = view === 'tv' ? 'top' : 'tv'; setView(nv); try { localStorage.setItem(VIEW_KEY, nv) } catch { /* storage blocked */ } }} className="display inline-flex items-center gap-1 rounded-lg border border-white/20 bg-black/60 px-2 py-1 text-xs font-extrabold uppercase text-white backdrop-blur">
            {view === 'tv' ? <LayoutGrid className="size-3.5" aria-hidden /> : <Tv className="size-3.5" aria-hidden />}{view === 'tv' ? tm.tactical : tm.tv}
          </button>
          <button type="button" aria-pressed={soundOn} onClick={() => { const on = sound.toggle(); setSoundOn(on); if (on) sound.play('pop') }} className="display inline-flex items-center gap-1 rounded-lg border border-white/20 bg-black/60 px-2 py-1 text-xs font-extrabold uppercase text-white backdrop-blur">
            {soundOn ? <Volume2 className="size-3.5" aria-hidden /> : <VolumeX className="size-3.5" aria-hidden />}{tm.sound}
          </button>
        </div>
        <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden">
          {floats.map((f) => {
            const R = REACTS.find((r) => r.e === f.e)!
            return (
              <span key={f.id} className="jeu-float" style={{ left: `${f.x}%` }}>
                <R.icon className={`size-8 drop-shadow ${R.tone}`} aria-hidden />
                <small className="display text-[10px] font-extrabold uppercase text-white [text-shadow:0_1px_3px_#000]">{f.who}</small>
              </span>
            )
          })}
        </div>
        {banner && <BannerView b={banner} ctx={ctx} />}
        {tout && (
          <div className="absolute inset-0 z-20 grid place-content-center justify-items-center gap-1 bg-black/60 text-white">
            <PauseCircle className="size-9" aria-hidden />
            <b className="display text-2xl font-black uppercase">{tm.timeout}</b>
          </div>
        )}
        {acts && P[acts.k] && (
          <div className="absolute inset-x-2.5 bottom-2.5 z-20 grid gap-1.5">
            <div className="display text-center text-base font-black uppercase text-white [text-shadow:0_2px_4px_#000]">
              {tm.yourTurn.replace('{name}', P[acts.k].name)}{acts.secs ? ` · ${tm.seconds.replace('{n}', String(acts.secs))}` : ''}
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {acts.list.map(([k, to, p1, p2], i) => {
                const target = P[to]
                if (k === 'p' && !target) return null
                const label = k === 's' ? (isThree(P[acts.k].x, P[acts.k].y) ? tm.three : tm.shoot) : k === 'd' ? tm.drive : tm.pass.replace('{name}', target.name)
                const sub = k === 's' ? tm.pctShot.replace('{n}', String(p1)) : k === 'd' ? tm.pctDrive.replace('{n}', String(p1)) : tm.pctPass.replace('{n}', String(p2))
                return (
                  <button key={i} type="button" onClick={() => pickAct(i)} className={`jeu-pop display rounded-xl py-2.5 text-base font-black uppercase shadow-xl ${k === 'p' ? 'bg-white text-[#12151a]' : 'bg-brand text-white'}`}>
                    {label}<small className="block font-sans text-[10px] font-bold normal-case opacity-85">{sub}</small>
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {mode !== 'solo' && (
        <section className="mx-3 grid gap-1.5 rounded-2xl border border-brand bg-surface p-2.5">
          <div className="flex items-center gap-2">
            <b className="display min-w-0 flex-1 truncate text-base font-black uppercase">
              {mode === 'host' ? tm.hostTitle : tm.guestTitle.replace('{name}', hostId ? nameOf(hostId) : '…')}
            </b>
            {code && <span className="display text-base font-black tracking-[.14em] text-[var(--gold)]">{code.toUpperCase()}</span>}
          </div>
          <span className="text-xs text-ink-2">
            {problem === 'full' ? tm.full : problem === 'gone' ? tm.gone
              : mode === 'host' ? (members.length > 1 ? tm.hostPeople.replace('{n}', String(members.length)) : tm.hostWaiting)
              : !v ? tm.connecting : claims[String(myIdx)] && lc(claims[String(myIdx)]) === myId ? tm.guestMine.replace('{name}', P[myIdx]?.name ?? '') : tm.guestFree}
          </span>
          {P.length === 6 && (
            <div className="flex flex-wrap gap-1.5">
              {P.map((p, i) => {
                const owner = claims[String(i)] ?? null
                const mine = !!owner && lc(owner) === myId
                const who = owner ? (mine ? tm.you : nameOf(owner)) : i === hostIdx && hostId && mode !== 'host' ? `${nameOf(hostId)} · ${tm.ai}` : tm.ai
                // Player 0 is the host's own avatar; the others are free for anyone.
                const reserved = (i === hostIdx) !== (mode === 'host')
                return (
                  <button key={i} type="button" disabled={!!problem || (!!owner && !mine) || reserved} onClick={() => claim(i)}
                    className={`display inline-flex items-center gap-1.5 rounded-full border py-0.5 pl-0.5 pr-2.5 text-xs font-extrabold uppercase disabled:opacity-45 ${mine ? 'border-brand bg-brand/15' : 'border-line bg-surface-2'}`}>
                    <span className={`grid size-5 place-items-center rounded-full text-[10px] text-white ${p.team ? 'bg-upcoming' : 'bg-brand'}`}>{p.num}</span>
                    {p.name} · {who}
                  </button>
                )
              })}
            </div>
          )}
        </section>
      )}

      <div className="grid h-[3.25rem] content-start gap-px overflow-hidden px-4 text-xs text-ink-2 [&>div:first-child]:font-semibold [&>div:first-child]:text-ink" aria-live="polite">
        {feed.map((line, i) => <div key={`${i}-${line.k}-${JSON.stringify(line.s ?? '')}`} className="flex min-w-0"><FeedText line={line} ctx={ctx} /></div>)}
      </div>

      <div className="flex items-center gap-1.5 px-3">
        {REACTS.map(({ e, icon: Icon, tone }) => (
          <button key={e} type="button" onClick={() => react(e)} aria-label={(t.jeu.reactions as Record<string, string>)[e]} className="grid h-8 w-10 place-items-center rounded-full border border-line bg-surface active:scale-90">
            <Icon className={`size-4.5 ${tone}`} aria-hidden />
          </button>
        ))}
      </div>

      {me && (
        <div className="mx-3 flex items-center gap-2.5 rounded-2xl border border-line bg-surface p-2.5">
          {people[lc(me.id)] ? <Avatar user={people[lc(me.id)]} size={36} /> : <Gamepad2 className="size-7 text-brand" aria-hidden />}
          <div className="grid min-w-0 flex-1 gap-1">
            <div className="flex gap-3 text-[11px] text-ink-2 [&_b]:display [&_b]:mr-0.5 [&_b]:text-lg [&_b]:font-black [&_b]:text-ink">
              <span><b>{me.st.pts}</b>{tm.pts}</span><span><b>{me.st.reb}</b>{tm.reb}</span><span><b>{me.st.ast}</b>{tm.ast}</span><span><b>{me.st.fgm}/{me.st.fga}</b>{tm.fg}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-surface-2" aria-label={tm.stamina}>
              <i className="block h-full transition-all" style={{ width: `${Math.round(me.stam * 100)}%`, background: me.stam > 0.6 ? 'var(--live)' : me.stam > 0.4 ? 'var(--gold)' : 'var(--danger)' }} />
            </div>
          </div>
          <RatingPill r={rating(me, won === null ? null : me.team === 0 ? won : !won)} />
        </div>
      )}

      {mode === 'client' ? (
        <p className="px-4 text-xs text-ink-2">{tm.hostCoaches.replace('{team}', teamNames[0])}</p>
      ) : (
        <section className="mx-3 grid gap-2 rounded-2xl border border-line bg-surface p-2.5">
          <Opts label={tm.pace} value={tactics.pace} options={['fast', 'norm', 'slow'] as const} onPick={(x) => setTactic('pace', x)} />
          <Opts label={tm.attack} value={tactics.focus} options={['out', 'bal', 'in'] as const} onPick={(x) => setTactic('focus', x)} />
          <Opts label={tm.defense} value={tactics.def} options={['man', 'press'] as const} onPick={(x) => setTactic('def', x)} />
          <div className="grid grid-cols-3 gap-1.5">
            <label className="display flex items-center justify-center gap-1.5 rounded-xl border border-line bg-surface-2 py-2 text-xs font-extrabold uppercase">
              <input type="checkbox" checked={control} onChange={(e) => setPlaying(e.target.checked)} />
              {tm.control.replace('{name}', P[0]?.name ?? '')}
            </label>
            <button type="button" onClick={timeout} disabled={timeoutUsed || finished} className="display rounded-xl border border-line bg-surface-2 py-2 text-xs font-extrabold uppercase disabled:opacity-45">{tm.timeout}</button>
            <button type="button" onClick={changeSpeed} className="display rounded-xl border border-line bg-surface-2 py-2 text-xs font-extrabold uppercase">×{speed}</button>
          </div>
        </section>
      )}
    </div>
  )
}

function Opts<T extends string>({ label, value, options, onPick }: { label: string; value: T; options: readonly T[]; onPick: (v: T) => void }) {
  const { t } = useLocale()
  return (
    <div className="flex items-center gap-2">
      <span className="display w-16 shrink-0 text-[11px] font-extrabold uppercase tracking-wider text-ink-2">{label}</span>
      <div className="flex flex-1 gap-1 rounded-xl bg-surface-2 p-1">
        {options.map((o) => (
          <button key={o} type="button" aria-pressed={value === o} onClick={() => onPick(o)}
            className={`display flex-1 rounded-lg py-1.5 text-xs font-extrabold uppercase ${value === o ? 'bg-brand text-white' : 'text-ink-2'}`}>
            {(t.jeu.match.coach as Record<string, string>)[o]}
          </button>
        ))}
      </div>
    </div>
  )
}

export function RatingPill({ r }: { r: number }) {
  const bg = r >= 8 ? '#22c55e' : r >= 6.5 ? '#a3e635' : r >= 5.5 ? '#f2b632' : '#ef4444'
  return <span className="display rounded-lg px-2 py-0.5 text-lg font-black text-[#0d1117] tabular-nums" style={{ background: bg }}>{r.toFixed(1)}</span>
}

function BannerView({ b, ctx }: { b: Banner; ctx: FeedContext }) {
  const { t } = useLocale()
  const main = ((t.jeu.banner as Record<string, string>)[b.k] ?? '').replace('{team}', b.team !== undefined ? ctx.teams[b.team].toUpperCase() : '')
  const sub = b.p !== undefined ? (ctx.names[b.p] ?? '').toUpperCase() : b.s ? `${b.s[0]} – ${b.s[1]}` : b.team !== undefined && b.k !== 'lose' ? ctx.teams[b.team].toUpperCase() : ''
  return (
    <div className="jeu-banner display pointer-events-none absolute left-1/2 top-[42%] z-10 whitespace-nowrap text-center text-5xl font-black uppercase italic leading-[.9] text-white [text-shadow:0_4px_0_rgba(0,0,0,.4),0_0_30px_rgba(255,90,31,.6)]">
      {main}
      {sub && <small className="mt-1 block text-lg not-italic text-[var(--gold)]">{sub}</small>}
    </div>
  )
}
