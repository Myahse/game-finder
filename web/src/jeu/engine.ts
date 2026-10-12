// Mode Jeu match engine: half court, 3 against 3, first to 15 (2 and 3 points).
// Every decision and every outcome comes from the players' attributes, which
// the server computes from their real games. No DOM here: the screens draw the
// state and feed lines, and online the host's engine is the only one running.

export const W = 370
export const H = 380
export const HOOP = { x: 185, y: 36 }
export const R3 = 160
export const WIN = 15
export const RIM = 40

export type AttrKey = 'tir' | 'pen' | 'col' | 'def' | 'end' | 'men'
export type Attrs = Record<AttrKey, number>
export const ATTR_KEYS: AttrKey[] = ['tir', 'pen', 'col', 'def', 'end', 'men']

/** One player as the engine needs them. `id` is the user id, or `bot-…` for a stand-in. */
export interface RosterEntry {
  id: string
  name: string
  num: number
  big: boolean
  a: Attrs
}

export interface Stats { pts: number; fgm: number; fga: number; tpm: number; tpa: number; ast: number; reb: number; stl: number; blk: number; to: number }
export interface Shot { x: number; y: number; made: boolean }

export interface SimPlayer extends RosterEntry {
  team: 0 | 1
  slot: number
  x: number; y: number; tx: number; ty: number
  stam: number
  streak: number
  fire: boolean
  st: Stats
  shots: Shot[]
  bob: number
  jt: number; jd: number; jh: number; jz: number
}

/** A feed line: a key the screen turns into words, with player indexes and the score. */
export interface FeedLine { k: string; p?: number[]; s?: [number, number]; team?: 0 | 1; n?: number; v?: string }
export interface Banner { k: string; p?: number; team?: 0 | 1; s?: [number, number]; ms: number; n: number }
export interface Moment { k: string; p: number[]; s: [number, number]; t: number }
/** [id, type, player, x, y, extra] — something everyone sees and hears. */
export type Fx = [number, string, number, number, number, number]
/** [kind, target, success %, target's shot %] */
export type Choice = ['s' | 'd' | 'p', number, number, number]
export interface Await { k: number; q: number; who: string; deadline: number; list: Choice[] }

export interface Tactics { pace: 'fast' | 'norm' | 'slow'; focus: 'out' | 'bal' | 'in'; def: 'man' | 'press' }
type Op = { kind: 'shoot' | 'drive' | 'pass'; p: number; val: number; to?: SimPlayer }

export interface Hooks {
  /** 'me' for this device's own player, a user id for an online player, null for the AI. */
  humanFor(p: SimPlayer): string | null
  onAwait?(aw: Await | null): void
  onFx?(f: Fx): void
  onBanner?(b: Banner): void
  onFeed?(): void
  onScore?(team: 0 | 1): void
  onFinish?(): void
  now?(): number
}

const SPOTS: { out: [number, number][]; mid: [number, number][] } = {
  out: [[185, 232], [64, 156], [306, 156], [32, 62], [338, 62]],
  mid: [[124, 140], [246, 140], [108, 70], [262, 70], [185, 160]],
}

export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
export const lerp = (a: number, b: number, k: number) => a + (b - a) * k
export const isThree = (x: number, y: number) => Math.hypot(x - HOOP.x, y - HOOP.y) >= R3 - 2
export const emptyStats = (): Stats => ({ pts: 0, fgm: 0, fga: 0, tpm: 0, tpa: 0, ast: 0, reb: 0, stl: 0, blk: 0, to: 0 })

export function makePlayer(r: RosterEntry, team: 0 | 1, slot: number): SimPlayer {
  return { ...r, team, slot, x: 185 + (slot - 1) * 60, y: team ? 250 : 300, tx: 185, ty: 300, stam: 1, streak: 0, fire: false, st: emptyStats(), shots: [], bob: Math.random() * 6, jt: 0, jd: 0.4, jh: 12, jz: 0 }
}

/** Match rating 3–10, like a newspaper player rating. */
export function rating(p: Pick<SimPlayer, 'st'>, won: boolean | null) {
  const s = p.st
  return clamp(6 + s.pts * 0.11 + s.ast * 0.28 + s.reb * 0.14 + s.stl * 0.45 + s.blk * 0.4 - s.to * 0.35 - (s.fga - s.fgm) * 0.07 + (won === null ? 0 : won ? 0.4 : -0.2), 3, 10)
}

export interface Ball { mode: 'held' | 'pass' | 'shot' | 'loose'; x: number; y: number; z: number; zb: number; fx?: number; fy?: number; tx?: number; ty?: number; dur?: number; h?: number; to?: SimPlayer; from?: SimPlayer; steal?: boolean; blocked?: boolean; z0?: number }

export class Match {
  P: SimPlayer[]
  score: [number, number] = [0, 0]
  off: 0 | 1
  handler!: SimPlayer
  phase: 'check' | 'play' | 'drive' | 'pass' | 'shot' | 'rebound' | 'celebrate' | 'over' = 'check'
  pt = 0
  shotClock = 8
  ball: Ball = { mode: 'held', x: 185, y: 300, z: 8, zb: 0 }
  feed: FeedLine[] = []
  moments: Moment[] = []
  poss = 0
  hist = [0]
  finished = false
  gameT = 0
  slow = 1
  tactics: Tactics = { pace: 'norm', focus: 'bal', def: 'man' }
  aw: Await | null = null
  timeoutUsed = false
  fxRing: Fx[] = []
  banner: Banner | null = null
  private fxN = 0
  private bnN = 0
  private awQ = 0
  private aiNext = false
  private decisionT = 0
  private celebrate = 0
  private lastPass: { from: SimPlayer; to: SimPlayer; t: number } | null = null
  private pending: { by: SimPlayer; three: boolean; made: boolean; blocked: boolean; blocker: SimPlayer; dunk: boolean; layup: boolean; x: number; y: number } | null = null
  private evs: { type: string; p: SimPlayer; v: number }[] = []
  private hooks: Hooks
  private rnd: () => number

  constructor(teams: [RosterEntry[], RosterEntry[]], hooks: Hooks, rnd: () => number = Math.random) {
    this.hooks = hooks
    this.rnd = rnd
    this.P = [...teams[0].map((r, i) => makePlayer(r, 0, i)), ...teams[1].map((r, i) => makePlayer(r, 1, i))]
    this.off = this.rnd() < 0.5 ? 0 : 1
    this.say({ k: 'kickoff', team: this.off })
    this.startPossession()
    this.fx('go', 0)
  }

  private r(a: number, b: number) { return a + this.rnd() * (b - a) }
  private pick<T>(arr: readonly T[]): T { return arr[Math.floor(this.rnd() * arr.length)] }
  private now() { return this.hooks.now ? this.hooks.now() : performance.now() }
  team(i: 0 | 1) { return this.P.filter((p) => p.team === i) }
  idx(p: SimPlayer | undefined) { return p ? this.P.indexOf(p) : -1 }
  private guard(p: SimPlayer) { return this.P.find((q) => q.team !== p.team && q.slot === p.slot)! }
  private dist(a: { x: number; y: number }, b: { x: number; y: number }) { return Math.hypot(a.x - b.x, a.y - b.y) }
  private dHoop(p: SimPlayer) { return Math.hypot(p.x - HOOP.x, p.y - HOOP.y) }
  private nearestDef(p: SimPlayer) { return this.team((1 - p.team) as 0 | 1).reduce((m, q) => (this.dist(q, p) < m.d ? { q, d: this.dist(q, p) } : m), { q: this.P[0], d: 1e9 }) }

  private say(line: FeedLine) { this.feed.unshift(line); this.feed = this.feed.slice(0, 3); this.hooks.onFeed?.() }
  private moment(k: string, p: SimPlayer[]) { this.moments.push({ k, p: p.map((x) => this.idx(x)), s: [...this.score] as [number, number], t: this.gameT }) }
  private showBanner(k: string, extra: Partial<Banner> = {}, ms = 1100) { this.bnN++; this.banner = { k, ms, n: this.bnN, ...extra }; this.hooks.onBanner?.(this.banner) }
  private fx(type: string, i: number, x = 0, y = 0, e = 0) { this.fxN++; const f: Fx = [this.fxN, type, i, Math.round(x), Math.round(y), e]; this.fxRing.push(f); if (this.fxRing.length > 8) this.fxRing.shift(); this.hooks.onFx?.(f) }

  private startPossession() {
    this.poss++; this.phase = 'check'; this.pt = 0; this.shotClock = { fast: 6, norm: 8, slow: 10 }[this.off ? 'norm' : this.tactics.pace]
    const o = this.team(this.off), d = this.team((1 - this.off) as 0 | 1)
    this.handler = o.reduce((m, p) => (p.a.col + p.a.pen > m.a.col + m.a.pen ? p : m), o[0])
    if (this.rnd() < 0.35) this.handler = this.pick(o)
    const outSpots = [...SPOTS.out].sort(() => this.rnd() - 0.5)
    o.forEach((p) => { if (p === this.handler) { p.tx = 185 + this.r(-20, 20); p.ty = 300 } else { const s = outSpots.pop()!; p.tx = s[0]; p.ty = s[1] } })
    d.forEach((p) => { const m = this.P.find((q) => q.team === this.off && q.slot === p.slot)!; p.tx = m.tx; p.ty = m.ty - 40 })
    this.lastPass = null
    this.ball = { mode: 'held', x: this.handler.x, y: this.handler.y, z: 8, zb: 0 }
  }

  /** Chance of a shot going in, from the shooter's attributes, the spot and the defense. */
  shotProb(p: SimPlayer, x: number, y: number) {
    const d = Math.hypot(x - HOOP.x, y - HOOP.y), a = p.a
    let pr = d < 72 ? 0.4 + a.pen * 0.0045 : d < R3 - 2 ? 0.27 + a.tir * 0.0036 : 0.12 + a.tir * 0.0038
    const defs = this.team((1 - p.team) as 0 | 1)
    const dq = defs.reduce((m, q) => (Math.hypot(q.x - x, q.y - y) < Math.hypot(m.x - x, m.y - y) ? q : m))
    const nd = Math.hypot(dq.x - x, dq.y - y)
    const press = p.team === 1 && this.tactics.def === 'press' ? 1.2 : 1
    pr -= Math.max(0, (48 - nd) / 48) * (0.16 + dq.a.def / 650) * press
    pr *= 0.72 + 0.28 * p.stam
    if (p.fire) pr += 0.07
    if (Math.max(...this.score) >= WIN - 5) pr += (a.men - 66) * 0.003
    if (p.team === 0) pr += 0.012
    return clamp(pr, 0.05, 0.9)
  }
  // Teams share the ball like real teams: a player who already took many of the
  // team's shots is a little less likely to take the next one.
  private usage(q: SimPlayer) { const t = this.team(q.team).reduce((s, x) => s + x.st.fga, 0); if (t < 3) return 1; return clamp(1.3 - (q.st.fga / t) * 1.05, 0.55, 1.3) }
  private passSteal(a: SimPlayer, b: SimPlayer) {
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2
    return this.team((1 - a.team) as 0 | 1).reduce((m, q) => { const dd = Math.hypot(q.x - mx, q.y - my); if (dd > 46) return m; return Math.max(m, (0.03 + q.a.def / 1400) * (1 - dd / 46) * (a.team === 1 && this.tactics.def === 'press' ? 1.7 : 1)) }, 0.01) * (1.15 - a.a.col / 300)
  }
  private options(h: SimPlayer): Op[] {
    const ops: Op[] = [], fo = h.team === 0 ? this.tactics.focus : 'bal', uh = this.usage(h)
    const pShot = this.shotProb(h, h.x, h.y), three = isThree(h.x, h.y)
    ops.push({ kind: 'shoot', p: pShot, val: pShot * (three ? 3 : 2) * uh * (three ? (fo === 'out' ? 1.3 : fo === 'in' ? 0.7 : 1) : 1) })
    if (this.dHoop(h) > 70) { const g2 = this.guard(h), pd = clamp(0.38 + h.a.pen * 0.0048 - g2.a.def * 0.0026 + (h.team === 1 && this.tactics.def === 'press' ? 0.06 : 0), 0.12, 0.8); ops.push({ kind: 'drive', p: pd, val: pd * 2 * uh * (fo === 'in' ? 1.3 : fo === 'out' ? 0.8 : 1) }) }
    this.team(h.team).filter((q) => q !== h).forEach((q) => {
      const open = this.nearestDef(q).d, ps = this.shotProb(q, q.x, q.y), vv = isThree(q.x, q.y) ? 3 : 2, steal = this.passSteal(h, q)
      ops.push({ kind: 'pass', to: q, p: 1 - steal, val: (ps * vv * 0.9 + Math.min(open, 60) / 400) * this.usage(q) * (1 - steal * 2.2) * (0.85 + h.a.col / 400) })
    })
    return ops
  }
  private opsFor: Op[] = []
  private decide() {
    const ops = this.options(this.handler)
    if (this.shotClock <= 1.2) return this.act(ops.find((o) => o.kind === 'shoot')!)
    const who = this.aiNext || this.auto ? null : this.hooks.humanFor(this.handler)
    this.aiNext = false
    if (who) {
      this.awQ++
      this.opsFor = ops
      this.aw = {
        k: this.idx(this.handler), q: this.awQ, who,
        deadline: this.now() + (who === 'me' && !this.onlineHost ? Infinity : who === 'me' ? 10_000 : 7_000),
        list: ops.map((o) => [o.kind[0] as 's' | 'd' | 'p', o.to ? this.idx(o.to) : -1, Math.round(o.p * 100), o.to ? Math.round(this.shotProb(o.to, o.to.x, o.to.y) * 100) : 0]),
      }
      this.hooks.onAwait?.(this.aw)
      return
    }
    let best = ops[0], bv = -1
    for (const o of ops) { const v = o.val * this.r(0.82, 1.18); if (v > bv) { bv = v; best = o } }
    this.act(best)
  }
  /** Set by the online host so its own turns also time out. */
  onlineHost = false
  /** Every player on AI (fast-forward). */
  auto = false
  /** A human's choice for the turn `q` (ignored if that turn is over). */
  choose(q: number, i: number, who: string) {
    if (!this.aw || this.aw.q !== q || this.aw.who !== who || !Number.isInteger(i) || i < 0 || i >= this.opsFor.length) return false
    this.act(this.opsFor[i])
    return true
  }
  private clearAwait() { if (this.aw) { this.aw = null; this.hooks.onAwait?.(null) } }
  private act(o: Op) {
    this.clearAwait()
    const h = this.handler
    if (o.kind === 'shoot') return this.release(h.x, h.y, false)
    if (o.kind === 'drive') {
      this.phase = 'drive'; this.pt = 0
      h.tx = 185 + this.r(-28, 28); h.ty = 66; h.stam = Math.max(0.2, h.stam - (100 - h.a.end) * 0.0009)
      const gd = this.guard(h); gd.tx = h.tx + this.r(-10, 10); gd.ty = h.ty - 16
      return
    }
    const to = o.to!
    const steal = this.rnd() < this.passSteal(h, to)
    this.phase = 'pass'; this.pt = 0
    const mx = (h.x + to.x) / 2, my = (h.y + to.y) / 2
    const thief = steal ? this.team((1 - h.team) as 0 | 1).reduce((m, q) => (Math.hypot(q.x - mx, q.y - my) < Math.hypot(m.x - mx, m.y - my) ? q : m)) : null
    this.ball = { mode: 'pass', fx: h.x, fy: h.y, to: thief ?? to, from: h, steal, dur: 0.28 + this.dist(h, to) / 900, x: h.x, y: h.y, z: 10, zb: 6 }
  }
  private release(x: number, y: number, layup: boolean) {
    const h = this.handler, three = isThree(x, y), d = Math.hypot(x - HOOP.x, y - HOOP.y)
    const nd = this.nearestDef(h), dunk = layup && h.a.pen >= 72 && h.stam > 0.5 && this.rnd() < 0.45
    const blockP = nd.d < (layup ? 34 : 24) ? (layup ? 0.05 : 0.02) + nd.q.a.def / (layup ? 650 : 1500) : 0
    let pr = this.shotProb(h, x, y); if (dunk) pr = Math.min(0.94, pr + 0.2)
    const blocked = this.rnd() < blockP, made = !blocked && this.rnd() < pr
    h.st.fga++; if (three) h.st.tpa++
    const winning = made && this.score[h.team] + (three ? 3 : 2) >= WIN
    this.pending = { by: h, three, made, blocked, blocker: nd.q, dunk, layup, x, y }
    this.phase = 'shot'; this.pt = 0
    const dur = blocked ? 0.22 : dunk ? 0.3 : layup ? 0.45 : d > R3 ? 0.78 : 0.62
    this.ball = { mode: 'shot', fx: x, fy: y - 6, tx: blocked ? nd.q.x : HOOP.x, ty: blocked ? nd.q.y - 8 : HOOP.y, dur, h: blocked ? 14 : dunk ? 26 : layup ? 34 : d > R3 ? 92 : 70, blocked, x, y, z: 10, zb: 0 }
    if (winning) this.slow = 0.32
    h.stam = Math.max(0.2, h.stam - 0.012)
    this.fx('rel', this.idx(h), x, y, dunk ? 1 : 0)
  }
  private landed() {
    const s = this.pending!, p = s.by, i = this.idx(p)
    this.slow = 1
    if (s.blocked) {
      s.blocker.st.blk++
      this.fx('bk', i, s.x, s.y, this.idx(s.blocker))
      this.say({ k: 'block', p: [this.idx(s.blocker), i] }); this.moment('block', [s.blocker, p])
      this.showBanner('block', { p: this.idx(s.blocker) }, 900); p.streak = 0; p.fire = false
      return this.rebound(true)
    }
    if (s.made) {
      const v = s.three ? 3 : 2; this.score[p.team] += v; p.st.pts += v; p.st.fgm++; if (s.three) p.st.tpm++
      const ast = this.lastPass && this.lastPass.to === p && this.gameT - this.lastPass.t < 3.2 ? this.lastPass.from : null
      if (ast) ast.st.ast++
      p.streak++
      this.fx('mk', i, s.x, s.y, s.dunk ? 4 : v)
      const k = s.dunk ? 'dunk' : s.three ? 'three' : s.layup ? 'layup' : 'jumper'
      this.say({ k: ast ? k + 'Ast' : k, p: ast ? [i, this.idx(ast)] : [i], s: [...this.score] as [number, number] })
      this.evs.push({ type: 'make', p, v })
      if (s.dunk || s.three) this.moment(k, ast ? [p, ast] : [p])
      if (s.dunk) this.showBanner('dunk', { p: i })
      if (p.streak === 3 && !p.fire) { p.fire = true; this.say({ k: 'fire', p: [i] }); this.moment('fire', [p]); if (!s.dunk) this.showBanner('fire', { p: i }) }
      this.hooks.onScore?.(p.team)
      this.hist.push(this.score[0] - this.score[1])
      if (this.score[p.team] >= WIN) return this.finish(p)
      const run = this.runOf(p.team); if (run >= 7) { this.say({ k: 'run', n: run, team: p.team }); this.moment('run', [p]) }
      if (this.score[p.team] >= WIN - 3 && this.score[p.team] - v < WIN - 3) this.showBanner('matchPoint', { team: p.team }, 900)
      this.celebrate = 0.5; this.phase = 'celebrate'; this.pt = 0; this.off = (1 - p.team) as 0 | 1
      return
    }
    this.fx('ms', i, s.x, s.y)
    p.streak = 0; p.fire = false
    this.say({ k: s.three ? 'miss3' : s.layup ? 'missLayup' : 'miss', p: [i] })
    this.evs.push({ type: 'miss', p, v: 0 })
    this.rebound(false)
  }
  private runOf(t: number) { let r = 0; for (let i = this.evs.length - 1; i >= 0; i--) { const e = this.evs[i]; if (e.type !== 'make') continue; if (e.p.team !== t) break; r += e.v } return r }
  private rebound(blocked: boolean) {
    const a = this.r(0.15, Math.PI - 0.15), r = this.r(26, 78)
    this.ball = { mode: 'loose', x: HOOP.x, y: HOOP.y, tx: HOOP.x + Math.cos(a) * r, ty: HOOP.y + Math.sin(a) * r + 6, z: 0, zb: blocked ? 10 : RIM, z0: blocked ? 10 : RIM }
    this.P.forEach((p) => { if (Math.hypot(p.x - this.ball.tx!, p.y - this.ball.ty!) < 150) { p.tx = this.ball.tx! + this.r(-14, 14); p.ty = this.ball.ty! + this.r(-10, 14) } })
    this.phase = 'rebound'; this.pt = 0
  }
  private grabRebound() {
    const b = this.ball, cands = this.P.filter((p) => Math.hypot(p.x - b.tx!, p.y - b.ty!) < 110)
    const pool = cands.length ? cands : this.P
    const w = pool.map((p) => ((p.a.end + p.a.def * 0.5 + (p.big ? 25 : 0)) / 100) * (1 / (Math.hypot(p.x - b.tx!, p.y - b.ty!) + 18)) * (p.team === this.off ? 0.72 : 1) * (0.6 + 0.4 * p.stam))
    let r = this.rnd() * w.reduce((s, v) => s + v, 0), who = pool[0]
    for (let i = 0; i < pool.length; i++) { r -= w[i]; if (r <= 0) { who = pool[i]; break } }
    who.st.reb++
    this.hist.push(this.score[0] - this.score[1])
    if (who.team === this.off) {
      this.say({ k: 'orb', p: [this.idx(who)] })
      this.handler = who; this.ball = { mode: 'held', x: who.x, y: who.y, z: 8, zb: 0 }
      if (this.dHoop(who) < 70 && this.rnd() < 0.4 + who.a.pen / 400) return this.release(who.x, who.y, true)
      this.phase = 'play'; this.pt = 0; this.shotClock = 5; this.decisionT = 0.5
    } else {
      this.say({ k: 'drb', p: [this.idx(who)] })
      this.off = who.team; this.startPossession(); this.handler = who; this.ball = { mode: 'held', x: who.x, y: who.y, z: 8, zb: 0 }
    }
  }
  private finish(p: SimPlayer) {
    this.finished = true; this.phase = 'over'; this.pt = 0
    const w = p.team
    this.say({ k: 'win', team: w, s: [...this.score] as [number, number] })
    this.moment('win', [p])
    this.fx('win', this.idx(p))
    this.showBanner(w === 0 ? 'win' : 'lose', { team: w, s: [...this.score] as [number, number] }, 2600)
    this.hooks.onFinish?.()
  }

  /** Coach's timeout for team A: +15 % stamina. */
  timeout() {
    if (this.timeoutUsed || this.finished) return false
    this.timeoutUsed = true
    this.team(0).forEach((p) => (p.stam = Math.min(1, p.stam + 0.15)))
    this.say({ k: 'timeout', team: 0 }); this.moment('timeout', [this.P[0]]); this.showBanner('timeout', { team: 0 }, 1500)
    return true
  }
  setTactic<K extends keyof Tactics>(k: K, v: Tactics[K]) { this.tactics[k] = v; this.say({ k: 'coach', team: 0, v: String(v) }) }
  /** A line from outside the engine (someone took control of a player…). */
  note(line: FeedLine) { this.say(line) }
  /** Stop waiting for a human and let the AI play this turn. */
  aiTakesOver() { if (!this.aw) return; const i = this.aw.k; this.clearAwait(); this.say({ k: 'aiPlays', p: [i] }); this.aiNext = true; this.decisionT = 0 }

  update(dt: number) {
    this.gameT += dt; this.pt += dt
    const t = this.tactics, pace = t.pace === 'fast' ? 1.25 : t.pace === 'slow' ? 0.85 : 1
    for (const p of this.P) {
      const sp = 145 * (0.75 + p.a.pen / 400) * (0.62 + 0.38 * p.stam) * (p.team === 0 ? pace : 1)
      const dx = p.tx - p.x, dy = p.ty - p.y, d = Math.hypot(dx, dy)
      if (d > 1) { const m = Math.min(d, sp * dt); p.x += (dx / d) * m; p.y += (dy / d) * m; p.stam = Math.max(0.2, p.stam - dt * (100 - p.a.end) / 100 * 0.006 * (p.team === 0 && t.def === 'press' ? 1.25 : 1) * (p.team === 0 ? pace : 1)) }
      else p.stam = Math.min(1, p.stam + dt * 0.004)
      p.bob += dt * (d > 2 ? 14 : 4)
    }
    // defenders shadow their man (between him and the rim), tighter when pressing
    if (this.phase === 'check' || this.phase === 'play' || this.phase === 'drive' || this.phase === 'pass') {
      for (const dfd of this.team((1 - this.off) as 0 | 1)) {
        const m = this.P.find((q) => q.team === this.off && q.slot === dfd.slot)!, press = dfd.team === 0 && t.def === 'press' ? 0.16 : 0.26
        const k = m === this.handler ? press : press + 0.12
        dfd.tx = m.x + (HOOP.x - m.x) * k; dfd.ty = m.y + (HOOP.y - m.y) * k
      }
    }
    const b = this.ball, h = this.handler
    switch (this.phase) {
      case 'check':
        this.ball = { mode: 'held', x: h.x, y: h.y, z: 8, zb: 0 }
        if (this.pt > 0.45) { this.phase = 'play'; this.pt = 0; this.decisionT = 0.25 }
        break
      case 'play':
        if (this.aw) {
          if (this.now() > this.aw.deadline) this.aiTakesOver()
        } else {
          this.shotClock -= dt; this.decisionT -= dt
          for (const p of this.team(this.off)) if (p !== h && this.rnd() < dt * 0.45) { const pool = this.rnd() < (p.team === 0 && t.focus === 'in' ? 0.6 : 0.35) ? SPOTS.mid : SPOTS.out; const s = this.pick(pool); p.tx = s[0]; p.ty = s[1] }
          if (h.ty > 250) h.ty = 240
          if (this.decisionT <= 0) { this.decisionT = this.r(0.28, 0.6) * (h.team === 0 ? (t.pace === 'fast' ? 0.7 : t.pace === 'slow' ? 1.3 : 1) : 1); this.decide() }
        }
        break
      case 'drive':
        if (Math.hypot(h.x - h.tx, h.y - h.ty) < 8 || this.pt > 0.9) {
          const gd = this.guard(h)
          const stop = this.rnd() < clamp(gd.a.def / 210 - h.a.pen / 320 + (h.team === 1 && t.def === 'press' ? -0.06 : 0) + 0.12, 0.05, 0.45)
          if (stop) {
            const mate = this.pick(this.team(this.off).filter((q) => q !== h)); this.say({ k: 'kickOut', p: [this.idx(h)] })
            this.ball = { mode: 'pass', fx: h.x, fy: h.y, to: mate, from: h, steal: false, dur: 0.35, x: h.x, y: h.y, z: 10, zb: 6 }; this.phase = 'pass'; this.pt = 0
          } else this.release(h.x, h.y, true)
        }
        break
      case 'pass': {
        const k = Math.min(1, this.pt / b.dur!)
        b.x = lerp(b.fx!, b.to!.x, k); b.y = lerp(b.fy!, b.to!.y, k); b.z = 10 + Math.sin(k * Math.PI) * 10
        if (k >= 1) {
          if (b.steal) {
            const th = b.to!; th.st.stl++; b.from!.st.to++
            this.fx('st', this.idx(th))
            this.say({ k: 'steal', p: [this.idx(th)] }); this.moment('steal', [th]); this.showBanner('steal', { p: this.idx(th) }, 800)
            this.hist.push(this.score[0] - this.score[1]); this.off = th.team; this.startPossession(); this.handler = th
          } else {
            this.lastPass = { from: b.from!, to: b.to!, t: this.gameT }; this.handler = b.to!; this.ball = { mode: 'held', x: b.to!.x, y: b.to!.y, z: 8, zb: 0 }; this.phase = 'play'; this.pt = 0; this.decisionT = this.r(0.25, 0.6)
          }
        }
        break
      }
      case 'shot': {
        const k = Math.min(1, this.pt / b.dur!)
        b.x = lerp(b.fx!, b.tx!, k); b.y = lerp(b.fy!, b.ty!, k); b.z = 10 + Math.sin(k * Math.PI) * b.h! * (1 - k * 0.4); b.zb = (b.blocked ? 20 : RIM - 10) * k
        if (k >= 1) this.landed()
        break
      }
      case 'rebound': {
        const k = Math.min(1, this.pt / 0.5)
        b.x = lerp(HOOP.x, b.tx!, k); b.y = lerp(HOOP.y, b.ty!, k); b.z = Math.abs(Math.sin(k * Math.PI * 2)) * 22 * (1 - k); b.zb = b.z0! * (1 - k) * (1 - k)
        if (this.pt > 0.62) this.grabRebound()
        break
      }
      case 'celebrate':
        b.zb = Math.max(0, b.zb - dt * 110); b.z = Math.max(0, b.z - dt * 30)
        if (this.pt > this.celebrate) this.startPossession()
        break
      case 'over': {
        const wt = this.score[0] >= WIN ? 0 : 1
        for (const p of this.P) if (p.team === wt) { p.tx = 185 + Math.cos(this.gameT + p.slot * 2) * 40; p.ty = 190 + Math.sin(this.gameT * 2 + p.slot) * 20; if (p.jt <= 0 && this.rnd() < dt * 1.5) { p.jd = 0.45; p.jt = 0.45; p.jh = 14 } }
        b.zb = Math.max(0, b.zb - dt * 110)
        break
      }
    }
    if (this.ball.mode === 'held' && this.handler) { const hb = this.handler; this.ball.x = hb.x + (hb.team ? -10 : 10); this.ball.y = hb.y + 6; this.ball.z = 2 + Math.abs(Math.sin(this.gameT * 10)) * 8; this.ball.zb = 0 }
  }
  momentum() { const r = this.hist.slice(-6); return clamp(50 + (r[r.length - 1] - r[0]) * 7, 8, 92) }

  /** Play the rest of the match without drawing (for skipping to the result). */
  simulateToEnd() {
    this.auto = true
    if (this.aw) this.aiTakesOver()
    let n = 0
    while (!this.finished && n++ < 40_000) this.update(0.05)
    this.auto = false
  }
}
