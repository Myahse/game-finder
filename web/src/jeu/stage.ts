// Draws a Mode Jeu match on a canvas: a TV view (wood floor in perspective,
// crowd, hoop and net, players with bodies and their avatar as head) or a
// tactical view from above. It also owns what every phone animates by itself:
// particles, shake, the crowd, jumps, and the replay of the last basket.
import { H, HOOP, RIM, W, clamp, type Sport } from './engine'
import { NET_Y, NET_Z } from './rally'
import { sound } from './sound'

export interface ScenePlayer {
  name: string
  num: number
  team: 0 | 1
  x: number
  y: number
  bob: number
  stam: number
  st: { pts: number }
  fire: boolean
  jt: number
  jd: number
  jh: number
  jz: number
}
export interface SceneBall { x: number; y: number; z: number; zb: number; mode: string }
export interface Scene {
  P: ScenePlayer[]
  ball: SceneBall
  handler: number
  phase: string
  shotClock: number
  awaiting: boolean
  score: [number, number]
  names: [string, string]
  lane: [number, number] | null
  /** The player this phone plays or follows. */
  me: number
  /** Who controls each player ('' for the AI), shown under their feet. */
  tags: string[]
  heads: (HTMLImageElement | null)[]
  slow: number
}
type Frame = { t: number; pl: [number, number, number, number][]; b: [number, number, number, number]; bm: string; ln: [number, number, number, number] | null }
type Particle = { x: number; y: number; z: number; vx: number; vy: number; vz: number; g: number; life: number; age: number; c: string; sz: number }

const OX = 40
const TVW = W + OX * 2
const REDUCE = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
const SKIN = ['#5a3420', '#4a2a1a', '#6b3f26', '#8a5634', '#7a4a2d', '#3d2416']
const rnd = (a: number, b: number) => a + Math.random() * (b - a)
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)]
const teamCols = (t: number) => (t ? ['#2f8cff', '#ffffff', '#93c5fd'] : ['#ff5a1f', '#f2b632', '#ffffff'])

function mk(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas'); c.width = w * 2; c.height = h * 2
  const x = c.getContext('2d')!; x.scale(2, 2)
  return [c, x]
}

const NET_X: Record<string, [number, number]> = { volleyball: [26, 344], tennis: [30, 340], badminton: [46, 324] }

function lines(f: CanvasRenderingContext2D, w = 2.5) { f.strokeStyle = 'rgba(255,255,255,.92)'; f.lineWidth = w }
function brand(f: CanvasRenderingContext2D, tv: boolean, y = 300) {
  f.textAlign = 'center'
  f.fillStyle = tv ? 'rgba(255,255,255,.22)' : 'rgba(255,255,255,.14)'; f.font = '900 30px "Barlow Condensed", sans-serif'; f.fillText('OUT FOR GROUND', 185, y)
}

/** Half a football pitch, the goal at the top. */
function paintPitch(f: CanvasRenderingContext2D, tv: boolean) {
  f.fillStyle = tv ? '#3d8b3d' : '#1f4a2c'; f.fillRect(0, 0, W, H)
  for (let y = 0; y < H; y += 38) { f.fillStyle = tv ? 'rgba(255,255,255,.07)' : 'rgba(255,255,255,.03)'; if ((y / 38) % 2) f.fillRect(0, y, W, 38) }
  for (let i = 0; i < 1800; i++) { f.fillStyle = `rgba(${Math.random() < 0.5 ? '0,40,0' : '200,255,180'},${Math.random() * 0.06})`; f.fillRect(Math.random() * W, Math.random() * H, 1, 2) }
  lines(f)
  f.strokeRect(6, 4, W - 12, H - 8)
  f.strokeRect(85, 4, 200, 92); f.strokeRect(137, 4, 96, 34)
  f.fillStyle = '#fff'; f.beginPath(); f.arc(185, 70, 2.5, 0, Math.PI * 2); f.fill()
  f.beginPath(); f.arc(185, 70, 50, Math.asin(26 / 50), Math.PI - Math.asin(26 / 50)); f.stroke()
  f.beginPath(); f.arc(185, H - 4, 52, Math.PI, 0); f.stroke()
  brand(f, tv, 250)
}

/** A full volleyball, tennis or badminton court, the net across the middle. */
function paintNetCourt(f: CanvasRenderingContext2D, tv: boolean, sport: string) {
  const c = sport === 'volleyball' ? ['#2d6ea6', '#d9783c'] : sport === 'tennis' ? ['#3f7d52', '#2e5f9f'] : ['#1d3f35', '#2f7f5c']
  f.fillStyle = c[0]; f.fillRect(0, 0, W, H)
  const [x0, x1, y0, y1] = sport === 'volleyball' ? [52, 318, 12, 368] : sport === 'tennis' ? [44, 326, 8, 372] : [58, 312, 14, 366]
  f.fillStyle = c[1]; f.fillRect(x0, y0, x1 - x0, y1 - y0)
  for (let i = 0; i < 1400; i++) { f.fillStyle = `rgba(255,255,255,${Math.random() * 0.035})`; f.fillRect(Math.random() * W, Math.random() * H, 1, 1) }
  if (!tv) { f.fillStyle = 'rgba(13,17,23,.4)'; f.fillRect(0, 0, W, H) }
  lines(f, 2)
  f.strokeRect(x0, y0, x1 - x0, y1 - y0)
  const hl = (y: number, a = x0, b = x1) => { f.beginPath(); f.moveTo(a, y); f.lineTo(b, y); f.stroke() }
  const vl = (x: number, a: number, b: number) => { f.beginPath(); f.moveTo(x, a); f.lineTo(x, b); f.stroke() }
  if (sport === 'volleyball') { hl(NET_Y - 62); hl(NET_Y + 62) }
  else if (sport === 'tennis') { vl(74, y0, y1); vl(296, y0, y1); hl(NET_Y - 104, 74, 296); hl(NET_Y + 104, 74, 296); vl(185, NET_Y - 104, NET_Y + 104) }
  else { vl(72, y0, y1); vl(298, y0, y1); hl(NET_Y - 42); hl(NET_Y + 42); hl(y0 + 24); hl(y1 - 24); vl(185, y0, NET_Y - 42); vl(185, NET_Y + 42, y1) }
  hl(NET_Y, x0 - 18, x1 + 18)
  f.textAlign = 'center'; f.fillStyle = 'rgba(255,255,255,.16)'; f.font = '900 22px "Barlow Condensed", sans-serif'; f.fillText('OUT FOR GROUND', 185, y1 - 40)
}

function paintCourt(f: CanvasRenderingContext2D, wood: boolean, sport: Sport = 'basketball') {
  if (sport === 'football') return paintPitch(f, wood)
  if (sport !== 'basketball') return paintNetCourt(f, wood, sport)
  if (wood) {
    f.fillStyle = '#c4874e'; f.fillRect(0, 0, W, H)
    for (let x = 0; x < W; x += 12) { f.fillStyle = Math.random() < 0.5 ? `rgba(90,45,15,${0.04 + Math.random() * 0.07})` : `rgba(255,225,180,${0.04 + Math.random() * 0.06})`; f.fillRect(x, 0, 12, H) }
    for (let i = 0; i < 240; i++) { f.fillStyle = 'rgba(60,30,10,.16)'; f.fillRect(Math.floor(Math.random() * 31) * 12, Math.random() * H, 12, 1) }
    f.fillStyle = 'rgba(70,35,10,.25)'; for (let x = 0; x <= W; x += 12) f.fillRect(x, 0, 0.6, H)
    const gr = f.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, 'rgba(0,0,0,.18)'); gr.addColorStop(0.5, 'rgba(255,255,255,.06)'); gr.addColorStop(1, 'rgba(0,0,0,.08)'); f.fillStyle = gr; f.fillRect(0, 0, W, H)
  } else {
    const gr = f.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#2b3d52'); gr.addColorStop(1, '#22313f'); f.fillStyle = gr; f.fillRect(0, 0, W, H)
    for (let i = 0; i < 2600; i++) { f.fillStyle = `rgba(255,255,255,${Math.random() * 0.03})`; f.fillRect(Math.random() * W, Math.random() * H, 1, 1) }
  }
  f.fillStyle = wood ? 'rgba(226,86,28,.88)' : 'rgba(255,90,31,.38)'; f.fillRect(125, 0, 120, 150)
  if (wood) { f.fillStyle = 'rgba(13,17,23,.9)'; f.beginPath(); f.arc(185, H - 4, 46, Math.PI, 0); f.fill() }
  f.strokeStyle = 'rgba(255,255,255,.9)'; f.lineWidth = 3
  f.strokeRect(125, 0, 120, 150)
  f.beginPath(); f.arc(185, 150, 52, 0, Math.PI); f.stroke()
  f.setLineDash([8, 7]); f.beginPath(); f.arc(185, 150, 52, Math.PI, 0); f.stroke(); f.setLineDash([])
  f.beginPath(); f.moveTo(35, 0); f.lineTo(35, 92); f.arc(HOOP.x, HOOP.y, 160, Math.atan2(92 - 36, 35 - 185), Math.atan2(92 - 36, 335 - 185), true); f.lineTo(335, 0); f.stroke()
  f.beginPath(); f.moveTo(0, H - 4); f.lineTo(W, H - 4); f.stroke()
  f.beginPath(); f.arc(185, H - 4, 46, Math.PI, 0); f.stroke()
  f.strokeRect(1.5, 1.5, W - 3, H - 3)
  f.textAlign = 'center'
  if (wood) { f.fillStyle = '#ff5a1f'; f.font = '900 15px "Barlow Condensed", sans-serif'; f.fillText('OFG', 185, H - 12) }
  f.fillStyle = wood ? 'rgba(255,255,255,.3)' : 'rgba(255,255,255,.18)'; f.font = '900 30px "Barlow Condensed", sans-serif'; f.fillText('OUT FOR GROUND', 185, 300)
}

type Floors = { top: HTMLCanvasElement; tv: HTMLCanvasElement; crowd: HTMLCanvasElement }
const floorCache = new Map<Sport, Floors>()
/** Court drawings shared by every stage and the shot chart (drawn once per sport). */
export function courtFloors(sport: Sport = 'basketball') {
  const hit = floorCache.get(sport)
  if (hit) return hit
  const [top, tc] = mk(W, H); paintCourt(tc, false, sport)
  const [wood, wc] = mk(W, H); paintCourt(wc, true, sport)
  const [tv, tf] = mk(TVW, H)
  tf.fillStyle = '#1b130d'; tf.fillRect(0, 0, TVW, H)
  const apron = sport === 'basketball' ? ['#3a2718', '#5a3b22'] : sport === 'football' ? ['#1f4d24', '#2f6d33'] : sport === 'volleyball' ? ['#1b3f61', '#24527d'] : sport === 'tennis' ? ['#24502f', '#2f6a3e'] : ['#142d26', '#1b3d33']
  const ap = tf.createLinearGradient(0, 58, 0, H); ap.addColorStop(0, apron[0]); ap.addColorStop(1, apron[1]); tf.fillStyle = ap
  tf.beginPath(); tf.moveTo(OX + 185 - 215 * 0.66, 50); tf.lineTo(OX + 185 + 215 * 0.66, 50); tf.lineTo(OX + 185 + 215, H); tf.lineTo(OX + 185 - 215, H); tf.fill()
  for (let y = 0; y < H; y += 1) { const s = 0.66 + 0.34 * y / H; tf.drawImage(wood, 0, y * 2, W * 2, 2, OX + 185 - 185 * s, 58 + y * 0.8, W * s, 1.1) }
  const [crowd, cr] = mk(TVW, 70)
  cr.fillStyle = '#0d1117'; cr.fillRect(0, 0, TVW, 70)
  const shirts = ['#ff5a1f', '#2f8cff', '#f2b632', '#e5e7eb', '#22c55e', '#a855f7', '#ef4444', '#1f2937']
  for (let row = 0; row < 6; row++) {
    const y = 6 + row * 7.5
    cr.fillStyle = `rgba(255,255,255,${0.02 + row * 0.01})`; cr.fillRect(0, y + 5, TVW, 1)
    for (let x = (row % 2) * 3; x < TVW; x += 6 + Math.random() * 2.5) {
      if (Math.random() < 0.1) continue
      cr.globalAlpha = 0.55 + row * 0.08
      cr.fillStyle = pick(shirts); cr.fillRect(x - 2.6, y + 2, 5.2, 5)
      cr.fillStyle = pick(SKIN); cr.beginPath(); cr.arc(x, y, 2.2, 0, Math.PI * 2); cr.fill()
      cr.globalAlpha = 1
    }
  }
  const sh = cr.createLinearGradient(0, 0, 0, 52); sh.addColorStop(0, 'rgba(13,17,23,.75)'); sh.addColorStop(1, 'rgba(13,17,23,0)'); cr.fillStyle = sh; cr.fillRect(0, 0, TVW, 52)
  const out = { top, tv, crowd }
  floorCache.set(sport, out)
  return out
}

export class Stage {
  view: 'tv' | 'top' = 'tv'
  sport: Sport = 'basketball'
  private get net() { return this.sport !== 'basketball' && this.sport !== 'football' }
  private g: CanvasRenderingContext2D
  private parts: Particle[] = []
  private shake = 0
  private crowdJump = 0
  private camX = 0
  private vt = 0
  private rec: Frame[] = []
  private clip: Frame[] | null = null
  private pendingClip = 0
  private replay: { t: number; end: number } | null = null
  private autoReplay = false
  private prevBz = 9
  private lastDrib = 0
  /** Called when a replay of the last basket becomes available. */
  onClip?: () => void

  constructor(cv: HTMLCanvasElement) {
    const d = Math.min(2, window.devicePixelRatio || 1)
    cv.width = W * d; cv.height = H * d
    this.g = cv.getContext('2d')!
    this.g.setTransform(d, 0, 0, d, 0, 0)
    courtFloors()
  }

  get replaying() { return !!this.replay }
  get hasClip() { return !!this.clip && this.clip.length > 10 }
  reset() { this.parts = []; this.rec = []; this.clip = null; this.pendingClip = 0; this.replay = null; this.autoReplay = false }
  startReplay() { if (!this.clip || this.clip.length < 10 || REDUCE) return; this.replay = { t: this.clip[0].t, end: this.clip[this.clip.length - 1].t } }

  /** Effects from the match ([id, type, player, x, y, extra]); sound and particles. */
  fx(type: string, i: number, _x: number, _y: number, e: number, P: ScenePlayer[]) {
    const p = P[i]
    if (!p) return
    if (type === 'rel') {
      if (this.sport === 'basketball') { p.jd = e ? 0.55 : 0.42; p.jt = p.jd; p.jh = e ? 24 : 13 }
      else sound.play(this.sport === 'football' ? 'kick' : 'hit')
    } else if (type === 'mk') {
      const [bx, by, bz] = this.sport === 'basketball' ? [HOOP.x, HOOP.y, RIM] : this.sport === 'football' ? [HOOP.x, 16, 14] : [_x, _y, 8]
      this.burst(bx, by, bz, e === 4 ? 30 : 16, teamCols(p.team), e === 4 ? 190 : 120)
      sound.play(this.sport === 'basketball' ? 'swish' : this.sport === 'football' ? 'thud' : 'hit'); sound.play('crowd', e === 4 ? 1.6 : e === 3 ? 1.3 : 0.9)
      this.crowdJump = e === 4 ? 1.4 : 1
      if (e === 4) { this.shake = 0.5; buzz([15, 30, 15]) }
      this.pendingClip = this.vt + 0.75
    } else if (type === 'ms') sound.play(this.sport === 'basketball' ? 'clank' : 'thud')
    else if (type === 'bk') { this.shake = 0.35; buzz(20); sound.play('thud'); const q = P[e]; if (q) this.burst(q.x, q.y, 34, 10, ['#ffffff', '#c9ced6'], 90) }
    else if (type === 'st') { sound.play('whistle'); buzz(15) }
    else if (type === 'go') sound.play('whistle')
    else if (type === 'win') { this.burst(185, 190, 30, 90, ['#ff5a1f', '#f2b632', '#22c55e', '#2f8cff', '#ffffff'], 260, 200); sound.play('horn'); sound.play('crowd', 2); this.crowdJump = 2; buzz([20, 40, 20, 40, 60]); this.autoReplay = true }
  }

  private burst(x: number, y: number, z: number, n: number, colors: string[], spd = 140, grav = 260) {
    for (let i = 0; i < n; i++) { const a = rnd(0, Math.PI * 2), s = rnd(spd * 0.3, spd); this.parts.push({ x, y, z, vx: Math.cos(a) * s * 0.7, vy: Math.sin(a) * s * 0.35, vz: rnd(0.3, 1) * spd, g: grav, life: rnd(0.5, 1.1), age: 0, c: pick(colors), sz: rnd(2, 4.5) }) }
  }

  /** Advance the stage's own animation by dt (match time) and draw the scene. */
  frame(sc: Scene, dt: number, raw: number) {
    this.vt += dt
    for (const q of this.parts) { q.age += dt; q.vz -= q.g * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.z = Math.max(0, q.z + q.vz * dt); q.vx *= 0.98 }
    this.parts = this.parts.filter((q) => q.age < q.life)
    if (this.parts.length > 260) this.parts.splice(0, this.parts.length - 260)
    for (const p of sc.P) {
      if (p.jt > 0) { p.jt = Math.max(0, p.jt - dt); p.jz = Math.sin(Math.PI * (1 - p.jt / p.jd)) * p.jh } else p.jz = 0
      if (p.fire && Math.random() < dt * 14) this.parts.push({ x: p.x + rnd(-6, 6), y: p.y, z: 44, vx: rnd(-10, 10), vy: 0, vz: rnd(30, 60), g: -20, life: 0.5, age: 0, c: pick(['#ff5a1f', '#f2b632', '#ef4444']), sz: rnd(2, 4) })
    }
    this.shake = Math.max(0, this.shake - raw * 1.6); this.crowdJump = Math.max(0, this.crowdJump - raw * 0.8)

    if (dt > 0) {
      this.rec.push({ t: this.vt, pl: sc.P.map((p) => [p.x, p.y, p.jz, p.bob]), b: [sc.ball.x, sc.ball.y, sc.ball.z, sc.ball.zb], bm: sc.ball.mode, ln: this.lane(sc) })
      while (this.rec.length && this.rec[0].t < this.vt - 4.5) this.rec.shift()
    }
    if (this.pendingClip && this.vt >= this.pendingClip) {
      const from = this.pendingClip - 3.3
      this.clip = this.rec.filter((f) => f.t >= from); this.pendingClip = 0
      if (this.clip.length > 10) { this.onClip?.(); if (this.autoReplay) { this.autoReplay = false; setTimeout(() => this.startReplay(), 350) } }
    }
    let f: Frame
    if (this.replay && this.clip) {
      this.replay.t += raw * 0.4
      if (this.replay.t > this.replay.end) this.replay = null
      f = this.clip.find((x) => x.t >= (this.replay?.t ?? Infinity)) ?? this.clip[this.clip.length - 1]
    } else f = { t: this.vt, pl: sc.P.map((p) => [p.x, p.y, p.jz, p.bob]), b: [sc.ball.x, sc.ball.y, sc.ball.z, sc.ball.zb], bm: sc.ball.mode, ln: this.lane(sc) }

    // a dribble you can hear
    if (!this.replay && this.sport === 'basketball' && sc.ball.mode === 'held' && sc.phase !== 'over') { const bz = sc.ball.z; const now = performance.now(); if (this.prevBz > 3 && bz <= 3 && now - this.lastDrib > 180) { this.lastDrib = now; sound.play('dribble') } this.prevBz = bz }

    const g = this.g
    g.save()
    if (this.shake > 0 && !REDUCE) g.translate(rnd(-1, 1) * this.shake * 8, rnd(-1, 1) * this.shake * 8)
    if (this.view === 'tv') this.drawTV(sc, f); else this.drawTop(sc, f)
    g.restore()
    if (this.replay) {
      g.fillStyle = 'rgba(13,17,23,.75)'; g.beginPath(); g.roundRect(10, 10, 92, 22, 8); g.fill()
      g.fillStyle = '#ef4444'; g.beginPath(); g.arc(22, 21, 4, 0, Math.PI * 2); g.fill()
      g.fillStyle = '#fff'; g.font = '900 13px "Barlow Condensed", sans-serif'; g.textAlign = 'left'; g.fillText('REPLAY', 32, 26)
      g.strokeStyle = 'rgba(255,255,255,.8)'; g.lineWidth = 3; g.strokeRect(1.5, 1.5, W - 3, H - 3)
    } else if (sc.phase === 'play' && !sc.awaiting && !this.net) {
      g.fillStyle = 'rgba(13,17,23,.75)'; g.beginPath(); g.roundRect(W - 52, H - 30, 44, 22, 8); g.fill()
      g.fillStyle = sc.shotClock < 2.5 ? '#ef4444' : '#fff'; g.font = '900 15px "Barlow Condensed", sans-serif'; g.textAlign = 'center'
      g.fillText(String(Math.max(0, Math.ceil(sc.shotClock))), W - 30, H - 14)
    }
  }

  /** A still frame with a message (connecting, host gone…). */
  message(text: string) {
    const g = this.g
    g.drawImage(courtFloors(this.sport).top, 0, 0, W, H)
    g.fillStyle = 'rgba(13,17,23,.72)'; g.fillRect(0, 0, W, H)
    g.fillStyle = '#fff'; g.font = '900 20px "Barlow Condensed", sans-serif'; g.textAlign = 'center'; g.fillText(text.toUpperCase(), W / 2, H / 2)
  }

  private lane(sc: Scene): Frame['ln'] {
    if (!sc.lane) return null
    const a = sc.P[sc.lane[0]], b = sc.P[sc.lane[1]]
    return a && b ? [a.x, a.y, b.x, b.y] : null
  }

  private proj(x: number, y: number, z: number): [number, number, number] {
    const s = 0.66 + 0.34 * y / H
    return [185 + (x - 185) * s + this.camX, 58 + y * 0.8 - z * s, s]
  }

  private drawTV(sc: Scene, f: Frame) {
    const g = this.g, fl = courtFloors(this.sport)
    this.camX += (clamp(-(f.b[0] - 185) * 0.2, -30, 30) - this.camX) * 0.06
    g.fillStyle = '#0d1117'; g.fillRect(0, 0, W, H)
    const cj = this.crowdJump > 0 && !REDUCE ? Math.abs(Math.sin(this.vt * 18)) * this.crowdJump * 2.2 : 0
    g.drawImage(fl.crowd, -OX + this.camX * 0.6, -cj, TVW, 70)
    g.drawImage(fl.tv, -OX + this.camX, 0, TVW, H)
    // scoreboard strip along the baseline
    const lb = 44, cx = 185 + this.camX * 0.8
    g.fillStyle = '#05070a'; g.fillRect(-OX + this.camX * 0.8, lb, TVW, 13)
    g.fillStyle = '#ff5a1f'; g.font = '900 10px "Barlow Condensed", sans-serif'; g.textAlign = 'center'
    const scroll = (this.vt * 22) % 140
    for (let x = -OX - scroll; x < W + OX; x += 140) g.fillText('OUT FOR GROUND', x + this.camX * 0.8, lb + 10)
    const stx = `${sc.names[0].toUpperCase()} ${sc.score[0]} – ${sc.score[1]} ${sc.names[1].toUpperCase()}`, sw = g.measureText(stx).width + 18
    g.fillStyle = '#05070a'; g.fillRect(cx - sw / 2, lb - 1, sw, 15); g.strokeStyle = 'rgba(242,182,50,.6)'; g.lineWidth = 1; g.strokeRect(cx - sw / 2, lb - 1, sw, 15)
    g.fillStyle = '#f2b632'; g.fillText(stx, cx, lb + 10)
    let front: { y: number; f: () => void } | null = null
    if (this.sport === 'basketball') front = this.hoopTV()
    else if (this.sport === 'football') front = this.goalTV()
    else front = this.netTV()
    if (f.ln) { const a = this.proj(f.ln[0], f.ln[1], 0), b = this.proj(f.ln[2], f.ln[3], 0); g.strokeStyle = 'rgba(255,255,255,.28)'; g.setLineDash([4, 5]); g.lineWidth = 2; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); g.setLineDash([]) }
    const items: { y: number; f: () => void }[] = sc.P.map((p, i) => ({ y: f.pl[i]?.[1] ?? p.y, f: () => this.drawBody(sc, i, f.pl[i] ?? [p.x, p.y, p.jz, p.bob]) }))
    items.push({ y: f.b[1] - 0.01, f: () => this.drawBallTV(f) })
    if (front) items.push(front)
    items.sort((a, b) => a.y - b.y).forEach((o) => o.f())
    for (const q of this.parts) { const [x, y, s] = this.proj(q.x, q.y, q.z); g.globalAlpha = 1 - q.age / q.life; g.fillStyle = q.c; g.fillRect(x, y, q.sz * s, q.sz * s) }
    g.globalAlpha = 1
    const vg = g.createRadialGradient(185, 170, 60, 185, 190, 300); vg.addColorStop(0, 'rgba(255,240,220,.05)'); vg.addColorStop(1, 'rgba(0,0,0,.42)'); g.fillStyle = vg; g.fillRect(0, 0, W, H)
  }

  private hoopTV() {
    const g = this.g
    // stanchion and backboard
    const [bx, , bs] = this.proj(185, 22, 0)
    g.strokeStyle = '#2b3442'; g.lineWidth = 4; g.beginPath(); g.moveTo(bx, this.proj(185, 4, 0)[1]); g.lineTo(bx, this.proj(185, 4, 76)[1]); g.lineTo(bx, this.proj(185, 22, 76)[1]); g.stroke()
    const bt = this.proj(185, 26, 74)[1], bb = this.proj(185, 26, 44)[1], bw = 64 * bs
    g.fillStyle = 'rgba(230,240,250,.32)'; g.fillRect(bx - bw / 2, bt, bw, bb - bt)
    g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = 1.6; g.strokeRect(bx - bw / 2, bt, bw, bb - bt)
    g.strokeStyle = '#ff5a1f'; g.strokeRect(bx - 12 * bs, this.proj(185, 26, 58)[1], 24 * bs, this.proj(185, 26, 46)[1] - this.proj(185, 26, 58)[1])
    const [rx, ry, rs] = this.proj(HOOP.x, HOOP.y, RIM)
    g.strokeStyle = '#ff5a1f'; g.lineWidth = 2.6; g.beginPath(); g.ellipse(rx, ry, 11 * rs, 3.6 * rs, 0, Math.PI, Math.PI * 2); g.stroke()
    const rimFront = () => {
      g.strokeStyle = 'rgba(255,255,255,.75)'; g.lineWidth = 1
      for (let i = 0; i <= 6; i++) { const a = Math.PI * (i / 6); g.beginPath(); g.moveTo(rx - Math.cos(a) * 11 * rs, ry + Math.sin(a) * 3.6 * rs); g.lineTo(rx - Math.cos(a) * 6 * rs, ry + 13 * rs); g.stroke() }
      g.beginPath(); g.moveTo(rx - 8.5 * rs, ry + 6 * rs); g.lineTo(rx + 8.5 * rs, ry + 6 * rs); g.moveTo(rx - 6.5 * rs, ry + 11 * rs); g.lineTo(rx + 6.5 * rs, ry + 11 * rs); g.stroke()
      g.strokeStyle = '#ff5a1f'; g.lineWidth = 2.8; g.beginPath(); g.ellipse(rx, ry, 11 * rs, 3.6 * rs, 0, 0, Math.PI); g.stroke()
    }
    return { y: HOOP.y + 0.5, f: rimFront }
  }

  /** Football: the goal's posts, crossbar and net (drawn behind the players). */
  private goalTV() {
    const g = this.g, L = HOOP.x - 42, R = HOOP.x + 42, Y = 10, Z = 30
    const p = (x: number, y: number, z: number) => this.proj(x, y, z)
    g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 0.8
    for (let i = 0; i <= 12; i++) { const x = L + (R - L) * i / 12, a = p(x, Y, Z), b = p(x, 0, Z * 0.6), c = p(x, 0, 0); g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.lineTo(c[0], c[1]); g.stroke() }
    for (let k = 0; k <= 4; k++) { const z = Z * 0.6 * k / 4, a = p(L, 0, z), b = p(R, 0, z); g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke() }
    return { y: Y + 0.5, f: () => {
      g.strokeStyle = '#f5f5f5'; g.lineWidth = 3; g.lineCap = 'round'
      const a = p(L, Y, 0), b = p(L, Y, Z), c = p(R, Y, Z), d = p(R, Y, 0)
      g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.lineTo(c[0], c[1]); g.lineTo(d[0], d[1]); g.stroke()
    } }
  }

  /** Net sports: the net across the middle, sorted with the players. */
  private netTV() {
    const g = this.g, [x0, x1] = NET_X[this.sport], top = NET_Z[this.sport as keyof typeof NET_Z], bot = this.sport === 'tennis' ? 0 : top * 0.55
    return { y: NET_Y, f: () => {
      const a = this.proj(x0, NET_Y, 0), b = this.proj(x1, NET_Y, 0), at = this.proj(x0, NET_Y, top), bt = this.proj(x1, NET_Y, top), ab = this.proj(x0, NET_Y, bot), bb = this.proj(x1, NET_Y, bot)
      g.fillStyle = 'rgba(15,20,28,.35)'; g.beginPath(); g.moveTo(at[0], at[1]); g.lineTo(bt[0], bt[1]); g.lineTo(bb[0], bb[1]); g.lineTo(ab[0], ab[1]); g.fill()
      g.strokeStyle = 'rgba(255,255,255,.25)'; g.lineWidth = 0.7
      for (let x = x0; x <= x1; x += 6) { const u = this.proj(x, NET_Y, top), v = this.proj(x, NET_Y, bot); g.beginPath(); g.moveTo(u[0], u[1]); g.lineTo(v[0], v[1]); g.stroke() }
      for (let k = 1; k < 4; k++) { const z = bot + (top - bot) * k / 4, u = this.proj(x0, NET_Y, z), v = this.proj(x1, NET_Y, z); g.beginPath(); g.moveTo(u[0], u[1]); g.lineTo(v[0], v[1]); g.stroke() }
      g.strokeStyle = '#ffffff'; g.lineWidth = 2.2; g.beginPath(); g.moveTo(at[0], at[1]); g.lineTo(bt[0], bt[1]); g.stroke()
      g.strokeStyle = '#d1d5db'; g.lineWidth = 3; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(at[0], at[1] - 3); g.moveTo(b[0], b[1]); g.lineTo(bt[0], bt[1] - 3); g.stroke()
    } }
  }

  private drawBallTV(f: Frame) {
    const g = this.g, [x, y, z, zb] = f.b, [sx, sy, s] = this.proj(x, y, 0), [bx, by] = this.proj(x, y, z + zb)
    g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.ellipse(sx, sy, Math.max(2, 5.5 * s - (z + zb) * 0.02), 2 * s, 0, 0, Math.PI * 2); g.fill()
    if (f.bm === 'shot') {
      const tr = this.rec.slice(-9); g.strokeStyle = 'rgba(255,140,60,.28)'; g.lineWidth = 3 * s; g.beginPath()
      tr.forEach((r, i) => { const q = this.proj(r.b[0], r.b[1], r.b[2] + r.b[3]); if (i) g.lineTo(q[0], q[1]); else g.moveTo(q[0], q[1]) }); g.stroke()
    }
    this.ball(bx, by, 5.2 * s)
  }

  private ball(bx: number, by: number, br: number) {
    const g = this.g
    if (this.sport === 'football') {
      g.fillStyle = '#f8f8f8'; g.beginPath(); g.arc(bx, by, br, 0, Math.PI * 2); g.fill()
      g.fillStyle = '#1f2937'; g.beginPath(); g.arc(bx, by, br * 0.38, 0, Math.PI * 2); g.fill()
      for (let i = 0; i < 5; i++) { const a = i * 1.2566 - 1.57; g.beginPath(); g.arc(bx + Math.cos(a) * br * 0.86, by + Math.sin(a) * br * 0.86, br * 0.22, 0, Math.PI * 2); g.fill() }
      g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 0.6; g.beginPath(); g.arc(bx, by, br, 0, Math.PI * 2); g.stroke()
      return
    }
    if (this.sport === 'volleyball') {
      g.fillStyle = '#fafafa'; g.beginPath(); g.arc(bx, by, br, 0, Math.PI * 2); g.fill()
      g.save(); g.beginPath(); g.arc(bx, by, br, 0, Math.PI * 2); g.clip()
      g.fillStyle = '#f2c230'; g.beginPath(); g.arc(bx - br * 0.9, by - br * 0.9, br * 1.2, 0, Math.PI * 2); g.fill()
      g.fillStyle = '#2563eb'; g.beginPath(); g.arc(bx + br * 1.1, by + br * 0.6, br * 1.05, 0, Math.PI * 2); g.fill()
      g.restore()
      g.strokeStyle = 'rgba(0,0,0,.3)'; g.lineWidth = 0.6; g.beginPath(); g.arc(bx, by, br, 0, Math.PI * 2); g.stroke()
      return
    }
    if (this.sport === 'tennis') {
      const r = br * 0.62
      g.fillStyle = '#d4ef3c'; g.beginPath(); g.arc(bx, by, r, 0, Math.PI * 2); g.fill()
      g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 0.7; g.beginPath(); g.arc(bx - r * 1.2, by, r, -0.9, 0.9); g.stroke(); g.beginPath(); g.arc(bx + r * 1.2, by, r, Math.PI - 0.9, Math.PI + 0.9); g.stroke()
      return
    }
    if (this.sport === 'badminton') {
      g.fillStyle = 'rgba(245,245,245,.95)'; g.beginPath(); g.moveTo(bx - br * 0.45, by); g.lineTo(bx - br * 1.1, by - br * 1.9); g.lineTo(bx + br * 1.1, by - br * 1.9); g.lineTo(bx + br * 0.45, by); g.fill()
      g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 0.6; g.stroke()
      g.fillStyle = '#f5f0e6'; g.beginPath(); g.arc(bx, by + br * 0.2, br * 0.5, 0, Math.PI * 2); g.fill()
      return
    }
    const bg = g.createRadialGradient(bx - br * 0.3, by - br * 0.3, 1, bx, by, br); bg.addColorStop(0, '#ffb27a'); bg.addColorStop(1, '#e8541a')
    g.fillStyle = bg; g.beginPath(); g.arc(bx, by, br, 0, Math.PI * 2); g.fill()
    g.strokeStyle = 'rgba(80,25,5,.8)'; g.lineWidth = 0.9; g.beginPath(); g.moveTo(bx - br, by); g.lineTo(bx + br, by); g.moveTo(bx, by - br); g.lineTo(bx, by + br); g.stroke()
  }

  private head(sc: Scene, i: number, x: number, y: number, r: number, ring: string) {
    const g = this.g, p = sc.P[i], img = sc.heads[i]
    g.save(); g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.clip()
    g.fillStyle = p.team ? '#1d3b66' : '#6b2a10'; g.fill()
    if (img && img.complete && img.naturalWidth) g.drawImage(img, x - r, y - r, r * 2, r * 2)
    else { g.fillStyle = '#fff'; g.font = `900 ${Math.round(r * 1.1)}px "Barlow Condensed", sans-serif`; g.textAlign = 'center'; g.fillText(p.name.slice(0, 1).toUpperCase(), x, y + r * 0.38) }
    g.restore()
    g.strokeStyle = ring; g.lineWidth = 1.8; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.stroke()
  }

  private label(sc: Scene, i: number, x: number, y: number, size: number) {
    const g = this.g, p = sc.P[i], tag = sc.tags[i]
    g.font = `800 ${size}px "Barlow Condensed", sans-serif`; g.textAlign = 'center'
    const lbl = `${tag ? tag + ' · ' : ''}${p.name.toUpperCase()} ${p.st.pts}`, w = g.measureText(lbl).width + 8
    g.fillStyle = tag ? 'rgba(6,46,22,.85)' : 'rgba(13,17,23,.72)'; g.beginPath(); g.roundRect(x - w / 2, y, w, size + 3, 6); g.fill()
    g.fillStyle = p.fire ? '#f2b632' : '#fff'; g.fillText(lbl, x, y + size)
  }

  private drawBody(sc: Scene, i: number, sp: [number, number, number, number]) {
    const g = this.g, p = sc.P[i], [x, y, jz, bob] = sp, [X, Yfl, s0] = this.proj(x, y, 0), s = s0 * 1.38, Yf = Yfl - jz * s0
    const col = p.team ? '#2f8cff' : '#ff5a1f', dark = p.team ? '#1d5fb8' : '#c2410c', skin = SKIN[(p.num + p.name.length) % SKIN.length]
    const moving = Math.abs(Math.sin(bob)) > 0.01, stride = Math.sin(bob) * 4 * s
    const isMe = i === sc.me, tag = sc.tags[i], hasBall = sc.handler === i && sc.ball.mode === 'held' && !this.replay
    g.fillStyle = `rgba(0,0,0,${0.4 - Math.min(0.25, jz * 0.01)})`; g.beginPath(); g.ellipse(X, Yfl, 11 * s, 3.6 * s, 0, 0, Math.PI * 2); g.fill()
    if (isMe) { g.strokeStyle = 'rgba(242,182,50,.85)'; g.lineWidth = 2; g.beginPath(); g.ellipse(X, Yfl, 15 * s + Math.sin(this.vt * 5) * 1.5, 5 * s, 0, 0, Math.PI * 2); g.stroke() }
    else if (tag) { g.strokeStyle = 'rgba(34,197,94,.8)'; g.lineWidth = 2; g.beginPath(); g.ellipse(X, Yfl, 14 * s, 4.6 * s, 0, 0, Math.PI * 2); g.stroke() }
    const hip = Yf - 20 * s, sh = Yf - 37 * s, up = jz > 2
    g.strokeStyle = skin; g.lineCap = 'round'; g.lineWidth = 4 * s
    g.beginPath(); g.moveTo(X - 3 * s, hip); g.lineTo(X - 4 * s + (moving ? stride : 0), Yf - 2 * s); g.moveTo(X + 3 * s, hip); g.lineTo(X + 4 * s - (moving ? stride : 0), Yf - 2 * s); g.stroke()
    g.fillStyle = '#f3f1ec'; g.fillRect(X - 7 * s + (moving ? stride : 0), Yf - 3 * s, 5 * s, 3 * s); g.fillRect(X + 2 * s - (moving ? stride : 0), Yf - 3 * s, 5 * s, 3 * s)
    g.fillStyle = dark; g.beginPath(); g.roundRect(X - 7.5 * s, hip - 6 * s, 15 * s, 9 * s, 2 * s); g.fill()
    g.fillStyle = col; g.beginPath(); g.roundRect(X - 7.5 * s, sh, 15 * s, 18 * s, 3 * s); g.fill()
    g.fillStyle = '#fff'; g.font = `900 ${Math.round(9 * s)}px "Barlow Condensed", sans-serif`; g.textAlign = 'center'; g.fillText(String(p.num), X, sh + 12.5 * s)
    g.strokeStyle = skin; g.lineWidth = 3.2 * s
    g.beginPath()
    if (up) { g.moveTo(X - 7 * s, sh + 2 * s); g.lineTo(X - 6 * s, sh - 13 * s); g.moveTo(X + 7 * s, sh + 2 * s); g.lineTo(X + 6 * s, sh - 13 * s) }
    else { const sw = moving ? -stride * 0.6 : 0; g.moveTo(X - 7.5 * s, sh + 2 * s); g.lineTo(X - 9 * s + sw, sh + 15 * s); g.moveTo(X + 7.5 * s, sh + 2 * s); g.lineTo(hasBall ? X + 11 * s : X + 9 * s - sw, sh + 15 * s) }
    g.stroke()
    if (this.sport === 'tennis' || this.sport === 'badminton') {
      const sw = moving ? -stride * 0.6 : 0, hx = up ? X + 6 * s : X + 9 * s - sw, hy0 = up ? sh - 13 * s : sh + 15 * s, dir = up ? -1 : -0.6
      const rx = hx + 4 * s, ry = hy0 + dir * 9 * s, big = this.sport === 'tennis' ? 1 : 0.8
      g.strokeStyle = '#111827'; g.lineWidth = 1.6 * s; g.beginPath(); g.moveTo(hx, hy0); g.lineTo(rx, ry); g.stroke()
      g.strokeStyle = this.sport === 'tennis' ? '#f2b632' : '#e5e7eb'; g.lineWidth = 1.3 * s; g.beginPath(); g.ellipse(rx + 1.5 * s, ry + dir * 4 * s * big, 3.4 * s * big, 4.6 * s * big, 0.4, 0, Math.PI * 2); g.stroke()
    }
    const hr = 8.5 * s, hy = sh - 8 * s
    this.head(sc, i, X, hy, hr, p.fire ? '#f2b632' : col)
    if (isMe) { g.fillStyle = '#f2b632'; g.beginPath(); g.moveTo(X, hy - hr - 4); g.lineTo(X - 5, hy - hr - 11); g.lineTo(X + 5, hy - hr - 11); g.fill() }
    this.label(sc, i, X, Yfl + 5 * s, 9)
  }

  private drawTop(sc: Scene, f: Frame) {
    const g = this.g
    if (sc.slow < 1) { g.translate(HOOP.x, HOOP.y + 60); g.scale(1.07, 1.07); g.translate(-HOOP.x, -HOOP.y - 60) }
    g.drawImage(courtFloors(this.sport).top, 0, 0, W, H)
    if (this.sport === 'basketball') {
      g.fillStyle = 'rgba(255,255,255,.9)'; g.fillRect(155, 10, 60, 5)
      g.strokeStyle = '#ff5a1f'; g.lineWidth = 3.5; g.beginPath(); g.arc(HOOP.x, HOOP.y, 10, 0, Math.PI * 2); g.stroke()
      g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 1; for (let i = -2; i <= 2; i++) { g.beginPath(); g.moveTo(HOOP.x + i * 4, HOOP.y + 6); g.lineTo(HOOP.x + i * 3, HOOP.y + 16); g.stroke() }
    } else if (this.sport === 'football') {
      g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(HOOP.x - 42, 0, 84, 10)
      g.strokeStyle = '#fff'; g.lineWidth = 3; g.strokeRect(HOOP.x - 42, 0, 84, 10)
    } else {
      const [x0, x1] = NET_X[this.sport]
      g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(x0, NET_Y + 1, x1 - x0, 4)
      g.strokeStyle = '#fff'; g.lineWidth = 3; g.beginPath(); g.moveTo(x0, NET_Y); g.lineTo(x1, NET_Y); g.stroke()
      g.fillStyle = '#d1d5db'; g.beginPath(); g.arc(x0, NET_Y, 3.5, 0, Math.PI * 2); g.arc(x1, NET_Y, 3.5, 0, Math.PI * 2); g.fill()
    }
    if (f.ln) { g.strokeStyle = 'rgba(255,255,255,.18)'; g.setLineDash([4, 5]); g.lineWidth = 2; g.beginPath(); g.moveTo(f.ln[0], f.ln[1]); g.lineTo(f.ln[2], f.ln[3]); g.stroke(); g.setLineDash([]) }
    sc.P.map((_, i) => i).sort((a, b) => (f.pl[a]?.[1] ?? 0) - (f.pl[b]?.[1] ?? 0)).forEach((i) => {
      const [x, y0, jz, bob] = f.pl[i] ?? [sc.P[i].x, sc.P[i].y, 0, 0], p = sc.P[i], r = 15, y = y0 - Math.abs(Math.sin(bob)) * 2 - jz * 0.4
      if (i === sc.me) { g.strokeStyle = 'rgba(242,182,50,.7)'; g.lineWidth = 2; g.beginPath(); g.ellipse(x, y0 + 16, 19 + Math.sin(this.vt * 5) * 2, 6, 0, 0, Math.PI * 2); g.stroke() }
      g.fillStyle = 'rgba(0,0,0,.38)'; g.beginPath(); g.ellipse(x, y0 + 16, 13, 4.5, 0, 0, Math.PI * 2); g.fill()
      this.head(sc, i, x, y, r, sc.tags[i] && i !== sc.me ? '#22c55e' : p.team ? '#2f8cff' : '#ff5a1f')
      g.strokeStyle = p.stam > 0.6 ? '#22c55e' : p.stam > 0.4 ? '#f2b632' : '#ef4444'; g.lineWidth = 2; g.beginPath(); g.arc(x, y, r + 4, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * p.stam); g.stroke()
      this.label(sc, i, x, y0 + 21, 10)
      if (i === sc.me) { g.fillStyle = '#f2b632'; g.beginPath(); g.moveTo(x, y - r - 7); g.lineTo(x - 6, y - r - 15); g.lineTo(x + 6, y - r - 15); g.fill() }
    })
    const [bx, by0, bz] = f.b
    g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.ellipse(bx, by0 + 3, Math.max(2, 6 - bz * 0.04), 2.4, 0, 0, Math.PI * 2); g.fill()
    if (f.bm === 'shot') { const tr = this.rec.slice(-9); g.strokeStyle = 'rgba(255,122,47,.25)'; g.lineWidth = 3; g.beginPath(); tr.forEach((r, i) => { if (i) g.lineTo(r.b[0], r.b[1] - r.b[2]); else g.moveTo(r.b[0], r.b[1] - r.b[2]) }); g.stroke() }
    this.ball(bx, by0 - bz, 6 + bz * 0.045)
    for (const q of this.parts) { g.globalAlpha = 1 - q.age / q.life; g.fillStyle = q.c; g.fillRect(q.x, q.y - q.z * 0.5, q.sz, q.sz) }
    g.globalAlpha = 1
  }
}

function buzz(p: number | number[]) {
  try { navigator.vibrate?.(p) } catch { /* not supported */ }
}

