// Mode Jeu rally engine for net sports: volleyball, tennis, badminton. Same
// court box as the half-court engine (W × H), with the net across the middle:
// team A on the near half (y > H/2), team B on the far half. Every hit is a
// choice (power, placed or safe); errors, winners and returns come from the
// players' attributes, which come from their real games of that sport.
import {
  H, clamp, lerp, makePlayer,
  type Await, type Ball, type Banner, type Choice, type FeedLine, type Fx, type Hooks, type Moment, type RosterEntry, type SimPlayer, type Tactics,
} from './engine'

export type NetSport = 'volleyball' | 'tennis' | 'badminton'
export const NET_Y = H / 2

type Shot = 's' | 'd' | 'p' // power / placed (drop, tip) / safe (lob, clear)
/** Height of the net's top in each sport (the screens draw it). */
export const NET_Z = { volleyball: 38, tennis: 14, badminton: 26 } as const
const RULES: Record<NetSport, { win: number; flight: [number, number]; arc: number; netZ: number }> = {
  volleyball: { win: 11, flight: [0.55, 0.85], arc: 90, netZ: 38 },
  tennis: { win: 7, flight: [0.55, 0.8], arc: 34, netZ: 14 },
  badminton: { win: 11, flight: [0.45, 1.0], arc: 80, netZ: 26 },
}

export class RallyMatch {
  sport: NetSport
  P: SimPlayer[]
  score: [number, number] = [0, 0]
  /** The serving team. */
  off: 0 | 1
  handler!: SimPlayer
  phase: 'serve' | 'flight' | 'point' | 'over' | 'play' = 'serve'
  pt = 0
  shotClock = 0
  ball: Ball = { mode: 'held', x: 185, y: 340, z: 20, zb: 0 }
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
  auto = false
  private rules: (typeof RULES)[NetSport]
  private fxN = 0
  private bnN = 0
  private awQ = 0
  private aiNext = false
  private wait = 0
  private hits = 0
  private touches = 0
  private streak: [number, number] = [0, 0]
  private flight: { from: SimPlayer; shot: Shot; tx: number; ty: number; dur: number; out: 'in' | 'err' | 'winner'; fx: number; fy: number; serve: boolean; blockBy: SimPlayer | null } | null = null
  private hooks: Hooks
  private rnd: () => number

  constructor(sport: NetSport, teams: [RosterEntry[], RosterEntry[]], hooks: Hooks, rnd: () => number = Math.random) {
    this.sport = sport
    this.rules = RULES[sport]
    this.hooks = hooks
    this.rnd = rnd
    this.P = [...teams[0].map((r, i) => makePlayer(r, 0, i)), ...teams[1].map((r, i) => makePlayer(r, 1, i))]
    this.off = this.rnd() < 0.5 ? 0 : 1
    this.say({ k: 'kickoff', team: this.off })
    this.setupServe()
    this.fx('go', 0)
  }

  private r(a: number, b: number) { return a + this.rnd() * (b - a) }
  private now() { return this.hooks.now ? this.hooks.now() : performance.now() }
  team(i: 0 | 1) { return this.P.filter((p) => p.team === i) }
  idx(p: SimPlayer | undefined) { return p ? this.P.indexOf(p) : -1 }
  private say(line: FeedLine) { this.feed.unshift(line); this.feed = this.feed.slice(0, 3); this.hooks.onFeed?.() }
  private moment(k: string, p: SimPlayer[]) { this.moments.push({ k, p: p.map((x) => this.idx(x)), s: [...this.score] as [number, number], t: this.gameT }) }
  private showBanner(k: string, extra: Partial<Banner> = {}, ms = 1100) { this.bnN++; this.banner = { k, ms, n: this.bnN, ...extra }; this.hooks.onBanner?.(this.banner) }
  private fx(type: string, i: number, x = 0, y = 0, e = 0) { this.fxN++; const f: Fx = [this.fxN, type, i, Math.round(x), Math.round(y), e]; this.fxRing.push(f); if (this.fxRing.length > 8) this.fxRing.shift(); this.hooks.onFx?.(f) }

  /** Home spots: spread across each half, deeper for tennis and badminton. */
  private home(p: SimPlayer) {
    const n = this.team(p.team).length, near = p.team === 0
    const x = n === 1 ? 185 : 70 + (230 / (n - 1)) * p.slot
    const depth = this.sport === 'volleyball' ? (p.slot % 2 ? 0.55 : 0.3) : 0.8
    const y = near ? NET_Y + (H - NET_Y) * depth : NET_Y - NET_Y * depth
    return { x, y }
  }
  private setupServe() {
    this.phase = 'serve'; this.pt = 0; this.hits = 0; this.touches = 0; this.poss++
    const t = this.team(this.off)
    this.handler = t[(this.poss + t.length) % t.length]
    for (const p of this.P) { const h = this.home(p); p.tx = h.x; p.ty = h.y }
    const s = this.handler
    s.tx = this.sport === 'volleyball' ? 185 + this.r(-60, 60) : s.slot % 2 ? 250 : 120
    s.ty = s.team === 0 ? H - 10 : 10
    this.ball = { mode: 'held', x: s.tx, y: s.ty, z: 22, zb: 0 }
    this.wait = 0.7
  }

  // ── a hit ──
  /** [error, winner] chances for a hit by p (incoming quality q in 0..1, 1 = easy). */
  private odds(p: SimPlayer, shot: Shot, q: number, serve: boolean) {
    const a = p.a, agg = p.team === 0 ? this.tactics.focus : 'bal'
    const skill = (serve ? a.pen : shot === 's' ? a.tir : shot === 'd' ? a.col : a.def) / 100
    let err = shot === 's' ? 0.22 : shot === 'd' ? 0.16 : 0.07
    let win = shot === 's' ? 0.3 : shot === 'd' ? 0.2 : 0.05
    if (serve) { err = 0.1; win = 0.08 }
    err *= (1.6 - 1.2 * skill) * (1.3 - 0.3 * q) * (1.25 - 0.25 * p.stam)
    win *= (0.4 + skill * 1.1) * (0.7 + 0.3 * q)
    if (agg === 'out') { err *= 1.2; win *= 1.25 } else if (agg === 'in') { err *= 0.8; win *= 0.8 }
    if (Math.max(...this.score) >= this.rules.win - 2) err *= 1.15 - (a.men - 60) * 0.004
    return [clamp(err, 0.02, 0.6), clamp(win, 0.02, 0.6)] as const
  }
  private choices(p: SimPlayer, q: number): Choice[] {
    return (['s', 'd', 'p'] as Shot[]).map((k) => { const [e, w] = this.odds(p, k, q, false); return [k, -1, Math.round((1 - e) * 100), Math.round(w * 100)] })
  }
  private quality = 0.7
  private decide() {
    const p = this.handler, q = this.quality
    if (this.sport === 'volleyball' && this.touches < 2) return this.hit('p', true) // reception, then set: automatic
    const who = this.aiNext || this.auto ? null : this.hooks.humanFor(p)
    this.aiNext = false
    if (who) {
      this.awQ++
      this.aw = { k: this.idx(p), q: this.awQ, who, deadline: who === 'me' ? Infinity : this.now() + 7_000, list: this.choices(p, q) }
      this.hooks.onAwait?.(this.aw)
      return
    }
    let best: Shot = 'p', bv = -1
    for (const k of ['s', 'd', 'p'] as Shot[]) {
      const [e, w] = this.odds(p, k, q, false), v = (1 - e) * (0.5 + w * 1.6) - e * 0.6
      const jit = v * this.r(0.85, 1.15)
      if (jit > bv) { bv = jit; best = k }
    }
    this.hit(best, false)
  }
  choose(q: number, i: number, who: string) {
    if (!this.aw || this.aw.q !== q || this.aw.who !== who || !Number.isInteger(i) || i < 0 || i > 2) return false
    const k = (['s', 'd', 'p'] as Shot[])[i]
    this.aw = null; this.hooks.onAwait?.(null)
    this.hit(k, false)
    return true
  }
  aiTakesOver() { if (!this.aw) return; const i = this.aw.k; this.aw = null; this.hooks.onAwait?.(null); this.say({ k: 'aiPlays', p: [i] }); this.aiNext = true; this.wait = 0 }

  /** p hits: inside its own side (volleyball pass/set) or over the net. */
  private hit(shot: Shot, internal: boolean, serve = false) {
    const p = this.handler, q = this.quality
    this.hits++
    if (internal) {
      // volleyball: reception or set to a teammate near the net
      this.touches++
      const mates = this.team(p.team).filter((m) => m !== p)
      const to = mates.length ? mates.reduce((m, x) => (Math.abs(x.y - NET_Y) < Math.abs(m.y - NET_Y) ? x : m)) : p
      const ty = p.team === 0 ? NET_Y + 45 : NET_Y - 45, tx = clamp(to.x + this.r(-30, 30), 40, 330)
      const err = this.touches === 1 ? clamp(0.12 - p.a.def / 1200 + (1 - q) * 0.12, 0.02, 0.3) : clamp(0.05 - p.a.col / 2500, 0.01, 0.1)
      if (this.touches === 2) p.st.ast++
      else p.st.reb++
      this.flight = { from: p, shot, tx, ty, dur: 0.55, out: this.rnd() < err ? 'err' : 'in', fx: p.x, fy: p.y, serve: false, blockBy: null }
      to.tx = tx; to.ty = ty
      this.next = to
      this.startFlight(30 + this.rules.arc * 0.4)
      return
    }
    const [eP, wP] = serve ? this.odds(p, 'p', 1, true) : this.odds(p, shot, q, false)
    const roll = this.rnd()
    let out: 'in' | 'err' | 'winner' = roll < eP ? 'err' : roll < eP + wP ? 'winner' : 'in'
    const far = p.team === 0
    // where it lands on the other side
    const deep = shot === 'd' ? this.r(0.15, 0.35) : shot === 's' ? this.r(0.45, 0.9) : this.r(0.6, 0.95)
    const ty = far ? NET_Y - NET_Y * deep : NET_Y + (H - NET_Y) * deep
    const tx = clamp(185 + this.r(-1, 1) * (shot === 'p' ? 90 : 150), 20, 350)
    // volleyball: a block at the net can stop a smash
    let blockBy: SimPlayer | null = null
    if (this.sport === 'volleyball' && shot === 's' && out !== 'err') {
      const front = this.team((1 - p.team) as 0 | 1).reduce((m, x) => (Math.abs(x.y - NET_Y) < Math.abs(m.y - NET_Y) ? x : m))
      if (this.rnd() < clamp(0.08 + front.a.def / 700 - p.a.tir / 900, 0.03, 0.25)) { blockBy = front; out = 'winner' }
    }
    p.st.fga++
    this.touches = 0
    const [d0, d1] = this.rules.flight
    const dur = shot === 's' ? d0 : shot === 'd' ? (d0 + d1) / 2 : d1
    this.flight = { from: p, shot, tx: out === 'err' && this.rnd() < 0.5 ? clamp(tx + this.r(-1, 1) * 220, -60, 430) : tx, ty: out === 'err' ? (this.rnd() < 0.5 ? NET_Y + (far ? 6 : -6) : ty + (far ? -60 : 60)) : ty, dur: blockBy ? 0.3 : dur, out, fx: p.x, fy: p.y, serve, blockBy }
    // the receiver starts to run
    const recv = this.team((1 - p.team) as 0 | 1).reduce((m, x) => (Math.hypot(x.x - tx, x.y - ty) < Math.hypot(m.x - tx, m.y - ty) ? x : m))
    this.next = recv
    if (!blockBy) { recv.tx = tx; recv.ty = ty }
    p.stam = Math.max(0.25, p.stam - (shot === 's' ? 0.02 : 0.008) * (1.3 - p.a.end / 100))
    if (shot === 's' || serve) { p.jd = 0.45; p.jt = 0.45; p.jh = this.sport === 'volleyball' ? 26 : 10 }
    this.fx('rel', this.idx(p), p.x, p.y, shot === 's' ? 1 : 0)
    this.startFlight(shot === 's' ? this.rules.arc * 0.45 : shot === 'd' ? this.rules.arc * 0.75 : this.rules.arc)
  }
  private next: SimPlayer | null = null
  private arc = 40
  private startFlight(arc: number) {
    const f = this.flight!
    this.arc = arc
    this.phase = 'flight'; this.pt = 0
    this.ball = { mode: 'shot', x: f.fx, y: f.fy, z: 26, zb: 0, fx: f.fx, fy: f.fy, tx: f.tx, ty: f.ty, dur: f.dur }
  }
  private land() {
    const f = this.flight!, p = f.from, i = this.idx(p), other = (1 - p.team) as 0 | 1
    this.flight = null
    if (f.out === 'err') {
      p.st.to++
      this.fx('ms', i, f.tx, f.ty)
      this.say({ k: f.ty > NET_Y - 8 && f.ty < NET_Y + 8 ? 'net' : 'out', p: [i] })
      return this.point(other, null)
    }
    if (f.blockBy) {
      const b = f.blockBy; b.st.blk++; b.st.pts++
      this.fx('bk', i, f.fx, f.fy, this.idx(b))
      this.say({ k: 'block', p: [this.idx(b), i] }); this.moment('block', [b, p]); this.showBanner('block', { p: this.idx(b) }, 900)
      return this.point(other, b)
    }
    if (f.out === 'winner' && f.ty !== undefined && !this.isInternal(f)) {
      p.st.pts++; p.st.fgm++
      const ace = f.serve
      if (ace) p.st.tpm++
      if (this.sport === 'badminton' && f.shot === 's') p.st.tpm++
      this.fx('mk', i, f.tx, f.ty, ace ? 3 : f.shot === 's' ? 4 : 2)
      const k = ace ? 'ace' : f.shot === 's' ? 'smash' : f.shot === 'd' ? 'drop' : 'winner'
      this.say({ k, p: [i], s: [this.score[0] + (p.team === 0 ? 1 : 0), this.score[1] + (p.team === 1 ? 1 : 0)] })
      if (ace || f.shot === 's') { this.moment(k, [p]); this.showBanner(k, { p: i }, 900) }
      return this.point(p.team, p)
    }
    // returned: the receiver (or the setter's teammate) plays it
    const r = this.next ?? this.team(other)[0]
    if (this.isInternal(f)) {
      this.handler = r; this.quality = 0.8
    } else {
      this.handler = r
      const reach = Math.hypot(r.x - f.tx, r.y - f.ty)
      this.quality = clamp(1 - reach / 160 - (f.shot === 's' ? 0.25 : 0), 0.15, 1)
      if (this.sport === 'volleyball') this.touches = 0
    }
    this.phase = 'play'; this.pt = 0; this.wait = this.sport === 'volleyball' ? 0.08 : 0.05
  }
  private isInternal(f: { from: SimPlayer; ty: number }) { return (f.from.team === 0) === (f.ty > NET_Y) }
  private point(team: 0 | 1, by: SimPlayer | null) {
    this.score[team]++
    this.hist.push(this.score[0] - this.score[1])
    this.streak[team]++; this.streak[(1 - team) as 0 | 1] = 0
    if (by && this.streak[team] >= 4 && !by.fire) { by.fire = true; this.say({ k: 'fire', p: [this.idx(by)] }); this.moment('fire', [by]) }
    if (!by || this.streak[team] < 2) for (const p of this.team((1 - team) as 0 | 1)) p.fire = false
    this.hooks.onScore?.(team)
    if (this.score[team] >= this.rules.win) return this.finish(team, by)
    if (this.score[team] === this.rules.win - 1 && this.score[(1 - team) as 0 | 1] < this.rules.win - 1) this.showBanner('matchPoint', { team }, 900)
    this.off = team
    this.phase = 'point'; this.pt = 0
  }
  private finish(team: 0 | 1, by: SimPlayer | null) {
    this.finished = true; this.phase = 'over'; this.pt = 0
    this.say({ k: 'win', team, s: [...this.score] as [number, number] })
    const mvp = by ?? this.team(team)[0]
    this.moment('win', [mvp])
    this.fx('win', this.idx(mvp))
    this.showBanner(team === 0 ? 'win' : 'lose', { team, s: [...this.score] as [number, number] }, 2600)
    this.hooks.onFinish?.()
  }

  timeout() {
    if (this.timeoutUsed || this.finished) return false
    this.timeoutUsed = true
    this.team(0).forEach((p) => (p.stam = Math.min(1, p.stam + 0.15)))
    this.say({ k: 'timeout', team: 0 }); this.moment('timeout', [this.P[0]]); this.showBanner('timeout', { team: 0 }, 1500)
    return true
  }
  setTactic<K extends keyof Tactics>(k: K, v: Tactics[K]) { this.tactics[k] = v; this.say({ k: 'coach', team: 0, v: String(v) }) }

  update(dt: number) {
    this.gameT += dt; this.pt += dt
    const pace = this.tactics.pace === 'fast' ? 1.2 : this.tactics.pace === 'slow' ? 0.85 : 1
    for (const p of this.P) {
      const sp = (this.sport === 'volleyball' ? 120 : 170) * (0.75 + p.a.end / 400) * (0.62 + 0.38 * p.stam) * (p.team === 0 ? pace : 1)
      const dx = p.tx - p.x, dy = p.ty - p.y, d = Math.hypot(dx, dy)
      if (d > 1) { const m = Math.min(d, sp * dt); p.x += (dx / d) * m; p.y += (dy / d) * m } else p.stam = Math.min(1, p.stam + dt * 0.003)
      p.bob += dt * (d > 2 ? 14 : 4)
    }
    const b = this.ball
    switch (this.phase) {
      case 'serve': {
        const s = this.handler
        b.x = s.x + 6; b.y = s.y - 2; b.z = 22 + Math.abs(Math.sin(this.gameT * 4)) * 10
        this.wait -= dt
        if (this.wait <= 0 && Math.hypot(s.x - s.tx, s.y - s.ty) < 6) { this.quality = 1; this.hit('p', false, true) }
        break
      }
      case 'play':
        if (this.aw) { if (this.now() > this.aw.deadline) this.aiTakesOver(); break }
        this.wait -= dt
        { const h = this.handler; b.x = lerp(b.x, h.x + 6, 0.4); b.y = lerp(b.y, h.y - 2, 0.4); b.z = lerp(b.z, 26, 0.3) }
        if (this.wait <= 0) this.decide()
        break
      case 'flight': {
        const k = Math.min(1, this.pt / b.dur!)
        b.x = lerp(b.fx!, b.tx!, k); b.y = lerp(b.fy!, b.ty!, k)
        b.z = lerp(26, 6, k) + Math.sin(k * Math.PI) * this.arc
        b.zb = 0
        if (k >= 1) this.land()
        break
      }
      case 'point':
        b.z = Math.max(0, b.z - dt * 60)
        if (this.pt > 0.9) this.setupServe()
        break
      case 'over': {
        const wt = this.score[0] > this.score[1] ? 0 : 1
        for (const p of this.team(wt)) { p.tx = 185 + Math.cos(this.gameT + p.slot * 2) * 40; p.ty = (wt === 0 ? 300 : 80) + Math.sin(this.gameT * 2 + p.slot) * 16; if (p.jt <= 0 && this.rnd() < dt * 1.5) { p.jd = 0.45; p.jt = 0.45; p.jh = 14 } }
        b.z = Math.max(0, b.z - dt * 60)
        break
      }
    }
  }
  momentum() { const r = this.hist.slice(-6); return clamp(50 + (r[r.length - 1] - r[0]) * 10, 8, 92) }
  simulateToEnd() {
    this.auto = true
    if (this.aw) this.aiTakesOver()
    let n = 0
    while (!this.finished && n++ < 60_000) this.update(0.05)
    this.auto = false
  }
}

